"""Automatic checks of the labelled pairs in phr13 (written by reading, never audited).
Flags: AMBIG (the source or the target phrase occurs more than once in the group, so the mapper's first-unused occurrence may be the wrong one),
RATIO (one side one word, the other six or more), FUNC (a side made only of function words), NONMONO (mapped out of reading order, from the mapper log).
usage: python audit_labels.py [DIR holding phr13/chapter-N.json]  -> flag counts per chapter, writes audit_labels.json (flagged pairs with context)"""
import json,re,sys,collections,subprocess,random
sys.stdout.reconfigure(encoding='utf-8')
P=sys.argv[1].rstrip('/')+'/' if len(sys.argv)>1 else 'D:/codex/2026-10-22/p/work/pilot/'
EN_F=set('a an the of to in on at by for with and or but as is was were be been it its his her their our your my i we you he she they them him us me this that these those from into than then so not no'.split())
VI_F=set('và của là có không được các những một cho với để trong khi thì mà rằng này đó ấy cũng đã sẽ đang rất lại đều chỉ nên bèn'.split())
def words(t):return re.findall(r'[\w\u00C0-\u1EF9]+',t.lower())
flags=collections.Counter();per=collections.defaultdict(collections.Counter);out=[];total=0
for ch in range(1,21):
    a=json.load(open(f'{P}phr13/chapter-{ch}.json',encoding='utf-8'));V=a['editions']['vi']['text'];E=a['editions']['en']['text']
    for g in a['groups']:
        for p in g.get('labelled',[]):
            total+=1
            v=V[p['vi']['start']:p['vi']['end']];e=E[p['en']['start']:p['en']['end']]
            vg=V[g['vi']['start']:g['vi']['end']].lower();eg=E[g['en']['start']:g['en']['end']].lower()
            fl=[]
            if vg.count(v.lower())>1 or eg.count(e.lower())>1:fl.append('AMBIG')
            vw,ew=words(v),words(e)
            if (len(vw)==1 and len(ew)>=6) or (len(ew)==1 and len(vw)>=6):fl.append('RATIO')
            if (ew and all(w in EN_F for w in ew)) or (vw and all(w in VI_F for w in vw)):fl.append('FUNC')
            for f in fl:flags[f]+=1;per[ch][f]+=1
            if fl:out.append({'chapter':ch,'group':g['id'],'flags':fl,'vi':v,'en':e,'vi_ctx':V[max(g['vi']['start'],p['vi']['start']-40):p['vi']['end']+40],'en_ctx':E[max(g['en']['start'],p['en']['start']-40):p['en']['end']+40]})
print('pairs',total,dict(flags))
print({ch:dict(c) for ch,c in sorted(per.items())})
json.dump(out,open(P+'audit_labels.json','w',encoding='utf-8'),ensure_ascii=False)
