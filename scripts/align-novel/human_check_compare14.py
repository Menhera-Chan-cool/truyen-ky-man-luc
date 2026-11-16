"""Score sheet 14 (absolute marking of a random sample on the deployed code). usage: human_check_compare14.py RESULT.csv KEY.json
Answered lookups: right / partly / wrong. Abstained lookups: has (the returned passage holds the translation) / hasnot / none.
Reports Wilson 95% intervals overall, by kind and by source language, and the share of all lookups that give the reader the right place."""
import csv,json,sys,collections,math
sys.stdout.reconfigure(encoding='utf-8')
key=json.load(open(sys.argv[2],encoding='utf-8'))['cards']
rows={r['key']:r for r in csv.DictReader(open(sys.argv[1],encoding='utf-8-sig'))}
print('rows',len(rows),'unknown keys',[k for k in rows if k not in key],'missing',[k for k in key if k not in rows or not rows[k]['answer']])
bad=[k for k,r in rows.items() if k in key and (r['answered']=='yes')!=key[k]['answered']]
print('answered flag differs from key:',bad)
def wilson(k,n,z=1.96):
    if not n:return (0,0)
    p=k/n;d=1+z*z/n;c=(p+z*z/(2*n))/d;h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return max(0,c-h),min(1,c+h)
def fmt(k,n):
    lo,hi=wilson(k,n);return f'{k}/{n} = {100*k/n:.1f}% (Wilson {100*lo:.0f}-{100*hi:.0f}%)' if n else '0/0'
ans=[(k,v) for k,v in key.items() if v['answered']];abst=[(k,v) for k,v in key.items() if not v['answered']]
a=collections.Counter(rows[k]['answer'] for k,v in ans);b=collections.Counter(rows[k]['answer'] for k,v in abst)
print('answered',dict(a),'| abstained',dict(b))
print('right of answered      ',fmt(a['right'],len(ans)))
print('not wrong of answered  ',fmt(a['right']+a['partly'],len(ans)))
print('partly of answered     ',fmt(a['partly'],len(ans)))
print('passage has translation of abstained',fmt(b['has'],len(abst)))
print('coverage (highlighted)  ',fmt(len(ans),len(key)))
print('right highlight of all  ',fmt(a['right'],len(key)))
print('reader gets right place (right highlight or passage holds it)',fmt(a['right']+a['partly']+b['has'],len(key)))
print('abstentions with no counterpart in the other edition (none):',b['none'],'; passage without it (hasnot):',b['hasnot'],'; wrong highlights:',a['wrong'])
print('lookups that mislead (wrong highlight or passage without the translation):',fmt(a['wrong']+b['hasnot'],len(key)))
groups=[('kind',lambda v:v['kind']),('from',lambda v:v['from'])]+([('part',lambda v:v['part'])] if all('part' in v for v in key.values()) else [])
for name,sel in groups:
    for g in sorted({sel(v) for v in key.values()}):
        A=[k for k,v in ans if sel(v)==g];B=[k for k,v in abst if sel(v)==g]
        ca=collections.Counter(rows[k]['answer'] for k in A);cb=collections.Counter(rows[k]['answer'] for k in B)
        print(f'  {name} {g:9s} answered {len(A):2d}: right {ca["right"]} partly {ca["partly"]} wrong {ca["wrong"]} ({fmt(ca["right"],len(A))}) | abstained {len(B):2d}: has {cb["has"]} hasnot {cb["hasnot"]} none {cb["none"]}')
print('notes:')
for k,r in rows.items():
    if r['note'].strip():print(f"  {k} ca{r['ca']} {key[k]['kind']} {key[k]['from']} ch{key[k]['chapter']} {key[k]['selection']!r}: {r['answer']} - {r['note']}")
