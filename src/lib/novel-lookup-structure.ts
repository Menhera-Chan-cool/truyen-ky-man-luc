import type {AlignmentArtifact,LookupRequest,LookupResult,TextSpan} from './novel-lookup';
import type {Locale} from './types';
type Note=TextSpan&{id:string;label?:TextSpan;reference?:string};
type Structure={headings:{kind:'critique'|'notes';span:TextSpan}[];original?:TextSpan;originals:TextSpan[];notes:Note[]};
const cache=new WeakMap<AlignmentArtifact,Record<Locale,Structure>>();
function trim(text:string,start:number,end:number):TextSpan{
 const value=text.slice(start,end),left=value.length-value.trimStart().length,right=value.length-value.trimEnd().length;
 return {start:start+left,end:end-right};
}
export function alignmentStructure(a:AlignmentArtifact,locale:Locale):Structure{
 const saved=cache.get(a);if(saved?.[locale])return saved[locale];
 const e=a.editions[locale],cuts=[...new Set([0,...(e.breaks??[]),e.text.length])].sort((x,y)=>x-y);
 const blocks=cuts.slice(0,-1).map((start,i)=>trim(e.text,start,cuts[i+1])).filter(s=>s.end>s.start);
 const headings:Structure['headings']=[],originals:TextSpan[]=[];let original:TextSpan|undefined;
 for(const b of blocks){
  const value=e.text.slice(b.start,b.end),kind=/^(?:lời\s+(?:bình|bàn)|critique)\s*[:：]?$/iu.test(value)?'critique':/^(?:chú\s+(?:thích|giải)|ghi chú|notes|footnotes|endnotes|annotations)\s*[:：]?$/iu.test(value)?'notes':undefined;
  if(kind)headings.push({kind,span:{start:b.start,end:b.start+value.replace(/\s*[:：]\s*$/u,'').length}});
  if(/^(?:(?:\(\*\)|\*)\s*)?(?:Nguyên văn|Original title)\s*[:：]/iu.test(value)){original=b;originals.push(b);}
 }
 const explicitFloor=Math.min(...headings.filter(h=>h.kind==='notes').map(h=>h.span.start),...a.groups.filter(g=>g.section==='notes').map(g=>g[locale].start));
 const floor=Number.isFinite(explicitFloor)?explicitFloor:Math.min(original?.start??Infinity,...blocks.filter(b=>/^\(\d{1,3}\)/u.test(e.text.slice(b.start,b.end))).map(b=>b.start));
 const numbered=blocks.filter(b=>b.start>=floor&&/^\(\d{1,3}\)/u.test(e.text.slice(b.start,b.end)));
 const starts=numbered.length?numbered:blocks.filter(b=>b.start>=floor&&!originals.some(o=>o.start===b.start)&&!headings.some(h=>h.span.start===b.start));
 const notes=starts.map((b,i):Note=>{
  const end=starts[i+1]?.start??e.text.length,value=e.text.slice(b.start,end),marker=/^\((\d{1,3})\)\s*/u.exec(value),offset=marker?.[0].length??0;
  const body=value.slice(offset),labelMatch=/^([^:：.!?\n]{1,80})[:：]/u.exec(body)??(locale==='vi'?/^([\p{Lu}][\p{L}\p{M}]*(?:\s+[\p{Lu}][\p{L}\p{M}]*){1,4})\s+(?:là|tức|người)(?=\s|$)/u.exec(body):null);
  let label:TextSpan|undefined;
  if(labelMatch){const name=labelMatch[1].replace(/\s*\([\d?\s–—-]+\)\s*$/u,'').trim();label={start:b.start+offset,end:b.start+offset+name.length};}
  const reference=/^(?:Xem\s+chú\s+thích|See\s+(?:note|footnote))\s*\((\d{1,3})\)/iu.exec(labelMatch?body.slice(labelMatch[0].length).trimStart():body)?.[1];
  return {id:marker?.[1]??'@'+b.start,start:b.start,end,label,reference};
 });
 const result={headings,original,originals,notes};cache.set(a,{...saved,[locale]:result} as Record<Locale,Structure>);return result;
}
export function notePair(a:AlignmentArtifact,r:LookupRequest){
 if(a.notePairs===undefined)return undefined;
 const locale=r.locale==='vi'?'en':'vi',source=alignmentStructure(a,r.locale).notes.find(n=>r.start>=n.start&&r.end<=n.end);
 if(!source)return undefined;
 const minimum=['labse-context-mbert-1','labse-book-mbert-2','labse-poetry-mbert-3'].includes(a.algorithm)?.5:.74;
 const matches=a.notePairs?.filter(p=>p[r.locale].start<=source.start&&p[r.locale].end>=source.end&&p.score>=minimum).sort((x,y)=>y.score-x.score)??[];
 const right=alignmentStructure(a,locale),baseTargets=right.notes.filter(n=>matches.some(m=>n.start>=m[locale].start&&n.end<=m[locale].end));
 const targets=[...baseTargets];for(const n of baseTargets){const ref=right.notes.find(m=>m.id===n.reference);if(ref&&!targets.includes(ref))targets.push(ref);}
 return {source,targets,baseTargets,target:baseTargets.length===1?baseTargets[0]:undefined,confidence:matches[0]};
}
function covers(r:LookupRequest,span:TextSpan){
 return r.start<=span.start&&r.end>=span.end&&/^[\s:：()*]*$/u.test(r.text.slice(0,span.start-r.start)+r.text.slice(span.end-r.start));
}
function originalKey(text:string){
 return text.replace(/^(?:(?:\(\*\)|\*)\s*)?(?:Nguyên văn|Original title)\s*[:：]/iu,'').split(/[（(—]/u)[0]!.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/gu,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function titleValue(text:string,span:TextSpan):TextSpan{
 const value=text.slice(span.start,span.end),prefix=/^(?:(?:\(\*\)|\*)\s*)?(?:Nguyên văn|Original title)\s*[:：]\s*/iu.exec(value)?.[0].length??0;
 const rest=value.slice(prefix).split(/[（(—]/u)[0]!,trimmed=rest.replace(/[\s.;:：]+$/u,'');
 return {start:span.start+prefix,end:span.start+prefix+trimmed.length};
}
export function structureLookup(a:AlignmentArtifact,r:LookupRequest):LookupResult|undefined{
 const locale=r.locale==='vi'?'en':'vi',left=alignmentStructure(a,r.locale),right=alignmentStructure(a,locale);
 const answer=(source:TextSpan,target:TextSpan,highlight=true):LookupResult=>({status:highlight?'match':'context-only',targetLocale:locale,targetRevision:a.editions[locale].revision,sourceBreaks:a.editions[r.locale].breaks?.filter(b=>b>r.start&&b<r.end),passages:[{source:{...source,text:a.editions[r.locale].text.slice(source.start,source.end)},target:{...target,text:a.editions[locale].text.slice(target.start,target.end),breaks:a.editions[locale].breaks?.filter(b=>b>target.start&&b<target.end)},highlights:highlight?[{...target}]:[]}]});
 for(const h of left.headings)if(covers(r,h.span)){const target=right.headings.find(x=>x.kind===h.kind);if(target)return answer(h.span,target.span);}
 for(const source of left.originals){
  const value=titleValue(a.editions[r.locale].text,source),whole=covers(r,source);
  const selectedValue=r.start<=value.start&&r.end>=value.end&&/^[\s.;:：()*]*$/u.test(r.text.slice(0,value.start-r.start)+r.text.slice(value.end-r.start));
  if(!whole&&!selectedValue)continue;
  const target=right.originals.find(span=>originalKey(a.editions[r.locale].text.slice(source.start,source.end))===originalKey(a.editions[locale].text.slice(span.start,span.end)));
  if(target)return whole?answer(source,target):answer(value,titleValue(a.editions[locale].text,target));
  return {status:'unavailable',targetLocale:locale,passages:[]};
 }
 const pair=notePair(a,r);
 if(pair?.source.label&&pair.target&&covers(r,pair.source.label)){
  const multi=(span:TextSpan,l:Locale)=>/\band\b|\s[/&]\s|\bvà\b/iu.test(a.editions[l].text.slice(span.start,span.end));
  if(pair.target.label&&pair.confidence&&pair.confidence.score>=.82&&pair.confidence.margin>=.015&&!multi(pair.source.label,r.locale)&&!multi(pair.target.label,locale)){
   const result=answer(pair.source.label,pair.target.label);result.status='uncertain';return result;
  }
  if((pair.target.reference||!pair.target.label)&&!(a.refinedGroups??a.groups).some(g=>g.kind==='lexical'&&g[r.locale].start<=r.start&&g[r.locale].end>=r.end))return answer(pair.source,pair.target,false);
 }
}
