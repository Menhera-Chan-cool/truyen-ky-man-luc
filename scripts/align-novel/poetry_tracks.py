"""Conservative DOM verse tracks; semantic evidence is required before reuse."""
import re
import numpy as np


def _views(groups,encode,normalize,prefix=''):
    raw=[prefix+'\n'.join(u['text'].strip() for u in units) for units in groups]
    contextual=[prefix+'\n'.join(u.get('semanticText',u['text']).strip() for u in units) for units in groups]
    body=normalize(encode(raw))
    return body,body if contextual==raw else normalize(encode(contextual))


def _similarity(a,b):
    return max(float(a[0]@b[0]),float(a[1]@b[1]))


def _line_pairs(left, right, encode, normalize):
    """Align actual adjacent-line strings rather than averaging isolated verse vectors."""
    n,m=len(left),len(right)
    def windows(units):
        return {size:_views([units[at:at+size] for at in range(len(units)-size+1)],encode,normalize)
                for size in range(1,min(3,len(units))+1)}
    a,b=windows(left),windows(right)
    scores={(x,y):np.maximum(a[x][0]@b[y][0].T,a[x][1]@b[y][1].T) for x in a for y in b}
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
                    candidate=value+(score-.35)*(x+y)/2-.015*(x+y-2)
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


def _line_span(unit):
    return dict(unit.get('lineSpan',{'start':unit['start'],'end':unit['end']}))


def _correspondences(left,right,pairs,encode,normalize):
    n,m=len(left),len(right)
    single=_views([[u] for u in left+right],encode,normalize)
    direct=np.maximum(single[0][:n]@single[0][n:].T,single[1][:n]@single[1][n:].T)
    context=_views([left[max(0,i-1):min(n,i+2)] for i in range(n)]+[right[max(0,j-1):min(m,j+2)] for j in range(m)],encode,normalize)
    surrounding=np.maximum(context[0][:n]@context[0][n:].T,context[1][:n]@context[1][n:].T);result=[]
    for pair in pairs:
        if len(pair['vi'])!=len(pair['en']):
            if pair['score']>=.5:
                result.append({l:[_line_span(units[k]) for k in pair[l]] for l,units in [('vi',left),('en',right)]}|{'score':pair['score'],'evidence':'direct-window'})
            continue
        for i,j in zip(pair['vi'],pair['en']):
            score=float(direct[i,j]);ctx=float(surrounding[i,j])
            other=max([float(direct[i,k]) for k in range(m) if k!=j]+[float(direct[k,j]) for k in range(n) if k!=i],default=0)
            if other>=.35 and other-score>=.1:continue
            if score>=.35 and score-other>=.03:evidence='direct-window'
            elif ctx>=.5 and score>=.1 and abs((i+.5)/n-(j+.5)/m)<=.2:
                evidence='surrounding-window';score=ctx
            else:continue
            result.append({'vi':[_line_span(left[i])],'en':[_line_span(right[j])],'score':score,'evidence':evidence})
    return result


def detect_tracks(units, edition, poems=None, semantic_context=None):
    raw = edition['text'].encode('utf-16-le')
    breaks = sorted(set([0, *edition.get('breaks', []), len(raw) // 2]))
    tracks, run = [], []
    def line(selected,bounds):
        result={**selected[0],'text':'','starts':[],'ends':[],'end':selected[-1]['end'],'lineSpan':dict(bounds)}
        for unit in selected:
            if result['text']:
                result['text']+=' ';result['starts'].append(unit['start']);result['ends'].append(unit['start'])
            result['text']+=unit['text'];result['starts']+=unit['starts'];result['ends']+=unit['ends']
        result['semanticText']='\n'.join(u.get('semanticText',u['text']) for u in selected)
        if semantic_context:result['semanticText']=semantic_context(result['text'],bounds)
        return result
    for hint in poems or []:
        if not isinstance(hint.get('id'),str) or not 0<=hint['start']<hint['end']<=len(raw)//2:raise ValueError('Invalid poem scope')
        previous=hint['start'];lines=[]
        for bounds in hint['lines']:
            if not previous<=bounds['start']<bounds['end']<=hint['end']:raise ValueError('Invalid poem line scope')
            raw[bounds['start']*2:bounds['end']*2].decode('utf-16-le');previous=bounds['end']
            selected=[u for u in units if bounds['start']<=u['start'] and u['end']<=bounds['end']]
            if selected:lines.append(line(selected,bounds))
        if len(lines)<2 and not (lines and hint.get('flattened')):continue
        track={k:hint[k] for k in ['id','start','end','evidence']};track.update(units=lines,hinted=True)
        if hint.get('renderingBreaks'):
            if any(p not in {line['start'] for line in hint['lines']} or not hint['start']<p<hint['end'] for p in hint['renderingBreaks']):raise ValueError('Invalid rendering break')
            track['renderingBreaks']=list(hint['renderingBreaks'])
        if hint.get('flattened'):track['flattened']=True
        if hint.get('title'):
            title=hint['title']
            if not 0<=title['start']<title['end']<=len(raw)//2:raise ValueError('Invalid poem title scope')
            track['title']=dict(title);track['titleText']=raw[title['start']*2:title['end']*2].decode('utf-16-le')
        tracks.append(track)
    if poems is not None:return sorted(tracks,key=lambda t:t['start'])
    def flush():
        if len(run) >= 4:
            tracks.append({'id': f"verse-{run[0]['start']}", 'start': run[0]['start'], 'end': run[-1]['end'], 'units': list(run)})
        run.clear()
    for start, end in zip(breaks, breaks[1:]):
        selected = [u for u in units if start <= u['start'] and u['end'] <= end]
        text = ' '.join(u['text'].strip() for u in selected)
        block = raw[start * 2:end * 2].decode('utf-16-le').strip()
        if not block:continue
        if any(start<t['end'] and t['start']<end for t in tracks):flush();continue
        if re.fullmatch(r'[IVXLCDM]+[.)]?', text):
            flush(); continue
        # Dialogue and prose paragraphs have no structural verse evidence.
        if not selected or not 2 <= len(text.split()) <= 18 or len(text) > 150 or re.match(r'^[\-–—"“”‘’«»]', block) or block.endswith(':'):
            flush(); continue
        run.append(line(selected,{'start':start,'end':end}))
    flush()
    return sorted(tracks,key=lambda t:t['start'])


def pair_tracks(left, right, encode, normalize, poem_pairs=None):
    def vector(track):
        views=_views([track['units']],encode,normalize,(track['titleText']+'\n') if track.get('titleText') else '')
        return np.stack([v[0] for v in views])
    def alternatives(tracks, other):
        result = []
        both_named=any(t.get('titleText') for t in tracks) and any(t.get('titleText') for t in other)
        for track in tracks:
            replacement = None;best_plan=None
            if track.get('flattened'):
                result.append(track);continue
            whole_scores=[(t,_similarity(vector(track),vector(t))) for t in other]
            whole_scores=[(t,s) for t,s in whole_scores if not both_named or bool(track.get('titleText'))==bool(t.get('titleText')) or s>=.75]
            best_whole=max((score for _,score in whole_scores),default=-1)
            same=max((score for t,score in whole_scores if len(t['units'])==len(track['units'])),default=-1)
            # A supported whole counterpart takes priority over unrelated partition sizes.
            if not track.get('renderingBreaks') and same>=.5 and same>=best_whole-.03:
                result.append(track);continue
            for target,whole_candidate in whole_scores:
                if whole_candidate<best_whole-.03:continue
                if both_named and bool(track.get('titleText'))!=bool(target.get('titleText')) and _similarity(vector(track),vector(target))<.75:continue
                width=len(target['units']);n=len(track['units']);count=n//width
                named=bool(track.get('title') or track.get('evidence')=='named-poem')
                plans=[]
                indices=[i for i,u in enumerate(track['units']) if _line_span(u)['start'] in track.get('renderingBreaks',[]) and 0<i<n]
                rendering_plans=[]
                if indices:
                    cuts=[0]+indices+[n];widths=[b-a for a,b in zip(cuts,cuts[1:])]
                    if 2<=len(widths)<=3 and min(widths)>=2:rendering_plans.append(widths);plans.append(widths)
                if count in [2,3] and n==count*width:plans.append([width]*count)
                # Named original and condensed rendering can have different line counts.
                if track.get('hinted') and 2<=n-width<=width+2:
                    plans.extend([[width,n-width],[n-width,width]])
                target_vector=vector(target)
                whole=_similarity(vector(track),target_vector) if plans else -1
                for widths in plans:
                    chunks=[];at=0
                    for size in widths:
                        lines=track['units'][at:at+size];at+=size
                        chunks.append({**track,'id':f"verse-{lines[0]['start']}",'start':_line_span(lines[0])['start'],
                                       'end':_line_span(lines[-1])['end'],'units':lines})
                    vectors=[vector(chunk) for chunk in chunks]
                    scores=[_similarity(v,target_vector) for v in vectors]
                    best=max(scores);rank=(best,sum(s>=.5 for s in scores),-len(chunks))
                    opposite_full=any(len(t['units'])==n and (t.get('title') or t.get('evidence')=='named-poem') for t in other)
                    parallel=(named and not opposite_full and (len(set(widths))==1 or widths in rendering_plans) and best>=whole-.08
                              and min(_similarity(a,b) for a in vectors for b in vectors)>=.7)
                    needs_gain=named or len(set(widths))>1
                    # Splitting needs whole semantic evidence; a weak original never forces its links.
                    if best>=.5 and (not needs_gain or best>=whole+.03 or parallel) and (best_plan is None or rank>best_plan):
                        best_plan=rank;replacement=chunks
            result.extend(replacement or [track])
        return result
    left, right = alternatives(left, right), alternatives(right, left)
    if not left or not right: return [], left, right
    a,b=np.stack([vector(t) for t in left]),np.stack([vector(t) for t in right])
    scores=np.maximum(a[:,0]@b[:,0].T,a[:,1]@b[:,1].T)
    named_left=[i for i,t in enumerate(left) if t.get('titleText')]
    named_right=[j for j,t in enumerate(right) if t.get('titleText')]
    title_scores=None
    if named_left and named_right:
        title_vectors=normalize(encode([left[i]['titleText'] for i in named_left]+[right[j]['titleText'] for j in named_right]))
        title_scores=title_vectors[:len(named_left)]@title_vectors[len(named_left):].T
    def title_compatible(i,j):
        if title_scores is None:return True
        if (i in named_left)!=(j in named_right):return float(scores[i,j])>=.75
        if i not in named_left:return True
        a,b=named_left.index(i),named_right.index(j)
        row,col=float(title_scores[a].max()),float(title_scores[:,b].max())
        # Similar weather/season bodies cannot override an independently clear title.
        return min(row,col)<.5 or float(title_scores[a,b])>=max(row,col)-.08
    eligible = {(i,j) for i,track in enumerate(left) for j,target in enumerate(right)
                if title_compatible(i,j) and (track.get('flattened') or target.get('flattened') or max(len(track['units']),len(target['units'])) <= (3 if track.get('hinted') and target.get('hinted') else 1.75) * min(len(track['units']),len(target['units'])))}
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
        pairs = [] if track.get('flattened') or right[j].get('flattened') else _line_pairs(a,b,encode,normalize)
        choices.append((i, j, pairs))
    result = []
    for i, j, pairs in choices:
        vi_primary = max((candidate for candidate in choices if candidate[0] == i), key=lambda p: (float(scores[i,p[1]]), -right[p[1]]['start']))[1]
        en_primary = max((candidate for candidate in choices if candidate[1] == j), key=lambda p: (float(scores[p[0],j]), -left[p[0]]['start']))[0]
        metadata = {locale: {key: track[key] for key in ['id','start','end','title'] if key in track} for locale, track in [('vi', left[i]), ('en', right[j])]}
        primary={'vi':j==vi_primary,'en':i==en_primary}
        coverage=min(len({k for p in pairs for k in p['vi']})/len(left[i]['units']),len({k for p in pairs for k in p['en']})/len(right[j]['units'])) if pairs else 0
        correspondences=_correspondences(left[i]['units'],right[j]['units'],pairs,encode,normalize) if coverage>=.75 else []
        if poem_pairs is not None:
            scopes={l:{**metadata[l],'lines':[_line_span(u) for u in track['units']],**({'flattened':True} if track.get('flattened') else {})}
                    for l,track in [('vi',left[i]),('en',right[j])]}
            margin=min(float(scores[i,j])-max([float(scores[i,k]) for k in range(len(right)) if k!=j],default=0),
                       float(scores[i,j])-max([float(scores[k,j]) for k in range(len(left)) if k!=i],default=0))
            poem_pairs.append({**scopes,'score':float(scores[i,j]),'margin':margin,'primary':primary,'correspondences':correspondences,'contextOnly':coverage<.75})
        if coverage<.75:continue
        for pair in pairs:
            line_spans={l:[dict(track['units'][k].get('lineSpan',{'start':track['units'][k]['start'],'end':track['units'][k]['end']})) for k in pair[l]]
                        for l,track in [('vi',left[i]),('en',right[j])]}
            related=[c for c in correspondences if all(any(p['start']<=q['start'] and q['end']<=p['end'] for p in line_spans[l]) for l in ['vi','en'] for q in c[l])]
            result.append({**pair, 'primary':primary, 'tracks': metadata,
                           'poetryLines':{**line_spans,'score':pair['score'],'poemScore':float(scores[i,j]),'evidence':'direct-window','correspondences':related},
                           'viUnits': [left[i]['units'][k] for k in pair['vi']], 'enUnits': [right[j]['units'][k] for k in pair['en']]})
    return result, left, right


def quote_aliases(tracks,poem_pairs,encode,normalize):
    """Bridge observed same-language quotations through already trusted poem lines."""
    aliases=[]
    plain=lambda us:'\n'.join(u['text'].strip() for u in us)
    words=lambda text:set(re.findall(r'[^\W\d_]+',text.casefold()))
    def spans(values):return [{'start':a,'end':b} for a,b in sorted({(p['start'],p['end']) for p in values})]
    def inside(parts,scope):return all(any(s['start']<=p['start'] and p['end']<=s['end'] for s in scope) for p in parts)
    for locale in ['vi','en']:
        other='en' if locale=='vi' else 'vi'
        for quote in tracks[locale]:
            if quote.get('flattened') or quote.get('title') or not 1<=len(quote['units'])<=3:continue
            if any(p[locale]['start']<=quote['start'] and quote['end']<=p[locale]['end'] for p in poem_pairs):continue
            query=plain(quote['units']);query_words=words(query);candidates=[]
            for parent in poem_pairs:
                if not parent['primary'][locale] or parent.get('contextOnly') or parent[locale].get('flattened') or not parent['correspondences']:continue
                track=next((t for t in tracks[locale] if t['id']==parent[locale]['id'] and t['start']==parent[locale]['start'] and t['end']==parent[locale]['end']),None)
                if not track or len(track['units'])<=len(quote['units']):continue
                windows=[]
                for size in range(1,min(3,len(track['units']))+1):
                    for at in range(len(track['units'])-size+1):
                        units=track['units'][at:at+size];tokens=words(plain(units));lexical=len(tokens&query_words)/max(len(tokens|query_words),1)
                        if lexical>=.5:windows.append((at,size,units,lexical))
                if not windows:continue
                vectors=normalize(encode([query]+[plain(u) for _,_,u,_ in windows]))
                for index,(at,size,units,lexical) in enumerate(windows):
                    semantic=float(vectors[0]@vectors[index+1])
                    if semantic>=.5:candidates.append((.7*semantic+.3*lexical-.015*(size-1),semantic,parent,track,at,size,units))
            if not candidates:continue
            best=max(candidates,key=lambda c:(c[0],-c[5],-c[3]['start'],-c[4]))
            rank,semantic,parent,track,at,size,units=best
            competitors=[c[0] for c in candidates if c[3]['id']!=track['id'] or c[4]+c[5]<=at or c[4]>=at+size]
            if rank-max(competitors,default=0)<.03:continue
            window=[_line_span(u) for u in units]
            bridge=[c for c in parent['correspondences'] if inside(c[locale],window)]
            if not bridge or not inside(window,[p for c in bridge for p in c[locale]]):continue
            target=spans([p for c in bridge for p in c[other]])
            positions=[parent[other]['lines'].index(p) for p in target]
            if positions!=list(range(min(positions),max(positions)+1)):continue
            clean=lambda us:[{**u,'semanticText':u['text']} for u in us]
            paired=_line_pairs(clean(units),clean(quote['units']),encode,normalize)
            if len({i for p in paired for i in p['vi']})!=len(units) or len({i for p in paired for i in p['en']})!=len(quote['units']):continue
            mapping=[]
            for p in paired:
                selected=[_line_span(units[i]) for i in p['vi']];local=[c for c in bridge if inside(c[locale],selected)]
                if local and inside(selected,[s for c in local for s in c[locale]]):
                    mapping.append({locale:[_line_span(quote['units'][i]) for i in p['en']],other:spans([s for c in local for s in c[other]]),
                                    'score':min(p['score'],*(c['score'] for c in local)),'evidence':'surrounding-window'})
            if not mapping:mapping=[{locale:[_line_span(u) for u in quote['units']],other:target,'score':min(semantic,*(c['score'] for c in bridge)),'evidence':'surrounding-window'}]
            scopes={locale:{k:quote[k] for k in ['id','start','end']},other:{**parent[other],'start':target[0]['start'],'end':target[-1]['end'],'lines':target}}
            scopes[locale]['lines']=[_line_span(u) for u in quote['units']]
            aliases.append({**scopes,'score':min(parent['score'],semantic),'margin':rank-max(competitors,default=0),
                            'primary':{locale:True,other:False},'correspondences':mapping,'aliasOrigin':'same-language-quote'})
    return aliases
