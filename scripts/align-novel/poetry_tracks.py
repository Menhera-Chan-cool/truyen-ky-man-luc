"""Conservative DOM verse tracks; semantic evidence is required before reuse."""
import re
import numpy as np


def _line_pairs(left, right, encode, normalize):
    """Align actual adjacent-line strings rather than averaging isolated verse vectors."""
    n,m=len(left),len(right)
    def windows(units):
        return {size:normalize(encode(['\n'.join(u.get('semanticText',u['text']).strip() for u in units[at:at+size])
                                      for at in range(len(units)-size+1)])) for size in range(1,min(3,len(units))+1)}
    a,b=windows(left),windows(right)
    scores={(x,y):a[x]@b[y].T for x in a for y in b}
    dp=np.full((n+1,m+1),-np.inf);dp[0,0]=0
    back=np.zeros((n+1,m+1,2),dtype=np.int8)
    for i in range(n+1):
        for j in range(m+1):
            value=dp[i,j]
            if i<n and value-.01>dp[i+1,j]:dp[i+1,j]=value-.01;back[i+1,j]=[1,0]
            if j<m and value-.01>dp[i,j+1]:dp[i,j+1]=value-.01;back[i,j+1]=[0,1]
            for x in range(1,min(3,n-i)+1):
                for y in range(1,min(3,m-j)+1):
                    score=float(scores[x,y][i,j])
                    if score<.35:continue
                    # Reward supported lines, so splitting evidence into singletons cannot hide a weak isolated line.
                    candidate=value+(score-.35)*min(x,y)-.015*(x+y-2)
                    if candidate>dp[i+x,j+y]:dp[i+x,j+y]=candidate;back[i+x,j+y]=[x,y]
    pairs=[];i,j=n,m
    while i or j:
        x,y=map(int,back[i,j]);i-=x;j-=y
        if not x and not y:raise ValueError('Broken verse alignment path')
        if x and y:
            matrix=scores[x,y];score=float(matrix[i,j])
            other=[float(matrix[i,k]) for k in range(matrix.shape[1]) if k+y<=j or k>=j+y]
            reverse=[float(matrix[k,j]) for k in range(matrix.shape[0]) if k+x<=i or k>=i+x]
            pairs.append({'vi':list(range(i,i+x)),'en':list(range(j,j+y)),'score':score,
                          'margin':min(score-max(other,default=0),score-max(reverse,default=0))})
    return pairs[::-1]


def detect_tracks(units, edition):
    raw = edition['text'].encode('utf-16-le')
    breaks = sorted(set([0, *edition.get('breaks', []), len(raw) // 2]))
    tracks, run = [], []
    def flush():
        if len(run) >= 4:
            tracks.append({'id': f"verse-{run[0]['start']}", 'start': run[0]['start'], 'end': run[-1]['end'], 'units': list(run)})
        run.clear()
    for start, end in zip(breaks, breaks[1:]):
        selected = [u for u in units if start <= u['start'] and u['end'] <= end]
        text = ' '.join(u['text'].strip() for u in selected)
        block = raw[start * 2:end * 2].decode('utf-16-le').strip()
        if re.fullmatch(r'[IVXLCDM]+[.)]?', text):
            flush(); continue
        # Dialogue and prose paragraphs have no structural verse evidence.
        if not selected or not 2 <= len(text.split()) <= 18 or len(text) > 150 or re.match(r'^[\-–—"“”‘’«»]', block) or block.endswith(':'):
            flush(); continue
        line = {**selected[0], 'text': '', 'starts': [], 'ends': [], 'end': selected[-1]['end']}
        for unit in selected:
            if line['text']:
                line['text'] += ' '; line['starts'].append(unit['start']); line['ends'].append(unit['start'])
            line['text'] += unit['text']; line['starts'] += unit['starts']; line['ends'] += unit['ends']
        line['semanticText'] = '\n'.join(u.get('semanticText', u['text']) for u in selected)
        run.append(line)
    flush()
    return tracks


def pair_tracks(left, right, encode, normalize):
    def vector(track):
        return normalize(encode(['\n'.join(u.get('semanticText', u['text']).strip() for u in track['units'])]))[0]
    def alternatives(tracks, other):
        result = []
        for track in tracks:
            replacement = None
            for target in other:
                width = len(target['units']); count = len(track['units']) // width
                if count not in [2, 3] or len(track['units']) != count * width: continue
                chunks = []
                for at in range(0, len(track['units']), width):
                    lines = track['units'][at:at + width]
                    chunks.append({'id': f"verse-{lines[0]['start']}", 'start': lines[0]['start'], 'end': lines[-1]['end'], 'units': lines})
                vectors = [vector(chunk) for chunk in chunks]; target_vector = vector(target)
                # A weak original must not hide a complete, independently supported rendering.
                if max(float(v @ target_vector) for v in vectors) >= .5:
                    replacement = chunks; break
            result.extend(replacement or [track])
        return result
    left, right = alternatives(left, right), alternatives(right, left)
    if not left or not right: return [], left, right
    scores = np.stack([vector(t) for t in left]) @ np.stack([vector(t) for t in right]).T
    eligible = {(i,j) for i,track in enumerate(left) for j,target in enumerate(right)
                if max(len(track['units']),len(target['units'])) <= 1.75 * min(len(track['units']),len(target['units']))}
    selected = set()
    # Each direction may reuse a unique whole-track match; ties never create a Cartesian product.
    for reverse in [False,True]:
        matrix = scores.T if reverse else scores
        for i in range(len(matrix)):
            candidates = [j for j in range(matrix.shape[1]) if ((j,i) if reverse else (i,j)) in eligible]
            if not candidates: continue
            j = max(candidates,key=lambda j:float(matrix[i,j]))
            if matrix[i,j] < .5 or any(matrix[i,j]-matrix[i,k] < .03 for k in candidates if k != j): continue
            selected.add((j,i) if reverse else (i,j))
    choices = []
    for i,j in sorted(selected):
        track = left[i]
        a, b = track['units'], right[j]['units']
        pairs = _line_pairs(a,b,encode,normalize)
        if min(len({k for p in pairs for k in p['vi']}) / len(a), len({k for p in pairs for k in p['en']}) / len(b)) < .75: continue
        choices.append((i, j, pairs))
    result = []
    for i, j, pairs in choices:
        vi_primary = max((candidate for candidate in choices if candidate[0] == i), key=lambda p: (float(scores[i,p[1]]), -right[p[1]]['start']))[1]
        en_primary = max((candidate for candidate in choices if candidate[1] == j), key=lambda p: (float(scores[p[0],j]), -left[p[0]]['start']))[0]
        metadata = {locale: {key: track[key] for key in ['id', 'start', 'end']} for locale, track in [('vi', left[i]), ('en', right[j])]}
        for pair in pairs:
            result.append({**pair, 'primary': {'vi': j == vi_primary, 'en': i == en_primary}, 'tracks': metadata,
                           'viUnits': [left[i]['units'][k] for k in pair['vi']], 'enUnits': [right[j]['units'][k] for k in pair['en']]})
    return result, left, right
