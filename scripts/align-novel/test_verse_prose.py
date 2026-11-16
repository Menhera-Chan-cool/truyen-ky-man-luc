import unittest
import numpy as np
from verse_prose import english_units,verse_lines,zones,add_verse_prose_pairs

VI_LINES=['Một đây,','Hai đây,','Ba đây,','Bốn đây.']
EN_LINES=['One here.','Two here.','Three here.','Four here.']
MEANING={text:i for i,text in enumerate(VI_LINES)}|{text:i for i,text in enumerate(EN_LINES)}|{'Lạc đề,':7,'Lạc nữa,':8}


def encode(texts):
    """One-hot meaning per line; a window is the normalised sum of its lines."""
    out=[]
    for text in texts:
        vector=np.zeros(10)
        for line in text.split('\n'):
            if line.strip() in MEANING:vector[MEANING[line.strip()]]+=1
        out.append(vector)
    return np.array(out)


def normalize(values):
    values=np.asarray(values,dtype=float);norms=np.linalg.norm(values,axis=1,keepdims=True)
    return values/np.where(norms==0,1,norms)


def artifact(extra_vi=(),english_scope=False):
    head,tail='Dẫn rằng: ',' Kết thúc.'
    lines=list(extra_vi)+VI_LINES
    vi=head+''.join(lines)+tail;breaks=[];at=len(head)
    for line in lines[:-1]:at+=len(line);breaks.append(at)
    start,end=len(head),len(head)+sum(map(len,lines))
    en='He wrote: '+' '.join(EN_LINES)+' The end.'
    g=lambda i,v,e:{'id':f'g{i}','section':'story','score':.9,'margin':.2,'vi':{'start':vi.index(v),'end':vi.index(v)+len(v)},'en':{'start':en.index(e),'end':en.index(e)+len(e)},'links':[]}
    return {'editions':{'vi':{'text':vi,'breaks':breaks},'en':{'text':en}},'groups':[g(0,'Dẫn rằng:','He wrote:'),g(1,'Kết thúc.','The end.')],
            'poems':[],'notePairs':[],'poetryScopes':{'vi':[{'start':start,'end':end}],'en':[{'start':en.index('One'),'end':en.index('The end')-1}] if english_scope else []}}


class VersProseTests(unittest.TestCase):
    def test_english_units_split_sentences_and_no_break_space_lines(self):
        text='Skip. Ever I dread the mirror,\xa0That I am denied. Is it so? "Yes," she said. Tail'
        spans=english_units(text,text.index('Ever'),len(text))
        self.assertEqual([text[s['start']:s['end']] for s in spans],['Ever I dread the mirror,','That I am denied.','Is it so?','"Yes," she said.','Tail'])

    def test_verse_lines_follow_the_breaks_and_drop_blank_pieces(self):
        a=artifact();vi=a['editions']['vi'];scope=a['poetryScopes']['vi'][0]
        self.assertEqual([vi['text'][l['start']:l['end']] for l in verse_lines(vi['text'],vi['breaks'],scope)],VI_LINES)

    def test_zone_between_the_nearest_groups_holds_the_english_units(self):
        a=artifact();found=zones(a)
        self.assertEqual(len(found),1);self.assertEqual((found[0]['before'],found[0]['after']),('g0','g1'))
        self.assertEqual([a['editions']['en']['text'][u['start']:u['end']] for u in found[0]['units']],EN_LINES)

    def test_no_zone_when_the_english_already_has_a_poem_scope_or_the_groups_cross(self):
        self.assertEqual(zones(artifact(english_scope=True)),[])
        a=artifact();a['groups'][1]['en']={'start':0,'end':5};self.assertEqual(zones(a),[])

    def test_a_stray_group_that_breaks_the_english_order_falls_back_to_the_supported_ones(self):
        a=artifact();en=a['editions']['en']['text']
        a['groups'].append({'id':'stray','section':'story','score':.2,'margin':0,'vi':{'start':9,'end':10},'en':{'start':len(en)-3,'end':len(en)},'links':[]})
        self.assertEqual(zones(a)[0]['before'],'g0')
        # A short unsupported group in the right order is a real neighbour and bounds the zone itself.
        a=artifact();a['groups'].append({'id':'near','section':'story','score':.2,'margin':0,'vi':{'start':9,'end':10},'en':{'start':en.index('One')-1,'end':en.index('One')},'links':[]})
        self.assertEqual(zones(a)[0]['before'],'near')

    def test_pairs_the_verse_lines_with_the_english_sentences_one_to_one(self):
        a=artifact();report=add_verse_prose_pairs(a,encode,normalize)
        self.assertEqual([r.get('paired') for r in report],[True]);self.assertEqual(len(a['poems']),1)
        p=a['poems'][0];vi,en=a['editions']['vi']['text'],a['editions']['en']['text']
        self.assertEqual([(vi[c['vi'][0]['start']:c['vi'][0]['end']],en[c['en'][0]['start']:c['en'][0]['end']]) for c in p['correspondences']],list(zip(VI_LINES,EN_LINES)))
        self.assertTrue(p['primary']['vi'] and p['primary']['en'] and not p['contextOnly'] and p['score']>=.5)
        self.assertEqual(a['poetryScopes']['en'],[{'start':p['en']['start'],'end':p['en']['end']}])
        self.assertTrue(all(l['start']>=p['vi']['start'] and l['end']<=p['vi']['end'] for l in p['vi']['lines']))

    def test_a_scope_that_starts_with_an_original_keeps_only_the_lines_that_pair(self):
        a=artifact(extra_vi=['Lạc đề,','Lạc nữa,','Lạc đề,','Lạc nữa,']);add_verse_prose_pairs(a,encode,normalize)
        p=a['poems'][0];vi=a['editions']['vi']['text']
        self.assertEqual(vi[p['vi']['start']:p['vi']['end']],''.join(VI_LINES));self.assertEqual(len(p['vi']['lines']),4)

    def test_nothing_is_added_when_the_lines_do_not_pair(self):
        a=artifact();a['editions']['en']['text']=a['editions']['en']['text'].replace('One here.','Zzz.').replace('Two here.','Yyy.').replace('Three here.','Xxx.').replace('Four here.','Www.')
        for g in a['groups']:g['en']={'start':0,'end':9} if g['id']=='g0' else {'start':len(a['editions']['en']['text'])-8,'end':len(a['editions']['en']['text'])}
        self.assertEqual(add_verse_prose_pairs(a,encode,normalize)[0].get('paired'),None);self.assertEqual(a['poems'],[])


if __name__=='__main__':unittest.main()
