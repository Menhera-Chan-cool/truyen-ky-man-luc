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

    def test_explicit_couplet_lines_split_flattened_units_and_keep_reader_metadata(self):
        from context_alignment import align_contexts
        item=self.story(['Source first. Source second.'],['Target first. Target second.'])
        for locale in ['vi','en']:
            unit=item['units'][locale][0];cut=unit['text'].index(' ')+1
            # Actual source formatting, not sentence punctuation, supplies the line break.
            cut=unit['text'].index('. ')+2
            item['structures'][locale]['poems']=[{'id':'couplet','start':0,'end':unit['end'],
                'lines':[{'start':0,'end':cut},{'start':cut,'end':unit['end']}],'evidence':'br'}]
        def encode(texts):return np.array([[1.,0.] if 'first' in t else [0.,1.] for t in texts])
        groups,_=align_contexts(item,encode)
        poem=[g for g in groups if g.get('poetryLines')]
        self.assertTrue(poem)
        self.assertEqual({tuple((p['start'],p['end']) for p in g['poetryLines']['vi']) for g in poem}, {((0,14),),((14,28),)})
        self.assertTrue(all(g['poetryLines']['poemScore']>=.5 for g in poem))

    def test_whitespace_dom_blocks_do_not_split_a_verse_run(self):
        from poetry_tracks import detect_tracks
        item=self.story(['First verse line.',' ','Second verse line.',' ','Third verse line.',' ','Fourth verse line.'],['Target.'])
        units=[u for u in item['units']['vi'] if u['text'].strip()]
        tracks=detect_tracks(units,item['editions']['vi'])
        self.assertEqual([len(t['units']) for t in tracks],[4])

    def test_named_condensed_poem_can_match_longer_complete_rendering(self):
        from context_alignment import align_contexts
        item=self.story([f'Source verse {i}.' for i in range(4)],[f'Target verse {i}.' for i in range(8)])
        for locale in ['vi','en']:
            units=item['units'][locale]
            item['structures'][locale]['poems']=[{'id':'named','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'named-poem'}]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(4)
                for i in range(8):
                    if str(i) in text:v[i//2 if 'Target' in text else i%4]=1
                result.append(v)
            return np.array(result)
        groups,_=align_contexts(item,encode)
        poetry=[g for g in groups if g.get('poetryLines')]
        self.assertTrue(poetry)
        self.assertEqual({p['start'] for g in poetry for p in g['poetryLines']['en']},{u['start'] for u in item['units']['en']})

    def test_weak_middle_line_uses_same_poem_surroundings_without_neighbor_highlight(self):
        from context_alignment import align_contexts
        item=self.story([f'Source line {i}.' for i in range(3)],[f'The target line {i}, of this song.' for i in range(3)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'three','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'verse-block'}]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(4);ids=[i for i in range(3) if str(i) in text]
                for i in ids:v[i]=1
                if len(ids)==1 and ids[0]==1 and 'target' in text:v[1]=.2;v[3]=.96**.5
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        mappings=item['poemPairs'][0]['correspondences']
        vi,en=item['units']['vi'][1],item['units']['en'][1]
        middle=[c for c in mappings if c['vi']==[{'start':vi['start'],'end':vi['end']}]]
        self.assertEqual(middle[0]['en'],[{'start':en['start'],'end':en['end']}])
        self.assertEqual(middle[0]['evidence'],'surrounding-window')

    def test_flattened_confirmed_poem_has_context_metadata_and_no_invented_line_or_word_group(self):
        from context_alignment import align_contexts
        item=self.story(['A single flattened body of a whole poem.'],[f'Target verse {i}.' for i in range(8)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'flat','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'verse-block','flattened':locale=='vi'}]
        groups,_=align_contexts(item,lambda texts:np.array([[1.,0.] for t in texts]))
        self.assertEqual(groups,[])
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['correspondences'],[])
        self.assertTrue(item['poemPairs'][0]['vi']['flattened'])

    def test_named_original_and_shorter_rendering_split_on_semantic_whole_poem_evidence(self):
        from context_alignment import align_contexts
        item=self.story([f'Old verse {i}.' for i in range(6)]+[f'Current verse {i}.' for i in range(3)],
                        [f'Target verse {i}.' for i in range(6)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'named','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'named-poem'}]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(4)
                if 'Old' in text:v[3]=1
                else:
                    for i in range(6):
                        if str(i) in text:v[i//2 if 'Target' in text else i%3]=1
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['vi']['start'],item['units']['vi'][6]['start'])

    def test_surrounding_context_does_not_override_strong_contradictory_line_evidence(self):
        from poetry_tracks import _correspondences
        from context_alignment import _normalized
        left=[test_alignment.ContextAlignmentTests.unit(f'Source line {i}.',i*20) for i in range(3)]
        right=[test_alignment.ContextAlignmentTests.unit(f'Target line {i}.',i*20) for i in range(3)]
        def encode(texts):
            vectors=[]
            for text in texts:
                v=np.zeros(3)
                for i in range(3):
                    if str(i) in text:v[(2 if i==1 else 1 if i==2 else i) if 'Target' in text and '\n' not in text else i]=1
                vectors.append(v)
            return np.array(vectors)
        matches=_correspondences(left,right,[{'vi':[0,1,2],'en':[0,1,2],'score':1.}],encode,_normalized)
        self.assertFalse(any(c['vi']==[{'start':20,'end':34}] and c['en']==[{'start':20,'end':34}] for c in matches))

    def test_reference_context_reads_local_reader_marker_when_lexical_unit_already_masked_it(self):
        from context_alignment import _context_units
        item=self.story(['Verse (9).','Explanation.'],['Line.'])
        item['units']['vi'][0]['text']='Verse    .'
        note=item['units']['vi'][1];note['section']='notes';note['noteId']='9'
        item['structures']['vi']['notes']=[{'id':'9','start':note['start'],'end':note['end']}]
        unit=_context_units(item,'vi')[0]
        self.assertIn('Explanation.',unit['semanticText'])
        self.assertEqual(unit['text'],'Verse    .')
        self.assertEqual(unit['ends'][-1],10)

    def test_accepted_direct_cross_line_evidence_vetoes_positional_guess(self):
        from poetry_tracks import _correspondences
        from context_alignment import _normalized
        left=[test_alignment.ContextAlignmentTests.unit(f'Source line {i}.',i*20) for i in range(3)]
        right=[test_alignment.ContextAlignmentTests.unit(f'Target line {i}.',i*20) for i in range(3)]
        def encode(texts):
            values=[]
            for text in texts:
                v=np.zeros(4);ids=[i for i in range(3) if str(i) in text]
                for i in ids:v[i]=1
                if 'Target' in text and len(ids)==1 and ids[0] in [1,2]:
                    v[:]=0;v[ids[0]]=.15;v[3-ids[0]]=.45;v[3]=(1-.15**2-.45**2)**.5
                values.append(v)
            return np.array(values)
        mappings=_correspondences(left,right,[{'vi':[0,1,2],'en':[0,1,2],'score':1.}],encode,_normalized)
        self.assertFalse(any(c['vi']==[{'start':20,'end':34}] and c['en']==[{'start':20,'end':34}] for c in mappings))

    def test_ordinary_single_poem_is_not_shortened_to_fit_a_different_line_count(self):
        from context_alignment import align_contexts
        item=self.story([f'Source verse {i}.' for i in range(9)],[f'Target verse {i}.' for i in range(6)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'whole','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'verse-block'}]
        align_contexts(item,lambda texts:np.array([[1.,0.] for t in texts]))
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['vi']['end'],item['units']['vi'][-1]['end'])

    def test_unpaired_explicit_poem_cannot_reenter_generic_prose_retrieval(self):
        from context_alignment import align_contexts
        item=self.story(['First source verse.','Second source verse.'],['Unrelated prose sentence.','Another prose sentence.'])
        units=item['units']['vi'];item['structures']['vi']['poems']=[{'id':'couplet','start':0,'end':units[-1]['end'],
            'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'couplet'}]
        groups,_=align_contexts(item,lambda texts:np.array([[1.,0.] for t in texts]))
        self.assertEqual(item['poemPairs'],[])
        self.assertEqual(groups,[])

    def test_whole_reader_line_supplies_reference_marker_outside_lexical_unit(self):
        from context_alignment import align_contexts
        item=self.story(['First verse line (9).','Second verse line.','Explanation.'],['First target line.','Second target line.'])
        first=item['units']['vi'][0];full_end=first['end'];first['text']='First verse line';first['end']=16
        first['starts']=first['starts'][:16];first['ends']=first['ends'][:16]
        note=item['units']['vi'][2];note.update(section='notes',noteId='9')
        item['structures']['vi']['notes']=[{'id':'9','start':note['start'],'end':note['end']}]
        for locale in ['vi','en']:
            units=item['units'][locale][:2];lines=[{'start':u['start'],'end':u['end']} for u in units]
            if locale=='vi':lines[0]['end']=full_end
            item['structures'][locale]['poems']=[{'id':'couplet','start':0,'end':lines[-1]['end'],'lines':lines,'evidence':'couplet'}]
        seen=[]
        def encode(texts):seen.extend(texts);return np.array([[1.,0.] for t in texts])
        groups,_=align_contexts(item,encode)
        self.assertTrue(any('First verse line' in t and 'Explanation.' in t for t in seen))
        self.assertTrue(all('Explanation.' not in g['viInput']['text'] for g in groups))

    def test_explicit_empty_inventory_keeps_short_prose_out_of_poetry_detection(self):
        from poetry_tracks import detect_tracks
        item=self.story(['First short paragraph.','Second short paragraph.','Third short paragraph.','Fourth short paragraph.'],['Target.'])
        self.assertEqual(detect_tracks(item['units']['vi'],item['editions']['vi'],[]),[])
        self.assertEqual(len(detect_tracks(item['units']['vi'],item['editions']['vi'])),1)

    def test_named_poem_titles_prevent_related_bodies_from_switching_to_the_wrong_poem(self):
        from context_alignment import align_contexts
        item=self.story(['Source A title']+[f'SourceA line {i}.' for i in range(4)]+['Source B title']+[f'SourceB line {i}.' for i in range(4)],
                        ['Target A title']+[f'TargetA line {i}.' for i in range(4)]+['Target B title']+[f'TargetB line {i}.' for i in range(4)])
        for locale in ['vi','en']:
            units=item['units'][locale];poems=[]
            for first in [0,5]:
                title=units[first];lines=units[first+1:first+5]
                poems.append({'id':str(first),'start':lines[0]['start'],'end':lines[-1]['end'],'title':{'start':title['start'],'end':title['end']},
                              'lines':[{'start':u['start'],'end':u['end']} for u in lines],'evidence':'named-poem'})
            item['structures'][locale]['poems']=poems
        def encode(texts):
            values=[]
            for text in texts:
                if '\n' not in text and text.endswith('title'):v=[1.,0.] if ' A ' in text else [0.,1.]
                elif 'SourceA' in text:v=[0.,1.]
                elif 'SourceB' in text:v=[.6,.8]
                elif 'TargetA' in text:v=[.8,.6]
                else:v=[0.,1.]
                values.append(v)
            return np.array(values)
        align_contexts(item,encode)
        self.assertEqual({(p['vi']['id'],p['en']['id']) for p in item['poemPairs']},{('0','0'),('5','5')})

    def test_inline_quote_reuses_confirmed_poem_lines_without_changing_parent_default(self):
        import re
        from context_alignment import align_contexts
        item=self.story([f'Source line {i}.' for i in range(8)],
                        [f'Target line {i}.' for i in range(8)]+['The speaker then quoted:','Again Target line 6.','Target line 7 (73).'])
        for locale in ['vi','en']:
            units=item['units'][locale];first=units[:8]
            poems=[{'id':'whole','start':0,'end':first[-1]['end'],'lines':[{'start':u['start'],'end':u['end']} for u in first],'evidence':'verse-block'}]
            if locale=='en':
                quote=units[9:];poems.append({'id':'quote','start':quote[0]['start'],'end':quote[-1]['end'],
                    'lines':[{'start':u['start'],'end':u['end']} for u in quote],'evidence':'couplet'})
            item['structures'][locale]['poems']=poems
        def encode(texts):
            return np.array([[float(str(i) in re.findall(r'line (\d)',text)) for i in range(8)] for text in texts])
        groups,_=align_contexts(item,encode)
        aliases=[p for p in item['poemPairs'] if p['en']['id']=='quote']
        self.assertEqual(len(aliases),1)
        alias=aliases[0];vi=item['units']['vi']
        self.assertEqual(alias['vi']['start'],vi[6]['start'])
        self.assertEqual(alias['vi']['end'],vi[7]['end'])
        self.assertEqual(alias['primary'],{'vi':False,'en':True})
        self.assertEqual(alias['vi']['id'],'whole')
        parent=next(p for p in item['poemPairs'] if p['en']['id']=='whole')
        self.assertTrue(parent['primary']['vi'])
        self.assertFalse(any(g['enInput']['starts'][0]>=item['units']['en'][9]['start'] for g in groups))

    def test_named_equal_length_alternatives_split_only_when_semantics_improve(self):
        from context_alignment import align_contexts
        item=self.story([f'Old verse {i}.' for i in range(6)]+[f'Current verse {i}.' for i in range(6)],
                        [f'Target verse {i}.' for i in range(6)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'named','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'named-poem'}]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(7)
                if 'Old' in text:v[6]=1
                else:
                    for i in range(6):
                        if str(i) in text:v[i]=1
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['vi']['start'],item['units']['vi'][6]['start'])

    def test_unnamed_unequal_alternatives_require_semantic_gain_over_the_whole(self):
        from context_alignment import align_contexts
        item=self.story([f'Old verse {i}.' for i in range(6)]+[f'Current verse {i}.' for i in range(3)],
                        [f'Target verse {i}.' for i in range(6)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'plain','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'verse-block'}]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(4)
                if 'Old' in text:v[3]=1
                else:
                    for i in range(6):
                        if str(i) in text:v[i//2 if 'Target' in text else i%3]=1
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['vi']['start'],item['units']['vi'][6]['start'])

    def test_semantically_parallel_named_renderings_do_not_default_to_a_mixed_whole(self):
        from context_alignment import align_contexts
        item=self.story([f'Old verse {i}.' for i in range(6)]+[f'Current verse {i}.' for i in range(6)],
                        [f'Target verse {i}.' for i in range(6)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'named','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'named-poem'}]
        def encode(texts):
            result=[]
            for text in texts:
                if 'Old' in text and 'Current' in text:v=[.732,(1-.732**2)**.5,0.]
                elif 'Old' in text:v=[.51,(1-.51**2)**.5,0.]
                elif 'Current' in text:v=[.696,.494,(1-.696**2-.494**2)**.5]
                else:v=[1.,0.,0.]
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        primary=next(p for p in item['poemPairs'] if p['primary']['en'])
        self.assertEqual(primary['vi']['start'],item['units']['vi'][6]['start'])
        self.assertEqual(len(primary['vi']['lines']),6)

    def test_existing_full_named_counterpart_blocks_near_tie_condensed_splitting(self):
        import re
        from poetry_tracks import pair_tracks
        from context_alignment import _normalized
        def track(prefix,count,start):
            units=[test_alignment.ContextAlignmentTests.unit(f'{prefix} line {i}.',start+i*30) for i in range(count)]
            return {'id':prefix,'start':start,'end':units[-1]['end'],'units':units,'hinted':True,'evidence':'named-poem'}
        original=track('Original',4,0);compact=track('Compact',2,150);english=track('English',4,0)
        def encode(texts):
            values=[]
            for text in texts:
                ids={int(i) for i in re.findall(r'line (\d)',text)}
                if 'English' not in text:v=[1.,0.,0.]
                elif len(ids)==4 or not (ids<={0,1} or ids<={2,3}):v=[.732,(1-.732**2)**.5,0.]
                elif ids<={0,1}:v=[.51,(1-.51**2)**.5,0.]
                else:v=[.696,.494,(1-.696**2-.494**2)**.5]
                values.append(v)
            return np.array(values)
        _,_,guarded=pair_tracks([original,compact],[english],encode,_normalized)
        self.assertEqual([t['id'] for t in guarded],['English'])
        _,_,unguarded=pair_tracks([compact],[english],encode,_normalized)
        self.assertEqual(len(unguarded),2)

    def test_note_context_cannot_erase_a_clear_raw_poem_and_line_match(self):
        from context_alignment import align_contexts
        item=self.story(['Source line 0.','Source line 1.'],['Target line 0.','Target line 1 (2).','Distractor annotation.'])
        note=item['units']['en'][2];note.update(section='notes',noteId='2')
        item['structures']['en']['notes']=[{'id':'2','start':note['start'],'end':note['end']}]
        for locale in ['vi','en']:
            units=item['units'][locale][:2];item['structures'][locale]['poems']=[{'id':'couplet','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'couplet'}]
        def encode(texts):
            return np.array([[0.,0.,1.] if 'Distractor' in t else [float('line 0' in t),float('line 1' in t),0.] for t in texts])
        groups,_=align_contexts(item,encode)
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(len(item['poemPairs'][0]['correspondences']),2)
        self.assertTrue(groups)
        self.assertTrue(all('Distractor' not in g['enInput']['text'] for g in groups))

    def test_source_rendering_break_is_a_semantically_validated_partition_candidate(self):
        from context_alignment import align_contexts
        item=self.story([f'Old verse {i}.' for i in range(7)]+[f'Current verse {i}.' for i in range(5)],
                        [f'Target verse {i}.' for i in range(6)])
        for locale in ['vi','en']:
            units=item['units'][locale];hint={'id':'named','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'named-poem'}
            if locale=='vi':hint['renderingBreaks']=[units[7]['start']]
            item['structures'][locale]['poems']=[hint]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(6)
                if 'Old' in text:v[5]=1
                else:
                    for i in range(6):
                        if str(i) in text:v[min(i,4)]=1
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['vi']['start'],item['units']['vi'][7]['start'])

    def test_uneven_rendering_may_have_one_more_reader_line_than_the_counterpart(self):
        from context_alignment import align_contexts
        item=self.story([f'Old verse {i}.' for i in range(7)]+[f'Current verse {i}.' for i in range(8)],
                        [f'Target verse {i}.' for i in range(7)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'plain','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'verse-block'}]
        def encode(texts):
            result=[]
            for text in texts:
                v=np.zeros(8)
                if 'Old' in text:v[7]=1
                else:
                    for i in range(8):
                        if str(i) in text:v[min(i,6)]=1
                result.append(v)
            return np.array(result)
        align_contexts(item,encode)
        self.assertEqual(len(item['poemPairs']),1)
        self.assertEqual(item['poemPairs'][0]['vi']['start'],item['units']['vi'][7]['start'])

    def test_whole_match_without_line_support_is_explicitly_context_only(self):
        from context_alignment import align_contexts
        item=self.story([f'Source verse {i}.' for i in range(4)],[f'Target verse {i}.' for i in range(4)])
        for locale in ['vi','en']:
            units=item['units'][locale];item['structures'][locale]['poems']=[{'id':'whole','start':0,'end':units[-1]['end'],
                'lines':[{'start':u['start'],'end':u['end']} for u in units],'evidence':'verse-block'}]
        def encode(texts):
            return np.array([[1.,0.] if all(str(i) in t for i in range(4)) or 'Source' in t else [0.,1.] for t in texts])
        groups,_=align_contexts(item,encode)
        self.assertEqual(groups,[])
        self.assertTrue(item['poemPairs'][0]['contextOnly'])
        self.assertEqual(item['poemPairs'][0]['correspondences'],[])

    def test_ineligible_named_poem_cannot_seed_an_untitled_rendering_partition(self):
        import re
        from poetry_tracks import pair_tracks
        from context_alignment import _normalized
        def track(prefix,count,start,named=False):
            units=[test_alignment.ContextAlignmentTests.unit(f'{prefix} line {i}.',start+i*30) for i in range(count)]
            result={'id':prefix,'start':start,'end':units[-1]['end'],'units':units,'hinted':True,'evidence':'verse-block'}
            if named:result.update(title={'start':start-20,'end':start-1},titleText='A heading',evidence='named-poem')
            return result
        main=track('Main',12,0);other=track('Other',4,1000,True)
        plain=track('Plain',6,0);named=track('Named',8,1000,True)
        def encode(texts):
            values=[]
            for text in texts:
                ids={int(i) for i in re.findall(r'Main line (\d+)',text)}
                if ids==set(range(12)):v=[.6,.6,.28**.5]
                elif ids==set(range(8,12)):v=[.1,.99**.5,0.]
                elif ids==set(range(8)):v=[.8,.6,0.]
                elif ids:v=[.1,0.,.99**.5] if min(ids)<6 else [.8,0.,.6]
                elif 'Plain' in text:v=[1.,0.,0.]
                else:v=[0.,1.,0.]
                values.append(v)
            return np.array(values)
        _,left,_=pair_tracks([main,other],[plain,named],encode,_normalized)
        self.assertEqual([len(t['units']) for t in left if t['start']<1000],[6,6])


if __name__ == '__main__':
    unittest.main()
