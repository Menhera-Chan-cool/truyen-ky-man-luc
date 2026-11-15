import unittest
import numpy as np
from context_alignment import join_units
from test_prose_alignment import unit


def vec(*values):
    return np.array(list(values)+[0.]*(6-len(values)),dtype=float)


class BoundaryRepairTests(unittest.TestCase):
    def build(self,vi,en,cuts,breaks=None,gap=' '):
        def units(texts):
            at=0;result=[]
            for t in texts:result.append(unit(t,at));at+=len(t)+len(gap)
            return result
        u={'vi':units(vi),'en':units(en)}
        text={l:gap.join(t) for l,t in [('vi',vi),('en',en)]}
        item={'editions':{l:{'text':text[l],'breaks':(breaks or {}).get(l,[])} for l in u}}
        groups=[{'section':'story','score':.7,'margin':.2,'primary':{'vi':True,'en':True},'viInput':join_units(u['vi'][a:b]),'enInput':join_units(u['en'][c:d])} for (a,b),(c,d) in cuts]
        return item,groups

    def repair(self,item,groups,vectors):
        from prose_alignment import repair_boundaries
        return repair_boundaries(item,groups,lambda texts:np.stack([vectors.get(t,vec()) for t in texts]))

    VECTORS={'a1,':vec(1),'X1,':vec(1),'a2, b1.':vec(0,1),'X2. Y.':vec(0,1),'a1, a2,':vec(0,0,1),'b1.':vec(0,0,0,1)}

    def test_moves_a_unit_to_the_neighbour_group_that_pairs_it_better(self):
        item,groups=self.build(['a1,','a2,','b1.'],['X1,','X2.','Y.'],[((0,2),(0,1)),((2,3),(1,3))])
        result=self.repair(item,groups,self.VECTORS)
        sizes=[(len(g['viInput']['parts']),len(g['enInput']['parts'])) for g in result]
        self.assertEqual(sizes,[(1,1),(2,2)])
        self.assertGreaterEqual(result[0]['score'],.99)

    def test_keeps_a_cut_that_is_nearly_as_good(self):
        vectors={**self.VECTORS,'a1, a2,':vec(.99,0,.14),'b1.':vec(0,.99,0,.14)}
        item,groups=self.build(['a1,','a2,','b1.'],['X1,','X2.','Y.'],[((0,2),(0,1)),((2,3),(1,3))])
        self.assertEqual([len(g['viInput']['parts']) for g in self.repair(item,groups,vectors)],[2,1])

    def test_never_crosses_a_missing_unit_a_paragraph_break_or_poetry(self):
        cuts=[((0,2),(0,1)),((2,3),(1,3))]
        item,groups=self.build(['a1,','a2,','b1.'],['X1,','X2.','Y.'],cuts)
        # a skipped unit between the groups
        item['editions']['vi']['text']=item['editions']['vi']['text'].replace('a2, b1.','a2, zzz b1.')
        groups[1]['viInput']['parts'][0]['start']+=4;groups[1]['viInput']['parts'][0]['end']+=4
        self.assertEqual([len(g['viInput']['parts']) for g in self.repair(item,groups,self.VECTORS)],[2,1])
        item,groups=self.build(['a1,','a2,','b1.'],['X1,','X2.','Y.'],cuts,breaks={'en':[7]})
        self.assertEqual([len(g['viInput']['parts']) for g in self.repair(item,groups,self.VECTORS)],[2,1])
        item,groups=self.build(['a1,','a2,','b1.'],['X1,','X2.','Y.'],cuts)
        groups[0]['tracks']={}
        self.assertEqual([len(g['viInput']['parts']) for g in self.repair(item,groups,self.VECTORS)],[2,1])


class OrphanAdoptionTests(unittest.TestCase):
    def build(self,vi,en,cuts,gap=' '):
        def units(texts):
            at=0;result=[]
            for t in texts:result.append(unit(t,at));at+=len(t)+len(gap)
            return result
        u={'vi':units(vi),'en':units(en)}
        text={l:gap.join(t) for l,t in [('vi',vi),('en',en)]}
        item={'editions':{l:{'text':text[l],'breaks':[]} for l in u}}
        groups=[{'section':'story','score':.7,'margin':.2,'primary':{'vi':True,'en':True},'viInput':join_units([u['vi'][i] for i in a]),'enInput':join_units([u['en'][i] for i in b])} for a,b in cuts]
        return item,groups

    def adopt(self,item,groups,vectors):
        from prose_alignment import adopt_orphans
        return adopt_orphans(item,groups,lambda texts:np.stack([vectors.get(t,vec()) for t in texts]))

    def test_a_skipped_unit_joins_the_group_it_completes(self):
        # "orphan," was skipped between the two groups and belongs with the second one.
        vectors={'v2.':vec(0,1),'X2.':vec(1),'orphan, v2.':vec(1)}
        item,groups=self.build(['v1.','orphan,','v2.'],['X1.','X2.'],[([0],[0]),([2],[1])])
        vectors.update({'v1.':vec(0,0,1),'X1.':vec(0,0,1)})
        result=self.adopt(item,groups,vectors)
        self.assertEqual([len(g['viInput']['parts']) for g in result],[1,2])
        self.assertEqual(result[1]['viInput']['parts'][0]['start'],len('v1. '))

    def test_a_skipped_unit_stays_out_when_it_does_not_help_or_leaves_the_paragraph(self):
        vectors={'v1.':vec(0,0,1),'X1.':vec(0,0,1),'v2.':vec(1),'X2.':vec(1),'orphan, v2.':vec(.99,.14)}
        item,groups=self.build(['v1.','orphan,','v2.'],['X1.','X2.'],[([0],[0]),([2],[1])])
        self.assertEqual([len(g['viInput']['parts']) for g in self.adopt(item,groups,vectors)],[1,1])
        item,groups=self.build(['v1.','orphan,','v2.'],['X1.','X2.'],[([0],[0]),([2],[1])])
        item['editions']['vi']['breaks']=[len('v1. orphan, ')-1]
        vectors={'v1.':vec(0,0,1),'X1.':vec(0,0,1),'v2.':vec(0,1),'X2.':vec(1),'orphan, v2.':vec(1)}
        self.assertEqual([len(g['viInput']['parts']) for g in self.adopt(item,groups,vectors)],[1,1])
