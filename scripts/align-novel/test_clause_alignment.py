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
