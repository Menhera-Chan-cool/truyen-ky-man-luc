import unittest
import numpy as np
from alignment import align_sequences,align_candidates,softmax_links,reader_span,vietnamese_word_spans

class AlignmentTests(unittest.TestCase):
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

if __name__=='__main__':unittest.main()
