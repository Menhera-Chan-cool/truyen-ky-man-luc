import argparse,datetime,gc,json,os,pathlib,sys,time
import numpy as np
from alignment import softmax_links,reader_span,vietnamese_word_spans
from context_alignment import align_contexts,add_caption_aliases,split_reader_units,mask_references,slice16,u16
import regex

ALGORITHM='labse-context-mbert-1'

def labse_encode(texts,tokenizer,model,dense):
    import torch
    if not texts:return np.empty((0,dense['linear.weight'].shape[0]),dtype=np.float32)
    # Overflow windows retain every token, including long notes, without adding an E5 query prefix.
    encoded=tokenizer(texts,padding=True,return_tensors='pt',truncation=True,max_length=256,
                      return_overflowing_tokens=True,stride=32)
    owners=encoded.pop('overflow_to_sample_mapping').tolist();vectors=[[] for _ in texts]
    if encoded['input_ids'].shape[1]>256:raise ValueError('LaBSE window exceeds 256 tokens')
    with torch.inference_mode():
        for at in range(0,len(owners),4):
            batch={key:value[at:at+4] for key,value in encoded.items()}
            last=batch['attention_mask'].any(dim=0).nonzero()
            width=int(last[-1,0])+1 if len(last) else 1
            batch={key:value[:,:width] for key,value in batch.items()}
            cls=model(**batch).last_hidden_state[:,0]
            projected=torch.tanh(torch.nn.functional.linear(cls,dense['linear.weight'],dense['linear.bias']))
            projected=torch.nn.functional.normalize(projected,p=2,dim=1)
            for owner,vector in zip(owners[at:at+4],projected):vectors[owner].append(vector.cpu().numpy())
    if any(not value for value in vectors):raise ValueError('LaBSE silently dropped an input')
    result=np.stack([np.mean(value,axis=0) for value in vectors])
    return result/np.maximum(np.linalg.norm(result,axis=1,keepdims=True),1e-9)

def align_words(contexts,token_vectors):
    groups=[]
    for index,original in enumerate(contexts):
        group=dict(original);vi,en=group.pop('viInput'),group.pop('enInput')
        a,b=token_vectors(mask_references(vi['text'])),token_vectors(mask_references(en['text']));links=[]
        if a and b:
            scores=np.stack([value[2] for value in a])@np.stack([value[2] for value in b]).T
            candidates=softmax_links(scores)
            for i in range(len(a)):
                for _,j,score in sorted((v for v in candidates if v[0]==i),key=lambda v:v[2],reverse=True)[:3]:
                    left=reader_span(vi,a[i][0],a[i][1]);right=reader_span(en,b[j][0],b[j][1])
                    if left[0]>=left[1] or right[0]>=right[1]:continue
                    if any(not any(p['start']<=value[0] and value[1]<=p['end'] for p in unit['parts'])
                           for value,unit in [(left,vi),(right,en)]):continue
                    links.append({'vi':left,'en':right,'score':round(score,5)})
        groups.append({**group,'id':str(index),'vi':{'start':vi['starts'][0],'end':vi['ends'][-1]},
                       'en':{'start':en['starts'][0],'end':en['ends'][-1]},'parts':{'vi':vi['parts'],'en':en['parts']},'links':links})
    return groups

def english_words(edition):
    text=edition['text'];cuts=sorted(set([0,*edition.get('breaks',[]),u16(text)]));result=[]
    for a,b in zip(cuts,cuts[1:]):
        block=slice16(text,a,b)
        for m in regex.finditer(r"[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*",block):
            result.append({'start':a+u16(block[:m.start()]),'end':a+u16(block[:m.end()])})
    return result

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser();parser.add_argument('--cache',required=True);parser.add_argument('--input',required=True)
    parser.add_argument('--output',required=True);parser.add_argument('--threads',type=int,default=2);args=parser.parse_args()
    if not 1<=args.threads<=4:raise ValueError('Use 1–4 isolated CPU threads')
    cache=pathlib.Path(args.cache).resolve();source=pathlib.Path(args.input).resolve();output=pathlib.Path(args.output).resolve()
    if source==output:raise ValueError('Keep artifact output separate from source snapshots')
    os.environ.update(HF_HOME=str(cache),HF_HUB_DISABLE_TELEMETRY='1',TOKENIZERS_PARALLELISM='false',
                      HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
    import torch
    from transformers import AutoTokenizer,AutoModel
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file
    torch.set_num_threads(args.threads)
    models=json.loads(pathlib.Path(__file__).with_name('models.json').read_text(encoding='utf-8'))
    if models['sentence']['id']!='sentence-transformers/LaBSE' or models['sentence'].get('pooling')!='cls-dense-tanh-normalize':
        raise ValueError('The pinned LaBSE CLS/Dense/Tanh/Normalize recipe is required')
    def load(name):
        spec=models[name]
        tokenizer=AutoTokenizer.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True,trust_remote_code=False)
        model=AutoModel.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True,trust_remote_code=False,use_safetensors=True).eval()
        return tokenizer,model
    output.mkdir(parents=True,exist_ok=True);started=time.perf_counter()
    inputs=[json.loads(file.read_text(encoding='utf-8')) for file in sorted(source.glob('*.input.json'))]
    print(json.dumps({'pid':os.getpid(),'threads':args.threads,'algorithm':ALGORITHM,'chapters':len(inputs)}),flush=True)
    if not inputs:return
    tokenizer,model=load('sentence')
    dense=load_file(hf_hub_download(models['sentence']['id'],'2_Dense/model.safetensors',
                                   revision=models['sentence']['revision'],local_files_only=True))
    memo={}
    def encode(texts):
        missing=list(dict.fromkeys(text for text in texts if text not in memo))
        if missing:
            for text,vector in zip(missing,labse_encode(missing,tokenizer,model,dense)):memo[text]=vector
        return np.stack([memo[text] for text in texts])
    for item in inputs:
        item['contexts'],item['notePairs']=align_contexts(item,encode)
        print(json.dumps({'chapter':item['chapterId'],'sentenceGroups':len(item['contexts']),'notePairs':len(item['notePairs']),
                          'seconds':round(time.perf_counter()-started,2)}),flush=True)
    del encode,memo,dense,model,tokenizer;gc.collect()
    tokenizer,model=load('word')
    def token_vectors(text):
        encoded=tokenizer(text,return_offsets_mapping=True,return_overflowing_tokens=True,stride=48,max_length=512,
                          truncation=True,padding=True,return_tensors='pt')
        offsets=encoded.pop('offset_mapping');encoded.pop('overflow_to_sample_mapping',None);vectors={}
        with torch.inference_mode():
            for at in range(0,len(offsets),4):
                batch={key:value[at:at+4] for key,value in encoded.items()}
                hidden=model(**batch,output_hidden_states=True).hidden_states[8]
                for row,spans in zip(hidden,offsets[at:at+4]):
                    for vector,(a,b) in zip(row,spans.tolist()):
                        if a==b:continue
                        vectors.setdefault((a,b),[]).append(vector.cpu().numpy())
        return [(a,b,np.mean(value,axis=0)) for (a,b),value in sorted(vectors.items())]
    for item in inputs:
        groups=align_words(item['contexts'],token_vectors)
        artifact={'schema':1,'codec':item['editions']['vi']['codec'],'algorithm':ALGORITHM,'models':models,
                  'chapterId':item['chapterId'],'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'editions':{l:{k:v for k,v in edition.items() if k!='sentences'} for l,edition in item['editions'].items()},
                  'groups':groups,'refinementVersion':1,'notePairs':item['notePairs']}
        artifact['editions']['vi']['words']=vietnamese_word_spans(split_reader_units(item['editions']['vi']['sentences'],item['editions']['vi'].get('breaks',[])))
        artifact['editions']['en']['words']=english_words(item['editions']['en'])
        aliases=add_caption_aliases(artifact,item['structures'])
        destination=output/(item['chapterId']+'.json');temporary=destination.with_suffix('.tmp')
        temporary.write_text(json.dumps(artifact,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temporary.replace(destination)
        print(json.dumps({'chapter':item['chapterId'],'completed':True,'groups':len(artifact['groups']),**aliases,
                          'secondsTotal':round(time.perf_counter()-started,2)}),flush=True)

if __name__=='__main__':main()
