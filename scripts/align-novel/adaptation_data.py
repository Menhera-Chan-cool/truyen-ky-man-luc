"""Version-bound parallel pairs for adaptation, split by entire chapter."""
import argparse,hashlib,json,pathlib,re,unicodedata
from context_alignment import mask_references,slice16,u16

TEST={'chapter-1','chapter-2','chapter-3','chapter-14','chapter-19'}
DEV={'chapter-4'}

def load_artifacts(directory):
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(pathlib.Path(directory).glob('chapter-*.json')) if re.fullmatch(r'chapter-\d+\.json',p.name)]

def normalized(text):return ' '.join(unicodedata.normalize('NFC',mask_references(text)).split())

def export_pairs(artifacts,test=None,dev=None):
    test=TEST if test is None else set(test);dev=DEV if dev is None else set(dev)
    if test&dev:raise ValueError('Chapter splits overlap')
    result={'test':[],'dev':[],'train':[]};seen={'vi':set(),'en':set()};skipped=0
    def split(a):return 'test' if a['chapterId'] in test else 'dev' if a['chapterId'] in dev else 'train'
    for a in sorted(artifacts,key=lambda a:({'test':0,'dev':1,'train':2}[split(a)],a['chapterId'])):
        for l in ['vi','en']:
            e=a['editions'][l]
            if hashlib.sha256(e['text'].encode()).hexdigest()!=e['hash']:raise ValueError('Source hash mismatch')
        for g in a['groups']:
            if g.get('kind') or g.get('tracks') or g['section'] not in ['story','critique'] or g['score']<.72 or g['margin']<.025 or not all(g.get('primary',{}).get(l) for l in ['vi','en']):
                skipped+=1;continue
            texts={};valid=True
            for l in ['vi','en']:
                p=g[l];parts=g.get('parts',{}).get(l,[p])
                if len(parts)!=1 or parts[0]!=p or not 0<=p['start']<p['end']<=u16(a['editions'][l]['text']):valid=False;break
                texts[l]=normalized(slice16(a['editions'][l]['text'],p['start'],p['end']))
                if not 3<=len(texts[l].split())<=70 or not 10<=len(texts[l])<=600:valid=False;break
            if not valid or any(texts[l].casefold() in seen[l] for l in ['vi','en']):skipped+=1;continue
            years=[set(re.findall(r'\b\d{3,4}\b',texts[l])) for l in ['vi','en']]
            if years[0]!=years[1]:skipped+=1;continue
            for l in ['vi','en']:seen[l].add(texts[l].casefold())
            result[split(a)].append({'chapterId':a['chapterId'],**texts,'sourceVersions':{l:{k:a['editions'][l][k] for k in ['versionId','revision','hash']} for l in ['vi','en']},
                                     'spans':{l:g[l] for l in ['vi','en']},'score':g['score'],'margin':g['margin']})
    result['stats']={**{s:len(result[s]) for s in ['train','dev','test']},'skipped':skipped,'testChapters':sorted(test),'devChapters':sorted(dev)}
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
    data=export_pairs(load_artifacts(args.input))
    path=pathlib.Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(data['stats']))
