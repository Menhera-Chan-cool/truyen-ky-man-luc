import type {AlignmentArtifact,LookupPassage,LookupRequest,LookupResult,TextSpan} from './novel-lookup';
import type {Locale} from './types';
import {viMatchesPinyin,viSyllables} from './sino-names';
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
 // The opening parenthesis of a note number is missing in the Vietnamese notes of chapter 14 ("11) Uyên Minh …"): the note keeps its number.
 const numbered=blocks.filter(b=>b.start>=floor&&/^\(?\d{1,3}\)/u.test(e.text.slice(b.start,b.end)));
 const starts=numbered.length?numbered:blocks.filter(b=>b.start>=floor&&!originals.some(o=>o.start===b.start)&&!headings.some(h=>h.span.start===b.start));
 const notes=starts.map((b,i):Note=>{
  const end=starts[i+1]?.start??e.text.length,value=e.text.slice(b.start,end),marker=/^\(?(\d{1,3})\)\s*/u.exec(value),offset=marker?.[0].length??0;
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
 // A note that carries paragraphs without a number after its own (chapter 14, Vietnamese: "1) Thần Môn: …" and the entries that follow it) is held by a pair that stops inside it.
 const matches=a.notePairs?.filter(p=>(p[r.locale].start<=source.start&&p[r.locale].end>=source.end||p[r.locale].start>=source.start&&p[r.locale].end<=source.end)&&p.score>=minimum).sort((x,y)=>y.score-x.score)??[];
 const right=alignmentStructure(a,locale),baseTargets=right.notes.filter(n=>matches.some(m=>n.start>=m[locale].start&&n.end<=m[locale].end));
 // A note no pair holds whose number the other edition gives to one note, which no pair holds either, is that note (11 such pairs in the book, all right by reading: "(10) Câu: cái móc để vén rèm, màn." and "(10) Jade-hooked curtains: …").
 // Only where the confirmed pairs of the chapter show that the two editions number their notes alike (at least two, and 4 in 5 of them with the same numbers on both sides).
 if(!baseTargets.length&&/^\d{1,3}$/.test(source.id)){
  const confirmed=(a.notePairs??[]).filter(p=>p.score>=minimum),left=alignmentStructure(a,r.locale).notes;
  const ids=(notes:Note[],s:TextSpan)=>notes.filter(n=>n.start>=s.start&&n.end<=s.end).map(n=>n.id).sort().join(),alike=confirmed.filter(p=>ids(left,p[r.locale])===ids(right.notes,p[locale])&&ids(left,p[r.locale])!=='').length;
  const free=(n:TextSpan,l:Locale)=>!confirmed.some(p=>p[l].start<=n.start&&p[l].end>=n.end),same=right.notes.filter(n=>n.id===source.id&&free(n,locale));
  if(alike>=2&&alike*5>=confirmed.length*4&&same.length===1)baseTargets.push(same[0]);
 }
 const targets=[...baseTargets];for(const n of baseTargets){const ref=right.notes.find(m=>m.id===n.reference);if(ref&&!targets.includes(ref))targets.push(ref);}
 return {source,targets,baseTargets,target:baseTargets.length===1?baseTargets[0]:undefined,confidence:matches[0]};
}
function covers(r:LookupRequest,span:TextSpan){
 return r.start<=span.start&&r.end>=span.end&&/^[\s:：()*]*$/u.test(r.text.slice(0,span.start-r.start)+r.text.slice(span.end-r.start));
}
function originalKey(text:string){
 return text.replace(/^(?:(?:\(\*\)|\*)\s*)?(?:Nguyên văn|Original title)\s*[:：]/iu,'').split(/[（(—]/u)[0]!.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/gu,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
}
// The same title in Sino-Vietnamese on one side and in pinyin on the other ("Hạng vương từ ký", "Xiangwang Ci Ji"): the syllables read as exactly that pinyin.
const titleLead=/^(?:(?:\(\*\)|\*)\s*)?(?:Nguyên văn|Original title)\s*[:：]/iu;
const titleWords=(text:string)=>text.replace(titleLead,'').split(/[（(—]/u)[0]!;
const sameTitleInPinyin=(vi:string,en:string)=>viMatchesPinyin(viSyllables(titleWords(vi)),titleWords(en));
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
  const inside=r.start>=source.start&&r.end<=source.end;
  if(!whole&&!selectedValue&&!inside)continue;
  const own=a.editions[r.locale].text.slice(source.start,source.end);
  const target=right.originals.find(span=>{const other=a.editions[locale].text.slice(span.start,span.end);return originalKey(own)===originalKey(other)||(r.locale==='vi'?sameTitleInPinyin(own,other):sameTitleInPinyin(other,own));});
  // Part of the note that is not its whole title shows the paired note as it is, never a neighbouring note.
  if(target)return whole?answer(source,target):selectedValue?answer(value,titleValue(a.editions[locale].text,target)):answer(source,target,false);
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

// An allusion or annotated phrase with no counterpart of its own can still show the paired explanation as context:
// the selection ends right before a body marker (n), and that note has a confirmed note pair. Never a highlight.
export function annotatedNote(a:AlignmentArtifact,r:LookupRequest):LookupPassage|undefined{
 const left=alignmentStructure(a,r.locale),text=a.editions[r.locale].text;
 if(!left.notes.length||left.notes.some(n=>r.start>=n.start&&r.end<=n.end))return undefined;
 // The unnumbered title note ("* Nguyên văn: …") stands in the notes, right before the marker (1) of the first note, but it is not a phrase of the story.
 if(left.originals.some(o=>r.start<o.end&&r.end>o.start)||r.start>=(left.headings.find(h=>h.kind==='notes')?.span.start??Infinity))return undefined;
 const id=/^[\s"”’)\]…,.;:!?]{0,6}\((\d{1,3})\)/u.exec(text.slice(r.end,r.end+16))?.[1]??/\((\d{1,3})\)\s*$/u.exec(r.text)?.[1];
 const note=id?left.notes.find(n=>n.id===id):undefined;
 if(!note)return undefined;
 const target=notePair(a,{...r,start:note.start,end:note.end,text:text.slice(note.start,note.end)})?.target;
 if(!target)return undefined;
 const other=r.locale==='vi'?'en':'vi',t=a.editions[other];
 return {source:{start:note.start,end:note.end,text:text.slice(note.start,note.end)},target:{start:target.start,end:target.end,text:t.text.slice(target.start,target.end),breaks:t.breaks?.filter(b=>b>target.start&&b<target.end)},highlights:[]};
}
