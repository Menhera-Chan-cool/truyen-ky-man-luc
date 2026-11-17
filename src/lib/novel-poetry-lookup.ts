import type {AlignmentArtifact,LookupRequest,LookupResult,PoetryPair,PoetryCorrespondence,TextSpan} from './novel-lookup';
import type {Locale} from './types';
const intersects=(a:TextSpan,b:TextSpan)=>a.start<b.end&&b.start<a.end;
const bounds=(parts:TextSpan[]):TextSpan=>({start:Math.min(...parts.map(p=>p.start)),end:Math.max(...parts.map(p=>p.end))});
const mask=(s:string)=>s.replace(/\(\d{1,3}\)/g,m=>' '.repeat(m.length));
function complete(text:string,p:TextSpan,r:TextSpan){
 const words=[...mask(text.slice(p.start,p.end)).matchAll(/[\p{L}\p{M}\p{N}]/gu)];if(!words.length)return false;
 return r.start<=p.start+words[0].index&&r.end>=p.start+words.at(-1)!.index+words.at(-1)![0].length;
}
function preferred(a:AlignmentArtifact,r:LookupRequest){
 const to=r.locale==='vi'?'en':'vi',groups=new Map<string,PoetryPair[]>();
 for(const p of a.poems??[]){
  const source=p[r.locale],titleHit=source.title&&intersects(source.title,r);
  if(!intersects(source,r)&&!titleHit)continue;
  const values=groups.get(p[r.locale].id)??[];values.push(p);groups.set(p[r.locale].id,values);
 }
 return [...groups.values()].map(values=>values.sort((a,b)=>Number(b.primary[r.locale])-Number(a.primary[r.locale])||b.score-a.score||a[to].start-b[to].start)[0]).sort((a,b)=>a[r.locale].start-b[r.locale].start);
}
function mappings(pair:PoetryPair,locale:Locale,r:TextSpan){
 const other=locale==='vi'?'en':'vi';const result:PoetryCorrespondence[]=[];
 for(const line of pair[locale].lines.filter(s=>intersects(s,r))){
  const c=pair.correspondences.filter(c=>c[locale].some(s=>intersects(s,line)))
   .sort((a,b)=>a[locale].length-b[locale].length||a[other].length-b[other].length||b.score-a.score)[0];
  if(c&&!result.includes(c))result.push(c);
 }
 return result;
}
export function poetryScope(a:AlignmentArtifact,r:LookupRequest){
 const pair=preferred(a,r).find(p=>p[r.locale].start<=r.start&&p[r.locale].end>=r.end);if(!pair)return undefined;
 const to=r.locale==='vi'?'en':'vi',maps=mappings(pair,r.locale,r);
 const lines=pair[r.locale].lines.filter(s=>intersects(s,r));
 const covered=lines.length>0&&lines.every(s=>maps.some(c=>c[r.locale].some(p=>p.start<=s.start&&p.end>=s.end)));
 const trustedWordScope=!pair.contextOnly&&covered&&maps.every(c=>c[r.locale].length===1||c[to].length===1);
 return {pair,trustedWordScope,source:covered?bounds(maps.flatMap(c=>c[r.locale])):pair[r.locale],target:covered?bounds(maps.flatMap(c=>c[to])):pair[to]};
}
function passage(a:AlignmentArtifact,locale:Locale,source:TextSpan,target:TextSpan,highlight:boolean){
 const other=locale==='vi'?'en':'vi',edition=a.editions[other];
 return {source:{start:source.start,end:source.end,text:a.editions[locale].text.slice(source.start,source.end)},target:{start:target.start,end:target.end,text:edition.text.slice(target.start,target.end),breaks:edition.breaks?.filter(b=>b>target.start&&b<target.end)},highlights:highlight?[{start:target.start,end:target.end}]:[]};
}
export function poetryContext(a:AlignmentArtifact,r:LookupRequest,scope:NonNullable<ReturnType<typeof poetryScope>>):LookupResult{
 const to=r.locale==='vi'?'en':'vi';return {status:'context-only',targetLocale:to,targetRevision:a.editions[to].revision,passages:[passage(a,r.locale,scope.source,scope.target,false)]};
}
export function poetryLookup(a:AlignmentArtifact,r:LookupRequest):LookupResult|undefined{
 const pairs=preferred(a,r);if(!pairs.length)return undefined;
 const to=r.locale==='vi'?'en':'vi',text=a.editions[r.locale].text,passages:LookupResult['passages']=[];let context=false;
 for(const pair of pairs){
  const from=pair[r.locale],target=pair[to];
  if(pair.contextOnly){passages.push(passage(a,r.locale,from,target,false));context=true;continue;}
  if(from.title&&r.start>=from.title.start&&r.end<=from.title.end){passages.push(passage(a,r.locale,from.title,target.title??target,!!target.title));context ||= !target.title;continue;}
  const lines=from.lines.filter(s=>intersects(s,r));if(!lines.length)continue;
  if(!lines.every(s=>complete(text,s,r)))return undefined;
  if(complete(text,from,r)){passages.push(passage(a,r.locale,from,target,!from.flattened&&!target.flattened));context ||= !!from.flattened||!!target.flattened;continue;}
  const maps=mappings(pair,r.locale,r);
  if(!maps.length||lines.some(line=>!maps.some(c=>c[r.locale].some(s=>s.start<=line.start&&s.end>=line.end)))){
   passages.push(passage(a,r.locale,from,target,false));context=true;continue;
  }
  for(const c of maps){
   const precise=c[r.locale].every(s=>complete(text,s,r));context ||= !precise;
   passages.push(passage(a,r.locale,bounds(c[r.locale]),bounds(c[to]),precise));
  }
 }
 if(!passages.length)return undefined;
 const unique=passages.filter((p,i,all)=>!all.slice(0,i).some(q=>q.source.start===p.source.start&&q.source.end===p.source.end&&q.target.start===p.target.start&&q.target.end===p.target.end));
 if(context)for(const p of unique)p.highlights=[];
 return {status:context?'context-only':'uncertain',targetLocale:to,targetRevision:a.editions[to].revision,sourceBreaks:a.editions[r.locale].breaks?.filter(b=>b>r.start&&b<r.end),passages:unique};
}
// Pairs written by reading inside a verse pair answer a selection that is only part of a line when every word of it (function words apart) lies in a pair:
// the highlights are the English or Vietnamese halves of the pairs it touches, the passage the lines that hold them. A selection of whole lines keeps the line answer, except in a context-only pair, which has none.
export function poetryLabelled(a:AlignmentArtifact,r:LookupRequest,skip:(word:string)=>boolean):LookupResult|undefined{
 const to=r.locale==='vi'?'en':'vi',text=a.editions[r.locale].text,edition=a.editions[to];
 const pair=preferred(a,r).find(p=>p.labelled?.length&&p[r.locale].start<=r.start&&p[r.locale].end>=r.end);if(!pair)return undefined;
 const lines=pair[r.locale].lines.filter(s=>intersects(s,r));
 // whole lines keep the line answer, unless the pair has no line correspondences (context only): then the pairs written by reading answer them too
 if(!lines.length||(!pair.contextOnly&&lines.every(s=>complete(text,s,r))))return undefined;
 const touched=pair.labelled!.filter(p=>intersects(p[r.locale],r));if(!touched.length)return undefined;
 const words=[...mask(text.slice(r.start,r.end)).matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(m=>({start:r.start+m.index,end:r.start+m.index+m[0].length,text:m[0]})).filter(w=>/\p{L}/u.test(w.text)&&!skip(w.text));
 if(!words.length||words.some(w=>!touched.some(p=>p[r.locale].start<=w.start&&p[r.locale].end>=w.end)))return undefined;
 const targets=touched.map(p=>({...p[to]})).sort((x,y)=>x.start-y.start);
 const targetLines=pair[to].lines.filter(s=>targets.some(t=>intersects(s,t)));if(!targetLines.length)return undefined;
 const source=bounds(lines),target=bounds(targetLines);if(target.end-target.start>1200)return undefined;
 return {status:'uncertain',targetLocale:to,targetRevision:edition.revision,sourceBreaks:a.editions[r.locale].breaks?.filter(b=>b>r.start&&b<r.end),
  passages:[{source:{start:source.start,end:source.end,text:text.slice(source.start,source.end)},target:{start:target.start,end:target.end,text:edition.text.slice(target.start,target.end),breaks:edition.breaks?.filter(b=>b>target.start&&b<target.end)},highlights:targets}]};
}
