"""Context-scoped alignment and same-language aliases; no corpus-specific mappings."""
import bisect,re,unicodedata
import numpy as np
import regex
from alignment import align_sequences,align_candidates
from poetry_tracks import detect_tracks,pair_tracks

def u16(text):return len(text.encode('utf-16-le'))//2
def slice16(text,start,end):return text.encode('utf-16-le')[start*2:end*2].decode('utf-16-le')
def mask_references(text):return re.sub(r'\(\d{1,3}\)',lambda m:' '*len(m.group()),text)
def contains(outer,inner):return outer['start']<=inner['start'] and inner['end']<=outer['end']
def overlap(a,b):return a['start']<b['end'] and b['start']<a['end']
def span(units):return {'start':min(u['start'] for u in units),'end':max(u['end'] for u in units)}

def join_units(units):
    result={'text':'','starts':[],'ends':[],'parts':[{'start':u['start'],'end':u['end']} for u in units]}
    for unit in sorted(units,key=lambda u:u['start']):
        if result['text']:
            result['text']+='\n';result['starts'].append(unit['start']);result['ends'].append(unit['start'])
        result['text']+=unit['text'];result['starts']+=unit['starts'];result['ends']+=unit['ends']
    return result

def split_reader_units(units,breaks):
    result=[]
    for unit in units:
        positions=[0]
        for character in unit['text']:positions.append(positions[-1]+u16(character))
        cuts=[0]+[bisect.bisect_left(unit['starts'],b) for b in breaks if unit['start']<b<unit['end']]+[positions[-1]]
        for a,b in zip(sorted(set(cuts)),sorted(set(cuts))[1:]):
            if a not in positions or b not in positions:raise ValueError('Structural break splits a Unicode character')
            if a==b:continue
            result.append({**unit,'text':unit['text'][bisect.bisect_left(positions,a):bisect.bisect_left(positions,b)],
                           'start':unit['starts'][a],'end':unit['ends'][b-1],'starts':unit['starts'][a:b],'ends':unit['ends'][a:b]})
    return result

def _normalized(values):
    values=np.asarray(values,dtype=np.float32)
    if values.ndim!=2 or not np.isfinite(values).all():raise ValueError('Invalid sentence vectors')
    return values/np.maximum(np.linalg.norm(values,axis=1,keepdims=True),1e-9)

def _best_window(query,values):
    query=query/max(float(np.linalg.norm(query)),1e-9);candidates=[]
    for size in range(1,min(3,len(values))+1):
        merged=_normalized([values[j:j+size].sum(0) for j in range(len(values)-size+1)])
        for j,value in enumerate(merged@query):
            candidate=(float(value)-.015*(size-1),-size,-j)
            candidates.append((candidate,float(value),j,size))
    if not candidates:return [],0
    _,score,start,size=max(candidates,key=lambda c:c[0])
    alternatives=[value for _,value,at,width in candidates if at+width<=start or at>=start+size]
    return list(range(start,start+size)),score-max(alternatives,default=0)

def _pairs(left,right,minimum,shared):
    pairs=align_sequences(left,right,minimum=minimum)
    used={'vi':{i for p in pairs for i in p['vi']},'en':{i for p in pairs for i in p['en']}}
    for p in pairs:p['primary']={'vi':True,'en':True}
    for p in align_candidates(left,right,minimum=.5):
        fresh={l:all(i not in used[l] for i in p[l]) for l in ['vi','en']}
        if not any(fresh.values()):continue
        if not shared and not all(fresh.values()):continue
        vi_best,vi_margin=_best_window(right[p['en']].sum(0),left)
        en_best,en_margin=_best_window(left[p['vi']].sum(0),right)
        needed=[(en_best==p['en'],en_margin)] if fresh['vi'] else []
        if fresh['en']:needed.append((vi_best==p['vi'],vi_margin))
        if not all(matches and margin>=.03 for matches,margin in needed):continue
        p['margin']=min(margin for _,margin in needed)
        p['primary']=fresh;pairs.append(p)
        for l in ['vi','en']:used[l].update(p[l])
    return pairs

def _context_units(item,locale):
    edition=item['editions'][locale];structure=item['structures'][locale]
    excluded=[heading['span'] for heading in structure.get('headings',[])]+list(structure.get('originals',[]))
    if structure.get('original'):excluded.append(structure['original'])
    notes={str(n['id']):n for n in structure.get('notes',[])};result=[]
    for raw in item['units'][locale]:
        if raw.get('section') not in ['story','critique','notes'] or not 0<=raw['start']<raw['end']<=u16(edition['text']):raise ValueError('Invalid context unit')
        size=u16(raw['text'])
        if len(raw['starts'])!=size or len(raw['ends'])!=size or any(not raw['start']<=a<b<=raw['end'] for a,b in zip(raw['starts'],raw['ends'])) or any(values!=sorted(values) for values in [raw['starts'],raw['ends']]):raise ValueError('Invalid Reader offset map')
        if any(overlap(raw,p) for p in excluded):continue
        unit={**raw,'text':mask_references(raw['text'])}
        unit['semanticText']=reference_context(item,locale,raw['text'],notes.get(str(raw.get('noteId'))))
        if not any(c.isalnum() for c in unit['text']):continue
        if unit['section']=='notes':
            note=notes.get(str(unit.get('noteId')))
            if not note or not contains(note,unit):raise ValueError('Word unit escapes its note scope')
        result.append(unit)
    return sorted(result,key=lambda u:u['start'])


def reference_context(item,locale,text,note=None):
    """Resolve only local references, with independent traversal and text budgets."""
    notes={str(n['id']):n for n in item['structures'][locale].get('notes',[])}
    visited={str(note['id'])} if note else set();parts=[];remaining=2048
    def visit(value,owner,depth):
        nonlocal remaining
        if depth>=3 or remaining<=0:return
        references=re.findall(r'\((\d{1,3})\)',value)
        if owner and owner.get('reference') is not None:references.append(str(owner['reference']))
        for key in dict.fromkeys(references):
            if key in visited or key not in notes or remaining<=0:continue
            visited.add(key);target=notes[key]
            if not 0<=target['start']<target['end']<=u16(item['editions'][locale]['text']):raise ValueError('Invalid referenced note scope')
            body=slice16(item['editions'][locale]['text'],target['start'],target['end'])
            addition=mask_references(body).strip()[:remaining]
            if addition:parts.append(addition);remaining-=len(addition)
            visit(body,target,depth+1)
    visit(text,note,0)
    return mask_references(text).strip()+ ('\n'+'\n'.join(parts) if parts else '')

def align_contexts(item,encode):
    if 'units' not in item or 'structures' not in item:raise ValueError('Context units and structures are required')
    units={l:_context_units(item,l) for l in ['vi','en']};groups=[];note_pairs=[]
    def fine(left,right,section):
        if not left or not right:return
        vectors=_normalized(encode([u.get('semanticText',u['text']).strip() for u in left+right]))
        if len(vectors)!=len(left)+len(right):raise ValueError('Sentence vector count mismatch')
        for pair in _pairs(vectors[:len(left)],vectors[len(left):],.5 if section=='notes' else .35,section=='story'):
            groups.append({'section':section,'score':pair['score'],'margin':pair['margin'],'primary':pair['primary'],
                           'viInput':join_units([left[i] for i in pair['vi']]),'enInput':join_units([right[i] for i in pair['en']])})
    for section in ['story','critique']:
        selected={l:[u for u in units[l] if u['section']==section] for l in ['vi','en']}
        if section=='story':
            tracks={l:detect_tracks(selected[l],item['editions'][l]) for l in ['vi','en']}
            pairs,_,_=pair_tracks(tracks['vi'],tracks['en'],encode,_normalized)
            for pair in pairs:
                groups.append({'section':section,'score':pair['score'],'margin':pair['margin'],'primary':pair['primary'],'tracks':pair['tracks'],
                               'viInput':join_units(pair['viUnits']),'enInput':join_units(pair['enUnits'])})
            # Reserve matched verse, including its rejected lines; unmatched DOM layouts retain the fallback.
            for l in ['vi','en']:
                confirmed=[pair['tracks'][l] for pair in pairs]
                selected[l]=[u for u in selected[l] if not any(contains(t,u) for t in confirmed)]
        fine(selected['vi'],selected['en'],section)
    notes={};texts={}
    for l in ['vi','en']:
        notes[l]=[];texts[l]=[]
        for note in item['structures'][l].get('notes',[]):
            if not 0<=note['start']<note['end']<=u16(item['editions'][l]['text']):raise ValueError('Invalid full note scope')
            text=reference_context(item,l,slice16(item['editions'][l]['text'],note['start'],note['end']),note)
            if any(c.isalnum() for c in text):notes[l].append(note);texts[l].append(text)
    if notes['vi'] and notes['en']:
        vectors=_normalized(encode(texts['vi']+texts['en']));left,right=vectors[:len(notes['vi'])],vectors[len(notes['vi']):]
        for pair in _pairs(left,right,.5,False):
            chosen={l:[notes[l][i] for i in pair[l]] for l in ['vi','en']}
            bounds={l:span(chosen[l]) for l in ['vi','en']}
            note_pairs.append({**bounds,'score':round(pair['score'],5),'margin':round(pair['margin'],5)})
            selected={l:[u for u in units[l] if u['section']=='notes' and str(u['noteId']) in {str(n['id']) for n in chosen[l]}] for l in ['vi','en']}
            fine(selected['vi'],selected['en'],'notes')
    return groups,note_pairs

_word_pattern=regex.compile(r"[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*")
_stop={'a','an','the','of','and','to','in','at','on','for'}
def _words(text,base=0):
    return [{'fold':unicodedata.normalize('NFC',m.group()).casefold(),'start':base+u16(text[:m.start()]),'end':base+u16(text[:m.end()])} for m in _word_pattern.finditer(text)]

def add_caption_aliases(artifact,structures):
    before=len(artifact['groups'])
    blocked={l:[] for l in ['vi','en']}
    for l in ['vi','en']:
        other='en' if l=='vi' else 'vi'
        for note in structures[l].get('notes',[]):
            if not note.get('label'):continue
            scopes=[p[other] for p in artifact.get('notePairs',[]) if contains(p[l],note)]
            targets=[n for n in structures[other].get('notes',[]) if any(contains(p,n) for p in scopes)]
            if targets and not any(n.get('label') for n in targets):blocked[l].append(note)
    clean=[]
    for original in artifact['groups']:
        g={**original,'links':list(original['links'])};discard=False
        if g['section']=='notes':
            for l in ['vi','en']:
                for note in blocked[l]:
                    label=note['label']
                    if note['start']<=g[l]['start'] and g[l]['end']<=label['end']+1:discard=True
                    g['links']=[link for link in g['links'] if not contains(label,{'start':link[l][0],'end':link[l][1]})]
        if not discard:clean.append(g)
    aliases=[];seen=set()
    for l in ['vi','en']:
        other='en' if l=='vi' else 'vi';text=artifact['editions'][l]['text']
        notes=structures[l].get('notes',[]);by_id={str(n['id']):n for n in notes}
        for note in notes:
            label=note.get('label')
            if not label:continue
            query=_words(slice16(text,label['start'],label['end']),label['start'])
            content=[w for w in query if w['fold'] not in _stop];wanted={w['fold'] for w in content}
            # shortcut: alias only short captions with unique content words; ambiguous/repeated captions abstain.
            if not 1<=len(wanted)<=6 or len(wanted)!=len(content):continue
            ref=by_id.get(str(note.get('reference')));scopes=[note]+([ref] if ref and ref is not note else [])
            for scope in scopes:
                body=_words(slice16(text,scope['start'],scope['end']),scope['start'])
                for i,word in enumerate(body):
                    if word['fold'] not in wanted:continue
                    for j in range(i,min(len(body),i+len(wanted)+4)):
                        window=body[i:j+1]
                        if {w['fold'] for w in window if w['fold'] not in _stop}!=wanted:continue
                        start,end=window[0]['start'],window[-1]['end']
                        if label['start']<=start and end<=label['end']:continue
                        for g in clean:
                            if g['section']!='notes' or not contains(g[l],{'start':start,'end':end}):continue
                            copied=[]
                            for link in g['links']:
                                source=next((w for w in window if w['start']<=link[l][0] and link[l][1]<=w['end'] and w['fold'] in wanted),None)
                                header=next((w for w in query if source and w['fold']==source['fold']),None)
                                if not header or header['end']-header['start']!=source['end']-source['start']:continue
                                copied.append({**link,l:[header['start']+link[l][0]-source['start'],header['start']+link[l][1]-source['start']]})
                            key=(l,label['start'],label['end'],g[other]['start'],g[other]['end'])
                            if copied and key not in seen:
                                seen.add(key);alias={**g,'id':'alias'+str(len(aliases)),'kind':'lexical',l:dict(label),'links':copied,'primary':{l:True,other:False},'aliasOrigin':'reference' if scope is ref else 'same-note'}
                                if g.get('parts'):alias['parts']={**g['parts'],l:[dict(label)]}
                                aliases.append(alias)
                        break
    artifact['groups']=clean+aliases
    return {'removedCaptionGroups':before-len(clean),'aliases':len(aliases)}
