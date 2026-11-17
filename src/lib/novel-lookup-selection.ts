import type {AlignmentArtifact,LookupPassage,LookupRequest,LookupResult,PoetryTrack,TextSpan} from './novel-lookup';
import {alignmentStructure} from './novel-lookup-structure';
import type {Locale} from './types';

const intersects=(a:TextSpan,b:TextSpan)=>a.start<b.end&&b.start<a.end;
const contains=(a:TextSpan,b:TextSpan)=>a.start<=b.start&&a.end>=b.end;
const meaningful=(text:string)=>/[\p{L}\p{N}]/u.test(text.replace(/\(\d{1,3}\)/gu,''));
const groups=(a:AlignmentArtifact)=>a.refinementVersion===1?a.refinedGroups??a.groups:a.groups;
// Keeping the highlight of the part of a selection that was found, when only a few of its words have no counterpart. `min` is the share of the content words that must have one (0 = never kept: the rule before 2026-11-17),
// `words` the least number of content words, `strength` the weakest link that may carry the highlight. Measured on 24,303 selections taken from the pairs written by reading: with min .5 and words 2 the lookup
// answers 5.2 points more of them, and 80% of those new answers sit inside or on the gold (the gold is stricter than a reader); on the whole-book prose pool 943 selections gain an answer and none loses one.
// ON since 2026-11-17 on the owner's instruction, before human sheet 21 (23 cards) was answered. scripts/align-novel/replay-without-labels.ts sets it from PARTIAL_MIN to measure other values.
// maxWords: a whole sentence is not kept in part. Over the 332 sentence cases of the gold sets the rule added 8 answers for 3 hits, 1 hit lost to a partial answer, 2 wrong and 3 over-wide or short ones (precision of the answered 98.7% to 96.8%); only one of the 8 had fewer than 18 words.
export const partialRule={min:.5,words:2,maxWords:8,strength:0};
const stop:Record<Locale,Set<string>>={
 en:new Set('a an the of to for from by with in on at as and or but is was were be been being am are it its his her their our your my i we you he she they them him us me this that these those than then so not no do does did has have had will would can could may might shall should must there here who whom whose which what when where while if how why all also only just very too more most some such any each both other up down out over off upon about after before through between under until once again'.split(' ')),
 vi:new Set('của và hoặc nhưng các những thì mà là ở với bởi vì cho từ tại đã đang sẽ có không được một này đó ấy cũng rất lại đều chỉ nên bèn thế vậy nào gì như hay rồi đến khi trong để rằng cả vẫn cứ hãy chớ đừng chưa chẳng thôi vừa liền ra vào lên xuống về qua sang theo cùng nhau bằng do nếu dù tuy dẫu hơn nhất mỗi'.split(' ')),
};
// A selection some of whose words have no counterpart keeps the highlight of the part found when the words it lacks are few (never a negation) and the selection holds enough content words.
export function partialKept(text:string,r:TextSpan,unmatched:TextSpan[],passages:LookupPassage[],locale:Locale,strength:number):boolean{
 if(!partialRule.min||!unmatched.length||strength<partialRule.strength||!passages.some(p=>p.highlights.length))return false;
 const words=[...text.slice(r.start,r.end).matchAll(/[\p{L}\p{M}]+/gu)].map(m=>({start:r.start+m.index,end:r.start+m.index+m[0].length,text:m[0].toLocaleLowerCase(locale)})).filter(w=>!stop[locale].has(w.text));
 const lacking=words.filter(w=>unmatched.some(u=>u.start<w.end&&u.end>w.start));
 // A negation is a stop word, so it is looked for among all the words of the selection: a highlight that leaves "không" or "not" out would say the opposite.
 const negated=[...text.slice(r.start,r.end).matchAll(/[\p{L}\p{M}]+/gu)].some(m=>/^(?:not|never|no|nor|neither|cannot|without|none|nothing|nobody|không|chưa|chẳng|chả|đừng)$/iu.test(m[0])&&unmatched.some(u=>u.start<r.start+m.index+m[0].length&&u.end>r.start+m.index));
 return words.length>=partialRule.words&&words.length<=partialRule.maxWords&&lacking.length>0&&!negated&&(words.length-lacking.length)/words.length>=partialRule.min;
}
function missing(text:string,r:TextSpan,covered:TextSpan[]){
 let remaining:TextSpan[]=[{start:r.start,end:r.end}];
 for(const p of covered)remaining=remaining.flatMap(s=>!intersects(s,p)?[s]:[
  ...(s.start<p.start?[{start:s.start,end:p.start}]:[]),...(s.end>p.end?[{start:p.end,end:s.end}]:[]),
 ]);
 return remaining.filter(s=>meaningful(text.slice(s.start,s.end)));
}
function coverage(a:AlignmentArtifact,r:LookupRequest,result:LookupResult):LookupResult{
 const covered=result.passages.flatMap(p=>{
  const matched=groups(a).filter(g=>g[r.locale].start===p.source.start&&g[r.locale].end===p.source.end);
  return matched.length?matched.flatMap(g=>g.parts?.[r.locale]??[g[r.locale]]):[p.source];
 });
 const unmatchedSource=[...(result.unmatchedSource??[]),...missing(a.editions[r.locale].text,r,covered)]
  .map(s=>({start:Math.max(r.start,s.start),end:Math.min(r.end,s.end)})).filter((s,i,all)=>s.end>s.start&&!all.slice(0,i).some(p=>p.start===s.start&&p.end===s.end));
 if(!unmatchedSource.length)return result;
 if(result.partial&&!missing(a.editions[r.locale].text,r,covered).length&&result.passages.some(p=>p.highlights.length))return {...result,status:'uncertain',unmatchedSource};
 return {...result,status:result.passages.length?'context-only':result.status,unmatchedSource,passages:result.passages.map(p=>({...p,highlights:[]}))};
}
function block(a:AlignmentArtifact,l:Locale,s:TextSpan){
 const e=a.editions[l];if(!e.breaks?.length)return undefined;
 const start=Math.max(0,...e.breaks.filter(b=>b<=s.start)),end=e.breaks.find(b=>b>s.start)??e.text.length;
 return s.end<=end?{start,end}:undefined;
}
// A parent is only a context hint: two ordered prose anchors must agree on a unique target block.
function parentContext(a:AlignmentArtifact,r:LookupRequest){
 if(!block(a,r.locale,r))return undefined;
 const to=r.locale==='vi'?'en':'vi',votes=new Map<number,{scope:TextSpan;anchors:AlignmentArtifact['groups']}>();
 for(const g of groups(a)){
  if(g.tracks||g.kind==='lexical'||g.section==='notes'||g.score<.5||!contains(r,g[r.locale]))continue;
  const scope=block(a,to,g[to]);if(!scope)continue;
  const vote=votes.get(scope.start)??{scope,anchors:[]};vote.anchors.push(g);votes.set(scope.start,vote);
 }
 const ranked=[...votes.values()].sort((a,b)=>b.anchors.length-a.anchors.length),best=ranked[0];
 if(!best||best.anchors.length<2||best.anchors.length<=(ranked[1]?.anchors.length??0))return undefined;
 const anchors=best.anchors.sort((a,b)=>a[r.locale].start-b[r.locale].start);
 if(anchors.some((g,i)=>i>0&&g[to].start<anchors[i-1][to].start))return undefined;
 return {...best,selected:{start:Math.min(...anchors.map(g=>g[to].start)),end:Math.max(...anchors.map(g=>g[to].end))}};
}
function tokens(text:string,scope:TextSpan){
 const masked=text.slice(scope.start,scope.end).replace(/\(\d{1,3}\)/gu,m=>' '.repeat(m.length));
 return [...masked.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(m=>({value:m[0].normalize('NFC').toLowerCase(),start:scope.start+m.index,end:scope.start+m.index+m[0].length}));
}
function quotedTrack(text:string,track:PoetryTrack,scope:TextSpan){
 const haystack=tokens(text,scope),lines:TextSpan[]=[];
 for(const line of track.lines){
  const words=tokens(text,line),found:TextSpan[]=[];
  if(!words.length)return undefined;
  for(let i=0;i+words.length<=haystack.length;i++)if(words.every((w,j)=>w.value===haystack[i+j].value))found.push({start:haystack[i].start,end:haystack[i+words.length-1].end});
  if(found.length!==1)return undefined;
  const previous=lines.at(-1);if(previous&&(found[0].start<previous.end||meaningful(text.slice(previous.end,found[0].start))))return undefined;
  lines.push(found[0]);
 }
 return {...track,id:track.id+'@'+lines[0].start,start:lines[0].start,end:lines.at(-1)!.end,lines,title:undefined};
}
function inParent(a:AlignmentArtifact,r:LookupRequest,scope:TextSpan){
 const to=r.locale==='vi'?'en':'vi';
 return {...a,poems:a.poems?.map(p=>{
  if(!intersects(p[r.locale],r)||contains(scope,p[to]))return p;
  const target=quotedTrack(a.editions[to].text,p[to],scope);if(!target)return p;
  const old=p[to].lines;
  return {...p,[to]:target,correspondences:p.correspondences.map(c=>({...c,[to]:c[to].map(s=>target.lines[old.findIndex(line=>line.start===s.start&&line.end===s.end)])}))};
 })};
}
function parts(a:AlignmentArtifact,r:LookupRequest){
 const structure=alignmentStructure(a,r.locale),poems=(a.poems??[]).map(p=>p[r.locale]);
 const scopes=[...structure.headings.map(h=>h.span),...structure.originals,...structure.notes,...poems,...poems.flatMap(p=>p.title?[p.title]:[]),
  ...(a.poetryScopes?.[r.locale]??[]).filter(s=>!poems.some(p=>contains(p,s)))];
 const cuts=[...new Set([r.start,r.end,...scopes.flatMap(s=>[s.start,s.end]).filter(n=>n>r.start&&n<r.end)])].sort((a,b)=>a-b);
 return cuts.slice(0,-1).map((start,i)=>({start,end:cuts[i+1]})).filter(s=>meaningful(a.editions[r.locale].text.slice(s.start,s.end)));
}
export function selectionLookup(a:AlignmentArtifact,r:LookupRequest,lookup:(a:AlignmentArtifact,r:LookupRequest)=>LookupResult):LookupResult{
 if(a.poems?.some(p=>contains(p[r.locale],r)||(p[r.locale].title&&contains(p[r.locale].title!,r))))return coverage(a,r,lookup(a,r));
 const pieces=parts(a,r);
 if(pieces.length<=1)return coverage(a,r,lookup(a,r));
 if(pieces.length>32)throw RangeError('Select a shorter passage');
 const to=r.locale==='vi'?'en':'vi',parent=parentContext(a,r),scoped=parent?inParent(a,r,parent.scope):a;
 const passages:LookupPassage[]=[],unmatchedSource:TextSpan[]=[];let context=false,uncertain=false;
 for(const s of pieces){
  const sub={...r,...s,text:a.editions[r.locale].text.slice(s.start,s.end)};
  let result=lookup(scoped,sub);
  if(parent)result={...result,passages:result.passages.filter(p=>contains(parent.scope,p.target))};
  result=coverage(scoped,sub,result);
  unmatchedSource.push(...(result.unmatchedSource??[]));
  context ||= result.status!=='match'&&result.status!=='uncertain';uncertain ||= result.status==='uncertain';
  for(const p of result.passages)if(!passages.some(q=>q.source.start===p.source.start&&q.source.end===p.source.end&&q.target.start===p.target.start&&q.target.end===p.target.end))passages.push(p);
 }
 if(passages.length>32)throw RangeError('Select a shorter passage');
 // Preserve the complete local dialogue as context when some connecting clauses have no reliable links.
 if(parent&&unmatchedSource.length&&passages.length){
  const start=Math.min(parent.selected.start,...passages.map(p=>p.target.start)),end=Math.max(parent.selected.end,...passages.map(p=>p.target.end));
  passages.splice(0,passages.length,{source:{start:r.start,end:r.end,text:r.text},target:{start,end,text:a.editions[to].text.slice(start,end),breaks:a.editions[to].breaks?.filter(b=>b>start&&b<end)},highlights:[]});
 }
 if(unmatchedSource.length)for(const p of passages)p.highlights=[];
 return {status:!passages.length?'unavailable':context||unmatchedSource.length?'context-only':uncertain?'uncertain':'match',targetLocale:to,targetRevision:a.editions[to].revision,
  sourceBreaks:a.editions[r.locale].breaks?.filter(b=>b>r.start&&b<r.end),passages,...(unmatchedSource.length?{unmatchedSource}:{})};
}
