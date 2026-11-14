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


def add_clause_pairs(contexts,encode,editions=None):
    from context_alignment import slice16,_normalized,mask_references
    from alignment import align_sequences
    prepared=[];texts=set()
    for g in contexts:
        if g['section'] not in ['story','critique'] or 'tracks' in g:continue
        atoms={}
        for l in ['vi','en']:
            inp=g[l+'Input'];parts=inp['parts'];values=[]
            if len(parts)>32 or parts[-1]['end']-parts[0]['start']>1024:break
            if any(b['start']-a['end']>3 and (editions is None or any(c.isalnum() for c in mask_references(slice16(editions[l]['text'],a['end'],b['start'])))) for a,b in zip(parts,parts[1:])):break
            for p in parts:
                indices=[i for i,(a,b) in enumerate(zip(inp['starts'],inp['ends'])) if p['start']<=a<b<=p['end']]
                if not indices:break
                text=slice16(inp['text'],indices[0],indices[-1]+1).strip()
                if l=='en' and values and not re.search(r'[.!?…]["”’]*$',values[-1]['text']):
                    values[-1]['text']+=' '+text;values[-1]['parts'].append(p)
                else:values.append({'text':text,'parts':[p]})
            else:
                atoms[l]=values;continue
            break
        if len(atoms)!=2 or not all(atoms.values()) or (len(atoms['vi'])==len(atoms['en'])==1):continue
        windows={l:{n:[' '.join(u['text'] for u in units[i:i+n]) for i in range(len(units)-n+1)] for n in range(1,min(3,len(units))+1)} for l,units in atoms.items()}
        texts.update(t for w in windows.values() for values in w.values() for t in values);prepared.append((g,atoms,windows))
    if not texts:return
    ordered=sorted(texts);vectors=_normalized(encode(ordered))
    if len(vectors)!=len(ordered):raise ValueError('Clause vector count mismatch')
    memo=dict(zip(ordered,vectors))
    for g,atoms,text_windows in prepared:
        windows=[{n:np.stack([memo[t] for t in values]) for n,values in text_windows[l].items()} for l in ['vi','en']]
        pairs=align_sequences(windows[0][1],windows[1][1],minimum=.5,windows=windows)
        g['clausePairs']=[]
        def confidence(i,j,a,b,score,margin):
            alternatives=[float(v@windows[1][b][j]) for n,vs in windows[0].items() for at,v in enumerate(vs) if (at,n)!=(i,a)]
            alternatives += [float(v@windows[0][a][i]) for n,vs in windows[1].items() for at,v in enumerate(vs) if (at,n)!=(j,b)]
            return min(margin,score-max(alternatives,default=0))
        def mapping(i,j,a,b,score,margin):
            return {'vi':[p for atom in atoms['vi'][i:i+a] for p in atom['parts']],'en':[p for atom in atoms['en'][j:j+b] for p in atom['parts']],'score':score,'margin':margin}
        for pair in pairs:
            i,j=pair['vi'][0],pair['en'][0];a,b=len(pair['vi']),len(pair['en'])
            margin=confidence(i,j,a,b,pair['score'],pair['margin'])
            if margin<.03:continue
            g['clausePairs'].append(mapping(i,j,a,b,pair['score'],margin))
            if b<2 or a<2:continue
            finer=[]
            for at in range(j,j+b):
                candidates=[(float(v@windows[1][1][at]),start,n) for n,vs in windows[0].items() for start,v in enumerate(vs) if i<=start and start+n<=i+a and n<a]
                if not candidates:continue
                score,start,n=max(candidates);gap=confidence(start,at,n,1,score,score)
                if score>=.5 and gap>=.03:finer.append(mapping(start,at,n,1,score,gap))
            for fine in finer:
                if not any(other is not fine and fine['vi'][0]['start']<other['vi'][-1]['end'] and other['vi'][0]['start']<fine['vi'][-1]['end'] for other in finer):g['clausePairs'].append(fine)
