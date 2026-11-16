"""Pair Vietnamese verse scopes that no poem pair covers with the English prose of the same stretch of the chapter.
The English edition renders some letters, memorials and rhapsodies as prose where the Vietnamese edition keeps their verse lines, so no English poem scope exists
and the verse lines are in no group. The zone between the nearest supported groups before and after the Vietnamese scopes holds that prose; its sentences (and the
lines the English marks with a no-break space) become the lines of a synthetic English track, and the existing line pairing aligns the two."""
import re
import numpy as np
from poetry_tracks import _line_pairs,_correspondences,_views,_similarity

SUPPORTED=(.5,.015)
MIN_WHOLE=.5
MIN_COVERAGE=.75


def u16(text):return len(text.encode('utf-16-le'))//2


def slice16(text,start,end):return text.encode('utf-16-le')[start*2:end*2].decode('utf-16-le')


def _letters(text):return len(re.findall(r'[^\W\d_]',text))


def english_units(text,start,end):
    """Sentences and no-break-space lines of text[start:end] (UTF-16 offsets) as spans in the same offsets."""
    body=slice16(text,start,end);cuts=[0]
    for m in re.finditer(r'(?<=[.!?…])["”’)]*[ \t]+(?=["“‘(]?[^\W\d_a-z])|\xa0+',body):cuts.append(m.end())
    cuts.append(len(body));spans=[]
    for a,b in zip(cuts,cuts[1:]):
        piece=body[a:b];lead=len(piece)-len(piece.lstrip(' \t\xa0\n'));trail=len(piece)-len(piece.rstrip(' \t\xa0\n'))
        if _letters(piece)==0:continue
        spans.append({'start':start+u16(body[:a+lead]),'end':start+u16(body[:b-trail])})
    return spans


def verse_lines(text,breaks,scope):
    cuts=[scope['start'],*[b for b in sorted(set(breaks)) if scope['start']<b<scope['end']],scope['end']];lines=[]
    for a,b in zip(cuts,cuts[1:]):
        piece=slice16(text,a,b);lead=len(piece)-len(piece.lstrip());trail=len(piece)-len(piece.rstrip())
        if _letters(piece):lines.append({'start':a+u16(piece[:lead]),'end':b-u16(piece[len(piece)-trail:] if trail else '')})
    return lines


def zones(artifact):
    """Clusters of unpaired Vietnamese scopes with the supported groups around them and the English text between those groups."""
    vi,en=artifact['editions']['vi']['text'],artifact['editions']['en']['text']
    paired=[p['vi'] for p in artifact.get('poems',[])]
    scopes=sorted((s for s in artifact.get('poetryScopes',{}).get('vi',[]) if not any(p['start']<=s['start'] and s['end']<=p['end'] for p in paired)
                   and not any(p.get('title') and p['title']['start']<=s['start'] and s['end']<=p['title']['end'] for p in paired)),key=lambda s:s['start'])
    clusters=[]
    for s in scopes:
        if clusters and s['start']-clusters[-1][-1]['end']<=150:clusters[-1].append(s)
        else:clusters.append([s])
    every=[g for g in artifact['groups'] if not g.get('tracks')]
    supported=[g for g in every if g['score']>=SUPPORTED[0] and g['margin']>=SUPPORTED[1]]
    result=[]
    for cluster in clusters:
        lo,hi=cluster[0]['start'],cluster[-1]['end']
        # The nearest groups in Vietnamese order bound the zone, a short unsupported one included; a stray group that breaks the English order sends the choice back to the supported ones.
        for pool in (every,supported):
            before=max((g for g in pool if g['vi']['end']<=lo),key=lambda g:g['vi']['end'],default=None)
            after=min((g for g in pool if g['vi']['start']>=hi),key=lambda g:g['vi']['start'],default=None)
            if before and after and before['en']['end']<=after['en']['start']:break
        else:continue
        elo,ehi=before['en']['end'],after['en']['start']
        if any(p['start']<ehi and elo<p['end'] for p in artifact.get('poetryScopes',{}).get('en',[])):continue
        # What the zone's own groups and notes already hold stays out; a group whose Vietnamese lies outside the zone but whose English lies in it is a stray.
        taken=[(g['en']['start'],g['en']['end']) for g in artifact['groups'] if lo<=g['vi']['start'] and g['vi']['end']<=hi]
        taken+=[(p['en']['start'],p['en']['end']) for p in artifact.get('notePairs',[])]+[(p['en']['start'],p['en']['end']) for p in artifact.get('poems',[])]
        free=[];at=elo
        for s,e in sorted(t for t in taken if t[1]>elo and t[0]<ehi):
            if s>at:free.append((at,min(s,ehi)))
            at=max(at,e)
        if at<ehi:free.append((at,ehi))
        units=[u for s,e in free for u in english_units(en,s,e)]
        if len(units)>=4:result.append({'scopes':cluster,'units':units,'before':before['id'],'after':after['id']})
    return result


def _vector(units,encode,normalize):
    return np.stack([v[0] for v in _views([units],encode,normalize)])


def add_verse_prose_pairs(artifact,encode,normalize):
    """Append synthetic poem pairs to artifact['poems'] (and the English scopes to artifact['poetryScopes']); returns a report per paired scope."""
    vi,en=artifact['editions']['vi'],artifact['editions']['en'];report=[]
    for zone in zones(artifact):
        right=[{'text':slice16(en['text'],u['start'],u['end']),'start':u['start'],'end':u['end'],'starts':[],'ends':[]} for u in zone['units']]
        track={'id':f"prose-{right[0]['start']}",'start':right[0]['start'],'end':right[-1]['end'],'lines':[{'start':u['start'],'end':u['end']} for u in right]}
        target=_vector(right,encode,normalize)
        candidates=[]
        for scope in zone['scopes']:
            lines=verse_lines(vi['text'],vi.get('breaks',[]),scope)
            if len(lines)<4:continue
            left=[{'text':slice16(vi['text'],l['start'],l['end']),'start':l['start'],'end':l['end'],'starts':[],'ends':[]} for l in lines]
            pairs=_line_pairs(left,right,encode,normalize)
            if not pairs:report.append({'scope':scope,'skipped':'pairs'});continue
            # A scope may hold the original and its rendering one after the other: only the run of lines that pair with the prose is the counterpart.
            lo,hi=min(k for p in pairs for k in p['vi']),max(k for p in pairs for k in p['vi'])
            if hi-lo+1<len(left):
                lines,left=lines[lo:hi+1],left[lo:hi+1]
                if len(left)<4:report.append({'scope':scope,'skipped':'lines'});continue
                pairs=_line_pairs(left,right,encode,normalize)
                if not pairs:report.append({'scope':scope,'skipped':'pairs'});continue
            whole=float(_similarity(_vector(left,encode,normalize),target))
            if whole<MIN_WHOLE:report.append({'scope':scope,'skipped':'whole','whole':whole});continue
            coverage=min(len({k for p in pairs for k in p['vi']})/len(left),len({k for p in pairs for k in p['en']})/len(right)) if pairs else 0
            if coverage<MIN_COVERAGE:report.append({'scope':scope,'skipped':'coverage','whole':whole,'coverage':coverage});continue
            correspondences=_correspondences(left,right,pairs,encode,normalize)
            if not correspondences:report.append({'scope':scope,'skipped':'correspondences','whole':whole,'coverage':coverage});continue
            candidates.append((whole,scope,lines,correspondences,coverage,len(pairs)))
        if not candidates:continue
        best=max(c[0] for c in candidates)
        for whole,scope,lines,correspondences,coverage,count in candidates:
            others=[c[0] for c in candidates if c[1] is not scope]
            artifact.setdefault('poems',[]).append({
                'vi':{'id':f"verse-{lines[0]['start']}",'start':lines[0]['start'],'end':lines[-1]['end'],'lines':lines},'en':{**track,'lines':[dict(l) for l in track['lines']]},
                'score':whole,'margin':max(0.0,whole-max(others,default=0)),'primary':{'vi':True,'en':whole==best},'correspondences':correspondences,'contextOnly':False})
            report.append({'scope':scope,'paired':True,'whole':whole,'coverage':coverage,'pairs':count,'correspondences':len(correspondences),'enTrack':track['id']})
        scopes=artifact.setdefault('poetryScopes',{'vi':[],'en':[]});scopes.setdefault('en',[]).append({'start':track['start'],'end':track['end']})
    return report
