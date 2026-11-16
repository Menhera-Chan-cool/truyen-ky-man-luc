import json,sys,re,unicodedata,shutil,os
sys.stdout.reconfigure(encoding='utf-8')
# usage: map_labelled_pairs.py LABELS_DIR SRC_DIR OUT_DIR CHAPTER...
# LABELS_DIR holds labels-ch<N>.txt: a '#<group id>' line, then 'source phrase = counterpart phrase' lines in source order (exact substrings of the group text).
# SRC_DIR is a published data directory (chapter-<N>.json); OUT_DIR gets a copy of it with a 'labelled' list on the labelled groups.
P=sys.argv[1].rstrip('/')+'/';SRC=sys.argv[2].rstrip('/')+'/';OUT=sys.argv[3].rstrip('/')+'/'
def isw(c):return unicodedata.category(c)[0] in 'LMN'
def find_all(text,s,lo,hi,ci=False):
    t=text.lower() if ci else text;q=s.lower() if ci else s;res=[];i=lo
    while True:
        i=t.find(q,i,hi)
        if i<0:break
        j=i+len(q)
        if (i==lo or not isw(text[i-1]) or not isw(text[i])) and (j>=hi or not isw(text[j]) or not isw(text[j-1])):res.append((i,j))
        i+=1
    return res
def parse(path):
    d={};cur=None
    for line in open(path,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('#'):cur=line[1:].strip();d[cur]=[];continue
        if ' = ' in line and cur is not None:v,e=line.split(' = ',1);d[cur].append((v.strip(),e.strip()))
    return d
def run(ch):
    lab=parse(f'{P}labels-ch{ch}.txt');a=json.load(open(f'{SRC}chapter-{ch}.json',encoding='utf-8'))
    V=a['editions']['vi']['text'];E=a['editions']['en']['text'];fails=[];n=0;npairs=0
    byid={g['id']:g for g in a['groups']}
    for gid,pairs in lab.items():
        g=byid.get(gid)
        if g is None:fails.append((gid,'NO GROUP',''));continue
        vlo,vhi,elo,ehi=g['vi']['start'],g['vi']['end'],g['en']['start'],g['en']['end']
        usedv=[];usede=[];out=[];vpos=vlo
        for v,e in pairs:
            ms=find_all(V,v,vpos,vhi) or find_all(V,v,vpos,vhi,True)
            if not ms:
                ms=[m for m in (find_all(V,v,vlo,vhi) or find_all(V,v,vlo,vhi,True)) if not any(m[0]<u[1] and m[1]>u[0] for u in usedv)]
                if ms:fails.append((gid,'NONMONO',v))
            if not ms:fails.append((gid,'VI?',v));continue
            ns=[m for m in (find_all(E,e,elo,ehi) or find_all(E,e,elo,ehi,True)) if not any(m[0]<u[1] and m[1]>u[0] for u in usede)]
            if not ns:fails.append((gid,'EN?',e));continue
            vm,em=ms[0],ns[0];usedv.append(vm);usede.append(em);vpos=vm[1];out.append({'vi':{'start':vm[0],'end':vm[1]},'en':{'start':em[0],'end':em[1]}});npairs+=1
        g['labelled']=out;n+=1
    json.dump(a,open(f'{OUT}chapter-{ch}.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    print('chapter',ch,'groups labelled',n,'pairs mapped',npairs,'failures',len(fails))
    for f in fails:print('  ',f)
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True)
    for f in os.listdir(SRC):
        if not os.path.exists(OUT+f):shutil.copy(SRC+f,OUT+f)
    for ch in sys.argv[4:]:run(int(ch))
