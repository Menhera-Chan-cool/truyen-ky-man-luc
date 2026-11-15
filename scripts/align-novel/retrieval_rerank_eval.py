# Local evaluation script of the goal list (2026-11-16): paths point at this machine's work folder and local model cache; see docs/EVALUATION_PROTOCOL.md for what it measured.
"""Dev sentence retrieval: LaBSE top-5 reranked by bge-reranker-v2-m3 (cross-encoder), with and without a position prior. Adjacent = the retrieved sentence lies within two sentences of the gold one."""
import ctypes
ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x00004000)
import os,sys,json,pathlib
import numpy as np
sys.stdout.reconfigure(encoding='utf-8')
repo=pathlib.Path(r'D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc');work=pathlib.Path(r'D:/codex/2026-10-22/p/work')
sys.path.insert(0,str(repo/'scripts/align-novel'))
os.environ.update(HF_HOME=str(work/'novel-alignment-models'),HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false',HF_HUB_DISABLE_TELEMETRY='1')
import torch
from transformers import AutoTokenizer,AutoModel,AutoModelForSequenceClassification
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
from run import labse_encode
torch.set_num_threads(4)
spec=json.loads((repo/'scripts/align-novel/models.json').read_text())['sentence']
tok=AutoTokenizer.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True);lab=AutoModel.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True,use_safetensors=True).eval()
dense=load_file(hf_hub_download(spec['id'],'2_Dense/model.safetensors',revision=spec['revision'],local_files_only=True))
RR='BAAI/bge-reranker-v2-m3';REV='953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e'
rtok=AutoTokenizer.from_pretrained(RR,revision=REV,local_files_only=True);rr=AutoModelForSequenceClassification.from_pretrained(RR,revision=REV,local_files_only=True).eval()
def rerank(q,cands):
    out=[]
    for i in range(0,len(cands),5):
        b=rtok([q]*len(cands[i:i+5]),cands[i:i+5],padding=True,truncation=True,max_length=512,return_tensors='pt')
        with torch.inference_mode():out+=rr(**b).logits.view(-1).tolist()
    return np.array(out)
data=json.load(open(work/'phrase-alignment-20261115/heldout/gold.json',encoding='utf-8'));gold=data['gold'];pools=data['pools']
texts={}
def edition(ch):
    if ch not in texts:texts[ch]=json.load(open(work/f'clause-alignment-20261115/ready/chapter-{ch}.json',encoding='utf-8'))['editions']
    return texts[ch]
res={k:{'vi->en':[],'en->vi':[]} for k in ('labse','rerank','fuse','labse+pos','rerank+pos')}
adj={'labse':[],'rerank':[]}
for ch in sorted({g['chapter'] for g in gold}):
    T=edition(ch);vec={};spans={}
    for l in ('vi','en'):
        ss=pools[str(ch)][l];spans[l]=ss;vec[l]=labse_encode([T[l]['text'][a:b] for a,b in ss],tok,lab,dense)
    L={l:len(T[l]['text']) for l in ('vi','en')}
    for g in [x for x in gold if x['chapter']==ch]:
        for a,b,key in [('vi','en','vi->en'),('en','vi','en->vi')]:
            qs=spans[a];ts=spans[b]
            qi=[i for i,s in enumerate(qs) if s[0]<=g[a][0]<s[1] or g[a][0]<=s[0]<g[a][1]];ti=[i for i,s in enumerate(ts) if s[0]<g[b][1] and g[b][0]<s[1]]
            if not qi or not ti:continue
            qtext=T[a]['text'][qs[qi[0]][0]:qs[qi[0]][1]];cos=vec[b]@vec[a][qi[0]]
            qpos=qs[qi[0]][0]/L[a];tpos=np.array([s[0]/L[b] for s in ts]);pos=-np.abs(tpos-qpos)
            def rank_of(order):return min(int(np.where(order==t)[0][0])+1 for t in ti)
            order=np.argsort(-cos);top5=order[:5]
            cand=[T[b]['text'][ts[i][0]:ts[i][1]] for i in top5];r=rerank(qtext,cand)
            def with_top5(score5):
                o=list(top5[np.argsort(-score5)])+[i for i in order if i not in set(top5)];return rank_of(np.array(o))
            z=lambda x:(x-x.mean())/(x.std()+1e-6)
            res['labse'][key].append(rank_of(order));res['rerank'][key].append(with_top5(r));res['fuse'][key].append(with_top5(z(cos[top5])+z(r)))
            res['labse+pos'][key].append(rank_of(np.argsort(-(cos+.5*pos))))
            o2=np.argsort(-(cos+.5*pos));t5=o2[:5];c2=[T[b]['text'][ts[i][0]:ts[i][1]] for i in t5];r2=rerank(qtext,c2)
            o=list(t5[np.argsort(-r2)])+[i for i in o2 if i not in set(t5)];res['rerank+pos'][key].append(rank_of(np.array(o)))
            for name,top in (('labse',int(order[0])),('rerank',int(top5[int(np.argmax(r))]))):
                if top not in ti:adj[name].append(min(abs(top-t) for t in ti)<=2)
for name,d in res.items():
    print(name,{k:{'top1':round(sum(r==1 for r in v)/len(v),3),'mrr':round(sum(1/r for r in v)/len(v),3),'misses':sum(r!=1 for r in v)} for k,v in d.items()},flush=True)
for name,v in adj.items():print(name,'misses',len(v),'adjacent to the gold sentence:',sum(v))
