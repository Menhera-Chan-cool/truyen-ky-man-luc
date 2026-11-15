# Local evaluation script of the goal list (2026-11-16): paths point at this machine's work folder and local model cache; see docs/EVALUATION_PROTOCOL.md for what it measured.
"""Dev sentence retrieval with LaBSE (+ position prior): raw top-1 and region-consistent top-1 (the retrieved sentence is the gold one or within two sentences of it)."""
import ctypes
ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x00004000)
import os,sys,json,pathlib
import numpy as np
sys.stdout.reconfigure(encoding='utf-8')
repo=pathlib.Path(r'D:/codex/2026-10-22/p/outputs/truyen-ky-man-luc');work=pathlib.Path(r'D:/codex/2026-10-22/p/work')
sys.path.insert(0,str(repo/'scripts/align-novel'))
os.environ.update(HF_HOME=str(work/'novel-alignment-models'),HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false',HF_HUB_DISABLE_TELEMETRY='1')
import torch
from transformers import AutoTokenizer,AutoModel
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
from run import labse_encode
torch.set_num_threads(4)
spec=json.loads((repo/'scripts/align-novel/models.json').read_text())['sentence']
tok=AutoTokenizer.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True);lab=AutoModel.from_pretrained(spec['id'],revision=spec['revision'],local_files_only=True,use_safetensors=True).eval()
dense=load_file(hf_hub_download(spec['id'],'2_Dense/model.safetensors',revision=spec['revision'],local_files_only=True))
data=json.load(open(work/'phrase-alignment-20261115/heldout/gold.json',encoding='utf-8'));gold=data['gold'];pools=data['pools']
texts={}
def edition(ch):
    if ch not in texts:texts[ch]=json.load(open(work/f'clause-alignment-20261115/ready/chapter-{ch}.json',encoding='utf-8'))['editions']
    return texts[ch]
cases=[]
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
            cos=vec[b]@vec[a][qi[0]];qpos=qs[qi[0]][0]/L[a];tpos=np.array([s[0]/L[b] for s in ts])
            cases.append((key,cos,qpos,tpos,ti))
for lam in (0,.5):
    out={}
    for key in ('vi->en','en->vi'):
        n=raw=adj=0
        for k,cos,qpos,tpos,ti in cases:
            if k!=key:continue
            top=int(np.argmax(cos-lam*np.abs(tpos-qpos)));n+=1;raw+=top in ti;adj+=min(abs(top-t) for t in ti)<=2
        out[key]={'n':n,'raw top-1':round(raw/n,3),'region-consistent top-1':round(adj/n,3)}
    print('lambda',lam,json.dumps(out),flush=True)
