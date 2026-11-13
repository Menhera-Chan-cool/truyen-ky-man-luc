import numpy as np
def vietnamese_word_spans(units):
    import regex,unicodedata
    from underthesea import word_tokenize
    result=set()
    for unit in units:
        normalized='';starts=[];ends=[]
        for cluster in regex.finditer(r'\X',unit['text']):
            value=unicodedata.normalize('NFC',cluster.group())
            normalized+=value;starts += [cluster.start()]*len(value);ends += [cluster.end()]*len(value)
        cursor=0;found=[];valid=True
        for token in word_tokenize(normalized):
            pattern=r'\s+'.join(regex.escape(p) for p in token.split())
            match=regex.search(pattern,normalized[cursor:]) if pattern else None
            if not match:valid=False;break
            a,b=cursor+match.start(),cursor+match.end();cursor=b
            if any(c.isalpha() for c in token):found.append((a,b))
        if not valid:found=[m.span() for m in regex.finditer(r'[\p{L}\p{M}\p{N}]+',normalized)]
        for a,b in found:
            start,end=reader_span(unit,starts[a],ends[b-1]);result.add((start,end))
    return [{'start':a,'end':b} for a,b in sorted(result)]
def align_candidates(source,target,minimum=.78):
    if not len(source) or not len(target):return []
    source=np.asarray(source);target=np.asarray(target);result={}
    for reverse in [False,True]:
        left,right=(target,source) if reverse else (source,target)
        for i,vector in enumerate(left):
            candidates=[]
            for size in range(1,min(3,len(right))+1):
                merged=np.stack([right[j:j+size].sum(0) for j in range(len(right)-size+1)])
                merged/=np.maximum(np.linalg.norm(merged,axis=1,keepdims=True),1e-9)
                values=merged@vector
                for j,score in enumerate(values):candidates.append((float(score)-.015*(size-1),float(score),j,size))
            candidates.sort(reverse=True);_,score,j,size=candidates[0]
            if score<minimum:continue
            alternatives=[s for _,s,k,z in candidates[1:] if k+z<=j or k>=j+size]
            a,b=([j+x for x in range(size)],[i]) if reverse else ([i],[j+x for x in range(size)])
            key=(tuple(a),tuple(b));result[key]={'vi':a,'en':b,'score':score,'margin':score-max(alternatives,default=0)}
    return sorted(result.values(),key=lambda p:(p['vi'][0],p['en'][0]))

def align_sequences(source,target,minimum=.80):
    n,m=len(source),len(target)
    if not n or not m:return []
    source=np.asarray(source,dtype=np.float32);target=np.asarray(target,dtype=np.float32)
    def merged(values,size):
        result=np.stack([values[i:i+size].sum(0) for i in range(len(values)-size+1)])
        return result/np.maximum(np.linalg.norm(result,axis=1,keepdims=True),1e-9)
    scores={(a,b):merged(source,a)@merged(target,b).T for a in range(1,min(3,n)+1) for b in range(1,min(3,m)+1)}
    dp=np.full((n+1,m+1),-np.inf);dp[0,0]=0
    back=np.zeros((n+1,m+1,2),dtype=np.int8)
    for i in range(n+1):
        for j in range(m+1):
            value=dp[i,j]
            if i<n and value-.01>dp[i+1,j]:dp[i+1,j]=value-.01;back[i+1,j]=[1,0]
            if j<m and value-.01>dp[i,j+1]:dp[i,j+1]=value-.01;back[i,j+1]=[0,1]
            for a in range(1,min(3,n-i)+1):
                for b in range(1,min(3,m-j)+1):
                    score=float(scores[a,b][i,j])
                    if score<minimum:continue
                    candidate=value+score-minimum-.015*(a+b-2)
                    if candidate>dp[i+a,j+b]:dp[i+a,j+b]=candidate;back[i+a,j+b]=[a,b]
    result=[];i,j=n,m
    while i or j:
        a,b=map(int,back[i,j]);i-=a;j-=b
        if not a and not b:raise ValueError('Broken alignment path')
        if a and b:
            matrix=scores[a,b];score=float(matrix[i,j])
            alternatives=[float(matrix[i,k]) for k in range(matrix.shape[1]) if k+b<=j or k>=j+b]
            reverse=[float(matrix[k,j]) for k in range(matrix.shape[0]) if k+a<=i or k>=i+a]
            result.append({'vi':list(range(i,i+a)),'en':list(range(j,j+b)),'score':score,'margin':min(score-max(alternatives,default=0),score-max(reverse,default=0))})
    return result[::-1]

def softmax_links(scores):
    scores=np.asarray(scores)
    if not scores.size:return []
    row=np.exp(scores-scores.max(1,keepdims=True));row/=row.sum(1,keepdims=True)
    col=np.exp(scores-scores.max(0,keepdims=True));col/=col.sum(0,keepdims=True)
    return [(int(i),int(j),float(np.sqrt(row[i,j]*col[i,j]))) for i,j in zip(*np.nonzero((row>.001)&(col>.001)))]

def reader_span(unit,start,end):
    positions=[0]
    for ch in unit['text']:positions.append(positions[-1]+(2 if ord(ch)>0xffff else 1))
    if not 0<=start<end<len(positions):raise ValueError('Invalid tokenizer offsets')
    return [unit['starts'][positions[start]],unit['ends'][positions[end]-1]]
