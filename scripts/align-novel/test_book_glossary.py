import copy
import hashlib
import unittest

from book_glossary import apply_glossary, build_glossary, merge_book_names


def size(text):
    return len(text.encode('utf-16-le')) // 2


def fixture(rows):
    artifact = {'chapterId': 'synthetic', 'groups': [], 'editions': {}, 'notePairs': []}
    for locale, index in [('vi', 0), ('en', 1)]:
        text = '\n'.join(row[index] for row in rows)
        artifact['editions'][locale] = {'text': text, 'versionId': locale + '-version',
                                      'hash': hashlib.sha256(text.encode()).hexdigest()}
    offsets = {'vi': 0, 'en': 0}
    for index, row in enumerate(rows):
        group = {'id': str(index), 'section': 'story', 'score': .9, 'links': [], 'parts': {}}
        for locale, text in zip(['vi', 'en'], row):
            group[locale] = {'start': offsets[locale], 'end': offsets[locale] + size(text)}
            group['parts'][locale] = [dict(group[locale])]
            offsets[locale] += size(text) + 1
        artifact['groups'].append(group)
    return artifact


def link(artifact, index, vi, en, score=.9):
    group = artifact['groups'][index]
    result = {'score': score}
    for locale, term in [('vi', vi), ('en', en)]:
        text = artifact['editions'][locale]['text']
        raw = text.encode('utf-16-le')[group[locale]['start'] * 2:group[locale]['end'] * 2].decode('utf-16-le')
        start = group[locale]['start'] + size(raw[:raw.index(term)])
        result[locale] = [start, start + size(term)]
    group['links'].append(result)


class BookGlossaryTests(unittest.TestCase):
    def test_same_fold_names_need_two_independent_contexts(self):
        a = fixture([('😀 Lâm Sơn đi.', '😀 Lam Son went.'), ('Gặp Lâm Sơn ở đây.', 'Here is Lam Son.'),
                     ('Lâm Sơn về.', 'Lam Son returned.')])
        glossary = build_glossary(a)
        entry = next(e for e in glossary['accepted'] if e['vi'] == 'Lâm Sơn')
        self.assertEqual(entry['en'], 'Lam Son')
        self.assertEqual(entry['support'], 3)
        counts = apply_glossary(a, glossary)
        self.assertEqual(counts['linksAdded'], 3)
        self.assertEqual(a['groups'][0]['links'][0]['vi'], [3, 10])
        self.assertEqual(apply_glossary(a, glossary)['linksAdded'], 0)

    def test_raw_subwords_expand_to_observed_unicode_words(self):
        a = fixture([('nói chuyện ở sân.', 'a conversation outside.'),
                     ('chuyện đã xong.', 'the conversation ended.'),
                     ('nghe chuyện mới.', 'heard another conversation.')])
        link(a, 0, 'uyện', 'versation')
        link(a, 1, 'uyện', 'versation')
        link(a, 2, 'uyện', 'versation')
        g = build_glossary(a)
        entry = next(e for e in g['candidates'] if e['vi'] == 'chuyện' and e['en'] == 'conversation')
        self.assertEqual(entry['evidence'][0]['vi'], [4, 10])
        self.assertEqual(entry['evidence'][0]['en'], [2, 14])
        self.assertEqual(apply_glossary(a, g)['linksAdded'], 0)

    def test_published_compound_word_boundaries_prevent_syllable_entries(self):
        a = fixture([('có chư hầu ở đó.', 'some feudal lords there.'),
                     ('các chư hầu đi.', 'the feudal lords went.'),
                     ('gặp chư hầu khác.', 'met more feudal lords.')])
        spans = []
        for i in range(3):
            link(a, i, 'chư', 'feudal')
            link(a, i, 'hầu', 'lords')
            group = a['groups'][i]
            text = a['editions']['vi']['text']
            raw = text.encode('utf-16-le')[group['vi']['start'] * 2:group['vi']['end'] * 2].decode('utf-16-le')
            start = group['vi']['start'] + size(raw[:raw.index('chư hầu')])
            spans.append({'start': start, 'end': start + size('chư hầu')})
        a['editions']['vi']['words'] = spans
        self.assertEqual(build_glossary(a)['accepted'], [])

    def test_possessive_is_a_whole_observed_word(self):
        a = fixture([('một người ở đây.', "a person's home."),
                     ('thấy người bên kia.', "the person's name."),
                     ('có người mới.', "another person's room.")])
        for i in range(3):
            link(a, i, 'người', 'person')
        g = build_glossary(a)
        self.assertEqual(g['candidates'][0]['en'], "person's")

    def test_model_only_terms_and_name_fragments_remain_provisional(self):
        a = fixture([('một chuyện xưa.', 'an old story.'), ('chuyện đã xong.', 'the story ended.')])
        for i in range(2):
            link(a, i, 'chuyện', 'story')
        self.assertEqual(build_glossary(a)['accepted'], [])
        b = fixture([('Sinh nói.', "Du's speech."), ('Gặp Sinh.', "Du's visit."),
                     ('Nghe Sinh.', "Du's song.")])
        for i in range(3):
            link(b, i, 'Sinh', "Du's")
        self.assertEqual(build_glossary(b)['accepted'], [])

    def test_repeated_model_term_never_graduates_without_semantic_validation(self):
        a = fixture([('đúng ở đây.', 'false here.'), ('nói đúng rồi.', 'said false again.'),
                     ('thấy đúng chưa.', 'seen false yet.'), ('đúng như vậy.', 'false as before.')])
        for i in range(4):
            link(a, i, 'đúng', 'false')
        g = build_glossary(a)
        self.assertEqual(g['accepted'], [])
        self.assertEqual(g['candidates'][0]['support'], 4)
        self.assertIn('requires-semantic-validation', g['candidates'][0]['reasons'])

    def test_repeated_person_to_time_phrase_is_rejected(self):
        a = fixture([('Lâm Sơn đi.', 'In Spring he went.'), ('Gặp Lâm Sơn.', 'In Spring they met.')])
        link(a, 0, 'Lâm', 'Spring'); link(a, 1, 'Lâm', 'Spring')
        self.assertEqual(build_glossary(a)['accepted'], [])

    def test_one_occurrence_and_alias_copies_do_not_inflate_support(self):
        a = fixture([('Lâm Sơn đi.', 'Lam Son went.')])
        a['groups'].append({**copy.deepcopy(a['groups'][0]), 'id': 'alias', 'aliasOrigin': 'reference'})
        g = build_glossary(a)
        self.assertEqual(g['accepted'], [])
        self.assertEqual(g['candidates'][0]['support'], 1)

    def test_name_fragments_do_not_inherit_whole_name_support(self):
        a = fixture([('Tô Hiến Thành đi.', 'To Hien Thanh went.'),
                     ('Gặp Tô Hiến Thành.', 'Meet To Hien Thanh.'),
                     ('Tô Hiến về.', 'To Hien returned.')])
        g = build_glossary(a)
        self.assertEqual([e['vi'] for e in g['accepted']], ['Tô Hiến Thành'])
        self.assertEqual(next(e for e in g['candidates'] if e['vi'] == 'Tô Hiến')['support'], 1)

    def test_identical_text_at_new_offsets_is_not_independent(self):
        a = fixture([('Lâm Sơn đi.', 'Lam Son went.')] * 2)
        self.assertEqual(build_glossary(a)['accepted'], [])

    def test_ambiguity_in_either_direction_abstains(self):
        for rows in [[('từ chuyện.', 'a conversation.'), ('khác chuyện.', 'the story.')],
                     [('từ chuyện.', 'a conversation.'), ('khác truyện.', 'the conversation.')]]:
            a = fixture(rows)
            for i, row in enumerate(rows):
                link(a, i, row[0].split()[1].strip('.'), row[1].split()[1].strip('.'))
            g = build_glossary(a)
            self.assertEqual(g['accepted'], [])
            self.assertTrue(all('ambiguous' in e['reasons'] for e in g['candidates']))

    def test_stale_binding_and_modified_text_rejected(self):
        a = fixture([('Lâm Sơn đi.', 'Lam Son went.'), ('Gặp Lâm Sơn.', 'Meet Lam Son.')])
        g = build_glossary(a)
        for field in ['hash', 'versionId', 'text']:
            changed = copy.deepcopy(a)
            changed['editions']['vi'][field] += 'changed'
            with self.assertRaises(ValueError):
                apply_glossary(changed, g)

    def test_application_requires_exact_parts_and_whole_word_boundaries(self):
        a = fixture([('Lâm Sơn đi.', 'Lam Son went.'), ('Gặp Lâm Sơn.', 'Meet Lam Son.'),
                     ('Lâm Sơnx về.', 'Lam Son returned.')])
        g = build_glossary(a)
        a['groups'][1]['parts']['vi'] = [{'start': a['groups'][1]['vi']['start'],
                                        'end': a['groups'][1]['vi']['start'] + 3}]
        self.assertEqual(apply_glossary(a, g)['linksAdded'], 1)

    def test_caption_only_and_person_to_temporal_phrase_are_provisional(self):
        a = fixture([('Lâm Sơn', 'In Spring'), ('Lâm Sơn', 'In Spring')])
        for i in range(2):
            a['groups'][i]['section'] = 'notes'
            link(a, i, 'Lâm', 'Spring')
        structures = {l: {'notes': [{**g[l], 'id': str(i), 'label': dict(g[l])}
                                    for i, g in enumerate(a['groups'])]} for l in ['vi', 'en']}
        self.assertEqual(build_glossary(a, structures)['accepted'], [])
        b = fixture([('Xem chú thích.', 'See the note.'), ('Xem chuyện này.', 'See this story.')])
        link(b, 0, 'Xem', 'See'); link(b, 1, 'Xem', 'See')
        self.assertFalse(any(e['vi'] == 'Xem' for e in build_glossary(b)['accepted']))

    def test_notes_without_caption_metadata_cannot_supply_support(self):
        a = fixture([('Lâm Sơn', 'Lam Son'), ('Lâm Sơn đến.', 'Lam Son arrived.')])
        for group in a['groups']:
            group['section'] = 'notes'
        self.assertEqual(build_glossary(a)['accepted'], [])

    def test_relocated_name_uses_confirmed_full_note_scope(self):
        a = fixture([('Lâm Sơn đi.', 'Lam Son went.'), ('Gặp Lâm Sơn.', 'Meet Lam Son.'),
                     ('Lâm Sơn: một người.', 'A person. His name is Lam Son.')])
        note = a['groups'].pop()
        a['notePairs'] = [{l: note[l] for l in ['vi', 'en']}]
        structures = {'vi': {'notes': [{**note['vi'], 'id': '1',
                                        'label': {'start': note['vi']['start'], 'end': note['vi']['start'] + 7}}]},
                      'en': {'notes': [{**note['en'], 'id': '9'}]}}
        g = build_glossary(a, structures)
        self.assertEqual(apply_glossary(a, g)['groupsAdded'], 1)
        added = a['groups'][-1]
        self.assertEqual(added['kind'], 'lexical')
        self.assertEqual(added['parts']['vi'], [structures['vi']['notes'][0]['label']])
        b = fixture([('Lâm Sơn đi.', 'Lam Son went.'), ('Gặp Lâm Sơn.', 'Meet Lam Son.'),
                     ('Lâm Sơn: một người.', 'A person. His name is Lam Son.')])
        b['groups'].pop()
        self.assertEqual(apply_glossary(b, g)['groupsAdded'], 0)

    def caption_fixture(self, rows, notes, margin=.2):
        a = fixture(rows)
        for i in notes:
            a['groups'][i].update(section='notes', margin=margin)
        structures = {l: {'notes': [{**a['groups'][i][l], 'id': str(i), 'label': dict(a['groups'][i][l])} for i in notes]}
                      for l in ['vi', 'en']}
        return a, structures

    def test_a_confirmed_note_caption_adds_one_context_beside_a_body_context(self):
        a, structures = self.caption_fixture([('Lâm Sơn đi xa.', 'Lam Son went far.'), ('Lâm Sơn', 'Lam Son')], [1])
        g = build_glossary(a, structures)
        entry = next(e for e in g['accepted'] if e['vi'] == 'Lâm Sơn')
        self.assertEqual((entry['support'], entry['captionSupport']), (2, 1))
        self.assertEqual(apply_glossary(a, g)['linksAdded'] >= 1, True)

    def test_captions_never_stand_alone_or_when_the_note_pair_is_weak(self):
        a, structures = self.caption_fixture([('Lâm Sơn', 'Lam Son'), ('Lâm Sơn', 'Lam Son')], [0, 1])
        self.assertEqual(build_glossary(a, structures)['accepted'], [])
        b, structures = self.caption_fixture([('Lâm Sơn đi xa.', 'Lam Son went far.'), ('Lâm Sơn', 'Lam Son')], [1], margin=.01)
        g = build_glossary(b, structures)
        self.assertEqual(g['accepted'], [])
        self.assertIn('insufficient-independent-support', next(e for e in g['candidates'] if e['vi'] == 'Lâm Sơn')['reasons'])

    def test_a_caption_does_not_resolve_an_ambiguous_name(self):
        a, structures = self.caption_fixture([('Lâm Sơn đi xa.', 'Lam Son went far.'), ('Lâm Sơn', 'Lam Son'),
                                              ('Lam Sơn về.', 'Lam Son returned.')], [1])
        g = build_glossary(a, structures)
        self.assertEqual([e for e in g['accepted'] if e['en'] == 'Lam Son'], [])

    def chapters(self, rows_a, rows_b):
        a, b = fixture(rows_a), fixture(rows_b)
        a['chapterId'], b['chapterId'] = 'chapter-a', 'chapter-b'
        return a, b, build_glossary(a), build_glossary(b)

    def test_a_name_seen_once_in_two_chapters_is_promoted_with_its_evidence_binding(self):
        a, b, ga, gb = self.chapters([('Lâm Sơn đi xa.', 'Lam Son went far.')], [('Gặp Lâm Sơn.', 'Meet Lam Son.')])
        self.assertEqual((ga['accepted'], gb['accepted']), ([], []))
        promoted = merge_book_names([ga, gb])
        self.assertEqual(set(promoted), {'chapter-a', 'chapter-b'})
        entry = promoted['chapter-a'][0]
        self.assertEqual((entry['scope'], entry['support']), ('book', 2))
        self.assertEqual(set(entry['evidenceVersions']), {'chapter-a', 'chapter-b'})
        ga['accepted'] += promoted['chapter-a']
        versions = {'chapter-a': ga['sourceVersions'], 'chapter-b': gb['sourceVersions']}
        self.assertEqual(apply_glossary(a, ga, versions)['linksAdded'], 1)

    def test_book_evidence_is_dropped_when_any_supporting_chapter_is_republished(self):
        a, b, ga, gb = self.chapters([('Lâm Sơn đi xa.', 'Lam Son went far.')], [('Gặp Lâm Sơn.', 'Meet Lam Son.')])
        ga['accepted'] += merge_book_names([ga, gb])['chapter-a']
        current = {'chapter-a': ga['sourceVersions'], 'chapter-b': {**gb['sourceVersions'], 'vi': {'versionId': 'new', 'hash': '0' * 64}}}
        counts = apply_glossary(a, ga, current)
        self.assertEqual((counts['linksAdded'], counts['staleBookEntries']), (0, 1))
        self.assertEqual(apply_glossary(a, ga)['staleBookEntries'], 1)

    def test_one_chapter_a_conflicting_partner_or_a_copied_context_never_promotes(self):
        a, b, ga, gb = self.chapters([('Lâm Sơn đi xa.', 'Lam Son went far.')], [('Gặp Lâm Sơn.', 'Meet Lam Son.')])
        self.assertEqual(merge_book_names([ga]), {})
        c, d, gc, gd = self.chapters([('Lâm Sơn đi xa.', 'Lam Son went far.')], [('Gặp Lâm Sơn.', 'Meet Lam Sun.')])
        self.assertEqual(merge_book_names([gc, gd]), {})
        e, f, ge, gf = self.chapters([('Lâm Sơn đi xa.', 'Lam Son went far.')], [('Lâm Sơn đi xa.', 'Lam Son went far.')])
        self.assertEqual(merge_book_names([ge, gf]), {})

    def test_a_title_before_a_name_is_kept_as_a_candidate_with_its_anchor_and_never_applied(self):
        a = fixture([('vua Lâm Sơn đi.', 'King Lam Son went.'), ('Gặp vua Lâm Sơn.', 'Meet King Lam Son.'),
                     ('vua Lâm Sơn về.', 'King Lam Son returned.')])
        g = build_glossary(a)
        title = next(e for e in g['candidates'] if e['vi'] == 'vua' and e['en'] == 'King')
        self.assertIn('requires-semantic-validation', title['reasons'])
        self.assertEqual({e['anchor'] for e in title['evidence']}, {'Lâm Sơn'})
        self.assertFalse(any(e['vi'] == 'vua' for e in g['accepted']))
        self.assertEqual(apply_glossary(a, g)['linksAdded'], 3)

    def test_the_same_title_before_two_different_people_does_not_merge_the_people(self):
        a = fixture([('vua Lâm Sơn đi.', 'King Lam Son went.'), ('vua Hồ Quý đến.', 'King Ho Quy came.'),
                     ('Gặp Lâm Sơn.', 'Meet Lam Son.'), ('Gặp Hồ Quý.', 'Meet Ho Quy.')])
        g = build_glossary(a)
        accepted = {(e['vi'], e['en']) for e in g['accepted']}
        self.assertEqual(accepted, {('Lâm Sơn', 'Lam Son'), ('Hồ Quý', 'Ho Quy')})
        self.assertNotIn(('Lâm Sơn', 'Ho Quy'), accepted)


if __name__ == '__main__':
    unittest.main()
