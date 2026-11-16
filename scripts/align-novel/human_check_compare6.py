"""Score the sixth human check. Usage: python human_check_compare6.py ANSWERS.csv [KEY.json]
The sheet mixes three strata (kept only in the key, never shown to the reviewer):
  random  - a fresh random sample of answered lookups, 20 per kind; scored like sheets 3 to 5 (kind rates weighted by the audit's answered counts, bootstrap interval)
  changed - every lookup whose highlight differs from the code and data of sheet 5 (interior-gap rule, whole-sentence counterpart, chapter-18 data); counted, not extrapolated
  verse   - 12 lookups from the new chapter-18 verse/prose pairs; counted, not extrapolated
A card can sit in two strata (a random card that also changed). 'unsure' answers and unanswered cards are left out."""
import csv,json,random,sys,pathlib,collections
from human_check_compare3 import estimate
here=pathlib.Path(__file__).resolve().parents[2]/'docs/verification'
NAMES=('right','partly','wrong')

def main(answers_csv,keyfile):
    key=json.load(open(keyfile,encoding='utf-8'))
    given={r['key']:r['answer'] for r in csv.DictReader(open(answers_csv,encoding='utf-8-sig')) if r['answer'] in NAMES}
    in_stratum=lambda stratum:{k:a for k,a in given.items() if k in key['cards'] and stratum in key['cards'][k]['strata']}
    total=collections.Counter(s for c in key['cards'].values() for s in c['strata'])
    for stratum in ('random','changed','verse'):
        got=in_stratum(stratum);n=collections.Counter(got.values())
        print(f'{stratum:8} answered {len(got)} of {total[stratum]}:',' '.join(f'{name} {n[name]}' for name in NAMES))
        if stratum!='random':
            for k,a in sorted(got.items()):
                if a!='right':print(f'          {k} ({key["cards"][k]["kind"]}, from {key["cards"][k]["from"]}, chapter {key["cards"][k]["chapter"]}): {a}')
    population=key['population'];by=collections.defaultdict(list)
    for k,a in in_stratum('random').items():by[key['cards'][k]['kind']].append(a)
    if any(not by[k] for k in population):print('random stratum: a kind has no answers, no estimate');return
    rate=lambda xs:{name:sum(a==name for a in xs)/len(xs) for name in NAMES}
    point=estimate({k:rate(by[k]) for k in population},population)
    random.seed(1);boot=[estimate({k:rate([random.choice(by[k]) for _ in by[k]]) for k in population},population) for _ in range(4000)]
    for k in population:print(f'  {k:8} right {sum(a=="right" for a in by[k])}/{len(by[k])} partly {sum(a=="partly" for a in by[k])} wrong {sum(a=="wrong" for a in by[k])}')
    for name in NAMES:
        v=sorted(b[name] for b in boot);print(f'{name:7} {point[name]*100:5.1f}%  95% interval {v[100]*100:.0f}-{v[3899]*100:.0f}')
    print(f'not wrong {100*(point["right"]+point["partly"]):.1f}%  (sheets 3/4/5: 92.0 / 89.2 / 95.2 right; pooled 92.2)')

if __name__=='__main__':main(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else str(here/'human-check-key-6.json'))
