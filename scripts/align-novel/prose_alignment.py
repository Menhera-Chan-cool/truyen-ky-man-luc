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


CLOSE_FLOOR=.4;CLOSE_LEAD=.03


def _close(found,atoms,evidence,scores,limits,size):
    """Sentence closure. A free atom next to an accepted pair joins it when a clause of the pair's other side has this atom
    as its best partner in the whole group and prefers it to everything inside the pair: the other edition split one
    sentence in two and its second half was left behind. A longer window scores lower in LaBSE than its best half and a
    long sentence scores low against one short atom, so neither the pair score nor atom-to-atom scores can decide this;
    the evidence is clause to atom."""
    held={l:set() for l in SIDES}
    for f in found:
        i,a,j,b=f['window'];held['vi'].update(range(i,i+a));held['en'].update(range(j,j+b))
    unit,atom=evidence['unit'],evidence['atom']
    def claimed(side,k,window):
        other='en' if side=='vi' else 'vi'
        mine,theirs=((window[2],window[3]),(window[0],window[1])) if side=='en' else ((window[0],window[1]),(window[2],window[3]))
        lo,hi=atoms[other][theirs[0]][0],atoms[other][theirs[0]+theirs[1]-1][1];m0,m1=atoms[side][mine[0]][0],atoms[side][mine[0]+mine[1]-1][1]
        toward=unit[other]@atom[side][k];top=int(np.argmax(toward))
        if not lo<=top<hi or toward[top]<CLOSE_FLOOR:return False
        outside=max([float(x) for n,x in enumerate(toward) if not lo<=n<hi],default=0.)
        return toward[top]-outside>=CLOSE_LEAD and toward[top]-float((unit[side][m0:m1]@unit[other][top]).max())>=CLOSE_LEAD
    for f in sorted(found,key=lambda f:f['window'][0]):
        if f.get('residual'):continue
        grew=True
        while grew:
            grew=False;i,a,j,b=f['window']
            for side,k,grown in (('en',j-1,(i,a,j-1,b+1)),('en',j+b,(i,a,j,b+1)),('vi',i-1,(i-1,a+1,j,b)),('vi',i+a,(i,a+1,j,b))):
                if not 0<=k<size[side] or k in held[side] or grown[1]>limits[0] or grown[3]>limits[1] or not claimed(side,k,f['window']):continue
                score=float(scores[grown[1],grown[3]][grown[0],grown[2]])
                if score<.5:continue
                f.update(window=grown,score=score);held[side].add(k);grew=True;break
    return found


def _decide(task,atoms,scores,limits,pairs,evidence=None):
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
    if task['root'] and evidence:
        before={id(f):dict(f) for f in found};found=_close(found,atoms,evidence,scores,limits,size)
        for f in found:
            if f['window']==before[id(f)]['window']:continue
            i,a,j,b=f['window'];others=[{'vi':list(range(x['window'][0],x['window'][0]+x['window'][1])),'en':list(range(x['window'][2],x['window'][2]+x['window'][3])),'score':x['score']} for x in found if x is not f]
            apart,_=_rivals(scores,limits,{'vi':list(range(i,i+a)),'en':list(range(j,j+b)),'score':f['score']},others)
            if f['score']-apart<.03:f.update(before[id(f)]);continue   # a longer window that is no longer clearly ahead keeps the confident pair
            f.update(ranges=ranges(i,a,j,b),margin=f['score']-apart)
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
            texts.update(t for side in text.values() for values in side.values() for t in values or [])
            if task['root']:texts.update(u['text'] for l in SIDES for u in units[l])
            prepared.append((task,atoms,text))
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
            evidence={'atom':{'vi':windows[0][1],'en':windows[1][1]},'unit':{l:np.stack([memo[u['text']] for u in units[l]]) for l in SIDES}} if task['root'] else None
            for f in _decide(task,atoms,scores,limits,pairs,evidence):
                if _admit(g,units,f['ranges'],f['score'],f['margin'],f.get('residual',False)):tasks.append({'g':g,'units':units,**f['ranges'],'root':False})


# Measured on held-out phrase cases: every exact-window pair at score >= .65 was right; below that half were wrong, so the floor is .65.
import os as _os
PHRASE_SIZES={'en':(1,8),'vi':(1,8)};PHRASE_FLOOR=float(_os.environ.get('PHRASE_FLOOR','.65'));PHRASE_MARGIN=float(_os.environ.get('PHRASE_MARGIN','.15'));PHRASE_PER_PAIR=int(_os.environ.get('PHRASE_PER_PAIR','60'));PHRASE_PER_GROUP=int(_os.environ.get('PHRASE_PER_GROUP','512'));PHRASE_WORDS={'en':40,'vi':50};PHRASE_POS=float(_os.environ.get('PHRASE_POS','0'))


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
        # A window and its counterpart lie at about the same relative place in their clause pair: the choice of the best window (and the margin) uses the cosine minus PHRASE_POS times the distance of the two places, the stored score stays the cosine.
        def centre(items):
            total=max(w['last'] for w in items)+1
            return np.array([(w['first']+w['last']+1)/2/total for w in items])
        A=S-PHRASE_POS*np.abs(centre(en)[:,None]-centre(vi)[None,:])
        for source,target,matrix,raw,ovs,ovt,side in [(en,vi,A,S,ove,ovv,'en'),(vi,en,A.T,S.T,ovv,ove,'vi')]:
            for i,w in enumerate(source):
                j=int(matrix[i].argmax());score=float(raw[i,j]);adjusted=float(matrix[i,j])
                if score<PHRASE_FLOOR:continue
                rest=matrix[i][~ovt[j]];margin=adjusted-(float(rest.max()) if rest.size else 0.)
                back=int(matrix[:,j].argmax())
                if margin<PHRASE_MARGIN or not ovs[i,back] or adjusted<float(matrix[back,j])-.03:continue
                found.append({'vi':{'start':(w if side=='vi' else target[j])['start'],'end':(w if side=='vi' else target[j])['end']},
                              'en':{'start':(w if side=='en' else target[j])['start'],'end':(w if side=='en' else target[j])['end']},
                              'score':score,'margin':margin,'from':side})
        found.sort(key=lambda f:-f['score'])
        if found:g.setdefault('phrasePairs',[]).extend(found[:PHRASE_PER_PAIR])
    for g,_ in work:
        if 'phrasePairs' in g:g['phrasePairs']=sorted(g['phrasePairs'],key=lambda f:-f['score'])[:PHRASE_PER_GROUP]


BOUNDARY_GAIN=.10;BOUNDARY_UNITS=40


def _group_units(inp):
    """The units of one side as join_units wants them, split back out of a joined input."""
    from context_alignment import slice16
    units=[]
    for p in inp['parts']:
        found=[i for i,(a,b) in enumerate(zip(inp['starts'],inp['ends'])) if p['start']<=a<b<=p['end']]
        if not found:return None
        first,last=found[0],found[-1]+1
        units.append({'text':slice16(inp['text'],first,last),'starts':inp['starts'][first:last],'ends':inp['ends'][first:last],'start':p['start'],'end':p['end']})
    return units


def repair_boundaries(item,contexts,encode):
    """Re-split two neighbouring prose groups when a different cut of their combined units pairs both halves much better.
    The groups must touch in both editions inside one paragraph; poetry, notes and anything unproven stay untouched."""
    from context_alignment import join_units,mask_references,slice16,_normalized
    editions=item['editions']
    def clean(unit):return ' '.join(mask_references(unit['text']).split())
    def reach(g1,g2,l):
        a,b=g1[l+'Input']['parts'][-1]['end'],g2[l+'Input']['parts'][0]['start']
        gap=slice16(editions[l]['text'],a,b) if a<=b else None
        low,high=g1[l+'Input']['parts'][0]['start'],g2[l+'Input']['parts'][-1]['end']
        return gap is not None and not any(c.isalnum() for c in mask_references(gap)) and not any(low<br<high for br in editions[l].get('breaks',[]))
    for _ in range(2):
        prose=sorted([g for g in contexts if g['section']=='story' and 'tracks' not in g],key=lambda g:g['viInput']['parts'][0]['start'])
        jobs=[];texts=set()
        for g1,g2 in zip(prose,prose[1:]):
            if not (reach(g1,g2,'vi') and reach(g1,g2,'en')):continue
            parts={l:[_group_units(g1[l+'Input']),_group_units(g2[l+'Input'])] for l in ['vi','en']}
            if any(p is None for l in parts for p in parts[l]):continue
            units={l:parts[l][0]+parts[l][1] for l in parts}
            if any(len(units[l])>BOUNDARY_UNITS or len(units[l])<2 for l in units):continue
            clipped={l:[clean(u) for u in units[l]] for l in units}
            sides={l:([' '.join(clipped[l][:k]) for k in range(1,len(units[l]))],[' '.join(clipped[l][k:]) for k in range(1,len(units[l]))]) for l in units}
            texts.update(t for l in sides for part in sides[l] for t in part)
            jobs.append((g1,g2,units,sides,(len(parts['vi'][0]),len(parts['en'][0]))))
        if not jobs:break
        ordered=sorted(texts);vectors=_normalized(encode(ordered))
        if len(vectors)!=len(ordered):raise ValueError('Boundary vector count mismatch')
        memo=dict(zip(ordered,vectors));replace={};used=set()
        for g1,g2,units,sides,(p0,q0) in jobs:
            if id(g1) in used or id(g2) in used:continue
            left=np.stack([memo[t] for t in sides['vi'][0]])@np.stack([memo[t] for t in sides['en'][0]]).T
            right=np.stack([memo[t] for t in sides['vi'][1]])@np.stack([memo[t] for t in sides['en'][1]]).T
            total=left+right;p,q=(int(k)+1 for k in np.unravel_index(total.argmax(),total.shape))
            if (p,q)==(p0,q0) or total[p-1,q-1]-total[p0-1,q0-1]<BOUNDARY_GAIN or min(left[p-1,q-1],right[p-1,q-1])<.5:continue
            margin=min(g1['margin'],g2['margin'])
            replace[id(g1)]={**g1,'viInput':join_units(units['vi'][:p]),'enInput':join_units(units['en'][:q]),'score':float(left[p-1,q-1]),'margin':margin}
            replace[id(g2)]={**g2,'viInput':join_units(units['vi'][p:]),'enInput':join_units(units['en'][q:]),'score':float(right[p-1,q-1]),'margin':margin}
            used.update([id(g1),id(g2)])
        if not replace:break
        contexts=[replace.get(id(g),g) for g in contexts]
    return contexts


def _gap_units(editions,units,l,a,b,limit,section='story'):
    """The skipped units lying in one gap between two groups: real units when known, else cut from the gap text."""
    from context_alignment import mask_references,slice16,u16
    if b<=a:return None
    if units is not None:
        found=[u for u in units[l] if u.get('section','story')==section and u['start']>=a and u['end']<=b]
    else:
        gap=slice16(editions[l]['text'],a,b);found=[]
        for m in re.finditer(r'[^,;:.!?…]+[,;:.!?…]*',gap):
            lead=len(m.group())-len(m.group().lstrip());seg=m.group().strip();start=a+u16(gap[:m.start()])+u16(m.group()[:lead])
            if seg:found.append({'text':seg,'start':start,'end':start+u16(seg),'starts':list(range(start,start+u16(seg))),'ends':list(range(start+1,start+u16(seg)+1))})
    found=[u for u in found if any(c.isalnum() for c in mask_references(u['text']))]
    if not found or len(found)>limit or any(a<br<b for br in editions[l].get('breaks',[])):return None
    return found


ORPHAN_GAIN=.04;ORPHAN_UNITS=2


def adopt_orphans(item,contexts,encode,units=None,section='story'):
    """A unit that fell between two groups (the pairing skipped it) joins a neighbouring group on one side when that
    clearly improves the group's own pairing. One or two units, same paragraph, never poetry or notes."""
    from context_alignment import join_units,mask_references,slice16,u16,_normalized
    editions=item['editions']
    def clean(text):return ' '.join(mask_references(text).split())
    prose=[g for g in contexts if g['section']==section and 'tracks' not in g]
    if not prose:return contexts
    claimed=set();changed={};jobs=[]
    for l in ['vi','en']:
        ordered=sorted(prose,key=lambda g:g[l+'Input']['parts'][0]['start'])
        for k,g in enumerate(ordered):
            first,last=g[l+'Input']['parts'][0]['start'],g[l+'Input']['parts'][-1]['end']
            before=ordered[k-1][l+'Input']['parts'][-1]['end'] if k else 0
            after=ordered[k+1][l+'Input']['parts'][0]['start'] if k+1<len(ordered) else u16(editions[l]['text'])
            current=_group_units(g[l+'Input'])
            if current is None:continue
            for side,(a,b) in (('left',(before,first)),('right',(last,after))):
                found=_gap_units(editions,units,l,a,b,ORPHAN_UNITS,section)
                if found:jobs.append((g,l,side,found,current))
    if not jobs:return contexts
    texts=set()
    for g,l,side,found,current in jobs:
        other='en' if l=='vi' else 'vi'
        base=' '.join(clean(u['text']) for u in current);ext=' '.join(clean(u['text']) for u in (found+current if side=='left' else current+found))
        texts.update([base,ext,' '.join(clean(u['text']) for u in _group_units(g[other+'Input']))])
    ordered_texts=sorted(texts);vectors=_normalized(encode(ordered_texts))
    if len(vectors)!=len(ordered_texts):raise ValueError('Orphan vector count mismatch')
    memo=dict(zip(ordered_texts,vectors));scored=[]
    for g,l,side,found,current in jobs:
        other='en' if l=='vi' else 'vi';target=memo[' '.join(clean(u['text']) for u in _group_units(g[other+'Input']))]
        base=float(memo[' '.join(clean(u['text']) for u in current)]@target)
        merged=found+current if side=='left' else current+found
        grown=float(memo[' '.join(clean(u['text']) for u in merged)]@target)
        if grown>=.5 and grown-base>=ORPHAN_GAIN:scored.append((grown-base,id(g),l,side,found,merged,grown))
    result={id(g):g for g in contexts}
    for gain,gid,l,side,found,merged,grown in sorted(scored,key=lambda s:-s[0]):
        marks={(l,u['start']) for u in found}
        if marks&claimed:continue
        g=changed.get(gid,result[gid]);current=_group_units(g[l+'Input']);claimed|=marks
        changed[gid]={**g,l+'Input':join_units(found+current if side=='left' else current+found),'score':grown}
    return [changed.get(id(g),g) for g in contexts]


PLACE_FLOOR=.5;PLACE_LEAD=.05;PLACE_EDGE=5;PLACE_UNITS=6;PLACE_JOINT_UNITS=3


def _gap_runs(editions,units,l,a,b,section='story'):
    """Skipped units in one gap, cut into runs at paragraph breaks; each run says whether it touches the left or right group."""
    cuts=[a]+sorted(br for br in editions[l].get('breaks',[]) if a<br<b)+[b];runs=[]
    for lo,hi in zip(cuts,cuts[1:]):
        part=_gap_units(editions,units,l,lo,hi,10**6,section)
        if part:runs.append((part,lo==a,hi==b))
    return runs if sum(len(r[0]) for r in runs)<=PLACE_UNITS else []


def place_orphans(item,contexts,encode,units=None,section='story'):
    """Units skipped between two neighbouring groups find a home by unit-level evidence, not by the whole group (a long
    group dilutes one unit). Starting at the shared edge, a skipped unit joins the neighbour whose counterpart units near
    that edge match it (floor and lead required) and the run grows while the evidence holds; a gap skipped in both
    editions between the same two groups becomes a small group of its own."""
    from context_alignment import join_units,mask_references,_normalized
    editions=item['editions']
    def clean(text):return ' '.join(mask_references(text).split())
    prose=[g for g in contexts if g['section']==section and 'tracks' not in g]
    if len(prose)<2:return contexts
    order={l:sorted(prose,key=lambda g:g[l+'Input']['parts'][0]['start']) for l in ['vi','en']}
    rank={l:{id(g):i for i,g in enumerate(order[l])} for l in order}
    runs=[];strict={}
    for l in order:
        for g1,g2 in zip(order[l],order[l][1:]):
            a,b=g1[l+'Input']['parts'][-1]['end'],g2[l+'Input']['parts'][0]['start']
            for run,left,right in _gap_runs(editions,units,l,a,b,section):runs.append((l,run,g1,g2,left,right))
            found=_gap_units(editions,units,l,a,b,PLACE_JOINT_UNITS,section)
            if found:strict[l,id(g1),id(g2)]=(found,g1,g2)
    if not runs and not strict:return contexts
    def windows(group,l,edge):
        current=_group_units(group[l+'Input']);near=current[-PLACE_EDGE:] if edge=='end' else current[:PLACE_EDGE]
        return [' '.join(clean(u['text']) for u in near[i:j]) for i in range(len(near)) for j in range(i+1,len(near)+1)]
    texts=set();plans=[]
    for l,run,g1,g2,left,right in runs:
        other='en' if l=='vi' else 'vi';w1,w2=windows(g1,other,'end'),windows(g2,other,'start');ut=[clean(u['text']) for u in run]
        texts.update([*ut,*w1,*w2]);plans.append((l,run,g1,g2,left,right,ut,w1,w2))
    joint=[]
    for (l,i1,i2),(found,g1,g2) in strict.items():
        if l=='vi' and ('en',i1,i2) in strict and rank['en'][i2]==rank['en'][i1]+1:
            ef=strict['en',i1,i2][0];joint.append((g1,g2,found,ef,' '.join(clean(u['text']) for u in found),' '.join(clean(u['text']) for u in ef)));texts.update(joint[-1][4:])
    ordered=sorted(texts);vectors=_normalized(encode(ordered))
    if len(vectors)!=len(ordered):raise ValueError('Placement vector count mismatch')
    memo=dict(zip(ordered,vectors))
    def best(text,ws):return max((float(memo[text]@memo[w]) for w in ws),default=0.)
    changed={};placed=set()
    for l,run,g1,g2,left,right,ut,w1,w2 in plans:
        s1=[best(t,w1) for t in ut];s2=[best(t,w2) for t in ut]
        def home(k,mine,rival,present):
            return present and mine[k]>=PLACE_FLOOR and (not (left and right) or mine[k]-rival[k]>=PLACE_LEAD)
        front=[];k=0
        while k<len(run) and home(k,s1,s2,left):front.append(run[k]);k+=1
        back=[];k=len(run)-1
        while k>=len(front) and home(k,s2,s1,right):back.insert(0,run[k]);k-=1
        for group,l_units,after in ((g1,front,True),(g2,back,False)):
            if not l_units:continue
            current=changed.get(id(group),group);have=_group_units(current[l+'Input'])
            changed[id(group)]={**current,l+'Input':join_units(have+l_units if after else l_units+have)};placed.add((l,id(g1),id(g2)))
    result=[changed.get(id(g),g) for g in contexts]
    for g1,g2,vf,ef,vt,et in joint:
        if ('vi',id(g1),id(g2)) in placed or ('en',id(g1),id(g2)) in placed:continue
        score=float(memo[vt]@memo[et])
        if score>=PLACE_FLOOR:result.append({'section':section,'score':score,'margin':min(g1['margin'],g2['margin']),'primary':{'vi':True,'en':True},'viInput':join_units(vf),'enInput':join_units(ef)})
    return result
