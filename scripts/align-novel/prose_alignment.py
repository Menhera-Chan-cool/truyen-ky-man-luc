"""Repair weak prose clauses inside existing paragraph candidates, never across poetry."""
import bisect
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
