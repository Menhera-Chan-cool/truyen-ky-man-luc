import hashlib,unittest
from adaptation_data import export_pairs

def artifact(chapter,vi='Một người đọc sách.',en='A person reads a book.'):
    def edition(text):return {'text':text,'versionId':'version-'+chapter,'hash':hashlib.sha256(text.encode()).hexdigest(),'revision':1}
    return {'chapterId':chapter,'editions':{'vi':edition(vi),'en':edition(en)},'groups':[{
        'section':'story','score':.9,'margin':.1,'primary':{'vi':True,'en':True},
        'vi':{'start':0,'end':len(vi)},'en':{'start':0,'end':len(en)},'links':[]}]}

class AdaptationTests(unittest.TestCase):
    def test_loader_ignores_glossary_sidecars_from_the_same_pipeline(self):
        import json,pathlib,tempfile
        from adaptation_data import load_artifacts
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            (root/'chapter-1.json').write_text(json.dumps(artifact('chapter-1')),encoding='utf-8')
            (root/'chapter-1.glossary.json').write_text('{"accepted":[]}',encoding='utf-8')
            self.assertEqual(len(load_artifacts(root)),1)

    def test_whole_chapters_holdout_and_dedup_both_sides(self):
        a=artifact('chapter-1');b=artifact('chapter-5');c=artifact('chapter-6',en='A different rendering of the same source.')
        data=export_pairs([b,c,a],test={'chapter-1'},dev={'chapter-4'})
        self.assertEqual(len(data['test']),1);self.assertEqual(data['train'],[])
        self.assertEqual(data['test'][0]['sourceVersions']['vi']['versionId'],'version-chapter-1')

    def test_skips_aliases_low_margin_missing_primary_and_mismatched_year(self):
        a=artifact('chapter-5');a['groups'][0]['kind']='lexical'
        b=artifact('chapter-6');b['groups'][0]['margin']=.001
        c=artifact('chapter-7');c['groups'][0]['primary']['en']=False
        d=artifact('chapter-8','Năm 2024 mọi người đọc sách.','In 2025 people read books.')
        self.assertEqual(export_pairs([a,b,c,d],test=set(),dev=set())['train'],[])

    def test_rejects_tampered_source_and_noncontiguous_scope(self):
        a=artifact('chapter-5');a['editions']['vi']['text']+='x'
        with self.assertRaises(ValueError):export_pairs([a],test=set(),dev=set())
        b=artifact('chapter-5');b['groups'][0]['parts']={'vi':[{'start':0,'end':3},{'start':9,'end':15}],'en':[b['groups'][0]['en']]}
        self.assertEqual(export_pairs([b],test=set(),dev=set())['train'],[])

    def test_training_objective_can_change_extracted_layer(self):
        import torch
        from transformers import BertConfig,BertForMaskedLM
        from train_word_model import configure_trainable,alignment_loss
        torch.manual_seed(42)
        model=BertForMaskedLM(BertConfig(vocab_size=30,hidden_size=8,num_hidden_layers=12,num_attention_heads=2,intermediate_size=16)).eval()
        names=configure_trainable(model)
        self.assertTrue(all('.layer.6.' in n or '.layer.7.' in n for n in names))
        self.assertFalse(model.bert.embeddings.word_embeddings.weight.requires_grad)
        optimizer=torch.optim.SGD([p for p in model.parameters() if p.requires_grad],lr=.1)
        ids=torch.tensor([[1,5,6,2]])
        before=model.bert(ids,output_hidden_states=True).hidden_states[8].detach().clone()
        source=model.bert(ids,output_hidden_states=True).hidden_states[8][:,1:-1]
        target=model.bert(torch.tensor([[1,7,8,2]]),output_hidden_states=True).hidden_states[8][:,1:-1]
        loss=alignment_loss(source[0],target[0],torch.eye(2,dtype=torch.bool))
        self.assertTrue(torch.isfinite(loss));loss.backward();optimizer.step()
        after=model.bert(ids,output_hidden_states=True).hidden_states[8]
        self.assertFalse(torch.equal(before,after));self.assertTrue(any(p.grad is not None for p in model.parameters() if p.requires_grad))

if __name__=='__main__':unittest.main()
