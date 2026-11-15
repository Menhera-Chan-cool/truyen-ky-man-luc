"""Compare the CSV a person returns from docs/verification/human-check-sheet.html with the verdicts in human-check-key.json.
Usage: python human_check_compare.py RESULT.csv [KEY.json]
Prints how often the person agrees with each verdict and a corrected hit rate for the answered lookups."""
import csv,json,sys,collections,pathlib

# What a person's answer means for each verdict of mine.
EXPECT={'hit':{'right'},'incomplete':{'partly','right'},'partial':{'partly','wrong'},'wrong':{'wrong','partly'},'answered-but-none-exists':{'wrong'},'wrong-or-unanswerable':{'wrong'},
        'abstain-context-ok':{'has'},'abstain-no-context':{'hasnot'},'abstain-correct(no counterpart)':{'none'}}
# Both audits together after the fix: 172 answered lookups, 159 of them hits; the sheet holds every non-hit and 51 hits.
ANSWERED,HITS=172,159

def main(result,keyfile):
    key=json.load(open(keyfile,encoding='utf-8'))
    rows=[r for r in csv.DictReader(open(result,encoding='utf-8-sig')) if r['answer'] and r['key'] in key]
    if not rows:raise SystemExit('No answered rows matched the key.')
    table=collections.defaultdict(collections.Counter);agree=collections.Counter();total=collections.Counter()
    for r in rows:
        v=key[r['key']]['myVerdict'];table[v][r['answer']]+=1;total[v]+=1
        if r['answer']=='unsure':total[v]-=1;continue
        agree[v]+=r['answer'] in EXPECT[v]
    print(f'{len(rows)} cases answered of {len(key)}')
    for v,c in sorted(table.items()):print(f'  my verdict {v:34} -> person: {dict(c)}  agree {agree[v]}/{total[v]}')
    mine_hits=[r for r in rows if key[r['key']]['myVerdict']=='hit' and r['answer']!='unsure'];other=[r for r in rows if key[r['key']]['myVerdict'] in ('incomplete','partial','wrong') and r['answer']!='unsure']
    if mine_hits:
        confirmed=sum(r['answer']=='right' for r in mine_hits)/len(mine_hits);extra=sum(r['answer']=='right' for r in other)
        print(f'Of my hits the person confirms {confirmed:.0%} ({sum(r["answer"]=="right" for r in mine_hits)}/{len(mine_hits)}).')
        print(f'Corrected hit of answered (assuming the 51 sampled hits represent all {HITS}): {(HITS*confirmed+extra)/ANSWERED:.1%} against my {HITS/ANSWERED:.1%}.')
    gaps=[r['key'] for r in rows if r['answer']!='unsure' and r['answer'] not in EXPECT[key[r['key']]['myVerdict']]]
    print('Disagreements to look at:',', '.join(gaps) if gaps else 'none')

if __name__=='__main__':
    here=pathlib.Path(__file__).resolve().parents[2]/'docs/verification/human-check-key.json'
    main(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else str(here))
