"""Score sheet 8. usage: human_check_compare8.py RESULT.csv KEY.json (docs/verification/human-check-result-8-2026-11-16.csv and human-check-key-8.json).
Maps the reviewer's A/B choice back to old (phr11 data) / new (phr12 data with pairs written by reading) and prints the paired verdicts,
the control cards (both sides the same answer, so a choice of A or B there shows position bias) and an exact sign test on the decisive pairs."""
import csv,json,sys,collections,math
sys.stdout.reconfigure(encoding='utf-8')
key=json.load(open(sys.argv[2],encoding='utf-8'))['cards']
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))
ans={r['key']:(r['answer'],r['note']) for r in rows}
print('rows',len(rows),'keys unknown',[k for k in ans if k not in key],'missing',[k for k in key if k not in ans or not ans[k][0]])
verdict={}
for k,v in key.items():
    a=ans.get(k,('',''))[0]
    if not a:continue
    if v['control']:verdict[k]='control-'+('position-bias' if a in('A','B') else a)
    elif a in('A','B'):verdict[k]=(v[a]+' better')
    else:verdict[k]=a
pairs=[k for k,v in key.items() if not v['control']]
c=collections.Counter(verdict.get(k,'blank') for k in pairs)
print('pairs',len(pairs),dict(c))
print('controls',dict(collections.Counter(verdict.get(k,'blank') for k,v in key.items() if v['control'])))
n_new,n_old=c['new better'],c['old better'];m=n_new+n_old
if m:
    tail=sum(math.comb(m,i) for i in range(max(n_new,n_old),m+1))/2**m*2
    print(f'decisive pairs {m}: new better {n_new}, old better {n_old}; two-sided exact sign test p={min(1,tail):.3f}')
print('details:')
for k in pairs:
    v=key[k];a=ans.get(k,('',''))
    print(f"  {k} {v['kind']} {v['from']} ch{v['chapter']}: {verdict.get(k,'blank'):12s} A({v['A']})={v['A_text'][:2]} B({v['B']})={v['B_text'][:2]} {a[1]}")
