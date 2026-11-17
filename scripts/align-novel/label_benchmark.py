"""Label-free benchmark of the prose lookup, scored against the hand-labelled pairs (the gold).

usage: label_benchmark.py cases DATA CASES.json [SEED]       selections generated from the labelled pairs of every group of DATA, both directions
       label_benchmark.py score DATA CASES.json RESULT.json...  score replays (replay-without-labels.ts) against the gold
       label_benchmark.py compare DATA CASES.json OLD NEW        how the scored class of each selection moves between two replays

Kinds of selection: whole (the label's own span, at most 8 words), sub (2-3 words inside a label of 3+ words), word (one content word inside a label of 2+ words).
The replay removes every `labelled` list first, so only the word, phrase and clause links answer. Scoring is on content words of the target edition:
P = share of highlighted words inside the gold span, R = share of gold words highlighted. core = some overlap and (P >= .67 or the gold covered with at most two words more).
whole: right (core, R >= .6) | incomplete (core, R < .6) | over (not core, R >= .6) | elsewhere | wrong | abstain;  sub, word: inside (core) | elsewhere | wrong | abstain.
elsewhere = every highlighted content word also occurs in the gold span, at another place.
The gold is stricter than a reader (a coarse label scores a finer answer as incomplete or wrong): compare two replays, do not read the absolute figures as accuracy."""
import json,sys,random,re,collections
sys.stdout.reconfigure(encoding='utf-8')
EN_F=set("a an the of to for from by with in on at as and or but is was were be been being am are it its his her their our your my i we you he she they them him us me this that these those than then so not no do does did has have had will would can could may might shall should must there here who whom whose which what when where while if how why all also only just very too more most some such any each both other up down out over off upon about after before through between under until once again".split())
VI_F=set("của và hoặc nhưng các những thì mà là ở với bởi vì cho từ tại đã đang sẽ có không được một này đó ấy cũng rất lại đều chỉ nên bèn thế vậy nào gì như hay rồi đến khi trong để rằng cả vẫn cứ hãy chớ đừng chưa chẳng thôi vừa liền ra vào lên xuống về qua sang theo cùng nhau bằng do nếu dù tuy dẫu hơn nhất mỗi".split())
STOP={'vi':VI_F,'en':EN_F}
def load(D):return {ch:json.load(open(f'{D}/chapter-{ch}.json',encoding='utf-8')) for ch in range(1,21)}
def make_cases(D,out,seed=7):
    random.seed(seed);arts=load(D);cases=[]
    for ch,a in arts.items():
        for g in a['groups']:
            for k,p in enumerate(g.get('labelled') or []):
                for loc in ('vi','en'):
                    oth='en' if loc=='vi' else 'vi';T=a['editions'][loc]['text'];S=p[loc];G=p[oth]
                    ws=[w for w in a['editions'][loc]['words'] if S['start']<=w['start'] and w['end']<=S['end']]
                    if not ws:continue
                    isc=lambda w:T[w['start']:w['end']].lower() not in STOP[loc] and not re.fullmatch(r'[\d()]+',T[w['start']:w['end']])
                    base={'chapter':ch,'locale':loc,'group':g['id'],'label':k,'gold':[G['start'],G['end']],'section':g.get('section')}
                    if any(isc(w) for w in ws) and len(ws)<=8:cases.append({**base,'kind':'whole','start':ws[0]['start'],'end':ws[-1]['end']})
                    if len(ws)>=3:
                        n=random.choice((2,3));i=random.randrange(0,len(ws)-n+1);sub=ws[i:i+n]
                        if isc(sub[0]) and isc(sub[-1]):cases.append({**base,'kind':'sub','start':sub[0]['start'],'end':sub[-1]['end']})
                    cw=[w for w in ws if isc(w)]
                    if len(ws)>=2 and cw:
                        w=random.choice(cw);cases.append({**base,'kind':'word','start':w['start'],'end':w['end']})
    for i,c in enumerate(cases):c['id']=i;c['text']=arts[c['chapter']]['editions'][c['locale']]['text'][c['start']:c['end']]
    json.dump(cases,open(out,'w',encoding='utf-8'),ensure_ascii=False)
    print(len(cases),dict(collections.Counter((c['locale'],c['kind']) for c in cases)))
class Scorer:
    def __init__(self,D,cases_file):
        self.arts=load(D);self.cases={c['id']:c for c in json.load(open(cases_file,encoding='utf-8'))}
    def toks(self,ch,loc,spans,content=True):
        T=self.arts[ch]['editions'][loc]['text'];out=set()
        for i,w in enumerate(self.arts[ch]['editions'][loc]['words']):
            if content and T[w['start']:w['end']].lower() in STOP[loc]:continue
            for s,e in spans:
                ov=min(e,w['end'])-max(s,w['start'])
                if ov>0 and ov*2>=(w['end']-w['start']):out.add(i);break
        return out
    def classify(self,c,r):
        oth='en' if c['locale']=='vi' else 'vi'
        if not r['highlights']:return 'abstain'
        ch=c['chapter'];hs=[(h['start'],h['end']) for h in r['highlights']];gs=[tuple(c['gold'])]
        H=self.toks(ch,oth,hs);G=self.toks(ch,oth,gs)
        if not H or not G:H=self.toks(ch,oth,hs,False);G=self.toks(ch,oth,gs,False)
        if not H or not G:return 'wrong'
        i=len(H&G);P=i/len(H);R=i/len(G);extra=len(H)-i
        if i>0 and (P>=.67 or (R>=.99 and extra<=2)):return ('right' if R>=.6 else 'incomplete') if c['kind']=='whole' else 'inside'
        if R>=.6 and c['kind']=='whole':return 'over'
        T=self.arts[ch]['editions'][oth]['text'];W=self.arts[ch]['editions'][oth]['words']
        hw={T[W[j]['start']:W[j]['end']].lower() for j in H};gw={T[W[j]['start']:W[j]['end']].lower() for j in G}
        return 'elsewhere' if hw and hw<=gw else 'wrong'
    def cause(self,c):
        a=self.arts[c['chapter']];loc=c['locale'];g=next(g for g in a['groups'] if g['id']==c['group']);T=a['editions'][loc]['text']
        cw=[w for w in a['editions'][loc]['words'] if c['start']<=w['start'] and w['end']<=c['end'] and T[w['start']:w['end']].lower() not in STOP[loc]]
        lk=g.get('links') or [];n=sum(1 for w in cw if any(x[loc][0]<w['end'] and x[loc][1]>w['start'] for x in lk))
        return ('no content word' if not cw else 'none linked' if n==0 else 'all linked' if n==len(cw) else 'some linked',
                'supported' if g['score']>=.5 and g['margin']>=.015 else 'unsupported')
def score(D,cases_file,files):
    S=Scorer(D,cases_file)
    for fn in files:
        res={o['id']:o for o in json.load(open(fn,encoding='utf-8'))};tab=collections.defaultdict(collections.Counter);ab=collections.Counter()
        for i,c in S.cases.items():
            k=S.classify(c,res[i]);tab[(c['locale'],c['kind'])][k]+=1;tab[('all',c['kind'])][k]+=1;tab[('all','all')][k]+=1
            if k=='abstain':ab[S.cause(c)]+=1
        print('==',fn)
        for key in sorted(tab,key=lambda k:(k[0]!='all',k)):
            t=tab[key];n=sum(t.values());ans=n-t['abstain'];good=t['right']+t['inside']+t['incomplete']
            print(f"{str(key):<22} n={n:>6} answered {100*ans/n:4.1f}% | "+' '.join(f"{k} {100*v/n:4.1f}%" for k,v in sorted(t.items(),key=lambda x:-x[1]))+f" | good of answered {100*good/max(ans,1):4.1f}%")
        tot=sum(ab.values());print(f'abstain causes (n={tot}):')
        for k,v in ab.most_common():print(f'   {k[0]:<16} {k[1]:<12} {v:>5} {100*v/tot:4.1f}%')
def compare(D,cases_file,old,new):
    S=Scorer(D,cases_file);o={x['id']:x for x in json.load(open(old,encoding='utf-8'))};n={x['id']:x for x in json.load(open(new,encoding='utf-8'))}
    good={'right','inside','incomplete'};bad={'wrong','over','elsewhere'};move=collections.Counter()
    for i,c in S.cases.items():
        a=S.classify(c,o[i]);b=S.classify(c,n[i])
        if a!=b:move[(a,b)]+=1
    for (a,b),v in move.most_common():print(f'   {a:<10} -> {b:<10} {v:>6}')
    gain=sum(v for (a,b),v in move.items() if a=='abstain' and b in good);gbad=sum(v for (a,b),v in move.items() if a=='abstain' and b in bad)
    lost=sum(v for (a,b),v in move.items() if a in good and b=='abstain');worse=sum(v for (a,b),v in move.items() if a in good and b in bad);better=sum(v for (a,b),v in move.items() if a in bad and b in good)
    print(f'new answers good {gain}, new answers bad {gbad} (share good {100*gain/max(gain+gbad,1):.1f}%); good answers lost {lost}; good turned bad {worse}; bad turned good {better}')
if __name__=='__main__':
    cmd=sys.argv[1]
    if cmd=='cases':make_cases(sys.argv[2],sys.argv[3],int(sys.argv[4]) if len(sys.argv)>4 else 7)
    elif cmd=='score':score(sys.argv[2],sys.argv[3],sys.argv[4:])
    elif cmd=='compare':compare(*sys.argv[2:6])
    else:raise SystemExit(__doc__)
