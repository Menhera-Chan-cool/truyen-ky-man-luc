"""Repair weak prose clauses inside existing paragraph candidates, never across poetry."""
import bisect
import re
import numpy as np


def repair_prose_groups(item,contexts,units,encode):
    from context_alignment import join_units,contains,overlap,u16,_normalized
    prose=[g for g in contexts if g['section']=='story' and not g.get('tracks')]
    if not prose:return contexts
    parents={};owners={}
    for locale in ['vi','en']:
        edition=item['editions'][locale]
        cuts=sorted(set([0,*edition.get('breaks',[]),u16(edition['text'])]))
        protected=list(item['structures'][locale].get('poems',[]))+[p[locale] for p in item.get('poemPairs',[])]
        grouped={}
        for unit in units[locale]:
            if unit['section']!='story':continue
            at=bisect.bisect_right(cuts,unit['start'])-1
            if at+1>=len(cuts):continue
            scope={'start':cuts[at],'end':cuts[at+1]}
            if not contains(scope,unit) or scope['end']-scope['start']>1024 or any(overlap(scope,p) for p in protected):continue
            grouped.setdefault(cuts[at],[]).append(unit)
        parents[locale]=grouped
        owners[locale]={(u['start'],u['end']):key for key,values in grouped.items() for u in values}

    def keys(group,locale):
        return {owners[locale][(p['start'],p['end'])] for p in group[locale+'Input']['parts'] if (p['start'],p['end']) in owners[locale]}

    edges=set();weak={'vi':set(),'en':set()}
    for group in prose:
        ids={l:keys(group,l) for l in ['vi','en']}
        edges.update((v,e) for v in ids['vi'] for e in ids['en'])
        if group['score']<.5 or group['margin']<.015 or any(len(ids[l])>1 for l in ids):
            for l in ids:weak[l].update(ids[l])
    focus={(v,e) for v,e in edges if v in weak['vi'] or e in weak['en']}
    if not focus:return contexts
    active={'vi':{v for v,_ in focus},'en':{e for _,e in focus}}
    competing={(v,e) for v,e in edges if v in active['vi'] or e in active['en']}
    inputs={l:{key:join_units(parents[l][key]) for key in sorted({p[i] for p in competing})} for i,l in enumerate(['vi','en'])}
    order=[(l,key) for l in ['vi','en'] for key in inputs[l]]
    # Encode the actual joined text; averaging isolated clause vectors loses idioms and sentence context.
    vectors=_normalized(encode([inputs[l][key]['text'].strip() for l,key in order]))
    if len(vectors)!=len(order):raise ValueError('Prose parent vector count mismatch')
    values={key:vector for key,vector in zip(order,vectors)}
    scores={(v,e):float(values['vi',v]@values['en',e]) for v,e in competing}
    accepted=[];removed={'vi':set(),'en':set()}
    for v,e in sorted(focus):
        score=scores[v,e]
        margin=score-max((s for (x,y),s in scores.items() if (x==v and y!=e) or (y==e and x!=v)),default=0)
        if score<.5 or margin<.03:continue
        accepted.append({'section':'story','score':score,'margin':margin,'primary':{'vi':True,'en':True},
                         'viInput':inputs['vi'][v],'enInput':inputs['en'][e]})
        for l,key in [('vi',v),('en',e)]:
            removed[l].update((p['start'],p['end']) for p in inputs[l][key]['parts'])
    if not accepted:return contexts
    by_span={l:{(u['start'],u['end']):u for u in units[l]} for l in ['vi','en']}
    result=[]
    for group in contexts:
        if group['section']!='story' or group.get('tracks'):
            result.append(group);continue
        remaining={l:[p for p in group[l+'Input']['parts'] if (p['start'],p['end']) not in removed[l]] for l in ['vi','en']}
        if all(remaining[l]==group[l+'Input']['parts'] for l in remaining):result.append(group)
        elif all(remaining.values()):
            result.append({**group,**{l+'Input':join_units([by_span[l][p['start'],p['end']] for p in remaining[l]]) for l in remaining}})
    return result+accepted


_TERMINAL=re.compile(r'[.!?…]["”’)»]*$')
CLAUSE_WINDOW=3;CLAUSE_PAIRS=64;RESIDUAL_FLOOR=.4
SIDES=['vi','en']


def _clause_units(inp,locale,editions):
    """Comma/sentence units of one side, each tagged with its sentence number; None when content could be skipped."""
    from context_alignment import slice16,mask_references
    parts=inp['parts']
    if len(parts)>32 or parts[-1]['end']-parts[0]['start']>1024:return None
    if any(b['start']-a['end']>3 and (editions is None or any(c.isalnum() for c in mask_references(slice16(editions[locale]['text'],a['end'],b['start'])))) for a,b in zip(parts,parts[1:])):return None
    values=[];sentence=0
    for p in parts:
        indices=[i for i,(a,b) in enumerate(zip(inp['starts'],inp['ends'])) if p['start']<=a<b<=p['end']]
        if not indices:return None
        text=slice16(inp['text'],indices[0],indices[-1]+1).strip()
        values.append({'text':text,'part':p,'sentence':sentence})
        if _TERMINAL.search(text):sentence+=1
    return values


def _atoms(units,lo,hi):
    """Complete sentences when a range holds several; otherwise its comma clauses."""
    runs=[]
    for k in range(lo,hi):
        if runs and units[runs[-1][0]]['sentence']==units[k]['sentence']:runs[-1][1]=k+1
        else:runs.append([k,k+1])
    return runs if len(runs)>1 else [[k,k+1] for k in range(lo,hi)]


def _rivals(scores,limits,pair,pairs):
    """Best disjoint rival score, plus overlapping rivals this pair could really be swapped for. An overlapping window is a
    rival only when it adds atoms no other pair holds, so borrowing a neighbour's sentence never counts against a pair."""
    i,a,j,b=pair['vi'][0],len(pair['vi']),pair['en'][0],len(pair['en'])
    held={l:{k for other in pairs if other is not pair for k in other[l]} for l in SIDES}
    apart=0.;nested=[]
    def visit(start,size,own,width,taken,score,window):
        nonlocal apart
        if (start,size)==(own,width):return
        mine,theirs=set(range(own,own+width)),set(range(start,start+size))
        if not mine&theirs:apart=max(apart,score)
        elif not (theirs-mine)&taken:nested.append((score,window))
    for a2 in range(1,limits[0]+1):
        for i2 in range(scores[a2,b].shape[0]):visit(i2,a2,i,a,held['vi'],float(scores[a2,b][i2,j]),(i2,a2,j,b))
    for b2 in range(1,limits[1]+1):
        for j2 in range(scores[a,b2].shape[1]):visit(j2,b2,j,b,held['en'],float(scores[a,b2][i,j2]),(i,a,j2,b2))
    return apart,nested


def _admit(g,units,ranges,score,margin,residual=False):
    """Append a pair unless it crosses an earlier one or the group budget is spent; return whether it was kept."""
    bounds={l:(units[l][ranges[l][0]]['part']['start'],units[l][ranges[l][1]-1]['part']['end']) for l in SIDES}
    for other in g['clausePairs']:
        old={l:(other[l][0]['start'],other[l][-1]['end']) for l in SIDES}
        if any(bounds[l][0]<old[l][1] and old[l][0]<bounds[l][1] for l in SIDES):
            inside=all(old[l][0]<=bounds[l][0] and bounds[l][1]<=old[l][1] and old[l]!=bounds[l] for l in SIDES)
            outside=all(bounds[l][0]<=old[l][0] and old[l][1]<=bounds[l][1] and old[l]!=bounds[l] for l in SIDES)
            if not (inside or outside):return False
    if len(g['clausePairs'])>=CLAUSE_PAIRS:return False
    g['clausePairs'].append({**{l:[u['part'] for u in units[l][slice(*ranges[l])]] for l in SIDES},'score':score,'margin':margin,**({'residual':True} if residual else {})});return True


def _supported(scores,limits,size,window,held,floor=.35):
    """Atom-level support for one candidate window (i,a,j,b): every atom in it prefers the counterpart window over any
    outside one, and no free atom outside it prefers this counterpart instead (no orphan left behind)."""
    own=dict(zip(SIDES,[(window[0],window[1]),(window[2],window[3])]))
    def ahead(side,k,minimum):
        other='en' if side=='vi' else 'vi';start,width=own[other]
        if side=='vi':options=[(float(scores[1,b][k,j]),j,b) for b in range(1,limits[1]+1) for j in range(scores[1,b].shape[1])]
        else:options=[(float(scores[a,1][i,k]),i,a) for a in range(1,limits[0]+1) for i in range(scores[a,1].shape[0])]
        inside=max([s for s,at,w in options if at<start+width and start<at+w],default=0.);outside=max([s for s,at,w in options if not (at<start+width and start<at+w)],default=0.)
        return inside>=minimum and inside-outside>=.03
    for side in SIDES:
        start,width=own[side]
        if not all(ahead(side,k,floor) for k in range(start,start+width)):return False
        if any(ahead(side,k,.4) for k in range(size[side]) if not start<=k<start+width and k not in held[side]):return False
    return True


def _decide(task,atoms,scores,limits,pairs):
    """Confident pairs of one task. A pair tied with an overlapping window it could be swapped for keeps the one window
    whose atoms all find their own partner inside it (the largest when valid windows nest); otherwise it abstains.
    Inside an accepted parent, atoms left between confident pairs may pair by elimination at a lower floor (flagged)."""
    def ranges(i,a,j,b):return {'vi':(atoms['vi'][i][0],atoms['vi'][i+a-1][1]),'en':(atoms['en'][j][0],atoms['en'][j+b-1][1])}
    def inside(x,y):return x[0]<=y[0] and y[0]+y[1]<=x[0]+x[1] and x[2]<=y[2] and y[2]+y[3]<=x[2]+x[3]
    size={l:len(atoms[l]) for l in SIDES};found=[]
    for pair in pairs:
        if pair['score']<.5:continue
        apart,nested=_rivals(scores,limits,pair,pairs)
        if pair['score']-apart<.03:continue
        window=(pair['vi'][0],len(pair['vi']),pair['en'][0],len(pair['en']));score=pair['score']
        tied=[(s,w) for s,w in nested if s>pair['score']-.03]
        if tied:
            held={l:{k for other in pairs if other is not pair for k in other[l]} for l in SIDES}
            valid=[c for c in [(pair['score'],window)]+tied if _supported(scores,limits,size,c[1],held)]
            widest=max(valid,key=lambda c:c[1][1]+c[1][3],default=None)
            if not widest or any(not inside(widest[1],c[1]) for c in valid):continue
            score,window=widest
        mine=ranges(*window)
        if not task['root'] and any(mine[l]==task[l] for l in SIDES):continue
        found.append({'ranges':mine,'score':score,'margin':pair['score']-apart,'window':window})
    if not found:return found
    anchors=sorted(found,key=lambda f:f['window'][0]);cuts=[(0,0)]+[(f['window'][0]+f['window'][1],f['window'][2]+f['window'][3]) for f in anchors]
    starts=[(f['window'][0],f['window'][2]) for f in anchors]+[(size['vi'],size['en'])]
    for (i0,j0),(i1,j1) in zip(cuts,starts):
        a,b=i1-i0,j1-j0
        if not (1<=a<=limits[0] and 1<=b<=limits[1]) or (a,b)==(size['vi'],size['en']):continue
        score=float(scores[a,b][i0,j0])
        if score<RESIDUAL_FLOOR:continue
        trial={'vi':list(range(i0,i1)),'en':list(range(j0,j1)),'score':score}
        apart,nested=_rivals(scores,limits,trial,[*pairs,trial])
        if score-apart<.03 or any(s>score-.03 for s,_ in nested):continue
        mine=ranges(i0,a,j0,b)
        if any(mine[l]==task[l] for l in SIDES):continue
        found.append({'ranges':mine,'score':score,'margin':score-apart,'window':(i0,a,j0,b),'residual':True})
    return found


def add_clause_pairs(contexts,encode,editions=None):
    """Hierarchical sentence → clause pairs inside prose groups; poetry and notes keep their own paths.
    Each level aligns whole sentences first, then splits only an accepted pair into finer, strictly nested pairs."""
    from alignment import align_sequences
    from context_alignment import _normalized
    tasks=[]
    for g in contexts:
        if g['section'] not in ['story','critique'] or 'tracks' in g:continue
        units={l:_clause_units(g[l+'Input'],l,editions) for l in SIDES}
        if not all(units.values()) or (len(units['vi'])==len(units['en'])==1):continue
        g['clausePairs']=[];tasks.append({'g':g,'units':units,'vi':(0,len(units['vi'])),'en':(0,len(units['en'])),'root':True})
    for _ in range(6):
        prepared=[];texts=set()
        for task in tasks:
            units=task['units'];atoms={l:_atoms(units[l],*task[l]) for l in SIDES}
            if len(atoms['vi'])==len(atoms['en'])==1 or (not task['root'] and 1 in map(len,atoms.values())):continue
            # A non-root task is already a pair: its own full window is no candidate, so finer pairs can surface.
            text={l:{n:[' '.join(u['text'] for u in units[l][atoms[l][i][0]:atoms[l][i+n-1][1]]) for i in range(len(atoms[l])-n+1)] if task['root'] or n<len(atoms[l]) else None for n in range(1,min(CLAUSE_WINDOW,len(atoms[l]))+1)} for l in SIDES}
            texts.update(t for side in text.values() for values in side.values() for t in values or []);prepared.append((task,atoms,text))
        if not prepared or not texts:break
        ordered=sorted(texts);vectors=_normalized(encode(ordered))
        if len(vectors)!=len(ordered):raise ValueError('Clause vector count mismatch')
        memo=dict(zip(ordered,vectors));tasks=[]
        for task,atoms,text in prepared:
            g,units=task['g'],task['units']
            windows=[{n:np.stack([memo[t] for t in values]) if values else np.zeros((1,vectors.shape[1]),dtype=np.float32) for n,values in text[l].items()} for l in SIDES]
            limits=[max(windows[0]),max(windows[1])]
            scores={(a,b):windows[0][a]@windows[1][b].T for a in windows[0] for b in windows[1]}
            pairs=align_sequences(windows[0][1],windows[1][1],minimum=.5,windows=windows,limit=CLAUSE_WINDOW)
            for f in _decide(task,atoms,scores,limits,pairs):
                if _admit(g,units,f['ranges'],f['score'],f['margin'],f.get('residual',False)):tasks.append({'g':g,'units':units,**f['ranges'],'root':False})


PHRASE_SIZES={'en':(2,6),'vi':(1,6)};PHRASE_FLOOR=.5;PHRASE_MARGIN=.08;PHRASE_PER_PAIR=60;PHRASE_PER_GROUP=512;PHRASE_WORDS={'en':40,'vi':50}


def _phrase_windows(edition,span,locale):
    """Contiguous word windows of one side of a pair: they may cross commas, never a sentence end, a break or a note marker."""
    words=edition['words'];data=edition['_bytes'];starts=edition['_starts']
    from bisect import bisect_left
    lo=bisect_left(starts,span['start']);inside=[]
    for w in words[lo:]:
        if w['start']>=span['end']:break
        if w['end']>span['end']:continue
        before=data[max(w['start']-1,0)*2:w['start']*2].decode('utf-16-le');after=data[w['end']*2:(w['end']+1)*2].decode('utf-16-le')
        if before=='(' and after==')':continue   # the digits of a note marker are not a word
        inside.append(w)
    if not inside or len(inside)>PHRASE_WORDS[locale]:return []
    result=[]
    low,high=PHRASE_SIZES[locale]
    for i in range(len(inside)):
        for n in range(low,high+1):
            if i+n>len(inside):break
            a,b=inside[i],inside[i+n-1]
            raw=data[a['start']*2:b['end']*2].decode('utf-16-le')
            if re.search(r'[.!?;:…\n]|\(\d{1,3}\)',raw):break
            result.append({'start':a['start'],'end':b['end'],'first':i,'last':i+n-1,'text':' '.join(raw.split())})
    return result


def _finest_pairs(g):
    pairs=g.get('clausePairs')
    if pairs is None:
        whole={l:g[l] if l in g else {'start':g[l+'Input']['starts'][0],'end':g[l+'Input']['ends'][-1]} for l in ['vi','en']}
        return [{l:{'start':whole[l]['start'],'end':whole[l]['end']} for l in ['vi','en']}] if g.get('section')=='story' and 'tracks' not in g and g.get('score',0)>=.5 else []
    bounds=[{l:{'start':p[l][0]['start'],'end':p[l][-1]['end']} for l in ['vi','en']} for p in pairs]
    def inside(a,b):return all(b[l]['start']<=a[l]['start'] and a[l]['end']<=b[l]['end'] for l in ['vi','en']) and a!=b
    return [b for b in bounds if not any(inside(c,b) for c in bounds)]


def add_phrase_pairs(groups,encode,editions):
    """Phrase pairs inside the finest trusted pairs: for each word window the best counterpart window of the same pair,
    kept only when it clearly beats every disjoint window and the counterpart's own best window overlaps the query."""
    from context_alignment import mask_references,_normalized
    prepared={}
    for l in ['vi','en']:
        e=editions[l];prepared[l]={'words':sorted(e['words'],key=lambda w:w['start']),'_bytes':e['text'].encode('utf-16-le')}
        prepared[l]['_starts']=[w['start'] for w in prepared[l]['words']]
    work=[];texts=set()
    for g in groups:
        if g.get('kind')=='lexical' or 'tracks' in g or g.get('section') not in ['story','critique']:continue
        for pair in _finest_pairs(g):
            win={l:_phrase_windows(prepared[l],pair[l],l) for l in ['vi','en']}
            if not win['vi'] or not win['en']:continue
            for l in win:
                for w in win[l]:w['text']=' '.join(mask_references(w['text']).split())
            texts.update(w['text'] for l in win for w in win[l]);work.append((g,win))
    if not texts:return
    ordered=sorted(texts);vectors=_normalized(encode(ordered))
    if len(vectors)!=len(ordered):raise ValueError('Phrase vector count mismatch')
    memo=dict(zip(ordered,vectors))
    for g,win in work:
        vi,en=win['vi'],win['en']
        S=np.stack([memo[w['text']] for w in en])@np.stack([memo[w['text']] for w in vi]).T
        def overlap(items):
            first=np.array([w['first'] for w in items]);last=np.array([w['last'] for w in items])
            return (first[:,None]<=last[None,:])&(first[None,:]<=last[:,None])
        ove,ovv=overlap(en),overlap(vi);found=[]
        for source,target,matrix,ovs,ovt,side in [(en,vi,S,ove,ovv,'en'),(vi,en,S.T,ovv,ove,'vi')]:
            for i,w in enumerate(source):
                j=int(matrix[i].argmax());score=float(matrix[i,j])
                if score<PHRASE_FLOOR:continue
                rest=matrix[i][~ovt[j]];margin=score-(float(rest.max()) if rest.size else 0.)
                back=int(matrix[:,j].argmax())
                if margin<PHRASE_MARGIN or not ovs[i,back] or score<float(matrix[back,j])-.03:continue
                found.append({'vi':{'start':(w if side=='vi' else target[j])['start'],'end':(w if side=='vi' else target[j])['end']},
                              'en':{'start':(w if side=='en' else target[j])['start'],'end':(w if side=='en' else target[j])['end']},
                              'score':score,'margin':margin,'from':side})
        found.sort(key=lambda f:-f['score'])
        if found:g.setdefault('phrasePairs',[]).extend(found[:PHRASE_PER_PAIR])
    for g,_ in work:
        if 'phrasePairs' in g:g['phrasePairs']=sorted(g['phrasePairs'],key=lambda f:-f['score'])[:PHRASE_PER_GROUP]
