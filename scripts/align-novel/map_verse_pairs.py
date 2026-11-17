import json,sys,unicodedata,shutil,os,re
sys.stdout.reconfigure(encoding='utf-8')
# usage: map_verse_pairs.py LABELS_DIR SRC_DIR OUT_DIR CHAPTER...
# LABELS_DIR holds labels-ch<N>.txt: a '#<poem pair index>' line (the index in the chapter's `poems` list; the first token after '#'), then 'vietnamese phrase = english phrase' lines
# (exact substrings of that pair's Vietnamese and English verse; the Vietnamese side is searched in reading order and may not overlap an earlier pair, the English side neither; if no exact match is found
# the search is repeated ignoring white space, so run-together verse lines need not be typed exactly).
# SRC_DIR is a published data directory (chapter-<N>.json); OUT_DIR gets a copy of it with a 'labelled' list on the labelled poem pairs.
# A 'han-labels-ch<N>.txt' next to it, if present, is read as well. It holds sections that add poem pairs for verse the pipeline left unpaired, appended to `poems` in file order:
#   #han E J [lo hi] [t:S-E]  a Sino-Vietnamese original (E = poem of the Vietnamese edition, by start offset or else by index; lo, hi = its lines from lo to hi, default all, cut where another pair's poem
#                      starts inside it). Its English side is the English track of pair J (an index, a name given by #new, or 'en:S-E' for a new track made from that English text) and it is primary
#                      only for the Vietnamese side, so English selections still use pair J; no line correspondences, contextOnly.
#   #new NAME E en:S-E [t:S-E] [lo hi]   a Vietnamese poem with no pair at all, paired to a new English track (lines cut at punctuation followed at once by a letter), primary on both sides.
#   #fix J en:S-E [t:S-E]   replace the English side of pair J (a wrong one) by a new English track; drops its line correspondences.
#   #title J vi:S-E en:S-E   attach title spans to pair J.
#   #trim J lo hi   cut the Vietnamese side of pair J to its lines lo..hi-1 (the lines of a Sino-Vietnamese original that the pipeline put in the same pair as the Vietnamese version, so that a #han pair can take them).
#   #enline J i S E   give line i of the English track of pair J (and of the pairs that copy its track) the span S..E (a line the pipeline cut in the middle of a word).
#   #enbreaks J   cut the English track of pair J (and of the pairs that copy its track) into lines at the English edition's own line breaks, or at its sentence ends where it has none (a poem the pipeline took for one long line; a label's
#                  target passage is the English lines it touches, and a passage over 1,200 characters is not shown).
# Structural sections (#fix, #trim, #enline, #enbreaks, #title) run first, then the plain '#<pair>' sections, then #new and #han in file order.
# Labels: 'phrase = phrase'; '... = @<Vietnamese phrase>' takes the English of that label in the section's own pair, '@J:<phrase>' that of pair J's section; '@lines' pairs the lines of the two
# tracks one to one; '@couplets' pairs each Vietnamese line with two English lines (4 against 8); '@map 0=0 6-7=6 15=16' pairs Vietnamese lines (ranges allowed) with English lines (ranges allowed) by index in the two tracks, in any order.
P=sys.argv[1].rstrip('/')+'/';SRC=sys.argv[2].rstrip('/')+'/';OUT=sys.argv[3].rstrip('/')+'/'
REF='<missing reference>';SPAN='<span>'
def isw(c):return unicodedata.category(c)[0] in 'LMN'
def boundary(text,i,j,lo,hi):
    # verse lines are run together ("Quan TrungKhói tan"): a capital letter after a letter also ends a word
    return (i==lo or not isw(text[i-1]) or not isw(text[i]) or text[i].isupper()) and (j>=hi or not isw(text[j]) or not isw(text[j-1]) or text[j].isupper())
def find_all(text,s,lo,hi,ci=False):
    t=text.lower() if ci else text;q=s.lower() if ci else s;res=[];i=lo
    while True:
        i=t.find(q,i,hi)
        if i<0:break
        j=i+len(q)
        if boundary(text,i,j,lo,hi):res.append((i,j))
        i+=1
    return res
def find_loose(text,s,lo,hi):
    # the same search with white space removed from both the text and the phrase
    idx=[i for i in range(lo,hi) if not text[i].isspace()];flat=''.join(text[i] for i in idx).lower();q=re.sub(r'\s+','',s).lower();res=[];k=0
    while q:
        k=flat.find(q,k)
        if k<0:break
        i,j=idx[k],idx[k+len(q)-1]+1
        if boundary(text,i,j,lo,hi):res.append((i,j))
        k+=1
    return res
def search(text,s,lo,hi):return find_all(text,s,lo,hi) or find_all(text,s,lo,hi,True) or find_loose(text,s,lo,hi)
def parse(path):
    sections=[];cur=None
    for line in open(path,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('#'):
            tok=line[1:].split()
            cur={'head':tok[0],'args':tok[1:],'labels':[]};sections.append(cur)
            if tok[0].isdigit():cur['head']='pair';cur['args']=[int(tok[0])]
            continue
        if cur is None:continue
        if line.strip() in('@lines','@couplets'):cur['labels'].append((line.strip(),None));continue
        if line.startswith('@map '):cur['labels'].append(('@map',line[5:].strip()));continue
        if ' = ' in line:v,e=line.split(' = ',1);cur['labels'].append((v.strip(),e.strip()))
    return sections
SPLIT=re.compile(r'(?<=[,.;:!?—”"\)])(?=[A-Za-z“"(])')
def split_lines(text,s,e):
    cuts=[s]+[s+m.end() for m in SPLIT.finditer(text[s:e]) if 0<m.end()<e-s]+[e];out=[]
    for x,y in zip(cuts,cuts[1:]):
        raw=text[x:y];x+=len(raw)-len(raw.lstrip());y-=len(raw)-len(raw.rstrip())
        if y>x:out.append({'start':x,'end':y})
    return out
def span(tok):a,b=tok.split(':',1)[1].split('-');return {'start':int(a),'end':int(b)}
def en_track(a,tok,title=None):
    s=span(tok);lines=split_lines(a['editions']['en']['text'],s['start'],s['end'])
    t={'id':f"verse-{lines[0]['start']}",'start':lines[0]['start'],'end':lines[-1]['end'],'lines':lines}
    if title:t['title']=span(title)
    return t
def edition_poem(a,E):
    ps=a['editions']['vi']['poems'];e=int(E)
    return next((q for q in ps if q['start']==e),None) or ps[e]
def vi_track(a,ep,n0,lo=None,hi=None):
    lines=ep['lines']
    if lo is None:
        cut=min([q['vi']['start'] for q in a['poems'][:n0] if ep['start']<q['vi']['start']<ep['end']],default=ep['end']);lines=[l for l in lines if l['end']<=cut]
    else:lines=lines[int(lo):int(hi)]
    t={'id':f"han-{lines[0]['start']}",'start':lines[0]['start'],'end':lines[-1]['end'],'lines':lines}
    if ep.get('title') and (lo is None or int(lo)==0):t['title']=ep['title']
    return t
def pair(vi,en,primary_en,score=.75,margin=.1):return {'vi':vi,'en':en,'score':score,'margin':margin,'primary':{'vi':True,'en':primary_en},'correspondences':[],'contextOnly':True}
def expand(p,labels,ref,a):
    # turn '@lines' / '@couplets' / '@' references into plain (vietnamese, english) texts
    V=a['editions']['vi']['text'];E=a['editions']['en']['text'];out=[]
    trim=lambda s:s.strip().rstrip(',.;:!?—”"')
    for v,e in labels:
        if v=='@map':
            vl,el=p['vi']['lines'],p['en']['lines']
            def ends(T,a,b):
                while b>a and (T[b-1].isspace() or T[b-1] in ',.;:!?—”"'):b-=1
                return a,b
            for tok in e.split():
                h,_,r=tok.partition('=');h1,_,h2=h.partition('-');r1,_,r2=r.partition('-');h1,h2,r1,r2=int(h1),int(h2 or h1),int(r1),int(r2 or r1)
                if h2>=len(vl) or r2>=len(el):raise SystemExit(f'@map {tok}: out of range ({len(vl)} vietnamese lines, {len(el)} english lines)')
                out.append((SPAN,(ends(V,vl[h1]['start'],vl[h2]['end']),ends(E,el[r1]['start'],el[r2]['end']))))
            continue
        if v in('@lines','@couplets'):
            vl,el=p['vi']['lines'],p['en']['lines'];k=1 if v=='@lines' else 2
            if len(el)!=k*len(vl):raise SystemExit(f'{v}: {len(vl)} vietnamese lines against {len(el)} english lines')
            for i,l in enumerate(vl):out.append((trim(V[l['start']:l['end']]),trim(E[el[k*i]['start']:el[k*i+k-1]['end']])))
        elif e.startswith('@'):
            j,sep,key=e[1:].partition(':')
            if not sep or not j.isdigit():j,key=None,e[1:]
            d=ref(int(j) if j else None)
            out.append((v,d[key] if key in d else REF+key))
        else:out.append((v,e))
    return out
def map_pair(a,p,pairs,k,fails):
    V=a['editions']['vi']['text'];E=a['editions']['en']['text']
    vlo,vhi,elo,ehi=p['vi']['start'],p['vi']['end'],p['en']['start'],p['en']['end']
    usedv=[];usede=[];out=[];vpos=vlo
    for v,e in pairs:
        if v==SPAN:
            (a0,a1),(b0,b1)=e;out.append({'vi':{'start':a0,'end':a1},'en':{'start':b0,'end':b1}});continue
        if e.startswith(REF):fails.append((k,'REF?',e[len(REF):]));continue
        ms=search(V,v,vpos,vhi)
        if not ms:
            ms=[m for m in search(V,v,vlo,vhi) if not any(m[0]<u[1] and m[1]>u[0] for u in usedv)]
            if ms:fails.append((k,'NONMONO',v))
        if not ms:fails.append((k,'VI?',v));continue
        ns=[m for m in search(E,e,elo,ehi) if not any(m[0]<u[1] and m[1]>u[0] for u in usede)]
        if not ns:fails.append((k,'EN?',e));continue
        vm,em=ms[0],ns[0];usedv.append(vm);usede.append(em);vpos=vm[1];out.append({'vi':{'start':vm[0],'end':vm[1]},'en':{'start':em[0],'end':em[1]}})
    p['labelled']=out
    return len(out)
def run(ch):
    secs=parse(f'{P}labels-ch{ch}.txt');hp=f'{P}han-labels-ch{ch}.txt'
    if os.path.exists(hp):secs+=parse(hp)
    a=json.load(open(f'{SRC}chapter-{ch}.json',encoding='utf-8'));fails=[];n=0;npairs=0;n0=len(a.get('poems',[]));names={}
    own={s['args'][0]:s['labels'] for s in secs if s['head']=='pair'}
    base=lambda j:{v:e for v,e in own.get(j,[]) if e is not None}
    plain=[s for s in secs if s['head']=='pair'];STRUCT=('title','fix','trim','enline','enbreaks');structural=[s for s in secs if s['head'] in STRUCT];extra=[s for s in secs if s['head']!='pair' and s['head'] not in STRUCT]
    def target(spec,title=None):
        # the English side for a section: an existing pair index, a name given by #new, or a new track
        if spec.startswith('en:'):return en_track(a,spec,title),True
        j=names[spec] if spec in names else int(spec)
        return json.loads(json.dumps(a['poems'][j]['en'])),False
    def same_en(j,fn):
        # apply fn to the English track of pair j and of every pair that copies the same track (same id and span)
        t=a['poems'][j]['en'];key=(t['id'],t['start'],t['end'])
        for p in a['poems']:
            if (p['en']['id'],p['en']['start'],p['en']['end'])==key:fn(p['en'])
    for s in structural:
        h,ar=s['head'],s['args'];key=(h,)+tuple(ar)
        try:
            if h=='title':
                p=a['poems'][int(ar[0])]
                for tok in ar[1:]:p['vi' if tok.startswith('vi:') else 'en']['title']=span(tok)
            elif h=='trim':
                p=a['poems'][int(ar[0])];lines=p['vi']['lines'][int(ar[1]):int(ar[2])];p['vi']['lines']=lines;p['vi']['start']=lines[0]['start'];p['vi']['end']=lines[-1]['end']
                for c in p['correspondences']:c['vi']=[x for x in c['vi'] if lines[0]['start']<=x['start'] and x['end']<=lines[-1]['end']]
                p['correspondences']=[c for c in p['correspondences'] if c['vi']]
            elif h=='enline':
                j,i,s0,s1=map(int,ar[:4]);old=dict(a['poems'][j]['en']['lines'][i]);new={'start':s0,'end':s1}
                def fix(t,i=i,new=new,old=old):
                    if t['lines'][i]==old:t['lines'][i]=dict(new)
                same_en(j,fix)
                for p in a['poems']:
                    for c in p['correspondences']:c['en']=[dict(new) if x==old else x for x in c['en']]
            elif h=='enbreaks':
                j=int(ar[0]);t=a['poems'][j]['en'];ET=a['editions']['en']['text'];inner=[b for b in a['editions']['en'].get('breaks',[]) if t['start']<b<t['end']] or [t['start']+m.end() for m in re.finditer(r'[.!?]["”]?(?=\s+[A-Z"“(])',ET[t['start']:t['end']])];cuts=[t['start']]+inner+[t['end']];new=[]
                for c0,c1 in zip(cuts,cuts[1:]):
                    while c0<c1 and ET[c0].isspace():c0+=1
                    while c1>c0 and ET[c1-1].isspace():c1-=1
                    if c1>c0:new.append({'start':c0,'end':c1})
                same_en(j,lambda t,new=new:t.__setitem__('lines',[dict(x) for x in new]))
            elif h=='fix':
                j=int(ar[0]);p=a['poems'][j];p['en']=en_track(a,ar[1],ar[2] if len(ar)>2 else None);p['primary']['en']=True;p['correspondences']=[];p['contextOnly']=True
                npairs+=map_pair(a,p,expand(p,s['labels'],lambda j2,j=j:base(j if j2 is None else j2),a),key,fails);n+=1
        except (StopIteration,KeyError,IndexError,ValueError) as ex:fails.append((key,'SECTION?',repr(ex)))
    for s in plain:
        k=s['args'][0]
        if k>=n0:fails.append((k,'NO POEM',''));continue
        p=a['poems'][k];npairs+=map_pair(a,p,expand(p,s['labels'],lambda j,k=k:base(k if j is None else j),a),k,fails);n+=1
    for s in extra:
        h,ar=s['head'],s['args'];key=(h,)+tuple(ar)
        try:
            if h=='han':
                E,J=ar[0],ar[1];rest=ar[2:];lohi=[x for x in rest if not x.startswith('t:')];title=next((x for x in rest if x.startswith('t:')),None)
                en,fresh=target(J,title);ep=edition_poem(a,E)
                bp=a['poems'][int(J)] if J.isdigit() else None
                p=pair(vi_track(a,ep,n0,*lohi[:2]),en,fresh,*((bp['score'],bp['margin']) if bp else ()))
            elif h=='new':
                name,E,spec=ar[0],ar[1],ar[2];rest=ar[3:];lohi=[x for x in rest if not x.startswith('t:')];title=next((x for x in rest if x.startswith('t:')),None)
                ep=edition_poem(a,E);p=pair(vi_track(a,ep,n0,*lohi[:2]),en_track(a,spec,title),True)
                p['vi']['id']=f"verse-{p['vi']['start']}";names[name]=len(a['poems'])
            else:fails.append((key,'DIRECTIVE?',h));continue
        except (StopIteration,KeyError,IndexError,ValueError) as ex:fails.append((key,'SECTION?',repr(ex)));continue
        a['poems'].append(p);idx=len(a['poems'])-1
        rp=int(ar[1]) if h=='han' and ar[1].isdigit() else idx
        npairs+=map_pair(a,p,expand(p,s['labels'],lambda j,rp=rp:base(rp if j is None else j),a),key,fails);n+=1
    json.dump(a,open(f'{OUT}chapter-{ch}.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    print('chapter',ch,'poem pairs labelled',n,'pairs mapped',npairs,'failures',len(fails))
    for f in fails:print('  ',f)
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True)
    for f in os.listdir(SRC):
        if not os.path.exists(OUT+f):shutil.copy(SRC+f,OUT+f)
    for ch in sys.argv[4:]:run(int(ch))
