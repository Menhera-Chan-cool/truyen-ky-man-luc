"""After graft.py: move the label lines of the groups the change removed or replaced into the groups that now hold their text.
usage: relabel.py PUBLISHED_DIR GRAFT_DIR LABELS_DIR OUT_LABELS_DIR CHAPTER...
A label line is 'phrase = counterpart' under '#<group id>'. Each line is found in the published group (as map_labelled_pairs.py does), then given to the group of the graft
output that contains both phrases. Blocks of unchanged groups are copied as they are. Lines that fall in no group of the graft output are reported and left out."""
import json,sys,re,unicodedata,pathlib,collections
sys.stdout.reconfigure(encoding='utf-8')
pub,graft,labs,out=[pathlib.Path(a) for a in sys.argv[1:5]];chapters=[int(c) for c in sys.argv[5:]]
out.mkdir(parents=True,exist_ok=True)
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
key=lambda g:(g['vi']['start'],g['vi']['end'],g['en']['start'],g['en']['end'])
prose=lambda g:g['section'] in('story','critique') and 'alias' not in str(g['id'])
total=collections.Counter()
for n in chapters:
    text=open(labs/f'labels-ch{n}.txt',encoding='utf-8').read()
    P=json.load(open(pub/f'chapter-{n}.json',encoding='utf-8'));G=json.load(open(graft/f'chapter-{n}.json',encoding='utf-8'))
    V=P['editions']['vi']['text'];E=P['editions']['en']['text']
    pby={g['id']:g for g in P['groups']};gkeys={key(g) for g in G['groups']};gprose=[g for g in G['groups'] if prose(g)]
    # blocks in file order
    blocks=[];cur=None
    for line in text.split('\n'):
        if line.startswith('#'):cur=[line[1:].strip(),[]];blocks.append(cur);continue
        if cur is None or not line.strip():continue
        cur[1].append(line)
    moved=collections.defaultdict(list);kept=[];lost=[]
    for gid,lines in blocks:
        g=pby.get(gid)
        if g is None or key(g) in gkeys:kept.append((gid,lines));continue
        vlo,vhi,elo,ehi=g['vi']['start'],g['vi']['end'],g['en']['start'],g['en']['end'];vpos=vlo
        for line in lines:
            if ' = ' not in line:continue
            v,e=[x.strip() for x in line.split(' = ',1)]
            ms=find_all(V,v,vpos,vhi) or find_all(V,v,vpos,vhi,True) or find_all(V,v,vlo,vhi) or find_all(V,v,vlo,vhi,True)
            ns=find_all(E,e,elo,ehi) or find_all(E,e,elo,ehi,True)
            if not ms or not ns:lost.append((gid,line,'phrase not found'));continue
            vm,em=ms[0],ns[0];vpos=vm[1]
            tgt=[h for h in gprose if h['vi']['start']<=vm[0] and vm[1]<=h['vi']['end'] and h['en']['start']<=em[0] and em[1]<=h['en']['end']]
            if not tgt:lost.append((gid,line,'no group holds both'));continue
            moved[tgt[0]['id']].append((vm[0],line))
    # merge: moved lines go to their new group; a group that was both kept (same id) and receives lines keeps its own first
    final=collections.OrderedDict()
    for gid,lines in kept:final[gid]=list(lines)
    for gid,items in moved.items():
        final.setdefault(gid,[]).extend(l for _,l in sorted(items))
    # the repository keeps the label files with CRLF line endings
    with open(out/f'labels-ch{n}.txt','w',encoding='utf-8',newline='') as f:
        f.write((chr(13)+chr(10)).join(l for gid,lines in final.items() for l in ['#'+gid]+lines)+chr(13)+chr(10))
    nmoved=sum(len(v) for v in moved.values())
    print(f'chapter {n}: blocks {len(blocks)}, kept {len(kept)}, label lines moved {nmoved} into {len(moved)} groups, lost {len(lost)}')
    for gid,line,why in lost:print('   LOST',gid,why,'|',line[:80])
    total['moved']+=nmoved;total['lost']+=len(lost)
print(dict(total))
