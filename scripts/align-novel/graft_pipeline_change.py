"""Carry the effect of a pipeline change over to the published chapters without rerunning the later steps (clause, phrase and label steps).
usage: graft.py PUBLISHED_DIR OLD_BASE_DIR NEW_BASE_DIR OUT_DIR CHAPTER...
OLD_BASE: run.py with the code the published data was made with; NEW_BASE: run.py with the changed code, same inputs.
Story and critique groups only in OLD_BASE were dropped or changed by the change; groups only in NEW_BASE were added or changed.
A removed group the change replaced (same counterpart overlapping on both sides) is replaced in place and keeps its id, so the labels written for that id still find it
(map_labelled_pairs.py has to be run afterwards: the replaced group carries no `labelled` list); the other removed groups are dropped; the other added groups get a new id c<N>.
Every group the change did not touch stays as published. Prints what changed."""
import json,sys,pathlib,collections
sys.stdout.reconfigure(encoding='utf-8')
pub,old,new,out=[pathlib.Path(a) for a in sys.argv[1:5]];chapters=[int(c) for c in sys.argv[5:]]
out.mkdir(parents=True,exist_ok=True)
key=lambda g:(g['section'],g['vi']['start'],g['vi']['end'],g['en']['start'],g['en']['end'])
prose=lambda g:g['section'] in('story','critique') and 'alias' not in str(g['id'])
ov=lambda a,b:max(0,min(a[1],b[1])-max(a[0],b[0]))
total=collections.Counter()
for n in chapters:
    f=f'chapter-{n}.json'
    P=json.load(open(pub/f,encoding='utf-8'));O=json.load(open(old/f,encoding='utf-8'));N=json.load(open(new/f,encoding='utf-8'))
    vi=P['editions']['vi']['text'];en=P['editions']['en']['text']
    for l in ('vi','en'):assert P['editions'][l]['text']==N['editions'][l]['text']==O['editions'][l]['text'],(n,l,'texts differ')
    ok={key(g) for g in O['groups'] if prose(g)};nk={key(g) for g in N['groups'] if prose(g)};pk={key(g):g for g in P['groups']}
    removed=(ok-nk)&set(pk);added=(nk-ok)-set(pk)
    gone_before=(ok-nk)-set(pk)            # the published chapter already lacks them (a later step)
    ng={key(g):g for g in N['groups'] if prose(g)}
    ids=[int(g['id']) for g in P['groups'] if str(g['id']).isdigit()];nxt=max(ids)+1 if ids else 0
    replace={};used=set()
    for k in sorted(added,key=lambda k:k[1]):
        cand=[r for r in removed if r not in used and ov((k[1],k[2]),(r[1],r[2]))>0 and ov((k[3],k[4]),(r[3],r[4]))>0]
        if cand:r=max(cand,key=lambda r:ov((k[1],k[2]),(r[1],r[2]))+ov((k[3],k[4]),(r[3],r[4])));replace[k]=r;used.add(r)
    groups=[];dropped=[];replaced=[];newgroups=[]
    for g in P['groups']:
        k=key(g)
        if prose(g) and k in removed:
            rep=[a for a,r in replace.items() if r==k]
            if rep:
                ng_=json.loads(json.dumps(ng[rep[0]]));ng_['id']=g['id'];groups.append(ng_);replaced.append((k,rep[0],bool(g.get('labelled'))))
            else:dropped.append((k,bool(g.get('labelled'))))
            continue
        groups.append(g)
    for k in sorted(added,key=lambda k:(k[1],k[3])):
        if k in replace:continue
        g=json.loads(json.dumps(ng[k]));g['id']='c%d'%nxt;nxt+=1;groups.append(g);newgroups.append(k)
    P['groups']=groups
    print(f'chapter {n}: published-groups {len(pk)} | removed by the change {len(removed)} (dropped {len(dropped)}, replaced {len(replaced)}, of which labelled {sum(1 for r in replaced if r[2])}) | added {len(added)} (new {len(newgroups)}) | already absent in published {len(gone_before)}')
    for k,lab in dropped:print('   DROPPED ',k[0],(k[1],k[2]),repr(vi[k[1]:k[2]][:44]),'<->',(k[3],k[4]),repr(en[k[3]:k[4]][:44]),'LABELLED' if lab else '')
    for k,r,lab in replaced:print('   REPLACED',(k[1],k[2]),repr(vi[k[1]:k[2]][:44]),'<->',(k[3],k[4]),'->',(r[1],r[2]),repr(vi[r[1]:r[2]][:44]),'<->',(r[3],r[4]),'LABELLED' if lab else '')
    for k in newgroups:print('   NEW     ',k[0],(k[1],k[2]),repr(vi[k[1]:k[2]][:44]),'<->',(k[3],k[4]),repr(en[k[3]:k[4]][:44]))
    total['dropped']+=len(dropped);total['replaced']+=len(replaced);total['new']+=len(newgroups)
    json.dump(P,open(out/f,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(dict(total))
