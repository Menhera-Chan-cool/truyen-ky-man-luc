"""Estimate the reviewer-standard right/partly/wrong rate from the third human check, a fresh random sample.
Usage: python human_check_compare3.py ANSWERS.csv [KEY.json]
The key holds, per kind, how many answered lookups the audit had (the population) and which cards were drawn (20 per kind, shuffled).
The estimate weights each kind's rate by its population count; 'unsure' answers and unanswered cards are left out of that kind's rate."""
import csv,json,random,sys,pathlib,collections
here=pathlib.Path(__file__).resolve().parents[2]/'docs/verification'

def estimate(rates,population):
    total=sum(population.values());return {name:sum(population[k]*rates[k][name] for k in population)/total for name in ('right','partly','wrong')}

def main(answers_csv,keyfile):
    key=json.load(open(keyfile,encoding='utf-8'));population=key['population']
    given={r['key']:r['answer'] for r in csv.DictReader(open(answers_csv,encoding='utf-8-sig')) if r['answer'] in('right','partly','wrong')}
    by=collections.defaultdict(list)
    for k,a in given.items():
        if k in key['cards']:by[key['cards'][k]['kind']].append(a)
    print({k:len(v) for k,v in by.items()},'answered of',len(key['cards']))
    if any(not by[k] for k in population):print('a kind has no answers: no estimate');return
    rate=lambda xs:{n:sum(a==n for a in xs)/len(xs) for n in('right','partly','wrong')}
    point=estimate({k:rate(by[k]) for k in population},population)
    random.seed(1);boot=[estimate({k:rate([random.choice(by[k]) for _ in by[k]]) for k in population},population) for _ in range(4000)]
    for k in population:print(f'  {k:8} right {sum(a=="right" for a in by[k])}/{len(by[k])} partly {sum(a=="partly" for a in by[k])} wrong {sum(a=="wrong" for a in by[k])}')
    for name in('right','partly','wrong'):
        v=sorted(b[name] for b in boot);print(f'{name:7} {point[name]*100:5.1f}%  95% interval {v[100]*100:.0f}-{v[3899]*100:.0f}')
    print(f'not wrong {100*(point["right"]+point["partly"]):.1f}%')

if __name__=='__main__':main(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else str(here/'human-check-key-3.json'))
