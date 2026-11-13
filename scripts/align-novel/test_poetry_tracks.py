import unittest
import numpy as np
import test_alignment


class PoetryTests(unittest.TestCase):
    def story(self, vi, en):
        item = test_alignment.ContextAlignmentTests().notes(vi, en)
        for locale in ['vi', 'en']:
            item['structures'][locale]['notes'] = []
            for unit in item['units'][locale]:
                unit['section'] = 'story'
                unit.pop('noteId')
        return item

    def test_dom_lines_detect_alternate_renderings_and_keep_english_on_one_track(self):
        from context_alignment import align_contexts
        item = self.story([f'Original verse {i}.' for i in range(4)] +
                          [f'Rendered verse {i}.' for i in range(4)],
                          [f'English verse {i}.' for i in range(4)])
        def encode(texts):
            values = []
            for text in texts:
                vector = np.zeros(5)
                for i in range(4):
                    if str(i) in text: vector[i] = 1
                # Each rendering wins on different lines: track choice must be global.
                if ('Original' in text and ('1' in text or '3' in text)) or ('Rendered' in text and ('0' in text or '2' in text)):
                    vector[4] = .3
                values.append(vector)
            return np.array(values)
        groups, _ = align_contexts(item, encode)
        poetry = [g for g in groups if g.get('tracks')]
        self.assertTrue(poetry)
        self.assertEqual(len({g['tracks']['vi']['id'] for g in poetry}), 2)
        primary = [g for g in poetry if g['primary']['en']]
        self.assertEqual(len({g['tracks']['vi']['id'] for g in primary}), 1)
        self.assertTrue(all(g['primary']['vi'] for g in poetry))
        for group in poetry:
            self.assertLessEqual(group['viInput']['ends'][-1], group['tracks']['vi']['end'])

    def test_short_dialogue_and_sentence_fragments_are_not_poetry(self):
        from poetry_tracks import detect_tracks
        item = self.story(['- Are you there?', '- Yes I am.', '- Can we leave?', '- We can now.'], ['x'])
        self.assertEqual(detect_tracks(item['units']['vi'], item['editions']['vi']), [])
        item['editions']['vi']['breaks'] = [item['units']['vi'][-1]['end']]
        self.assertEqual(detect_tracks(item['units']['vi'], item['editions']['vi']), [])

    def test_english_alternate_tracks_keep_vietnamese_on_one_complete_rendering(self):
        from context_alignment import align_contexts
        item = self.story([f'Vietnamese verse {i}.' for i in range(4)],
                          [f'Original verse {i}.' for i in range(4)] + [f'Rendered verse {i}.' for i in range(4)])
        def encode(texts):
            result=[]
            for text in texts:
                values=[float(str(i) in text) for i in range(4)]+[0.]
                if ('Original' in text and ('1' in text or '3' in text)) or ('Rendered' in text and ('0' in text or '2' in text)):
                    values[4]=.3
                result.append(values)
            return np.array(result)
        groups,_=align_contexts(item,encode)
        poetry=[g for g in groups if g.get('tracks')]
        self.assertTrue(poetry)
        self.assertEqual(len({g['tracks']['en']['id'] for g in poetry}),2)
        self.assertTrue(all(g['primary']['en'] for g in poetry))
        self.assertEqual(len({g['tracks']['en']['id'] for g in poetry if g['primary']['vi']}),1)
        self.assertEqual({g['enInput']['text'] for g in poetry},set(item['editions']['en']['text'].split('\n')))

    def test_many_to_many_whole_track_ties_abstain_instead_of_cartesian_pairs(self):
        from poetry_tracks import detect_tracks,pair_tracks
        from context_alignment import _normalized
        lines=['I']+[f'First verse {i}.' for i in range(4)]+['II']+[f'Second verse {i}.' for i in range(4)]
        item=self.story(lines,lines)
        tracks={l:detect_tracks(item['units'][l],item['editions'][l]) for l in ['vi','en']}
        def encode(texts):return np.array([[float(str(i) in text) for i in range(4)] for text in texts])
        pairs,_,_=pair_tracks(tracks['vi'],tracks['en'],encode,_normalized)
        self.assertEqual(pairs,[])

    def test_weak_original_does_not_block_semantically_confirmed_complete_rendering(self):
        from context_alignment import align_contexts
        original=[f'Obscure original {i}.' for i in range(4)]
        rendered=[f'Modern rendering {i}.' for i in range(4)]
        item=self.story(original+rendered,[f'English rendering {i}.' for i in range(4)])
        def encode(texts):
            result=[]
            for text in texts:
                values=[float(str(i) in text) for i in range(4)]+[0.]
                if 'Obscure' in text:values=[0.,0.,0.,0.,1.]
                result.append(values)
            return np.array(result)
        groups,_=align_contexts(item,encode)
        tracked=[g for g in groups if g.get('tracks')]
        self.assertTrue(tracked)
        self.assertEqual({g['viInput']['text'] for g in tracked},set(rendered))
        self.assertTrue(all(g['primary']['en'] for g in tracked))
        self.assertEqual(len({g['tracks']['vi']['id'] for g in tracked}),1)

    def test_joined_line_evidence_preserves_a_couplet_with_one_weak_isolated_line(self):
        from context_alignment import align_contexts
        item=self.story([f'Source verse {i}.' for i in range(4)],[f'Target verse {i}.' for i in range(4)])
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(8);indices=[i for i in range(4) if str(i) in text]
                if '\n' in text:
                    for i in indices:
                        v[i]=1 if 'Source' in text or len(indices)==4 else .5
                        if 'Target' in text and len(indices)<4:v[i+4]=.75**.5
                else:
                    i=indices[0]
                    if 'Source' in text:v[i]=1
                    else:v[i]=.495 if i<3 else -.2;v[i+4]=(1-v[i]**2)**.5
                result.append(v)
            return np.array(result)
        groups,_=align_contexts(item,encode)
        poetry=[g for g in groups if g.get('tracks')]
        self.assertTrue(poetry)
        self.assertTrue(any('Source verse 3.' in g['viInput']['text'] and 'Target verse 3.' in g['enInput']['text'] for g in poetry))

    def test_roman_markers_separate_poem_tracks_without_becoming_lexical_text(self):
        from poetry_tracks import detect_tracks
        item = self.story(['I'] + [f'A verse {i}' for i in range(4)] + ['II'] + [f'B verse {i}' for i in range(4)], ['x'])
        tracks = detect_tracks(item['units']['vi'], item['editions']['vi'])
        self.assertEqual([len(t['units']) for t in tracks], [4, 4])
        self.assertTrue(all(u['text'] not in ['I', 'II'] for t in tracks for u in t['units']))

    def test_dialogue_punctuation_omitted_by_reader_units_still_blocks_poetry(self):
        from poetry_tracks import detect_tracks
        item = self.story(['- The first answer.', '- The next answer.', '- The third answer.', '- The final answer.'], ['x'])
        for unit in item['units']['vi']:
            unit['text'] = unit['text'][2:]; unit['start'] += 2
            unit['starts'] = unit['starts'][2:]; unit['ends'] = unit['ends'][2:]
        self.assertEqual(detect_tracks(item['units']['vi'], item['editions']['vi']), [])

    def test_same_locale_reference_context_is_bounded_and_offsets_stay_lexical(self):
        from context_alignment import align_contexts
        item = test_alignment.ContextAlignmentTests().notes(['Caption.', 'Local meaning.'], ['Header.', 'Other meaning.'])
        for locale in ['vi', 'en']:
            notes = item['structures'][locale]['notes']
            notes[0]['reference'] = '2'; notes[1]['reference'] = '1'
        seen = []
        def encode(texts):
            seen.extend(texts)
            return np.array([[1., 0.] for t in texts])
        groups, _ = align_contexts(item, encode)
        self.assertTrue(groups)
        self.assertTrue(any('Caption.' in t and 'Local meaning.' in t for t in seen))
        self.assertFalse(any('Caption.' in t and 'Other meaning.' in t for t in seen))
        self.assertTrue(all(len(t) < 4200 for t in seen))
        self.assertTrue(all('Local meaning.' not in g['viInput']['text'] for g in groups if g['viInput']['ends'][-1] <= 8))
        caption = next(g['viInput'] for g in groups if g['viInput']['starts'][0] == 0)
        self.assertEqual(caption['text'], 'Caption.')
        self.assertEqual(caption['starts'], list(range(8)))

    def test_reference_traversal_caps_depth_and_total_added_text(self):
        from context_alignment import reference_context
        item = test_alignment.ContextAlignmentTests().notes(['Root.', 'First.', 'Second.', 'Third.', 'Fourth.'], ['Other.'])
        for i, note in enumerate(item['structures']['vi']['notes'][:-1]): note['reference'] = str(i + 2)
        text = reference_context(item, 'vi', 'Root.', item['structures']['vi']['notes'][0])
        self.assertIn('Third.', text); self.assertNotIn('Fourth.', text)
        item = test_alignment.ContextAlignmentTests().notes(['Root.', 'z' * 5000], ['Other.'])
        item['structures']['vi']['notes'][0]['reference'] = '2'
        self.assertLess(len(reference_context(item, 'vi', 'Root.', item['structures']['vi']['notes'][0])), 2100)

    def test_unconfirmed_flattened_counterpart_keeps_existing_alignment(self):
        from context_alignment import align_contexts
        item = self.story([f'Verse line {i}.' for i in range(4)], [f'Target line {i}.' for i in range(4)])
        item['editions']['en']['breaks'] = [item['units']['en'][-1]['end']]
        def encode(texts):
            return np.array([[float(str(i) in text) for i in range(4)] for text in texts])
        groups, _ = align_contexts(item, encode)
        self.assertEqual(len(groups), 4)


if __name__ == '__main__':
    unittest.main()
