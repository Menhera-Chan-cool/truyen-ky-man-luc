import type {Locale} from "./types";
import {notePair,structureLookup} from './novel-lookup-structure';
import {poetryLookup,poetryScope,poetryContext} from './novel-poetry-lookup';
export const alignmentCodec = "reader-dom-1";
export type TextSpan = {start:number;end:number};
export type PoetryCorrespondence=Record<Locale,TextSpan[]>&{score:number;evidence:'direct-window'|'surrounding-window'};
export type PoetryTrack=TextSpan&{id:string;lines:TextSpan[];title?:TextSpan;flattened?:boolean};
export type PoetryPair=Record<Locale,PoetryTrack>&{score:number;margin:number;primary:Record<Locale,boolean>;correspondences:PoetryCorrespondence[];contextOnly?:boolean};
export type AlignmentArtifact = {
  schema:1;codec:string;algorithm:string;chapterId:string;createdAt:string;
  editions:Record<Locale,{revision:number;versionId:string;hash:string;text:string;words?:TextSpan[];breaks?:number[]}>;
  groups:{id:string;section:string;vi:TextSpan;en:TextSpan;score:number;margin:number;primary?:Record<Locale,boolean>;
    parts?:Record<Locale,TextSpan[]>;
    tracks?:Record<Locale,TextSpan&{id:string}>;
    poetryLines? : Record<Locale,TextSpan[]>&{score:number;poemScore:number;evidence:'direct-window'|'surrounding-window';correspondences:PoetryCorrespondence[]};
    kind?:'lexical';
    links:{vi:[number,number];en:[number,number];score:number}[]}[];
  notePairs?:{vi:TextSpan;en:TextSpan;score:number;margin:number}[];
  poems?:PoetryPair[];
  poetryScopes?:Record<Locale,TextSpan[]>;
  refinementVersion?:1;
  refinedGroups?:AlignmentArtifact['groups'];
};
export type LookupRequest = {chapterId:string;locale:Locale;revision:number;start:number;end:number;text:string};
export type LookupPassage = {source:TextSpan&{text:string};target:TextSpan&{text:string;breaks?:number[]};highlights:TextSpan[]};
export type ComparisonFocus = Record<Locale,TextSpan&{text:string;revision:number}>;
export type LookupResult = {status:"match"|"uncertain"|"context-only"|"unavailable"|"stale"|"pending"|"missing";
  targetLocale:Locale;targetRevision?:number;sourceBreaks?:number[];passages:LookupPassage[]};

export function validateLookupRequest(value:unknown):LookupRequest {
  const r=value as LookupRequest;
  if(!r||typeof r.chapterId!=="string"||!/^[a-z0-9-]{1,80}$/.test(r.chapterId)||!["vi","en"].includes(r.locale)||!Number.isSafeInteger(r.revision)||r.revision<1||!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.end)||r.start<0||r.end<=r.start||typeof r.text!=="string"||!r.text.trim()||r.text.length>2000||r.end-r.start!==r.text.length)throw Error("Invalid lookup selection");
  return {chapterId:r.chapterId,locale:r.locale,revision:r.revision,start:r.start,end:r.end,text:r.text};
}

export function validateAlignmentArtifact(value:unknown):AlignmentArtifact {
  const a=value as AlignmentArtifact;
  const invalid=()=>{throw Error("Invalid alignment artifact");};
  if(!a||a.schema!==1||a.codec!==alignmentCodec||!/^[a-z0-9-]{1,80}$/.test(a.chapterId)||typeof a.algorithm!=="string"||!a.editions||!Array.isArray(a.groups)||a.groups.length>10000)invalid();
  for(const locale of ["vi","en"] as const){
    const e=a.editions[locale];
    if(!e||!Number.isSafeInteger(e.revision)||e.revision<1||!/^[-0-9a-f]{36}$/i.test(e.versionId)||! /^[0-9a-f]{64}$/.test(e.hash)||typeof e.text!=="string"||e.text.length>2000000)invalid();
  }
  const valid=(s:TextSpan,text:string)=>s&&Number.isSafeInteger(s.start)&&Number.isSafeInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=text.length;
  for(const l of ['vi','en'] as const){
    const e=a.editions[l];if(e.words&&(!Array.isArray(e.words)||e.words.length>200000||e.words.some(s=>!valid(s,e.text))))invalid();
    if(e.breaks&&(!Array.isArray(e.breaks)||e.breaks.length>200000||e.breaks.some(p=>!Number.isSafeInteger(p)||p<0||p>e.text.length)))invalid();
  }
  if(a.refinedGroups&&(!Array.isArray(a.refinedGroups)||a.refinedGroups.length>10000||a.refinementVersion!==1))invalid();
  for(const g of [...a.groups,...(a.refinedGroups??[])]){
    if(!g||!valid(g.vi,a.editions.vi.text)||!valid(g.en,a.editions.en.text)||!Number.isFinite(g.score)||!Number.isFinite(g.margin)||!Array.isArray(g.links)||g.links.length>100000)invalid();
    if(g.parts)for(const l of ['vi','en']as const){const parts=g.parts[l];if(!Array.isArray(parts)||!parts.length||parts.length>1000||parts.some((p,i)=>!valid(p,a.editions[l].text)||p.start<g[l].start||p.end>g[l].end||(i>0&&p.start<parts[i-1].end)))invalid();}
    if(g.tracks)for(const l of ['vi','en']as const){const t=g.tracks[l];if(!valid(t,a.editions[l].text)||typeof t.id!=='string'||!t.id.length||t.id.length>100||t.start>g[l].start||t.end<g[l].end)invalid();}
    for(const link of g.links){
      if(!link||!Number.isFinite(link.score)||link.score<0||link.score>1.001)invalid();
      for(const l of ["vi","en"] as const){
        const span=link[l];
        if(!Array.isArray(span)||span.length!==2||!valid({start:span[0],end:span[1]},a.editions[l].text)||span[0]<g[l].start||span[1]>g[l].end)invalid();
      }
    }
  }
  if(a.notePairs&&(!Array.isArray(a.notePairs)||a.notePairs.length>10000||a.notePairs.some(p=>!valid(p.vi,a.editions.vi.text)||!valid(p.en,a.editions.en.text)||!Number.isFinite(p.score)||!Number.isFinite(p.margin))))invalid();
  if(a.poetryScopes)for(const l of ['vi','en']as const)if(!Array.isArray(a.poetryScopes[l])||a.poetryScopes[l].length>2048||a.poetryScopes[l].some(p=>!valid(p,a.editions[l].text)))invalid();
  if(a.poems){
    if(!Array.isArray(a.poems)||a.poems.length>512)invalid();
    for(const p of a.poems){
      if(!Number.isFinite(p.score)||p.score<.5||p.score>1.001||!Number.isFinite(p.margin)||!p.primary||!Array.isArray(p.correspondences)||p.correspondences.length>2048||(p.contextOnly!==undefined&&typeof p.contextOnly!=='boolean'))invalid();
      for(const l of ['vi','en']as const){const t=p[l];if(!valid(t,a.editions[l].text)||typeof t.id!=='string'||!t.id.length||t.id.length>100||typeof p.primary[l]!=='boolean'||!Array.isArray(t.lines)||!t.lines.length||t.lines.length>1024||t.lines.some((s,i)=>!valid(s,a.editions[l].text)||s.start<t.start||s.end>t.end||(i>0&&s.start<t.lines[i-1].end))||(t.title&&(!valid(t.title,a.editions[l].text)||t.title.end>t.start)))invalid();}
      for(const c of p.correspondences){
        if(!Number.isFinite(c.score)||c.score<0||c.score>1.001||!['direct-window','surrounding-window'].includes(c.evidence))invalid();
        for(const l of ['vi','en']as const)if(!Array.isArray(c[l])||!c[l].length||c[l].length>32||c[l].some(s=>!p[l].lines.some(line=>line.start===s.start&&line.end===s.end)))invalid();
      }
    }
  }
  return a;
}
function wordSpan(text:string,start:number,end:number,bounds:TextSpan,words?:TextSpan[]):TextSpan {
  const segmented=words?.find(w=>w.start<=start&&w.end>=end&&w.start>=bounds.start&&w.end<=bounds.end);
  if(segmented)return {...segmented};
  const left=text.slice(bounds.start,start).match(/[\p{L}\p{M}\p{N}’'-]+$/u)?.[0].length??0;
  const right=text.slice(end,bounds.end).match(/^[\p{L}\p{M}\p{N}’'-]+/u)?.[0].length??0;
  return {start:start-left,end:end+right};
}
function mergeSpans(spans:TextSpan[],text:string){
  const merged:TextSpan[]=[];
  for(const span of spans.sort((a,b)=>a.start-b.start||a.end-b.end)){
    const last=merged.at(-1);
    if(last&&(span.start<=last.end||/^\s{0,3}$/.test(text.slice(last.end,span.start))))last.end=Math.max(last.end,span.end);
    else merged.push({...span});
  }
  return merged;
}
function properNameSpan(quote:string,text:string,bounds:TextSpan):TextSpan|null {
  const words=[...quote.matchAll(/[\p{L}\p{M}]+/gu)].map(m=>m[0]);
  if(words.length<2||!words.every(w=>/^\p{Lu}/u.test(w)))return null;
  const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
  const target=[...text.slice(bounds.start,bounds.end).matchAll(/[\p{L}\p{M}]+/gu)];
  const found:TextSpan[]=[];
  for(let i=0;i+words.length<=target.length;i++){
    if(words.every((w,j)=>fold(w)===fold(target[i+j][0])&&/^\p{Lu}/u.test(target[i+j][0])))
      found.push({start:bounds.start+target[i].index,end:bounds.start+target[i+words.length-1].index+target[i+words.length-1][0].length});
  }
  return found.length===1?found[0]:null;
}
// Match the worker's analysis view without moving any Reader UTF-16 offsets.
const analysisText=(text:string,notes:boolean)=>notes?text:text.replace(/\(\d{1,3}\)/g,m=>' '.repeat(m.length));
export function alignmentUnits(edition:AlignmentArtifact['editions'][Locale],bounds:TextSpan,locale:Locale,notes:boolean,clauses=false):TextSpan[]{
  const {text}=edition,cuts=new Set([bounds.start,bounds.end,...(edition.breaks??[]).filter(p=>p>bounds.start&&p<bounds.end)]);
  for(const m of text.slice(bounds.start,bounds.end).matchAll(/[:：](?=\s*(?:["“‘«']|[-–—]\s))/gu))cuts.add(bounds.start+m.index+1);
  if(clauses){let depth=0;for(let i=bounds.start;i<bounds.end;i++){const c=text[i];if(c==='(')depth++;else if(c===')')depth=Math.max(0,depth-1);else if(!depth&&/[,;:：]/u.test(c)&&!(/\d/u.test(text[i-1]??'')&&/\d/u.test(text[i+1]??'')))cuts.add(i+1);}}
  const points=[...cuts].sort((a,b)=>a-b),units:TextSpan[]=[];
  const segmenter=new Intl.Segmenter(locale,{granularity:'sentence'});
  for(let i=0;i<points.length-1;i++)for(const part of segmenter.segment(analysisText(text.slice(points[i],points[i+1]),notes))){
    const value=part.segment,leading=value.match(/^[\s"“”‘’«»'\-–—]*/u)![0].length,trailing=value.match(/[\s"“”‘’«»']*$/u)![0].length;
    const start=points[i]+part.index+leading,end=points[i]+part.index+value.length-trailing;
    if(end>start&&/[\p{L}\p{N}]/u.test(value.slice(leading,value.length-trailing))&&!/^(?:[IVXLCDM]{1,8}|\d{1,3})[.:]?$/u.test(value.slice(leading,value.length-trailing)))units.push({start,end});
  }
  return units;
}
function wholeSentenceTargets(artifact:AlignmentArtifact,g:AlignmentArtifact['groups'][number],request:LookupRequest,targetLocale:Locale){
  const source=artifact.editions[request.locale],target=artifact.editions[targetLocale];
  const within=(span:TextSpan,l:Locale)=>!g.parts||g.parts[l].some(p=>span.start>=p.start&&span.end<=p.end);
  const notes=g.section==='notes',sourceUnits=alignmentUnits(source,g[request.locale],request.locale,notes,artifact.refinementVersion===1).filter(p=>within(p,request.locale)),targets=alignmentUnits(target,g[targetLocale],targetLocale,notes,artifact.refinementVersion===1).filter(p=>within(p,targetLocale));
  const covered:TextSpan[]=[],spans:TextSpan[]=[];
  if(g.parts){let at=Math.max(request.start,g[request.locale].start),end=Math.min(request.end,g[request.locale].end);for(const p of g.parts[request.locale]){if(p.end<=at)continue;if(p.start>=end)break;if(/\p{L}/u.test(source.text.slice(at,Math.min(p.start,end))))return {covered,spans};at=Math.max(at,p.end);}if(/\p{L}/u.test(source.text.slice(at,end)))return {covered,spans};}
  if(g.kind==='lexical'||nameSelection(request.text))return {covered,spans};
  if((request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)<=1&&((source.text.slice(g[request.locale].start,g[request.locale].end).match(/[\p{L}\p{M}]+/gu)?.length??0)>1||(target.text.slice(g[targetLocale].start,g[targetLocale].end).match(/[\p{L}\p{M}]+/gu)?.length??0)>3))return {covered,spans};
  const selection=wordSpan(source.text,request.start,request.end,g[request.locale]);
  const includes=(unit:TextSpan)=>{
    const text=analysisText(source.text.slice(unit.start,unit.end),notes),first=text.search(/[\p{L}\p{N}]/u),last=[...text.matchAll(/[\p{L}\p{M}\p{N}]/gu)].at(-1)!;
    return selection.start<=unit.start+first&&selection.end>=unit.start+last.index+last[0].length;
  };
  if(sourceUnits.length&&sourceUnits.every(includes)&&(targets.length===1||(sourceUnits.length===1&&targets.length<=3)))return {covered:sourceUnits,spans:targets};
  for(const unit of sourceUnits){
    if(!includes(unit))continue;
    const votes=targets.map(span=>{
      const words=new Map<string,number>();
      for(const link of g.links){
        const from=link[request.locale],to=link[targetLocale];
        if(from[0]<unit.start||from[1]>unit.end||to[0]<span.start||to[1]>span.end||!/\p{L}/u.test(source.text.slice(...from))||!/\p{L}/u.test(target.text.slice(...to)))continue;
        const word=wordSpan(source.text,...from,unit,source.words),key=word.start+':'+word.end;
        words.set(key,Math.max(words.get(key)??0,link.score*source.text.slice(word.start,word.end).replace(/[^\p{L}\p{M}\p{N}]/gu,'').length));
      }
      return {span,weight:[...words.values()].reduce((a,b)=>a+b,0)};
    }).sort((a,b)=>b.weight-a.weight);
    const best=votes[0];
    if(best&&((best.weight>0&&best.weight>(votes[1]?.weight??0)*1.35)||(sourceUnits.length===1&&targets.length===1))){covered.push(unit);spans.push(best.span);}
  }
  return {covered,spans};
}
const functionWords:Record<Locale,Set<string>>={
  en:new Set('a an the of to for from by with in on at as and or but'.split(' ')),
  vi:new Set('của và hoặc nhưng các những thì mà ở với bởi vì cho từ tại đã đang sẽ'.split(' ')),
};
function onlyFunctionWords(text:string,locale:Locale){
  const words=text.toLocaleLowerCase(locale).match(/[\p{L}\p{M}]+/gu)??[];
  return words.length>0&&words.every(w=>functionWords[locale].has(w));
}
const titledNames=[
 {en:/\b(?:hegemon|king)\b/i,vi:/(?:^|\s)(?:bá\s+vương|vương|vua)(?=\s|$)/iu,enTitle:'(?:Hegemon|King)',viTitle:'(?:bá\\s+vương|vương|vua)'},
 {en:/\bemperor\b/i,vi:/(?:^|\s)(?:hoàng\s+đế|đế|vua)(?=\s|$)/iu,enTitle:'Emperor',viTitle:'(?:hoàng\\s+đế|đế|vua)'},
 {en:/\bduke\b/i,vi:/(?:^|\s)(?:quốc\s+công|công)(?=\s|$)/iu,enTitle:'Duke',viTitle:'(?:quốc\\s+công|công)'},
];
function nameSelection(text:string){
 const words=text.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)??[];
  if(words.length<2||words.length>6)return false;
  const hasTitle=titledNames.some(t=>t.vi.test(text)||t.en.test(text));
  if(hasTitle){const rank=/^(?:hegemon|king|emperor|duke|bá|vương|vua|hoàng|đế|quốc|công|of)$/iu;return words.some(w=>/^\p{Lu}/u.test(w)&&!rank.test(w))&&words.every(w=>/^\p{Lu}/u.test(w)||rank.test(w));}
  return /^\p{Lu}/u.test(words[0]!)&&/^\p{Lu}/u.test(words.at(-1)!)&&words.filter(w=>/^\p{Lu}/u.test(w)).length>=2;
}
function nameTargets(spans:TextSpan[],request:LookupRequest,target:string,bounds:TextSpan,targetLocale:Locale){
 if(!nameSelection(request.text))return spans;
 const title=titledNames.find(t=>request.locale==='en'?t.en.test(request.text):t.vi.test(request.text));
 return spans.filter(s=>/\p{Lu}/u.test(target.slice(s.start,s.end))).map(s=>{
  if(!title)return s;const pattern=targetLocale==='vi'?title.viTitle:title.enTitle;
  const before=target.slice(bounds.start,s.start),after=target.slice(s.end,bounds.end);
  const left=new RegExp('(?:^|\\s)('+pattern+')\\s+$','iu').exec(before),right=new RegExp('^\\s+('+pattern+')(?![\\p{L}\\p{M}])','iu').exec(after);
  return {start:left?bounds.start+left.index+(left[0].length-left[0].trimStart().length):s.start,end:right?s.end+right[0].length:s.end};
 });
}
function shortBlock(edition:AlignmentArtifact['editions'][Locale],span:TextSpan){
 const start=Math.max(0,...(edition.breaks??[]).filter(b=>b<=span.start)),end=(edition.breaks??[]).find(b=>b>=span.end)??edition.text.length;
 return end-start<=160?{start,end}:undefined;
}
export function lookupArtifact(artifact:AlignmentArtifact,request:LookupRequest):LookupResult {
  const locale=request.locale,targetLocale=locale==="vi"?"en":"vi",source=artifact.editions[locale],target=artifact.editions[targetLocale];
  const empty=(status:LookupResult["status"]):LookupResult=>({status,targetLocale,passages:[]});
  if(artifact.chapterId!==request.chapterId||source.revision!==request.revision||request.start<0||request.end<=request.start||request.end>source.text.length||source.text.slice(request.start,request.end)!==request.text)return empty("stale");
  if(request.end-request.start>2000)throw RangeError("Selection too long");
  const structural=structureLookup(artifact,request);if(structural)return structural;
  const poetry=poetryLookup(artifact,request);if(poetry)return poetry;
  const poem=poetryScope(artifact,request);
  if(poem&&!poem.trustedWordScope)return poetryContext(artifact,request,poem);
  if(!poem&&artifact.poetryScopes?.[locale].some(p=>p.start<=request.start&&p.end>=request.end))return empty('unavailable');
  const note=notePair(artifact,request);
  const rank=(g:AlignmentArtifact['groups'][number])=>g.score-.03*Math.log1p(g[locale].end-g[locale].start)-(g.primary?.[locale]===false ? .1 : 0);
  const allGroups=artifact.refinementVersion===1?artifact.refinedGroups??artifact.groups:artifact.groups;
  const preferredTracks=new Map<string,string>();
  for(const g of allGroups)if(g.tracks&&g.primary?.[locale]===true&&!preferredTracks.has(g.tracks[locale].id))preferredTracks.set(g.tracks[locale].id,g.tracks[targetLocale].id);
  const candidates=allGroups.filter(g=>!g.tracks||!preferredTracks.has(g.tracks[locale].id)||preferredTracks.get(g.tracks[locale].id)===g.tracks[targetLocale].id)
   .filter(g=>(g.parts?.[locale]??[g[locale]]).some(p=>p.start<request.end&&p.end>request.start)).flatMap(original=>{
    let g=original;
    if(poem){
      const from={start:Math.max(g[locale].start,poem.source.start),end:Math.min(g[locale].end,poem.source.end)},to={start:Math.max(g[targetLocale].start,poem.target.start),end:Math.min(g[targetLocale].end,poem.target.end)};
      if(from.end<=from.start||to.end<=to.start)return [];
      const clipped={...g, [locale]:from,[targetLocale]:to,links:g.links.filter(l=>l[locale][0]>=from.start&&l[locale][1]<=from.end&&l[targetLocale][0]>=to.start&&l[targetLocale][1]<=to.end)};
      const parts=Object.fromEntries(([locale,targetLocale]as const).map(l=>[l,(g.parts?.[l]??[g[l]]).map(p=>({start:Math.max(p.start,clipped[l].start),end:Math.min(p.end,clipped[l].end)})).filter(p=>p.end>p.start)])) as Record<Locale,TextSpan[]>;
      if(!parts.vi.length||!parts.en.length)return [];
      g={...clipped,parts};
    }
    if(!note)return [g];
    return note.targets.flatMap(scope=>{
    const from={start:Math.max(g[locale].start,note.source.start),end:Math.min(g[locale].end,note.source.end)},to={start:Math.max(g[targetLocale].start,scope.start),end:Math.min(g[targetLocale].end,scope.end)};
    if(from.end<=from.start||to.end<=to.start)return [];
    return [{...g,section:'notes',[locale]:from,[targetLocale]:to,links:g.links.filter(l=>l[locale][0]>=from.start&&l[locale][1]<=from.end&&l[targetLocale][0]>=to.start&&l[targetLocale][1]<=to.end)}];});
  }).sort((a,b)=>rank(b)-rank(a));
  let remaining:TextSpan[]=[{start:request.start,end:request.end}];
  const groups:AlignmentArtifact['groups']=[];
  for(const g of candidates){
    if(!remaining.some(s=>s.start<g[locale].end&&s.end>g[locale].start))continue;
    groups.push(g);
    for(const part of g.parts?.[locale]??[g[locale]])remaining=remaining.flatMap(s=>s.end<=part.start||s.start>=part.end?[s]:[
      ...(s.start<part.start?[{start:s.start,end:part.start}]:[]),
      ...(s.end>part.end?[{start:part.end,end:s.end}]:[]),
    ]);
  }
  groups.sort((a,b)=>a[locale].start-b[locale].start);
  if(groups.length>32)throw RangeError("Select a shorter passage");
  if(!groups.length){
    if(poem)return poetryContext(artifact,request,poem);
    if(note?.target)return {status:'context-only',targetLocale,targetRevision:target.revision,passages:[{source:{...note.source,text:source.text.slice(note.source.start,note.source.end)},target:{...note.target,text:target.text.slice(note.target.start,note.target.end),breaks:target.breaks?.filter(b=>b>note.target!.start&&b<note.target!.end)},highlights:[]}]};
    return empty("unavailable");
  }
  let uncertain=remaining.some(s=>source.text.slice(s.start,s.end).trim()),hasWords=false,incompleteWords=false;
  const passages:LookupPassage[]=[];
  for(const g of groups){
    let spans:TextSpan[]=[];const coveredWords:TextSpan[]=[];const sentences=wholeSentenceTargets(artifact,g,request,targetLocale);
    const named=properNameSpan(request.text,target.text,g[targetLocale]);
    if(named)spans=[named];
    else {
      spans.push(...sentences.spans);
      const words=new Map<string,Map<string,{span:TextSpan;score:number}>>();
      for(const link of g.links){
        const from=link[locale],to=link[targetLocale];
        if(from[0]>=request.end||from[1]<=request.start||!/[\p{L}\p{N}]/u.test(target.text.slice(...to)))continue;
        if(sentences.covered.some(s=>from[0]>=s.start&&from[1]<=s.end))continue;
        const sw=wordSpan(source.text,...from,g[locale],source.words),tw=wordSpan(target.text,...to,g[targetLocale],target.words);
        coveredWords.push(sw);
        if(sw.start<request.start||sw.end>request.end)uncertain=true;
        const key=sw.start+":"+sw.end,tk=tw.start+":"+tw.end,map=words.get(key)??new Map();
        if(!map.has(tk)||map.get(tk)!.score<link.score)map.set(tk,{span:tw,score:link.score});
        words.set(key,map);
      }
      for(const map of words.values()){
        const ranked=[...map.values()].sort((a,b)=>b.score-a.score);
        const keep=ranked.filter(c=>c.score>=ranked[0].score*.8&&c.score>=.03);
        if(keep.length>1)uncertain=true;
        if(keep.some(c=>c.score<.15))uncertain=true;
        spans.push(...keep.map(c=>c.span));
      }
    }
    let highlights=mergeSpans(nameTargets(spans,request,target.text,g[targetLocale],targetLocale),target.text);
    const inferredTitle=titledNames.some(t=>locale==='en'?t.en.test(request.text)&&highlights.some(s=>t.vi.test(target.text.slice(s.start,s.end))):t.vi.test(request.text)&&highlights.some(s=>t.en.test(target.text.slice(s.start,s.end))));
    if(!named&&!inferredTitle&&!sentences.spans.length&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1){
      const from=Math.max(request.start,g[locale].start),end=Math.min(request.end,g[locale].end);
      const selected=source.words?.filter(w=>w.start<end&&w.end>from)??[...source.text.slice(from,end).matchAll(/[\p{L}\p{M}]+/gu)].map(m=>({start:from+m.index,end:from+m.index+m[0].length}));
      if(selected.some(w=>/\p{L}/u.test(source.text.slice(w.start,w.end))&&!onlyFunctionWords(source.text.slice(w.start,w.end),locale)&&!coveredWords.some(s=>s.start<=w.start&&s.end>=w.end)))incompleteWords=true;
    }
    const sourceBlock=shortBlock(source,request);
    if(artifact.refinementVersion===1&&g.section!=='notes'&&sourceBlock&&!nameSelection(request.text)&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>2){
      const whole=analysisText(source.text.slice(sourceBlock.start,sourceBlock.end),false).replace(/^[\s"“”‘’«»'\-–—]+|[\s"“”‘’«»',.;:!?]+$/gu,'');
      if(request.text.replace(/^[\s"“”‘’«»'\-–—]+|[\s"“”‘’«»',.;:!?]+$/gu,'')===whole)highlights=mergeSpans(highlights.map(s=>{const expanded=shortBlock(target,s)??s,t=g.tracks?.[targetLocale];return t?{start:Math.max(t.start,expanded.start),end:Math.min(t.end,expanded.end)}:expanded;}),target.text);
    }
    if(highlights.length&&!sentences.spans.length&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1&&!onlyFunctionWords(request.text,locale)&&highlights.every(s=>onlyFunctionWords(target.text.slice(s.start,s.end),targetLocale)))highlights=[];
    hasWords ||= highlights.length>0;
    uncertain ||= g.score<.82||g.margin<.015;
    const bounds=sentences.spans.length&&highlights.length?{start:Math.min(...highlights.map(s=>s.start)),end:Math.max(...highlights.map(s=>s.end))}:g[targetLocale];
    passages.push({source:{...g[locale],text:source.text.slice(g[locale].start,g[locale].end)},target:{...bounds,text:target.text.slice(bounds.start,bounds.end),breaks:target.breaks?.filter(p=>p>bounds.start&&p<bounds.end)},highlights});
  }
  if(incompleteWords){hasWords=false;for(const p of passages)p.highlights=[];}
  const joined:LookupPassage[]=[];
  for(const p of passages){
    const previous=joined.at(-1);
    if(previous&&p.source.start>=previous.source.start&&p.target.start>=previous.target.start&&(!analysisText(source.text.slice(previous.source.end,p.source.start),false).trim())&&(!analysisText(target.text.slice(previous.target.end,p.target.start),false).trim())){
      const sourceEnd=Math.max(previous.source.end,p.source.end),targetEnd=Math.max(previous.target.end,p.target.end);
      previous.source={start:previous.source.start,end:sourceEnd,text:source.text.slice(previous.source.start,sourceEnd)};
      previous.target={start:previous.target.start,end:targetEnd,text:target.text.slice(previous.target.start,targetEnd),breaks:target.breaks?.filter(b=>b>previous.target.start&&b<targetEnd)};
      previous.highlights=mergeSpans([...previous.highlights,...p.highlights],target.text);
    }else joined.push(p);
  }
  if(!hasWords&&poem)return poetryContext(artifact,request,poem);
  return {status:hasWords?(uncertain?"uncertain":"match"):"context-only",targetLocale,targetRevision:target.revision,sourceBreaks:source.breaks?.filter(b=>b>request.start&&b<request.end),passages:joined};
}
