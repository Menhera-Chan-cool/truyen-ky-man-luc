# Local evaluation script of the goal list (2026-11-16): paths point at this machine's work folder and local model cache; see docs/EVALUATION_PROTOCOL.md for what it measured.
import json,bisect,collections,sys
sys.stdout.reconfigure(encoding='utf-8')
P='D:/codex/2026-10-22/p/work/phrase-alignment-20261115/phr10/'
per={}
for ch in range(1,21):
    a=json.load(open(P+f'chapter-{ch}.json',encoding='utf-8'));E=a['editions']
    W={l:sorted(E[l]['words'],key=lambda w:w['start']) for l in ('vi','en')};S={l:[w['start'] for w in W[l]] for l in W}
    def word(l,pos):
        i=bisect.bisect_right(S[l],pos)-1
        return W[l][i] if i>=0 and W[l][i]['end']>pos else None
    cnt=collections.Counter()
    for g in a['groups']:
        if g.get('section') not in ('story','critique'):continue
        for l in g.get('links',[]):
            if l['score']<.9:continue
            v=word('vi',l['vi'][0]);e=word('en',l['en'][0])
            if not v or not e:continue
            vt=E['vi']['text'][v['start']:v['end']].lower();et=E['en']['text'][e['start']:e['end']].lower()
            if vt.isalpha() and et.isalpha():cnt[(vt,et)]+=1
    per[ch]=cnt
def lexicon(exclude):
    tot=collections.Counter()
    for ch,c in per.items():
        if ch!=exclude:tot.update(c)
    return tot
queries=[('chapter-1','thiên hạ','realm'),('chapter-1','quan hầu','attendants'),('chapter-1','nhà trọ','inn'),('chapter-1','nhà hồ','ho')]
import re
ev=json.load(open('D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc/scripts/align-novel/evaluation.json',encoding='utf-8'))
for ch,kind,vi,en in ev:
    if kind!='word':continue
    n=int(ch.split('-')[1]);tot=lexicon(n)
    if ' ' in vi.strip() and len(vi.split())>1:pass
    v=vi.lower();cands=[(e,c) for (x,e),c in tot.items() if x==v];cands.sort(key=lambda t:-t[1])
    allv=sum(c for _,c in cands)
    print(ch,'|',vi,'->',en,'| lexicon:',[(e,c) for e,c in cands[:4]],'total',allv)
