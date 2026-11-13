import unittest
import numpy as np
from alignment import align_sequences,align_candidates,softmax_links,reader_span,vietnamese_word_spans

class AlignmentTests(unittest.TestCase):
    def test_candidate_minimum_is_configurable_without_changing_default(self):
        left=np.array([[1.,0.]])
        right=np.array([[.6,.8]])
        self.assertEqual(align_candidates(left,right),[])
        self.assertEqual(len(align_candidates(left,right,minimum=.5)),1)

    def test_identical_units_and_missing_sentence(self):
        source=np.eye(3,dtype=np.float32)
        target=np.stack([source[0],np.array([-1.,-1.,-1.])/np.sqrt(3),source[1],source[2]])
        pairs=align_sequences(source,target)
        self.assertEqual([(p['vi'],p['en']) for p in pairs],[(list(range(i,i+1)),[j]) for i,j in [(0,0),(1,2),(2,3)]])

    def test_merges_two_source_sentences_when_target_combines_them(self):
        source=np.eye(3,dtype=np.float32)
        target=np.stack([(source[0]+source[1])/np.sqrt(2),source[2]])
        pairs=align_sequences(source,target)
        self.assertEqual(pairs[0]['vi'],[0,1]);self.assertEqual(pairs[0]['en'],[0])

    def test_rejects_unrelated_units(self):
        self.assertEqual(align_sequences(np.array([[1.,0.]]),np.array([[0.,1.]])),[])

    def test_note_scope_matching_can_be_conservative_without_requiring_equal_identifiers(self):
        source=np.array([[1.,0.]])
        target=np.array([[.77,np.sqrt(1-.77**2)]])
        self.assertEqual(align_sequences(source,target),[])
        self.assertEqual(len(align_sequences(source,target,minimum=.74)),1)
        self.assertEqual(align_sequences(source,np.array([[0.,1.]]),minimum=.74),[])

    def test_retrieval_handles_reordered_or_repeated_passages(self):
        source=np.eye(3,dtype=np.float32);target=source[[2,0,1]]
        pairs=align_candidates(source,target)
        self.assertTrue(all(any(p['vi']==[i] and p['en']==[j] for p in pairs) for i,j in [(0,1),(1,2),(2,0)]))

    def test_softmax_intersection_does_not_force_unmatched_tokens(self):
        pairs=softmax_links(np.array([[12.,0.,1.],[0.,12.,0.]]))
        self.assertEqual([(i,j) for i,j,_ in pairs],[(0,0),(1,1)])

    def test_python_codepoints_map_to_reader_utf16(self):
        unit={'text':'A 😀 từ','starts':[10,11,12,13,14,15,16],'ends':[11,12,13,14,15,16,17]}
        self.assertEqual(reader_span(unit,2,3),[12,14])
        self.assertEqual(reader_span(unit,4,6),[15,17])

    def test_vietnamese_compounds_preserve_raw_unicode_positions(self):
        import unicodedata
        for text in ['Trung Quốc','quần áo',unicodedata.normalize('NFD','tốt bụng')]:
            size=len(text.encode('utf-16-le'))//2
            unit={'text':text,'starts':list(range(size)),'ends':list(range(1,size+1))}
            self.assertIn({'start':0,'end':size},vietnamese_word_spans([unit]))

class ContextAlignmentTests(unittest.TestCase):
    @staticmethod
    def unit(text,start=0,section='story',note_id=None):
        size=len(text.encode('utf-16-le'))//2
        result={'text':text,'start':start,'end':start+size,'section':section,'starts':list(range(start,start+size)),'ends':list(range(start+1,start+size+1))}
        if note_id is not None:result['noteId']=note_id
        return result

    def notes(self,left,right):
        result={'chapterId':'synthetic','editions':{},'units':{},'structures':{}}
        for locale,texts in [('vi',left),('en',right)]:
            units=[];notes=[];at=0
            for index,text in enumerate(texts):
                unit=self.unit(text,at,'notes',str(index+1));units.append(unit)
                notes.append({'id':str(index+1),'start':unit['start'],'end':unit['end']});at=unit['end']+1
            result['editions'][locale]={'text':'\n'.join(texts),'breaks':[u['end'] for u in units]}
            result['units'][locale]=units;result['structures'][locale]={'notes':notes,'headings':[]}
        return result

    @staticmethod
    def encode(texts):
        vectors={'Trái.':[1.,0.,0.],'Left.':[1.,0.,0.],'Phải.':[0.,1.,0.],'Right.':[0.,1.,0.],'Together.':[2**-.5,2**-.5,0.],'Other.':[-1.,-1.,0.]}
        return np.array([vectors[text] for text in texts],dtype=np.float32)

    def test_note_numbers_do_not_override_reordered_meanings(self):
        from context_alignment import align_contexts
        item=self.notes(['Trái.','Phải.'],['Right.','Left.'])
        groups,pairs=align_contexts(item,self.encode)
        self.assertEqual({(p['vi']['start'],p['en']['start']) for p in pairs},{(0,7),(6,0)})
        self.assertEqual(len(groups),2)
        self.assertTrue(all(g['section']=='notes' for g in groups))

    def test_notes_can_merge_without_forcing_a_missing_note(self):
        from context_alignment import align_contexts
        item=self.notes(['Trái.','Phải.'],['Together.'])
        groups,pairs=align_contexts(item,self.encode)
        self.assertEqual(len(pairs),1);self.assertEqual(pairs[0]['vi'],{'start':0,'end':11})
        self.assertEqual(len(groups),1)
        missing=self.notes(['Trái.','Phải.'],['Left.','Other.'])
        groups,pairs=align_contexts(missing,self.encode)
        self.assertEqual(len(pairs),1);self.assertEqual(pairs[0]['vi'],{'start':0,'end':5})
        self.assertFalse(any(g['viInput']['starts'][0]>=6 for g in groups))

    def test_shifted_note_counters_are_masked_before_semantic_embedding(self):
        from context_alignment import align_contexts
        item=self.notes(['(9) Trái.'],['(8) Left.']);seen=[]
        def encode(texts):seen.extend(texts);return self.encode(texts)
        groups,pairs=align_contexts(item,encode)
        self.assertEqual(len(pairs),1);self.assertEqual(pairs[0]['vi'],{'start':0,'end':9})
        self.assertFalse(any('(9)' in text or '(8)' in text for text in seen))
        self.assertEqual(groups[0]['viInput']['starts'],list(range(9)))

    def test_shared_poem_translations_can_reuse_one_target_scope(self):
        from context_alignment import align_contexts
        item=self.notes(['Trái.','Phải.','Trái.'],['Left.','Right.'])
        for locale in ['vi','en']:
            item['structures'][locale]['notes']=[]
            for unit in item['units'][locale]:unit['section']='story';unit.pop('noteId')
        groups,_=align_contexts(item,self.encode)
        covered={position for group in groups for position in group['viInput']['starts']}
        self.assertIn(0,covered);self.assertIn(12,covered)
        self.assertTrue(any(not g['primary']['en'] for g in groups))

    def test_missing_note_phrase_cannot_reuse_an_already_aligned_unrelated_phrase(self):
        from context_alignment import align_contexts
        item=self.notes(['Base.'],['Base. Extra.'])
        item['units']['en']=[self.unit('Base.',0,'notes','1'),self.unit('Extra.',6,'notes','1')]
        def encode(texts):return np.array([[.8,.6] if text=='Extra.' else [1.,0.] for text in texts])
        groups,_=align_contexts(item,encode)
        self.assertEqual([g['enInput']['text'] for g in groups],['Base.'])

    def test_metadata_is_not_sent_to_sentence_alignment(self):
        from context_alignment import align_contexts
        item=self.notes(['Trái.'],['Left.'])
        for locale in ['vi','en']:
            item['structures'][locale]['notes']=[]
            for unit in item['units'][locale]:unit['section']='story';unit.pop('noteId')
        item['structures']['vi']['originals']=[{'start':0,'end':5}]
        groups,_=align_contexts(item,self.encode)
        self.assertEqual(groups,[])

    def test_node_wrapped_heading_spans_are_excluded(self):
        from context_alignment import align_contexts
        item=self.notes(['Trái.'],['Left.'])
        for locale in ['vi','en']:
            item['structures'][locale]['notes']=[]
            for unit in item['units'][locale]:unit['section']='story';unit.pop('noteId')
        item['structures']['vi']['headings']=[{'kind':'notes','span':{'start':0,'end':5}}]
        groups,_=align_contexts(item,self.encode)
        self.assertEqual(groups,[])

    def test_dom_splitting_and_joining_keep_reader_utf16_offsets(self):
        from context_alignment import split_reader_units,join_units
        parts=split_reader_units([self.unit('TrungQuốc',100)],[105])
        self.assertEqual([p['text'] for p in parts],['Trung','Quốc'])
        self.assertEqual(vietnamese_word_spans(parts),[{'start':100,'end':105},{'start':105,'end':109}])
        merged=join_units([self.unit('😀A',10),self.unit('B',20)])
        self.assertEqual(reader_span(merged,0,1),[10,12]);self.assertEqual(reader_span(merged,3,4),[20,21])

    def test_missing_target_caption_is_removed_and_relocated_same_language_topic_is_aliased(self):
        from context_alignment import add_caption_aliases
        body={'id':'body','section':'notes','vi':{'start':9,'end':14},'en':{'start':0,'end':10},'links':[{'vi':[9,14],'en':[0,10],'score':.9}]}
        caption={**body,'id':'caption','vi':{'start':2,'end':7},'links':[{'vi':[2,7],'en':[0,10],'score':.9}]}
        body['parts']={'vi':[dict(body['vi'])],'en':[dict(body['en'])]}
        artifact={'editions':{'vi':{'text':'😀Topic: Topic.'},'en':{'text':'Equivalent.'}},'groups':[caption,body],
                  'notePairs':[{'vi':{'start':2,'end':15},'en':{'start':0,'end':11},'score':.9,'margin':.1}]}
        structures={'vi':{'notes':[{'id':'a','start':2,'end':15,'label':{'start':2,'end':7}}]},'en':{'notes':[{'id':'b','start':0,'end':11}]}}
        add_caption_aliases(artifact,structures)
        self.assertFalse(any(g['id']=='caption' for g in artifact['groups']))
        alias=next(g for g in artifact['groups'] if g.get('kind')=='lexical')
        self.assertEqual(alias['links'][0]['vi'],[2,7]);self.assertEqual(alias['links'][0]['en'],[0,10])
        self.assertEqual(alias['parts']['vi'],[{'start':2,'end':7}]);self.assertEqual(body['parts']['vi'],[{'start':9,'end':14}])

    def test_labse_uses_all_256_token_overflow_windows_without_query_prefix(self):
        import torch
        from types import SimpleNamespace
        from run import labse_encode
        class Tokenizer:
            def __call__(self,texts,**options):
                self.texts=texts;self.options=options
                return {'input_ids':torch.tensor([[0],[1],[2]]),'attention_mask':torch.ones((3,1),dtype=torch.long),'overflow_to_sample_mapping':torch.tensor([0,0,1])}
        class Model:
            def __call__(self,input_ids,**_):
                values=torch.tensor([[2.,0.],[0.,2.],[-2.,0.]])
                return SimpleNamespace(last_hidden_state=values[input_ids[:,0]][:,None,:])
        tokenizer=Tokenizer();dense={'linear.weight':torch.eye(2),'linear.bias':torch.zeros(2)}
        result=labse_encode(['long input','other'],tokenizer,Model(),dense)
        np.testing.assert_allclose(result,[[2**-.5,2**-.5],[-1.,0.]],atol=1e-6)
        self.assertEqual(tokenizer.texts,['long input','other'])
        self.assertEqual(tokenizer.options['max_length'],256);self.assertTrue(tokenizer.options['return_overflowing_tokens'])

    def test_caption_alias_can_follow_a_same_language_note_reference(self):
        from context_alignment import add_caption_aliases
        body={'id':'body','section':'notes','vi':{'start':12,'end':17},'en':{'start':4,'end':14},'links':[{'vi':[12,17],'en':[4,14],'score':.9}]}
        artifact={'editions':{'vi':{'text':'Topic: See.\nTopic.'},'en':{'text':'Go.\nEquivalent.'}},'groups':[body],
                  'notePairs':[{'vi':{'start':0,'end':11},'en':{'start':0,'end':3}},{'vi':{'start':12,'end':18},'en':{'start':4,'end':15}}]}
        structures={'vi':{'notes':[{'id':'1','start':0,'end':11,'label':{'start':0,'end':5},'reference':'99'},{'id':'99','start':12,'end':18}]},
                    'en':{'notes':[{'id':'a','start':0,'end':3},{'id':'b','start':4,'end':15}]}}
        add_caption_aliases(artifact,structures)
        alias=next(g for g in artifact['groups'] if g.get('kind')=='lexical')
        self.assertEqual(alias['aliasOrigin'],'reference');self.assertEqual(alias['links'][0]['vi'],[0,5]);self.assertEqual(alias['links'][0]['en'],[4,14])

    def test_labse_avoids_computing_padding_from_unrelated_long_windows(self):
        import torch
        from types import SimpleNamespace
        from run import labse_encode
        widths=[]
        class Tokenizer:
            def __call__(self,texts,**options):
                return {'input_ids':torch.ones((5,8),dtype=torch.long),
                        'attention_mask':torch.tensor([[1,1,0,0,0,0,0,0]]*4+[[1]*8]),
                        'overflow_to_sample_mapping':torch.arange(5)}
        class Model:
            def __call__(self,input_ids,**_):
                widths.append(input_ids.shape[1]);return SimpleNamespace(last_hidden_state=torch.ones((*input_ids.shape,2)))
        result=labse_encode(['short']*4+['long'],Tokenizer(),Model(),{'linear.weight':torch.eye(2),'linear.bias':torch.zeros(2)})
        self.assertEqual(widths,[2,8]);self.assertEqual(result.shape,(5,2))

    def test_word_model_reference_mask_keeps_years_and_reader_positions(self):
        from run import align_words
        from context_alignment import join_units
        vi=join_units([self.unit('(9) năm 2024',10)]);en=join_units([self.unit('(8) year 2024',30)]);seen=[]
        def tokens(text):seen.append(text);return []
        groups=align_words([{'section':'notes','score':.9,'margin':.1,'viInput':vi,'enInput':en}],tokens)
        self.assertEqual(seen,['    năm 2024','    year 2024'])
        self.assertEqual(groups[0]['vi'],{'start':10,'end':22});self.assertEqual(vi['starts'],list(range(10,22)))

    def test_word_links_remain_in_the_mapped_paired_scope(self):
        from run import align_words
        from context_alignment import join_units
        group={'section':'story','score':.9,'margin':.1,'primary':{'vi':True,'en':True},
               'viInput':join_units([self.unit('😀A',10)]),'enInput':join_units([self.unit('B',20)])}
        def tokens(text):return [(1,2,np.array([1.]))] if text=='😀A' else [(0,1,np.array([1.]))]
        output=align_words([group],tokens)
        self.assertEqual(output[0]['links'][0]['vi'],[12,13]);self.assertEqual(output[0]['links'][0]['en'],[20,21])
        self.assertEqual(output[0]['parts'],{'vi':[{'start':10,'end':13}],'en':[{'start':20,'end':21}]})

if __name__=='__main__':unittest.main()
