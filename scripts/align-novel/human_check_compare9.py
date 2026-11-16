"""Score sheet 9. usage: human_check_compare9.py RESULT.csv KEY.json (docs/verification/human-check-result-9-2026-11-16.csv and human-check-key-9.json).
Two kinds of pair card: ans-ans (old answer vs new answer) and blank-ans (old = no highlight vs new answer: 'new better' = the new answer is right, 'old better' = it was wrong and silence was better).
Control cards (both sides the same) show position bias if A or B is chosen. Exact two-sided sign test on decisive pairs per kind and overall."""
import csv,json,sys,collections,math
sys.stdout.reconfigure(encoding='utf-8')
key=json.load(open(sys.argv[2],encoding='utf-8'))['cards']
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))
ans={r['key']:(r['answer'],r['note']) for r in rows}
print('rows',len(rows),'keys unknown',[k for k in ans if k not in key],'missing',[k for k in key if k not in ans or not ans[k][0]])
def verdict(k,v):
    a=ans.get(k,('',''))[0]
    if not a:return 'blank'
    if v['control']:return 'control-position-bias' if a in('A','B') else 'control-'+a
    return v[a]+' better' if a in('A','B') else a
def sign(n_new,n_old):
    m=n_new+n_old
    if not m:return 'no decisive pairs'
    tail=sum(math.comb(m,i) for i in range(max(n_new,n_old),m+1))/2**m*2
    return f'decisive {m}: new better {n_new}, old better {n_old}; two-sided exact sign test p={min(1,tail):.3f}'
tot=collections.Counter()
for pt in('ans-ans','blank-ans'):
    c=collections.Counter(verdict(k,v) for k,v in key.items() if v['ptype']==pt)
    print(pt,dict(c));print('  ',sign(c['new better'],c['old better']))
    tot.update(c)
print('all pairs',dict(tot));print('  ',sign(tot['new better'],tot['old better']))
print('controls',dict(collections.Counter(verdict(k,v) for k,v in key.items() if v['control'])))
byfrom=collections.defaultdict(collections.Counter)
for k,v in key.items():
    if not v['control']:byfrom[v['from']][verdict(k,v)]+=1
print('by source language',{k:dict(c) for k,c in byfrom.items()})
print('details:')
for k,v in key.items():
    if v['control']:continue
    a=ans.get(k,('',''))
    print(f"  {k} ch{v['chapter']} {v['ptype']} {v['kind']} {v['from']}: {verdict(k,v):12s} A({v['A']})={v['A_text'][:2]} B({v['B']})={v['B_text'][:2]} {a[1]}")
