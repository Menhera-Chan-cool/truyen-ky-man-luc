"""Score the seventh human check. usage: human_check_compare7.py RESULT.csv KEY.json. Prints per-role counts (old answer, new answer, control) and the paired old/new table."""
import csv,json,sys,collections,math,random
sys.stdout.reconfigure(encoding='utf-8')
key=json.load(open(sys.argv[2],encoding='utf-8'))['cards']
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))
ans={r['key']:r['answer'] for r in rows}
print('rows',len(rows),'keys unknown',[k for k in ans if k not in key],'missing',[k for k in key if k not in ans])
def wilson(k,n,z=1.96):
    if n==0:return (0,0)
    p=k/n;d=1+z*z/n;c=p+z*z/(2*n);m=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n));return ((c-m)/d,(c+m)/d)
by=collections.defaultdict(collections.Counter)
for k,a in ans.items():by[key[k]['role']][a]+=1
for role in ('old','new','control'):
    c=by[role];n=sum(c.values());lo,hi=wilson(c['right'],n)
    print(f"{role:8s} n={n:3d} right={c['right']} partly={c['partly']} wrong={c['wrong']} unsure={c['unsure']}  right {100*c['right']/n:.1f}% (Wilson {100*lo:.0f}-{100*hi:.0f})")
pairs=collections.defaultdict(dict)
for k,v in key.items():
    if v['role'] in ('old','new'):pairs[(v['set'],v['id'])][v['role']]=k
both=[(s,i,d) for (s,i),d in pairs.items() if 'old' in d and 'new' in d]
t=collections.Counter()
for s,i,d in both:t[(ans[d['old']],ans[d['new']])]+=1
print('paired (old answer, new answer):',len(both),dict(t))
print('new answers on lookups whose old answer was context-only:',collections.Counter(ans[d['new']] for (s,i),d in pairs.items() if 'old' not in d))
print('non-right:')
for k,a in ans.items():
    if a!='right':print(' ',k,a,key[k]['kind'],key[k]['from'],key[k]['highlights'])
