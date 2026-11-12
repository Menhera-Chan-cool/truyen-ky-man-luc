import argparse,datetime,gc,json,os,pathlib,time
from alignment import align_sequences,align_candidates,softmax_links,reader_span,vietnamese_word_spans

def join_units(units):
    result={'text':'','starts':[],'ends':[]}
    for unit in units:
        if result['text']:
            result['text']+=' ';result['starts'].append(unit['start']);result['ends'].append(unit['start'])
        result['text']+=unit['text'];result['starts']+=unit['starts'];result['ends']+=unit['ends']
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cache',required=True);parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);parser.add_argument('--threads',type=int,default=2);args=parser.parse_args()
    os.environ['HF_HOME']=str(pathlib.Path(args.cache).resolve());os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
    import numpy as np
    import torch
    from transformers import AutoTokenizer,AutoModel
    torch.set_num_threads(args.threads)
    print(json.dumps({'pid':os.getpid(),'threads':args.threads}),flush=True)
    models=json.loads(pathlib.Path(__file__).with_name('models.json').read_text());output=pathlib.Path(args.output);output.mkdir(parents=True,exist_ok=True)
    inputs=[json.loads(f.read_text(encoding='utf-8')) for f in sorted(pathlib.Path(args.input).glob('*.input.json'))]
    start=time.perf_counter()
    def load(name):
        spec=models[name];tok=AutoTokenizer.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True,trust_remote_code=False)
        model=AutoModel.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True,trust_remote_code=False,use_safetensors=True).eval()
        return tok,model
    tokenizer,model=load('sentence')
    def encode(texts):
        chunks=[];owners=[]
        for owner,text in enumerate(texts):
            offsets=tokenizer(text,add_special_tokens=False,return_offsets_mapping=True)['offset_mapping']
            if not offsets:chunks.append('query: ');owners.append(owner);continue
            for i in range(0,len(offsets),432):
                end=min(len(offsets),i+480);chunks.append('query: '+text[offsets[i][0]:offsets[end-1][1]]);owners.append(owner)
                if end==len(offsets):break
        vectors=[[] for _ in texts]
        with torch.inference_mode():
            for at in range(0,len(chunks),8):
                batch=tokenizer(chunks[at:at+8],padding=True,return_tensors='pt',truncation=False)
                if batch['input_ids'].shape[1]>512:raise ValueError('Sentence window exceeds model limit')
                hidden=model(**batch).last_hidden_state;mask=batch['attention_mask'].unsqueeze(-1);emb=(hidden*mask).sum(1)/mask.sum(1)
                for owner,vector in zip(owners[at:at+8],emb):vectors[owner].append(vector.numpy())
        result=np.stack([np.mean(v,axis=0) for v in vectors]);return result/np.maximum(np.linalg.norm(result,axis=1,keepdims=True),1e-9)
    for item in inputs:
        editions=item['editions'];groups=[]
        for section in ['story','critique','notes']:
            vi=[s for s in editions['vi']['sentences'] if s['section']==section];en=[s for s in editions['en']['sentences'] if s['section']==section]
            if not vi or not en:continue
            combined=encode([s['text'] for s in vi+en]);left,right=combined[:len(vi)],combined[len(vi):]
            pairs=align_sequences(left,right)
            used_vi={i for p in pairs for i in p['vi']};used_en={i for p in pairs for i in p['en']}
            for p in pairs:p['primary']={'vi':True,'en':True}
            for candidate in align_candidates(left,right):
                new_vi=all(i not in used_vi for i in candidate['vi']);new_en=all(i not in used_en for i in candidate['en'])
                if (new_vi or new_en) and candidate['score']>=.85 and candidate['margin']>=.015:
                    candidate['primary']={'vi':new_vi,'en':new_en};pairs.append(candidate)
            for pair in pairs:
                left=join_units([vi[i] for i in pair['vi']]);right=join_units([en[i] for i in pair['en']])
                groups.append({'section':section,'score':pair['score'],'margin':pair['margin'],'primary':pair['primary'],'viInput':left,'enInput':right})
        item['groups']=groups
        print(json.dumps({'chapter':item['chapterId'],'sentenceGroups':len(groups),'seconds':round(time.perf_counter()-start,2)}),flush=True)
    del model,tokenizer;gc.collect()
    tokenizer,model=load('word')
    def token_vectors(text):
        encoded=tokenizer(text,return_offsets_mapping=True,return_overflowing_tokens=True,stride=48,max_length=512,truncation=True,padding=True,return_tensors='pt')
        offsets=encoded.pop('offset_mapping');encoded.pop('overflow_to_sample_mapping',None);vectors={}
        with torch.inference_mode():
            for at in range(0,len(offsets),4):
                batch={key:value[at:at+4] for key,value in encoded.items()}
                hidden=model(**batch,output_hidden_states=True).hidden_states[8]
                for row,spans in zip(hidden,offsets[at:at+4]):
                    for vector,(a,b) in zip(row,spans.tolist()):
                        if a==b:continue
                        vectors.setdefault((a,b),[]).append(vector.numpy())
        return [(a,b,np.mean(v,axis=0)) for (a,b),v in sorted(vectors.items())]
    for item in inputs:
        groups=[]
        for index,group in enumerate(item['groups']):
            vi,en=group.pop('viInput'),group.pop('enInput');a=token_vectors(vi['text']);b=token_vectors(en['text'])
            links=[]
            if a and b:
                scores=np.stack([x[2] for x in a])@np.stack([x[2] for x in b]).T
                candidates=softmax_links(scores)
                for i in range(len(a)):
                    for _,j,score in sorted((v for v in candidates if v[0]==i),key=lambda v:v[2],reverse=True)[:3]:
                        left=reader_span(vi,a[i][0],a[i][1]);right=reader_span(en,b[j][0],b[j][1]);links.append({'vi':left,'en':right,'score':round(score,5)})
            def span(unit):
                left=unit['starts'][0];right=unit['ends'][-1];return {'start':left,'end':right}
            groups.append({**group,'id':str(index),'vi':span(vi),'en':span(en),'links':links})
            if index%30==0:print(json.dumps({'chapter':item['chapterId'],'wordGroups':index,'of':len(item['groups'])}),flush=True)
        artifact={'schema':1,'codec':item['editions']['vi']['codec'],'algorithm':'e5-mbert-uts95-1','models':models,'chapterId':item['chapterId'],'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'editions':{l:{k:v for k,v in e.items() if k!='sentences'} for l,e in item['editions'].items()},'groups':groups}
        artifact['editions']['vi']['words']=vietnamese_word_spans(item['editions']['vi']['sentences'])
        destination=output/(item['chapterId']+'.json');temp=destination.with_suffix('.tmp')
        temp.write_text(json.dumps(artifact,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(destination)
        print(json.dumps({'chapter':item['chapterId'],'completed':True,'groups':len(groups),'secondsTotal':round(time.perf_counter()-start,2)}),flush=True)
