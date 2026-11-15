"""Mine edition-bound names; model-only terms stay provisional pending semantic validation."""
import hashlib
import unicodedata


def _size(text):
    return len(text.encode('utf-16-le')) // 2


def _slice(text, start, end):
    return text.encode('utf-16-le')[start * 2:end * 2].decode('utf-16-le')


def _contains(outer, span):
    return outer['start'] <= span[0] < span[1] <= outer['end']


def _fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.casefold().replace('đ', 'd'))
                   if c.isalpha())


def _normal(text):
    return unicodedata.normalize('NFC', text).casefold()


def _binding(artifact):
    result = {}
    for locale in ['vi', 'en']:
        edition = artifact['editions'][locale]
        if hashlib.sha256(edition['text'].encode('utf-8')).hexdigest() != edition['hash']:
            raise ValueError('Glossary source text hash mismatch')
        result[locale] = {key: edition[key] for key in ['versionId', 'hash']}
    return result


def _words(text):
    words = []
    start = None
    begin = 0
    offset = 0
    for index, char in enumerate(text + ' '):
        letter = unicodedata.category(char)[0] in 'LM'
        if char in "'’" and start is not None and index + 1 < len(text):
            letter = unicodedata.category(text[index + 1])[0] in 'LM'
        if letter and start is None:
            start = offset
            begin = index
        if not letter and start is not None:
            value = text[begin:index]
            words.append({'span': [start, offset], 'text': value})
            start = None
        offset += _size(char)
    return words


def _names(text, words):
    names = []
    for i, word in enumerate(words):
        if not word['text'][0].isupper():
            continue
        for end in range(i + 1, min(i + 6, len(words))):
            before, after = words[end - 1], words[end]
            gap = _slice(text, before['span'][1], after['span'][0])
            if not after['text'][0].isupper() or not gap or not all(c.isspace() or c in '-–' for c in gap):
                break
            span = [word['span'][0], after['span'][1]]
            names.append({'span': span, 'text': _slice(text, *span)})
    return names


def _inside(group, locale, value):
    return _contains(group[locale], value['span']) and any(
        _contains(part, value['span']) for part in group.get('parts', {}).get(locale, [group[locale]]))


def _published_words(edition, fallback):
    if 'words' not in edition:
        return fallback
    result = []
    for word in edition['words']:
        value = _slice(edition['text'], word['start'], word['end'])
        if value and all(unicodedata.category(c)[0] in 'LM' or c.isspace() or c in "'’-" for c in value):
            result.append({'span': [word['start'], word['end']], 'text': value})
    return result


def _context_key(artifact, group):
    return tuple(' '.join(' '.join(_slice(artifact['editions'][l]['text'], p['start'], p['end'])
                                  for p in group.get('parts', {}).get(l, [group[l]])).split()).casefold()
                 for l in ['vi', 'en'])


# Function words and reference instructions are not stable bilingual terminology.
_STOP = set('xem see the a an in on at of for to and or is was were this that then when '
            'là và ở một có của đã với những các được ngày năm tháng'.split())


def build_glossary(artifact, structures=None):
    binding = _binding(artifact)
    structures = structures or {}
    words = {l: _words(artifact['editions'][l]['text']) for l in ['vi', 'en']}
    lexical = {l: _published_words(artifact['editions'][l], words[l]) for l in ['vi', 'en']}
    names = {l: _names(artifact['editions'][l]['text'], words[l]) for l in ['vi', 'en']}
    labels = {l: [n['label'] for n in structures.get(l, {}).get('notes', []) if n.get('label')]
              for l in ['vi', 'en']}
    observations = {}

    def labelled(left, right):
        return any(any(_contains(label, v['span']) for label in labels[l]) for l, v in [('vi', left), ('en', right)])

    def observe(left, right, group, method, anchor=None):
        if any(_normal(v['text']) in _STOP or len(_fold(v['text'])) < 3 for v in [left, right]):
            return
        key = (_normal(left['text']), _normal(right['text']))
        record = observations.setdefault(key, {'vi': left['text'], 'en': right['text'], 'evidence': []})
        evidence = {**({'anchor': anchor} if anchor else {}), 'vi': list(left['span']), 'en': list(right['span']), 'groupId': str(group['id']),
                    'observed': {'vi': left['text'], 'en': right['text']},
                    'method': method, 'caption': labelled(left, right)
                    or (group.get('section') == 'notes' and any(l not in structures for l in ['vi', 'en'])),
                    # A structure-confirmed note label inside a confident note pair is one more place the book names the entity.
                    'labelled': labelled(left, right) and group.get('section') == 'notes'
                    and group.get('score', 0) >= .5 and group.get('margin', 0) >= .03,
                    'context': hashlib.sha256(repr(_context_key(artifact, group)).encode()).hexdigest()}
        if not any(e['vi'] == evidence['vi'] and e['en'] == evidence['en'] for e in record['evidence']):
            record['evidence'].append(evidence)

    def title_before(locale, name, group):
        text = artifact['editions'][locale]['text']
        prior = [w for w in words[locale] if w['span'][1] <= name['span'][0]]
        if not prior or _slice(text, prior[-1]['span'][1], name['span'][0]) != ' ' or not _inside(group, locale, prior[-1]):
            return None
        return prior[-1]

    for group in artifact.get('groups', []):
        if group.get('aliasOrigin') or group.get('glossaryOrigin') or group.get('kind') == 'lexical':
            continue
        scoped = {l: [w for w in lexical[l] if _inside(group, l, w)] for l in ['vi', 'en']}
        proper = {l: [w for w in names[l] if _inside(group, l, w)] for l in ['vi', 'en']}
        matched_names = []
        for left in proper['vi']:
            targets = [v for v in proper['en'] if _fold(v['text']) == _fold(left['text'])]
            # Repeated occurrences inside one scope are not a disambiguated name anchor.
            if len(targets) == 1 and sum(_fold(v['text']) == _fold(left['text']) for v in proper['vi']) == 1:
                matched_names.append((left, targets[0]))
        for left, right in matched_names:
            if any(a['span'] != left['span'] and all(
                    _contains({'start': outer['span'][0], 'end': outer['span'][1]}, inner['span'])
                    for outer, inner in [(a, left), (b, right)]) for a, b in matched_names):
                continue
            observe(left, right, group, 'same-fold-name')
            # A word right before the same name in both editions is only a *title candidate*: kept with its anchor
            # for review, never accepted or applied, because adjacency does not show the words translate each other.
            before = [title_before(l, name, group) for l, name in [('vi', left), ('en', right)]]
            if all(before) and before[0]['text'][:1].islower() and before[1]['text'][:1].isupper():
                observe(before[0], before[1], group, 'title-before-name', anchor=left['text'])
        expanded = {}
        for link in group.get('links', []):
            if link.get('glossary') or link.get('score', 0) < .2:
                continue
            pair = {l: next((w for w in scoped[l] if _contains(
                {'start': w['span'][0], 'end': w['span'][1]}, link[l])), None) for l in ['vi', 'en']}
            if any(v is None for v in pair.values()):
                continue
            if pair['vi']['text'][0].isupper() != pair['en']['text'][0].isupper():
                continue
            # Multiword names only use same-fold evidence: a person cannot become a time phrase.
            if any(any(_contains({'start': n['span'][0], 'end': n['span'][1]}, pair[l]['span'])
                       for n in proper[l]) for l in ['vi', 'en']):
                continue
            key = (tuple(pair['vi']['span']), tuple(pair['en']['span']))
            if key not in expanded or link['score'] > expanded[key][0]:
                expanded[key] = (link['score'], pair)
        for (left, right), (score, pair) in expanded.items():
            row = [value for (a, _), (value, _) in expanded.items() if a == left]
            col = [value for (_, b), (value, _) in expanded.items() if b == right]
            if score == max(row) == max(col) and row.count(score) == col.count(score) == 1:
                observe(pair['vi'], pair['en'], group, 'reciprocal-word')

    partners = {l: {} for l in ['vi', 'en']}
    for key in observations:
        for index, locale in enumerate(['vi', 'en']):
            partners[locale].setdefault(key[index], set()).add(key[1 - index])
    accepted, candidates = [], []
    for key, record in sorted(observations.items()):
        seen_contexts, seen_vi, seen_en = set(), set(), set()
        for evidence in record['evidence']:
            if evidence['caption'] or evidence['context'] in seen_contexts:
                continue
            if tuple(evidence['vi']) in seen_vi or tuple(evidence['en']) in seen_en:
                continue
            seen_contexts.add(evidence['context'])
            seen_vi.add(tuple(evidence['vi'])); seen_en.add(tuple(evidence['en']))
        reasons = []
        is_title = any(e['method'] == 'title-before-name' for e in record['evidence'])
        is_name = any(e['method'] == 'same-fold-name' for e in record['evidence'])
        # Same-fold names may add confirmed note captions as extra contexts, but never stand on captions alone.
        captions = {e['context'] for e in record['evidence'] if is_name and e['caption'] and e['labelled']
                    and e['method'] == 'same-fold-name'} - seen_contexts if seen_contexts else set()
        support = len(seen_contexts) + len(captions)
        if support < 2:
            reasons.append('insufficient-independent-support')
        # Repetition of the same model's links cannot independently prove a translation.
        if not is_name or is_title:
            reasons.append('requires-semantic-validation')
        if any(len(partners[l][key[i]]) > 1 for i, l in enumerate(['vi', 'en'])):
            reasons.append('ambiguous')
        record.update(support=support, reasons=reasons, **({'captionSupport': len(captions)} if captions else {}))
        (candidates if reasons else accepted).append(record)
    return {'schema': 1, 'chapterId': artifact['chapterId'], 'sourceVersions': binding,
            'accepted': accepted, 'candidates': candidates, 'labels': labels,
            'stats': {'accepted': len(accepted), 'candidates': len(candidates),
                      'observations': sum(len(r['evidence']) for r in observations.values())}}


def merge_book_names(glossaries):
    """Promote same-fold names whose independent contexts add up across chapters.

    Returns {chapterId: [entry]} for chapters where the name is still a candidate. Each entry carries the source
    versions of every chapter it relies on, so apply_glossary can drop it when any of those chapters is republished.
    A name abstains when, anywhere in the book, either side has another partner."""
    partners = {'vi': {}, 'en': {}}
    found = {}
    for glossary in glossaries:
        for kind in ('accepted', 'candidates'):
            for record in glossary[kind]:
                if not any(e['method'] == 'same-fold-name' for e in record['evidence']):
                    continue
                key = (_normal(record['vi']), _normal(record['en']))
                partners['vi'].setdefault(key[0], set()).add(key[1])
                partners['en'].setdefault(key[1], set()).add(key[0])
                contexts = {e['context'] for e in record['evidence'] if not e['caption']} | {
                    e['context'] for e in record['evidence'] if e['caption'] and e.get('labelled')}
                found.setdefault(key, []).append((glossary, kind, record, contexts))
    result = {}
    for key, rows in found.items():
        if len(partners['vi'][key[0]]) > 1 or len(partners['en'][key[1]]) > 1:
            continue
        contexts = set().union(*(r[3] for r in rows))
        chapters = {r[0]['chapterId'] for r in rows if r[3]}
        if len(contexts) < 2 or len(chapters) < 2:
            continue
        versions = {r[0]['chapterId']: r[0]['sourceVersions'] for r in rows if r[3]}
        for glossary, kind, record, _ in rows:
            body = [e for e in record['evidence'] if not e['caption']]
            if kind != 'candidates' or not body or record['reasons'] != ['insufficient-independent-support']:
                continue
            entry = {**record, 'support': len(contexts), 'reasons': [], 'scope': 'book',
                     'evidenceVersions': versions}
            result.setdefault(glossary['chapterId'], []).append(entry)
    return result


def _occurrences(text, phrase, words):
    wanted = _normal(phrase)
    phrase_words = _words(phrase)
    count = len(phrase_words)
    result = []
    for index, word in enumerate(words):
        if index + count > len(words):
            break
        if not count or _normal(word['text']) != _normal(phrase_words[0]['text']):
            continue
        span = [word['span'][0], words[index + count - 1]['span'][1]]
        if _normal(_slice(text, *span)) == wanted:
            result.append({'span': span, 'text': _slice(text, *span)})
    return result


def apply_glossary(artifact, glossary, book_versions=None):
    if (glossary.get('schema') != 1 or glossary.get('chapterId') != artifact['chapterId']
            or glossary.get('sourceVersions') != _binding(artifact)):
        raise ValueError('Stale or incompatible glossary source binding')
    counts = {'linksAdded': 0, 'groupsAdded': 0}
    words = {l: _words(artifact['editions'][l]['text']) for l in ['vi', 'en']}
    for entry in glossary['accepted']:
        # Evidence gathered in other chapters only holds while every one of them is still the published source.
        if entry.get('scope') == 'book' and (book_versions is None or any(
                book_versions.get(chapter) != binding for chapter, binding in entry['evidenceVersions'].items())):
            counts['staleBookEntries'] = counts.get('staleBookEntries', 0) + 1
            continue
        found = {l: _occurrences(artifact['editions'][l]['text'], entry[l], words[l]) for l in ['vi', 'en']}
        for group in artifact['groups']:
            scoped = {l: [v for v in found[l] if _inside(group, l, v)] for l in ['vi', 'en']}
            if not all(len(v) == 1 for v in scoped.values()):
                continue
            anchor = {l: scoped[l][0]['span'] for l in ['vi', 'en']}
            if any(all(link[l] == anchor[l] for l in ['vi', 'en']) for link in group['links']):
                continue
            group['links'].append({**anchor, 'score': 1., 'glossary': True})
            counts['linksAdded'] += 1
        for pair in artifact.get('notePairs', []):
            if pair.get('score', 1) < .5 or pair.get('margin', 1) < .03:
                continue
            scoped = {l: [v for v in found[l] if _contains(pair[l], v['span'])] for l in ['vi', 'en']}
            if not all(len(v) == 1 for v in scoped.values()):
                continue
            anchor = {l: scoped[l][0]['span'] for l in ['vi', 'en']}
            caption_locales = [l for l in ['vi', 'en'] if any(_contains(label, anchor[l])
                               for label in glossary.get('labels', {}).get(l, []))]
            if not caption_locales or any(all(link[l] == anchor[l] for l in ['vi', 'en'])
                                         for g in artifact['groups'] for link in g['links']):
                continue
            bounds = {l: {'start': anchor[l][0], 'end': anchor[l][1]} for l in ['vi', 'en']}
            artifact['groups'].append({'id': 'glossary-' + str(len(artifact['groups'])), 'section': 'notes',
                                       'kind': 'lexical', 'glossaryOrigin': 'confirmed-note-pair',
                                       **bounds, 'parts': {l: [dict(bounds[l])] for l in ['vi', 'en']},
                                       'primary': {l: l in caption_locales for l in ['vi', 'en']},
                                       'score': 1., 'margin': 1.,
                                       'links': [{**anchor, 'score': 1., 'glossary': True}]})
            counts['linksAdded'] += 1; counts['groupsAdded'] += 1
    return counts
