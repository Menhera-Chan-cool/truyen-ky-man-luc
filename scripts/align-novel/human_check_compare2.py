"""Compare the second human check with the first and recompute the reviewer-standard estimate.
Usage: python human_check_compare2.py SECOND.csv [FIRST.csv] [KEY.json]
The second sheet holds the cases whose highlight changed since the first plus unchanged controls; its answers replace the first ones."""
import csv,json,random,sys,collections,pathlib

ANSWERED,HITS=172,159   # answered lookups of both audits after the gap-context fix; 159 of them were hits of mine
here=pathlib.Path(__file__).resolve().parents[2]/'docs/verification'

def estimate(hits,others):
    n=len(hits)
    r=sum(a=='right' for a in hits)/n;p=sum(a=='partly' for a in hits)/n;w=sum(a=='wrong' for a in hits)/n
    return tuple((HITS*x+sum(a==name for a in others))/ANSWERED for x,name in ((r,'right'),(p,'partly'),(w,'wrong')))

def main(second,first,keyfile):
    key=json.load(open(keyfile,encoding='utf-8'))
    answers={r['key']:r['answer'] for r in csv.DictReader(open(first,encoding='utf-8-sig')) if r['answer'] in('right','partly','wrong')}
    second_answers={r['key']:r['answer'] for r in csv.DictReader(open(second,encoding='utf-8-sig')) if r['answer'] in('right','partly','wrong','unsure')}
    moves=collections.Counter()
    for k,a in second_answers.items():
        if k in answers:moves[(answers[k],a)]+=1
    print('answers moved (first -> second):');[print(f'  {a:7} -> {b:7} {n}') for (a,b),n in sorted(moves.items())]
    merged={**answers,**{k:a for k,a in second_answers.items() if a!='unsure'}}
    hits=[a for k,a in merged.items() if key[k]['myVerdict']=='hit'];others=[a for k,a in merged.items() if key[k]['myVerdict']!='hit' and key[k]['answered']]
    point=estimate(hits,others)
    random.seed(1);boot=[estimate([random.choice(hits) for _ in hits],[random.choice(others) for _ in others]) for _ in range(4000)]
    for i,name in enumerate(('right','partly','wrong')):
        v=sorted(b[i] for b in boot);print(f'{name:7} {point[i]*100:5.1f}%  95% interval {v[100]*100:.0f}-{v[3899]*100:.0f}')
    print(f'not wrong {100*(point[0]+point[1]):.1f}%')

if __name__=='__main__':
    main(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else str(here/'human-check-result-2026-11-15.csv'),sys.argv[3] if len(sys.argv)>3 else str(here/'human-check-key.json'))
