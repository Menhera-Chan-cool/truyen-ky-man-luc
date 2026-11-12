import argparse,json,os,pathlib

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--cache',required=True);args=parser.parse_args()
    os.environ['HF_HOME']=str(pathlib.Path(args.cache).resolve())
    os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
    from huggingface_hub import snapshot_download
    models=json.loads(pathlib.Path(__file__).with_name('models.json').read_text())
    for name,model in models.items():
        print('Downloading pinned '+name+' model',flush=True)
        path=snapshot_download(model['id'],revision=model['revision'],allow_patterns=['config.json','model.safetensors','tokenizer.json','tokenizer_config.json','special_tokens_map.json','vocab.txt','sentencepiece.bpe.model'])
        print(json.dumps({'model':name,'path':path}),flush=True)
