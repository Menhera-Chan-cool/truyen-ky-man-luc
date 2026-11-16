import json,sys,unicodedata,shutil,os
sys.stdout.reconfigure(encoding='utf-8')
# usage: map_verse_pairs.py LABELS_DIR SRC_DIR OUT_DIR CHAPTER...
# LABELS_DIR holds labels-ch<N>.txt: a '#<poem pair index>' line (the index in the chapter's `poems` list; the first token after '#'), then 'vietnamese phrase = english phrase' lines
# (exact substrings of that pair's Vietnamese and English verse; the Vietnamese side is searched in reading order and may not overlap an earlier pair, the English side neither).
# SRC_DIR is a published data directory (chapter-<N>.json); OUT_DIR gets a copy of it with a 'labelled' list on the labelled poem pairs.
P=sys.argv[1].rstrip('/')+'/';SRC=sys.argv[2].rstrip('/')+'/';OUT=sys.argv[3].rstrip('/')+'/'
def isw(c):return unicodedata.category(c)[0] in 'LMN'
def find_all(text,s,lo,hi,ci=False):
    t=text.lower() if ci else text;q=s.lower() if ci else s;res=[];i=lo
    while True:
        i=t.find(q,i,hi)
        if i<0:break
        j=i+len(q)
        # verse lines are run together ("Quan TrungKhói tan"): a capital letter after a letter also ends a word
        before=i==lo or not isw(text[i-1]) or not isw(text[i]) or text[i].isupper()
        after=j>=hi or not isw(text[j]) or not isw(text[j-1]) or text[j].isupper()
        if before and after:res.append((i,j))
        i+=1
    return res
def parse(path):
    d={};cur=None
    for line in open(path,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('#'):cur=int(line[1:].split()[0]);d[cur]=[];continue
        if ' = ' in line and cur is not None:v,e=line.split(' = ',1);d[cur].append((v.strip(),e.strip()))
    return d
def run(ch):
    lab=parse(f'{P}labels-ch{ch}.txt');a=json.load(open(f'{SRC}chapter-{ch}.json',encoding='utf-8'))
    V=a['editions']['vi']['text'];E=a['editions']['en']['text'];fails=[];n=0;npairs=0
    for k,pairs in lab.items():
        if k>=len(a.get('poems',[])):fails.append((k,'NO POEM',''));continue
        p=a['poems'][k];vlo,vhi,elo,ehi=p['vi']['start'],p['vi']['end'],p['en']['start'],p['en']['end']
        usedv=[];usede=[];out=[];vpos=vlo
        for v,e in pairs:
            ms=find_all(V,v,vpos,vhi) or find_all(V,v,vpos,vhi,True)
            if not ms:
                ms=[m for m in (find_all(V,v,vlo,vhi) or find_all(V,v,vlo,vhi,True)) if not any(m[0]<u[1] and m[1]>u[0] for u in usedv)]
                if ms:fails.append((k,'NONMONO',v))
            if not ms:fails.append((k,'VI?',v));continue
            ns=[m for m in (find_all(E,e,elo,ehi) or find_all(E,e,elo,ehi,True)) if not any(m[0]<u[1] and m[1]>u[0] for u in usede)]
            if not ns:fails.append((k,'EN?',e));continue
            vm,em=ms[0],ns[0];usedv.append(vm);usede.append(em);vpos=vm[1];out.append({'vi':{'start':vm[0],'end':vm[1]},'en':{'start':em[0],'end':em[1]}});npairs+=1
        p['labelled']=out;n+=1
    json.dump(a,open(f'{OUT}chapter-{ch}.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    print('chapter',ch,'poem pairs labelled',n,'pairs mapped',npairs,'failures',len(fails))
    for f in fails:print('  ',f)
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True)
    for f in os.listdir(SRC):
        if not os.path.exists(OUT+f):shutil.copy(SRC+f,OUT+f)
    for ch in sys.argv[4:]:run(int(ch))
