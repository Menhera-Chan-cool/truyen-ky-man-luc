import copy,unittest
import numpy as np
from context_alignment import join_units

def unit(text,start):
    size=len(text.encode('utf-16-le'))//2
    return {'text':text,'start':start,'end':start+size,'starts':list(range(start,start+size)),'ends':list(range(start+1,start+size+1)),'section':'story'}

class ProseParentTests(unittest.TestCase):
    def fixture(self):
        units={l:[unit(l+' first,',0),unit(l+' second.',10)] for l in ['vi','en']}
        item={'editions':{l:{'text':l+' first, '+l+' second.','breaks':[]} for l in units},'structures':{l:{} for l in units}}
        contexts=[{'section':'story','score':.49,'margin':-.03,'primary':{'vi':True,'en':True},'viInput':join_units(units['vi']),'enInput':join_units(units['en'])}]
        return item,contexts,units

    def test_reencodes_complete_parent_before_realigning_words(self):
        from prose_alignment import repair_prose_groups
        item,contexts,units=self.fixture();before=copy.deepcopy(item);seen=[]
        def encode(texts):
            seen.extend(texts);return np.array([[1.,0.] for _ in texts])
        result=repair_prose_groups(item,contexts,units,encode)
        self.assertGreater(result[0]['score'],.9)
        self.assertTrue(all('first,' in text and 'second.' in text for text in seen))
        self.assertEqual(result[0]['viInput']['parts'],contexts[0]['viInput']['parts'])
        self.assertEqual(item,before)

    def test_keeps_poetry_and_its_word_context_unchanged(self):
        from prose_alignment import repair_prose_groups
        item,contexts,units=self.fixture();contexts[0]['tracks']={'vi':{},'en':{}}
        self.assertEqual(repair_prose_groups(item,contexts,units,lambda _:self.fail('Must not encode poetry')),contexts)

    def test_abstains_when_the_parent_pair_has_no_semantic_support(self):
        from prose_alignment import repair_prose_groups
        item,contexts,units=self.fixture()
        def encode(texts):return np.array([[1.,0.] if text.startswith('vi') else [0.,1.] for text in texts])
        self.assertEqual(repair_prose_groups(item,contexts,units,encode),contexts)

    def test_does_not_rewrite_already_supported_prose(self):
        from prose_alignment import repair_prose_groups
        item,contexts,units=self.fixture();contexts[0].update(score=.9,margin=.1)
        self.assertEqual(repair_prose_groups(item,contexts,units,lambda _:self.fail('Must not encode sound groups')),contexts)

    def test_does_not_merge_a_prose_parent_containing_protected_poetry(self):
        from prose_alignment import repair_prose_groups
        item,contexts,units=self.fixture();item['structures']['en']['poems']=[{'start':10,'end':20}]
        self.assertEqual(repair_prose_groups(item,contexts,units,lambda _:self.fail('Must respect poem boundaries')),contexts)

    def test_repeated_parent_candidates_do_not_supply_false_confidence(self):
        from prose_alignment import repair_prose_groups
        item,contexts,units=self.fixture();old=copy.deepcopy(contexts[0])
        text=item['editions']['vi']['text'];offset=len(text)+1
        extra=[unit('vi first,',offset),unit('vi second.',offset+10)]
        units['vi']+=extra;item['editions']['vi']={'text':text+'\n'+text,'breaks':[offset]}
        contexts.append({**old,'viInput':join_units(extra)})
        self.assertEqual(repair_prose_groups(item,contexts,units,lambda ts:np.array([[1.,0.] for _ in ts])),contexts)

    def test_repairs_a_narration_boundary_without_losing_either_dialogue_clause(self):
        from prose_alignment import repair_prose_groups
        units={'vi':[unit('vi narrator.',0),unit('vi first,',13),unit('vi second.',23)],
               'en':[unit('en narrator:',0),unit('saying:',13),unit('en first.',21),unit('en second.',31)]}
        item={'editions':{'vi':{'text':'vi narrator.\nvi first, vi second.','breaks':[13]},'en':{'text':'en narrator: saying:\nen first. en second.','breaks':[21]}},'structures':{'vi':{},'en':{}}}
        contexts=[]
        for left,right,score in [([0],[0],.9),([1],[1,2],.49),([2],[3],.6)]:
            contexts.append({'section':'story','score':score,'margin':-.03 if score<.5 else .1,'primary':{'vi':True,'en':True},'viInput':join_units([units['vi'][i] for i in left]),'enInput':join_units([units['en'][i] for i in right])})
        def encode(texts):return np.array([[1.,0.] if 'narrator' in text else [0.,1.] for text in texts])
        result=repair_prose_groups(item,contexts,units,encode)
        self.assertEqual(len(result),2)
        for l in units:self.assertEqual({(p['start'],p['end']) for g in result for p in g[l+'Input']['parts']},{(u['start'],u['end']) for u in units[l]})
        dialogue=next(g for g in result if 'first,' in g['viInput']['text'])
        self.assertIn('en first.',dialogue['enInput']['text']);self.assertIn('en second.',dialogue['enInput']['text'])
        self.assertNotIn('saying:',dialogue['enInput']['text'])
