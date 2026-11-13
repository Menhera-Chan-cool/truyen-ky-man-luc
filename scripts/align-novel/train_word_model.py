"""Bounded CPU mBERT adaptation: frozen-teacher SO and bilingual masked LM.

AWESOME-align objective reference: https://github.com/neulab/awesome-align
Only encoder layers6/7 train, so the serving hidden_states[8] actually changes.
"""
import argparse,hashlib,json,os,pathlib,random,time

def configure_trainable(model):
    for p in model.parameters():p.requires_grad_(False)
    for index in [6,7]:
        for p in model.bert.encoder.layer[index].parameters():p.requires_grad_(True)
    return [n for n,p in model.named_parameters() if p.requires_grad]

def alignment_loss(source,target,guide):
    scores=source@target.T
    if guide.shape!=scores.shape or not guide.any():raise ValueError('Invalid alignment guide')
    return -((scores.softmax(1)*guide).sum()/source.shape[0]+(scores.softmax(0)*guide).sum()/target.shape[0])

def main():
    os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TOKENIZERS_PARALLELISM='false',HF_HUB_DISABLE_PROGRESS_BARS='1')
    import torch
    from transformers import AutoTokenizer,AutoModelForMaskedLM
    p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--data',required=True);p.add_argument('--output',required=True)
    p.add_argument('--steps',type=int,default=300);p.add_argument('--minutes',type=int,default=15);args=p.parse_args()
    if not 1<=args.steps<=1000 or not 1<=args.minutes<=30:raise ValueError('Invalid training budget')
    output=pathlib.Path(args.output)
    if output.exists() and any(output.iterdir()):raise ValueError('Checkpoint directory must be empty')
    output.mkdir(parents=True,exist_ok=True);random.seed(42);torch.manual_seed(42);torch.set_num_threads(2);torch.set_num_interop_threads(1)
    dataset=pathlib.Path(args.data);data=json.loads(dataset.read_text(encoding='utf-8'))
    train=data['train'];assert train and not ({x['chapterId'] for x in train}&(set(data['stats']['testChapters'])|set(data['stats']['devChapters'])))
    base=json.loads(pathlib.Path(__file__).with_name('models.json').read_text())['word']
    if pathlib.Path(args.model).name!=base['revision']:raise ValueError('Use the pinned base-model snapshot directory')
    tokenizer=AutoTokenizer.from_pretrained(args.model,local_files_only=True,trust_remote_code=False)
    model=AutoModelForMaskedLM.from_pretrained(args.model,local_files_only=True,trust_remote_code=False,use_safetensors=True)
    names=configure_trainable(model);model.eval();prepared=[];started=time.perf_counter()
    for row in train:
        ids=[tokenizer(row[l],add_special_tokens=False)['input_ids'] for l in ['vi','en']]
        if min(map(len,ids))<3 or sum(map(len,ids))+3>192:continue
        prepared.append({'ids':ids,'chapterId':row['chapterId']})
    random.shuffle(prepared);prepared=prepared[:1000]
    if len(prepared)<20:raise ValueError('Insufficient clean parallel data')
    def hidden(ids):return model.bert(torch.tensor([[tokenizer.cls_token_id,*ids,tokenizer.sep_token_id]]),output_hidden_states=True).hidden_states[8][0,1:-1]
    with torch.no_grad():
        for index,row in enumerate(prepared):
            a,b=map(hidden,row['ids']);scores=a@b.T
            row['guide']=((scores.softmax(1)>.001)&(scores.softmax(0)>.001)).detach()
            if index%100==0:print(json.dumps({'stage':'teacher','pairs':index,'seconds':round(time.perf_counter()-started,1)}),flush=True)
    prepared=[r for r in prepared if r['guide'].any()]
    optimizer=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=2e-5,weight_decay=.01)
    initial=model.bert.encoder.layer[7].attention.self.query.weight.detach().clone();model.train();losses=[]
    train_start=time.perf_counter()
    with (output/'training.jsonl').open('w',encoding='utf-8') as log:
        for step in range(args.steps):
            if time.perf_counter()-train_start>args.minutes*60:break
            row=prepared[step%len(prepared)];source,target=row['ids'];optimizer.zero_grad(set_to_none=True)
            so=alignment_loss(hidden(source),hidden(target),row['guide'])
            ids=[tokenizer.cls_token_id,*source,tokenizer.sep_token_id,*target,tokenizer.sep_token_id]
            boundary=len(source)+2;positions=list(range(1,boundary-1)) if step%2==0 else list(range(boundary,len(ids)-1))
            positions=random.sample(positions,max(1,round(len(positions)*.15)))
            labels=torch.tensor([ids[i] for i in positions]);masked=ids.copy()
            for i in positions:
                pick=random.random()
                if pick<.8:masked[i]=tokenizer.mask_token_id
                elif pick<.9:masked[i]=random.randrange(model.config.vocab_size)
            states=model.bert(torch.tensor([masked]),token_type_ids=torch.tensor([[0]*boundary+[1]*(len(ids)-boundary)])).last_hidden_state[0,positions]
            # Only masked positions enter the 119k-vocabulary head; avoid full-sequence logits.
            tlm=torch.nn.functional.cross_entropy(model.cls(states),labels)
            loss=so+.1*tlm
            if not torch.isfinite(loss):raise ValueError('Non-finite training loss')
            loss.backward();torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad],1.)
            optimizer.step();entry={'step':step+1,'loss':float(loss.detach()),'so':float(so.detach()),'tlm':float(tlm.detach()),'seconds':round(time.perf_counter()-train_start,2)}
            losses.append(entry);log.write(json.dumps(entry)+'\n');log.flush()
            if (step+1)%25==0:print(json.dumps({'stage':'train',**entry}),flush=True)
    if not losses or torch.equal(initial,model.bert.encoder.layer[7].attention.self.query.weight):raise ValueError('Training did not change extractor weights')
    model.eval();model.save_pretrained(output);tokenizer.save_pretrained(output)
    weight=output/'model.safetensors'
    if not weight.is_file():raise ValueError('Expected safe checkpoint serialization')
    manifest={'base':base,'datasetSha256':hashlib.sha256(dataset.read_bytes()).hexdigest(),
              'seed':42,'steps':len(losses),'availablePairs':len(prepared),'uniqueTrainingPairs':min(len(losses),len(prepared)),
              'trainingChapters':sorted({prepared[step%len(prepared)]['chapterId'] for step in range(len(losses))}),
              'heldoutChapters':data['stats']['testChapters'],'devChapters':data['stats']['devChapters'],'trainableLayers':[6,7],'extractionHiddenState':8,
              'objectives':['frozen-teacher-softmax-SO','bilingual-masked-LM'],'tlmWeight':.1,'learningRate':2e-5,'device':'cpu','threads':2,
              'trainableParameters':sum(p.numel() for p in model.parameters() if p.requires_grad),'trainableNames':names,
              'seconds':time.perf_counter()-started,'weightsSha256':hashlib.file_digest(weight.open('rb'),'sha256').hexdigest(),'bytes':weight.stat().st_size,
              'selection':'candidate-only; requires heldout lexical evaluation before promotion','license':'Apache-2.0; derived from pinned google-bert/bert-base-multilingual-cased'}
    (output/'adaptation.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print(json.dumps({'stage':'saved',**manifest}),flush=True)

if __name__=='__main__':main()
