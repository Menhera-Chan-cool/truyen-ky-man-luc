import unittest
import numpy as np
from context_alignment import join_units
from test_prose_alignment import unit

class ClauseAlignmentTests(unittest.TestCase):
    def fixture(self):
        vi=[unit('A,',0),unit('B,',3),unit('C,',6),unit('D,',9),unit('E.',12)]
        en=[unit('X,',0),unit('Y.',3),unit('Z.',6)]
        return {'section':'story','score':.8,'margin':.1,'viInput':join_units(vi),'enInput':join_units(en)}

    def test_pairs_a_complete_sentence_with_three_clauses_using_joined_text(self):
        from prose_alignment import add_clause_pairs
        g=self.fixture()
        def encode(texts):
            return np.array([[1.,0.,0.] if t in ['X, Y.','A, B, C,'] else [0.,1.,0.] if t in ['Z.','D, E.'] else [0.,0.,0.] for t in texts])
        add_clause_pairs([g],encode)
        first=g['clausePairs'][0]
        self.assertEqual(len(first['vi']),3);self.assertEqual(len(first['en']),2)
        self.assertEqual(len(g['clausePairs'][1]['vi']),2)

    def test_keeps_poetry_and_notes_unchanged(self):
        from prose_alignment import add_clause_pairs
        for extra in [{'tracks':{}},{'section':'notes'}]:
            g={**self.fixture(),**extra};add_clause_pairs([g],lambda _:self.fail('Protected scope'));self.assertNotIn('clausePairs',g)

    def test_abstains_when_a_prefix_and_complete_counterpart_are_semantically_tied(self):
        from prose_alignment import add_clause_pairs
        g=self.fixture()
        def encode(texts):
            return np.array([[1.,0.,0.] if t in ['X, Y.','A, B, C,'] else [.9999,.014,0.] if t=='A, B,' else [0.,0.,1.] if t in ['Z.','D, E.'] else [0.,0.,0.] for t in texts])
        add_clause_pairs([g],encode)
        self.assertFalse(any(p['en'][0]['start']==0 for p in g['clausePairs']))

    def test_keeps_a_confident_finer_map_inside_a_merged_sentence_pair(self):
        from prose_alignment import add_clause_pairs
        g={'section':'story','viInput':join_units([unit('A,',0),unit('B.',3)]),'enInput':join_units([unit('X.',0),unit('Y.',3)])}
        def encode(texts):
            return np.array([[1.,0.,0.] if t in ['A, B.','X. Y.'] else [0.,1.,0.] if t=='A,' else [0.,.9,.19**.5] if t=='X.' else [0.,0.,0.] for t in texts])
        add_clause_pairs([g],encode)
        self.assertEqual([(len(p['vi']),len(p['en'])) for p in g['clausePairs']],[(2,2),(1,1)])

    def test_ignores_reference_only_gaps_but_not_missing_source_content(self):
        from prose_alignment import add_clause_pairs
        g={'section':'story','viInput':join_units([unit('A,',0),unit('B.',7)]),'enInput':join_units([unit('X. Y.',0)])}
        def encode(texts):return np.array([[1.,0.] if t in ['A, B.','X. Y.'] else [0.,0.] for t in texts])
        add_clause_pairs([g],encode,{'vi':{'text':'A, (4) B.'},'en':{'text':'X. Y.'}})
        self.assertTrue(g['clausePairs']);self.assertEqual(g['clausePairs'][0]['vi'][1]['start'],7)


def vector(*values):
    return np.array(list(values)+[0.]*(6-len(values)),dtype=float)


class SentenceHierarchyTests(unittest.TestCase):
    def pairs(self,vi,en,vectors,extra=None):
        from prose_alignment import add_clause_pairs
        def units(texts):
            at=0;result=[]
            for t in texts:result.append(unit(t,at));at+=len(t)+1
            return join_units(result)
        g={'section':'story','viInput':units(vi),'enInput':units(en)}
        add_clause_pairs([g],lambda texts:np.stack([vectors.get(t,vector()) for t in texts]),extra)
        return [(len(p['vi']),len(p['en'])) for p in g['clausePairs']],g['clausePairs']

    def test_two_english_sentences_map_to_one_long_vietnamese_sentence_and_split_it(self):
        # The Vietnamese sentence has four clauses (over the three-atom window) but is one sentence atom at the top level.
        vi=['a1,','a2,','a3,','a4.','b.'];en=['X.','Y.','Z.']
        shape,pairs=self.pairs(vi,en,{'a1, a2, a3, a4.':vector(1),'X. Y.':vector(1),'a1, a2,':vector(0,1),'X.':vector(0,1),'a3, a4.':vector(0,0,1),'Y.':vector(0,0,1),'b.':vector(0,0,0,1),'Z.':vector(0,0,0,1)})
        self.assertEqual(shape,[(4,2),(1,1),(2,1),(2,1)])
        self.assertEqual([p['vi'][0]['start'] for p in pairs],[0,16,0,8])

    def test_tied_prefix_is_settled_by_the_atom_that_would_be_left_behind(self):
        # S1 alone and S1+S2 score alike against T; S2 has no better partner elsewhere, so it belongs to T.
        vi=['t1,','t2,','t3.','u.'];en=['S1.','S2.','S3.']
        vectors={'t1, t2, t3.':vector(1,.9),'S1.':vector(1,.9),'S2.':vector(.7,.6,.4),'S1. S2.':vector(1,.9,.05),'u.':vector(0,0,0,1),'S3.':vector(0,0,0,1),'S2. S3.':vector(.7,.6,.4,1)}
        shape,pairs=self.pairs(vi,en,vectors)
        self.assertIn((3,2),shape);self.assertNotIn((3,1),shape)

    def test_does_not_absorb_a_neighbour_sentence_that_belongs_elsewhere(self):
        vi=['t.','u.'];en=['S1.','S2.']
        shape,_=self.pairs(vi,en,{'t.':vector(1),'u.':vector(0,0,1),'S1.':vector(1),'S2.':vector(0,0,1),'t. u.':vector(1,0,1),'S1. S2.':vector(1,0,1)})
        self.assertEqual(shape,[(1,1),(1,1)])

    def test_pairs_the_weak_remainder_of_a_confirmed_parent_by_elimination_and_flags_it(self):
        vi=['a.','b.','c.'];en=['X.','Y.','Z.']
        vectors={'a.':vector(1),'X.':vector(.52,0,0,0,.854),'b.':vector(0,1),'Y.':vector(0,.45,.893),'a. b.':vector(1,1),'X. Y.':vector(1,1),'c.':vector(0,0,0,1),'Z.':vector(0,0,0,1)}
        shape,pairs=self.pairs(vi,en,vectors)
        self.assertIn((2,2),shape)
        weak=[p for p in pairs if p.get('residual')]
        self.assertEqual(len(weak),1);self.assertAlmostEqual(weak[0]['score'],.45,places=2);self.assertGreaterEqual(weak[0]['margin'],.03)
        self.assertEqual((weak[0]['vi'][0]['start'],weak[0]['en'][0]['start']),(3,3))

    def test_a_weak_remainder_below_the_residual_floor_is_not_invented(self):
        vi=['a.','b.','c.'];en=['X.','Y.','Z.']
        vectors={'a.':vector(1),'X.':vector(.52,0,0,0,.854),'b.':vector(0,1),'Y.':vector(0,.3,.954),'a. b.':vector(1,1),'X. Y.':vector(1,1),'c.':vector(0,0,0,1),'Z.':vector(0,0,0,1)}
        _,pairs=self.pairs(vi,en,vectors)
        self.assertFalse(any(p.get('residual') for p in pairs))

    def test_a_pair_never_overlaps_another_without_nesting(self):
        vi=['a,','b.','c,','d.'];en=['X.','Y.']
        _,pairs=self.pairs(vi,en,{'a, b.':vector(1),'X.':vector(1),'c, d.':vector(0,1),'Y.':vector(0,1),'a, b. c, d.':vector(1,1),'X. Y.':vector(1,1)})
        bounds=[({'vi':(p['vi'][0]['start'],p['vi'][-1]['end']),'en':(p['en'][0]['start'],p['en'][-1]['end'])}) for p in pairs]
        for i,x in enumerate(bounds):
            for y in bounds[:i]:
                for l in ['vi','en']:
                    if x[l][0]<y[l][1] and y[l][0]<x[l][1]:
                        self.assertTrue(all((x[k][0]<=y[k][0] and y[k][1]<=x[k][1] and x[k]!=y[k]) for k in ['vi','en']) or all((y[k][0]<=x[k][0] and x[k][1]<=y[k][1] and x[k]!=y[k]) for k in ['vi','en']))


class PhrasePairTests(unittest.TestCase):
    def setUp(self):
        self.vi='thổi kèn dệt chiếu. rồi nghỉ.';self.en='flute players and mat weavers. then rest.'
        def words(text):
            import re
            return [{'start':m.start(),'end':m.end()} for m in re.finditer(r'\w+',text)]
        vw=[w for w in words(self.vi)];ew=words(self.en)
        # Vietnamese segmented words: "thổi kèn" and "dệt chiếu" are one word each
        vw=[{'start':0,'end':8},{'start':9,'end':18}]+[w for w in vw if w['start']>=19]
        self.editions={'vi':{'text':self.vi,'words':vw},'en':{'text':self.en,'words':ew}}
        self.group={'id':'0','section':'story','score':.9,'vi':{'start':0,'end':len(self.vi)},'en':{'start':0,'end':len(self.en)},
                    'clausePairs':[{'vi':[{'start':0,'end':18}],'en':[{'start':0,'end':29}],'score':.8,'margin':.2}]}

    def run_phrases(self,vectors):
        from prose_alignment import add_phrase_pairs
        add_phrase_pairs([self.group],lambda texts:np.stack([vectors.get(t,np.zeros(4)) for t in texts]),self.editions)
        return self.group.get('phrasePairs',[])

    def test_pairs_a_phrase_only_with_its_mutual_best_window_inside_the_same_pair(self):
        v=np.array([1.,0,0,0]);pairs=self.run_phrases({'flute players and mat weavers':v,'thổi kèn dệt chiếu':v,'mat weavers':np.array([.5,.866,0,0]),'dệt chiếu':np.array([.5,.866,0,0])})
        top=pairs[0];self.assertEqual((top['en'],top['vi']),({'start':0,'end':29},{'start':0,'end':18}))
        self.assertEqual({p['from'] for p in pairs if p['en']==top['en']},{'en','vi'})
        self.assertTrue(all(p['score']>=.5 and p['margin']>=.08 for p in pairs))

    def test_a_window_never_crosses_a_sentence_end_or_leaves_its_pair(self):
        v=np.array([1.,0,0,0]);pairs=self.run_phrases({'mat weavers then rest':v,'thổi kèn dệt chiếu rồi nghỉ':v})
        self.assertEqual(pairs,[])

    def test_unreliable_scores_produce_nothing(self):
        self.assertEqual(self.run_phrases({'flute players':np.array([1.,0,0,0]),'thổi kèn':np.array([.3,.954,0,0])}),[])


class EdgeResidualTests(unittest.TestCase):
    def pairs(self,vectors):
        from prose_alignment import add_clause_pairs
        def units(texts):
            at=0;result=[]
            for t in texts:result.append(unit(t,at));at+=len(t)+1
            return join_units(result)
        g={'section':'story','viInput':units(['a.','b.']),'enInput':units(['X.','Y.'])}
        add_clause_pairs([g],lambda texts:np.stack([vectors.get(t,vector()) for t in texts]),None)
        return g.get('clausePairs',[])

    def test_a_weak_pair_next_to_a_confident_one_is_kept_flagged_and_a_weaker_one_is_not(self):
        base={'a.':vector(0,1),'X.':vector(0,1),'b.':vector(.45,0,0,.893)}
        kept=self.pairs({**base,'Y.':vector(1)})
        self.assertEqual([bool(p.get('residual')) for p in kept],[False,True])
        self.assertEqual(len(self.pairs({**base,'b.':vector(.3,0,0,.954),'Y.':vector(1)})),1)
