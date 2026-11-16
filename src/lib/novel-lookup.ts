import type {Locale} from "./types";
import {annotatedNote,notePair,structureLookup} from './novel-lookup-structure';
import {poetryLookup,poetryScope,poetryContext} from './novel-poetry-lookup';
import {selectionLookup} from './novel-lookup-selection';
import {viSyllables,viMatchesPinyin,pinyinSegments,vietnameseReadings} from './sino-names';
export const alignmentCodec = "reader-dom-1";
export type TextSpan = {start:number;end:number};
export type PoetryCorrespondence=Record<Locale,TextSpan[]>&{score:number;evidence:'direct-window'|'surrounding-window'};
export type PoetryTrack=TextSpan&{id:string;lines:TextSpan[];title?:TextSpan;flattened?:boolean};
export type PoetryPair=Record<Locale,PoetryTrack>&{score:number;margin:number;primary:Record<Locale,boolean>;correspondences:PoetryCorrespondence[];contextOnly?:boolean};
export type PhrasePair=Record<Locale,TextSpan>&{score:number;margin:number;from:Locale};
export type ClausePair=Record<Locale,TextSpan[]>&{score:number;margin:number;residual?:boolean};
// A residual pair was inferred by elimination inside a confirmed parent pair, so it carries a lower score floor.
const trusted=(p:ClausePair)=>(p.score>=.5||(p.residual===true&&p.score>=.4))&&p.margin>=.03;
export type AlignmentArtifact = {
  schema:1;codec:string;algorithm:string;chapterId:string;createdAt:string;
  editions:Record<Locale,{revision:number;versionId:string;hash:string;text:string;words?:TextSpan[];breaks?:number[]}>;
  groups:{id:string;section:string;vi:TextSpan;en:TextSpan;score:number;margin:number;primary?:Record<Locale,boolean>;
    parts?:Record<Locale,TextSpan[]>;
    tracks?:Record<Locale,TextSpan&{id:string}>;
    poetryLines? : Record<Locale,TextSpan[]>&{score:number;poemScore:number;evidence:'direct-window'|'surrounding-window';correspondences:PoetryCorrespondence[]};
    kind?:'lexical';
    clausePairs?:ClausePair[];
    phrasePairs?:PhrasePair[];
    labelled?:{vi:TextSpan;en:TextSpan}[];
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
  targetLocale:Locale;targetRevision?:number;sourceBreaks?:number[];unmatchedSource?:TextSpan[];passages:LookupPassage[]};

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
    if(g.clausePairs){
      if(!Array.isArray(g.clausePairs)||g.clausePairs.length>64)invalid();
      for(const [pairIndex,p] of g.clausePairs.entries()){
        if(!Number.isFinite(p.score)||p.score<0||p.score>1.001||!Number.isFinite(p.margin)||(p.residual!==undefined&&typeof p.residual!=='boolean'))invalid();
        for(const l of ['vi','en']as const)if(!Array.isArray(p[l])||!p[l].length||p[l].length>96||p[l].some((s,i)=>!valid(s,a.editions[l].text)||s.start<g[l].start||s.end>g[l].end||(i>0&&s.start<p[l][i-1].end)||(g.parts&&!g.parts[l].some(q=>q.start<=s.start&&q.end>=s.end))))invalid();
        for(const q of g.clausePairs.slice(0,pairIndex)){
          const bounds=(p:ClausePair,l:Locale)=>({start:p[l][0].start,end:p[l].at(-1)!.end}),nested=(x:TextSpan,y:TextSpan)=>x.start<=y.start&&x.end>=y.end&&(x.start<y.start||x.end>y.end);
          const pv=bounds(p,'vi'),pe=bounds(p,'en'),qv=bounds(q,'vi'),qe=bounds(q,'en');
          if((pv.start<qv.end&&qv.start<pv.end)||(pe.start<qe.end&&qe.start<pe.end))if(!((nested(pv,qv)&&nested(pe,qe))||(nested(qv,pv)&&nested(qe,pe))))invalid();
        }
      }
    }
    if(g.phrasePairs){
      if(!Array.isArray(g.phrasePairs)||g.phrasePairs.length>512)invalid();
      for(const p of g.phrasePairs)if(!p||!Number.isFinite(p.score)||p.score<0||p.score>1.001||!Number.isFinite(p.margin)||!['vi','en'].includes(p.from)||(['vi','en'] as const).some(l=>!valid(p[l],a.editions[l].text)||p[l].start<g[l].start||p[l].end>g[l].end))invalid();
    }
    if(g.labelled){
      // Pairs written by reading: spans inside the group, none overlapping another on either side.
      if(!Array.isArray(g.labelled)||g.labelled.length>256||g.labelled.some(p=>!p||(['vi','en'] as const).some(l=>!valid(p[l],a.editions[l].text)||p[l].start<g[l].start||p[l].end>g[l].end)))invalid();
      for(const l of ['vi','en'] as const){const spans=g.labelled.map(p=>p[l]).sort((x,y)=>x.start-y.start);if(spans.some((x,i)=>i>0&&x.start<spans[i-1].end))invalid();}
    }
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
function targetWords(g:AlignmentArtifact['groups'][number],locale:Locale,source:AlignmentArtifact['editions'][Locale],target:AlignmentArtifact['editions'][Locale],split:boolean){
  const other=locale==='vi'?'en':'vi',same=(a:TextSpan,b:TextSpan)=>a.start===b.start&&a.end===b.end;
  const entries=g.links.map(link=>({link,sw:wordSpan(source.text,...link[locale],g[locale],source.words),raw:wordSpan(target.text,...link[other],g[other]),tw:wordSpan(target.text,...link[other],g[other],target.words)}));
  const compounds=new Map<string,typeof entries>();
  for(const e of entries){const key=e.tw.start+':'+e.tw.end,list=compounds.get(key)??[];list.push(e);compounds.set(key,list);}
  const complete=(span:TextSpan,list:typeof entries)=>[...target.text.slice(span.start,span.end).matchAll(/[\p{L}\p{M}\p{N}]/gu)].every(m=>list.some(e=>e.link[other][0]<=span.start+m.index&&e.link[other][1]>=span.start+m.index+m[0].length));
  return new Map(entries.map(e=>{
    if(!split||same(e.raw,e.tw)||nameSelection(target.text.slice(e.tw.start,e.tw.end)))return [e.link,e.tw];
    const peers=compounds.get(e.tw.start+':'+e.tw.end)!,own=peers.filter(p=>same(p.sw,e.sw)&&same(p.raw,e.raw)&&p.link.score>=.03);
    // Segmentation is a hint: separate a compound only when different source words fully support disjoint written words.
    const independent=peers.some(p=>!same(p.sw,e.sw)&&(p.raw.end<=e.raw.start||p.raw.start>=e.raw.end)&&!onlyFunctionWords(source.text.slice(p.sw.start,p.sw.end),locale)&&complete(p.raw,peers.filter(q=>same(q.sw,p.sw)&&same(q.raw,p.raw)&&q.link.score>=.03)));
    return [e.link,own.length&&complete(e.raw,own)&&independent?e.raw:e.tw];
  }));
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
// How many whole sentences [start,end) holds; 0 when it begins or ends inside a sentence.
function wholeSentences(text:string,start:number,end:number,locale:Locale):number{
  const body=analysisText(text.slice(start,end),false).trim();
  if(!/\p{L}/u.test(body))return 0;
  const startsAt=start<=0||/(^|[.!?…\n]["”’)\]]*\s*["“‘«']*)$/u.test(text.slice(Math.max(0,start-8),start));
  const endsAt=/[.!?…]["”’)\]]*$/u.test(body)||/^["”’)\]]*\s*(?:\n|$)/u.test(text.slice(end,end+8));
  return startsAt&&endsAt?[...new Intl.Segmenter(locale,{granularity:'sentence'}).segment(body)].filter(s=>/\p{L}/u.test(s.segment)).length:0;
}
// Pilot: word and phrase pairs written by reading both passages. A selection inside one such group whose content words all lie in labelled pairs takes the targets of the pairs it touches.
function labelledAnswer(g:AlignmentArtifact['groups'][number],request:LookupRequest,text:string,locale:Locale,targetLocale:Locale):{spans:TextSpan[];covered:TextSpan[];inner:boolean}|null{
  if(!g.labelled?.length||request.start<g[locale].start||request.end>g[locale].end)return null;
  const pairs=g.labelled.filter(p=>p[locale].start<request.end&&p[locale].end>request.start);
  if(!pairs.length)return null;
  const content=[...text.slice(request.start,request.end).matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(m=>({start:request.start+m.index,end:request.start+m.index+m[0].length,text:m[0]})).filter(w=>/\p{L}/u.test(w.text)&&!onlyFunctionWords(w.text,locale));
  if(!content.length||content.some(w=>!pairs.some(p=>p[locale].start<=w.start&&p[locale].end>=w.end)))return null;
  // A selection narrower than the one pair that holds it keeps a word-link answer that lies inside the pair's target; only an answer that leaves it is replaced.
  const inner=pairs.length===1&&!(pairs[0][locale].start===content[0].start&&pairs[0][locale].end===content.at(-1)!.end);
  return {spans:pairs.map(p=>({...p[targetLocale]})),covered:pairs.map(p=>({...p[locale]})),inner};
}
// A phrase pair is only used for a selection that is exactly its source window (edge punctuation and note markers aside).
function phraseTarget(g:AlignmentArtifact['groups'][number],request:LookupRequest,text:string,locale:Locale,targetLocale:Locale):{source:TextSpan;target:TextSpan}|null{
  if(!g.phrasePairs?.length)return null;
  let start=request.start,end=request.end;
  const edge=/[\s"“”‘’«»'\-–—,.;:!?()\[\]…]/u;
  while(start<end&&edge.test(text[start]))start++;
  for(let before=-1;before!==end;){before=end;const marker=/\(\d{1,3}\)$/u.exec(text.slice(start,end));if(marker)end-=marker[0].length;while(end>start&&edge.test(text[end-1]))end--;}
  if(end<=start)return null;
  const found=g.phrasePairs.filter(p=>p.from===locale&&p[locale].start===start&&p[locale].end===end&&p.score>=.65&&p.margin>=.15).sort((a,b)=>b.score-a.score);
  const best=found[0];
  if(!best||found.some(p=>(p[targetLocale].start!==best[targetLocale].start||p[targetLocale].end!==best[targetLocale].end)&&p.score>best.score-.03))return null;
  return {source:{start,end},target:{...best[targetLocale]}};
}
function wholeSentenceTargets(artifact:AlignmentArtifact,g:AlignmentArtifact['groups'][number],request:LookupRequest,targetLocale:Locale):{covered:TextSpan[];spans:TextSpan[];unmatched?:TextSpan[];grounded?:TextSpan[]}{
  const source=artifact.editions[request.locale],target=artifact.editions[targetLocale];
  const within=(span:TextSpan,l:Locale)=>!g.parts||g.parts[l].some(p=>span.start>=p.start&&span.end<=p.end);
  const notes=g.section==='notes',sourceUnits=alignmentUnits(source,g[request.locale],request.locale,notes,artifact.refinementVersion===1).filter(p=>within(p,request.locale)),targets=alignmentUnits(target,g[targetLocale],targetLocale,notes,artifact.refinementVersion===1).filter(p=>within(p,targetLocale));
  const covered:TextSpan[]=[],spans:TextSpan[]=[];
  if(g.parts){let at=Math.max(request.start,g[request.locale].start),end=Math.min(request.end,g[request.locale].end);for(const p of g.parts[request.locale]){if(p.end<=at)continue;if(p.start>=end)break;if(/\p{L}/u.test(source.text.slice(at,Math.min(p.start,end))))return {covered,spans};at=Math.max(at,p.end);}if(/\p{L}/u.test(source.text.slice(at,end)))return {covered,spans};}
  if(g.kind==='lexical'||nameSelection(request.text))return {covered,spans};
  if((request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)<=1&&((source.text.slice(g[request.locale].start,g[request.locale].end).match(/[\p{L}\p{M}]+/gu)?.length??0)>1||(target.text.slice(g[targetLocale].start,g[targetLocale].end).match(/[\p{L}\p{M}]+/gu)?.length??0)>3))return {covered,spans};
  const selection={start:request.start,end:request.end};
  const includes=(unit:TextSpan)=>{
    const text=analysisText(source.text.slice(unit.start,unit.end),notes),first=text.search(/[\p{L}\p{N}]/u),last=[...text.matchAll(/[\p{L}\p{M}\p{N}]/gu)].at(-1)!;
    return selection.start<=unit.start+first&&selection.end>=unit.start+last.index+last[0].length;
  };
  const selected=sourceUnits.filter(includes);
  if(g.clausePairs&&selected.length){
    if(!g.clausePairs.length)return {covered,spans,unmatched:selected};
    const pairs=g.clausePairs.filter(p=>trusted(p)&&p[request.locale].every(s=>s.start>=g[request.locale].start&&s.end<=g[request.locale].end&&within(s,request.locale)&&includes(s))&&p[targetLocale].every(s=>s.start>=g[targetLocale].start&&s.end<=g[targetLocale].end&&within(s,targetLocale)));
    covered.push(...pairs.flatMap(p=>p[request.locale]));spans.push(...pairs.flatMap(p=>p[targetLocale]));
  }
  if(!g.clausePairs&&sourceUnits.length&&sourceUnits.every(includes)&&(targets.length===1||(sourceUnits.length===1&&targets.length<=3)))return {covered:sourceUnits,spans:targets};
  for(const unit of sourceUnits){
    if(!includes(unit)||covered.some(p=>p.start<=unit.start&&p.end>=unit.end))continue;
    const votes=targets.map((span,index)=>{
      const words=new Map<string,number>(),outside=new Map<string,number>();
      for(const link of g.links){
        const from=link[request.locale],to=link[targetLocale];
        if(link.score<.03||to[0]<span.start||to[1]>span.end||!/\p{L}/u.test(source.text.slice(...from))||!/\p{L}/u.test(target.text.slice(...to)))continue;
        const word=wordSpan(source.text,...from,g[request.locale],source.words),key=word.start+':'+word.end;
        if(onlyFunctionWords(source.text.slice(word.start,word.end),request.locale))continue;
        const values=from[0]>=unit.start&&from[1]<=unit.end?words:(from[1]<=request.start||from[0]>=request.end)?outside:undefined;
        if(values)values.set(key,Math.max(values.get(key)??0,link.score*source.text.slice(word.start,word.end).replace(/[^\p{L}\p{M}\p{N}]/gu,'').length));
      }
      const reserved=g.clausePairs?.some(p=>trusted(p)&&!p[request.locale].some(s=>s.start<request.end&&s.end>request.start)&&p[targetLocale].some(s=>s.start<span.end&&s.end>span.start));
      return {span,index,weight:reserved?0:[...words.values()].reduce((a,b)=>a+b,0),outside:[...outside.values()].reduce((a,b)=>a+b,0)};
    });
    if(artifact.refinementVersion===1){
      const chosen=votes.filter(v=>v.weight>0&&v.weight>v.outside*1.35);
      const content=[...analysisText(source.text.slice(unit.start,unit.end),notes).matchAll(/[\p{L}\p{M}\p{N}]+/gu)].filter(m=>!onlyFunctionWords(m[0],request.locale));
      const anchored=(m:RegExpMatchArray)=>g.links.some(l=>l.score>=.03&&l[request.locale][0]<unit.start+m.index!+m[0].length&&l[request.locale][1]>unit.start+m.index!&&chosen.some(v=>l[targetLocale][0]>=v.span.start&&l[targetLocale][1]<=v.span.end));
      const essential=content.filter(m=>/^(?:\d+|not|never|no|không|chưa|chẳng|đừng)$/iu.test(m[0]));
      if(!chosen.length||chosen.some((v,i)=>i>0&&v.index!==chosen[i-1].index+1)||content.filter(anchored).length<=content.length/2||essential.some(m=>!anchored(m)))continue;
      covered.push(unit);spans.push(...chosen.map(v=>v.span));continue;
    }
    votes.sort((a,b)=>b.weight-a.weight);
    const best=votes[0];
    if(best&&((best.weight>0&&best.weight>(votes[1]?.weight??0)*1.35)||(sourceUnits.length===1&&targets.length===1))){
      covered.push(unit);spans.push(best.span);
    }
  }
  // Resolved sentences are kept apart from unresolved ones: the headline stays empty, but the grounded part narrows the context.
  const unresolved=selected.filter(s=>!covered.some(p=>p.start<=s.start&&p.end>=s.end));
  if(artifact.refinementVersion===1&&unresolved.length)return {covered,spans:[],unmatched:unresolved,grounded:spans};
  return {covered,spans};
}
const functionWords:Record<Locale,Set<string>>={
  en:new Set('a an the of to for from by with in on at as and or but'.split(' ')),
  vi:new Set('của và hoặc nhưng các những thì mà là ở với bởi vì cho từ tại đã đang sẽ'.split(' ')),
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
// Smallest target stretch that can hold the unresolved source: the gap between the nearest trusted pairs on each side
// (translation order inside a paragraph is monotone), plus whatever resolved sentences already ground. Whole group otherwise.
function groundedContext(g:AlignmentArtifact['groups'][number],locale:Locale,targetLocale:Locale,unmatched:TextSpan[],grounded:TextSpan[]):TextSpan{
 const whole=g[targetLocale],bounds=(spans:TextSpan[])=>({start:spans[0].start,end:spans.at(-1)!.end});
 const pairs=(g.clausePairs??[]).filter(trusted).map(p=>({from:bounds(p[locale]),to:bounds(p[targetLocale])}));
 if(!pairs.length||!unmatched.length)return whole;
 let start=Infinity,end=-Infinity;
 for(const u of unmatched){
  const before=pairs.filter(p=>p.from.end<=u.start),after=pairs.filter(p=>p.from.start>=u.end);
  const a=before.length?Math.max(...before.map(p=>p.to.end)):whole.start,b=after.length?Math.min(...after.map(p=>p.to.start)):whole.end;
  if(b<=a)return whole;
  start=Math.min(start,a);end=Math.max(end,b);
 }
 for(const s of grounded){start=Math.min(start,s.start);end=Math.max(end,s.end);}
 return {start:Math.max(start,whole.start),end:Math.min(end,whole.end)};
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
// Whole sentences whose one counterpart passage is exactly as many whole sentences, with no other group or clause of the pairing claiming it: the sentences correspond even though a clause of them
// was never paired or stands in no group, and the lookup that dropped its highlights for that reason keeps the counterpart highlighted, uncertain.
function absorbSentences(a:AlignmentArtifact,request:LookupRequest,result:LookupResult):LookupResult{
  const l=request.locale,o=l==='vi'?'en':'vi',overlaps=(s:TextSpan,t:TextSpan)=>s.start<t.end&&s.end>t.start;
  if(result.status!=='context-only'||!result.unmatchedSource?.length||result.passages.length!==1||notePair(a,request))return result;
  if(a.poems?.some(p=>overlaps(p[l],request))||a.poetryScopes?.[l].some(p=>overlaps(p,request)))return result;
  const p=result.passages[0],k=wholeSentences(a.editions[l].text,request.start,request.end,l);
  if(!k||k!==wholeSentences(a.editions[o].text,p.target.start,p.target.end,o))return result;
  const all=a.refinementVersion===1?a.refinedGroups??a.groups:a.groups,own=all.filter(g=>(g.parts?.[l]??[g[l]]).some(s=>overlaps(s,request)));
  if(!own.length||own.some(g=>(g.section!=='story'&&g.section!=='critique')||g.tracks||g.kind==='lexical'||g.score<.5||g.margin<.015))return result;
  if(all.some(g=>!own.includes(g)&&overlaps(g[o],p.target)))return result;
  const inside=(s:TextSpan)=>s.start>=request.start&&s.end<=request.end;
  const rival=(g:typeof own[number])=>g.clausePairs?.length?g.clausePairs.some(c=>trusted(c)&&!c[l].some(s=>overlaps(s,request))&&c[o].some(s=>overlaps(s,p.target))):!inside(g[l]);
  if(own.some(rival))return result;
  const text=a.editions[o].text.slice(p.target.start,p.target.end),{unmatchedSource:_,...rest}=result;
  return {...rest,status:'uncertain',passages:[{...p,highlights:[{start:p.target.start+text.length-text.trimStart().length,end:p.target.end-(text.length-text.trimEnd().length)}]}]};
}
export function lookupArtifact(artifact:AlignmentArtifact,request:LookupRequest):LookupResult {
  const locale=request.locale,targetLocale=locale==="vi"?"en":"vi",source=artifact.editions[locale],target=artifact.editions[targetLocale];
  const empty=(status:LookupResult["status"]):LookupResult=>({status,targetLocale,passages:[]});
  if(artifact.chapterId!==request.chapterId||source.revision!==request.revision||request.start<0||request.end<=request.start||request.end>source.text.length||source.text.slice(request.start,request.end)!==request.text)return empty("stale");
  if(request.end-request.start>2000)throw RangeError("Selection too long");
  const result=absorbSentences(artifact,request,selectionLookup(artifact,request,lookupSingle));
  // The name rules answer story text; inside a note or a caption paired with one, the paired note is shown as it is.
  if(!notePair(artifact,request)){
    const named=noteTermAnswer(artifact,result,request)??sameNameAnswer(result,request,target.text)??sinoNameAnswer(result,request,target.text);if(named)return named;
  }
  if(result.status==='context-only'||result.status==='unavailable'||!result.passages.length){
    const note=annotatedNote(artifact,request);
    if(note)return {...result,status:'context-only',targetRevision:target.revision,passages:[...result.passages,note]};
  }
  return result;
}
// The footnote of a term names it in both editions: "(n) Hồ Tông Thốc: …" against "(n) Ho Tong Thoc: …". A pair of headwords counts when each stands right before the marker "(n)" of its own prose (the only one in the text);
// a lookup of one of its terms highlights the other in the context the lookup returned, where it stands exactly once and the lookup did not already highlight it.
export type NoteTerm={vi:string;en:string};
const noteTerms=new WeakMap<AlignmentArtifact,NoteTerm[]>();
const foldAccents=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
export function noteTermsOf(a:AlignmentArtifact):NoteTerm[]{
  const known=noteTerms.get(a);if(known)return known;
  const text={vi:a.editions.vi.text,en:a.editions.en.text},out:NoteTerm[]=[];
  const head=(note:string)=>{const m=/^\s*\((\d{1,3})\)\s*([^:：]{1,90})[:：]/u.exec(note);return m?{n:+m[1],word:m[2].replace(/\s*\((?:\?|\d)[^)]*\)\s*/g,' ').trim().replace(/[ .,;]+$/,'')}:null;};
  const before=(l:'vi'|'en',n:number,term:string)=>{const marks=[...text[l].matchAll(new RegExp('(?<=[\\p{L}\\p{N})])\\s?\\('+n+'\\)','gu'))];if(marks.length!==1||!foldAccents(term))return false;return foldAccents(text[l].slice(Math.max(0,marks[0].index!-term.length-60),marks[0].index!)).includes(foldAccents(term));};
  for(const p of a.notePairs??[]){
    const v=head(text.vi.slice(p.vi.start,p.vi.end)),e=head(text.en.slice(p.en.start,p.en.end));if(!v||!e)continue;
    const count=(s:string)=>s.match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0;if(count(v.word)>6||count(e.word)>6||/[.!?]/.test(v.word+e.word))continue;
    const alias=/^(.*?)\s*\(([^)]{2,40})\)$/.exec(e.word),english=alias&&!/\d/.test(alias[2])?[alias[1].trim(),alias[2].trim()]:[e.word];
    // A list headword ("Dương Thành, Hạ Sái" against "Xiacai and Yangcheng") is kept whole: the two editions need not list its items in the same order.
    for(const q of english.map(en=>({vi:v.word,en})))if(q.vi&&q.en&&foldAccents(q.vi)!==foldAccents(q.en)&&before('vi',v.n,q.vi)&&before('en',e.n,q.en))out.push(q);
  }
  noteTerms.set(a,out);return out;
}
function noteTermAnswer(a:AlignmentArtifact,result:LookupResult,request:LookupRequest):LookupResult|null{
  if(!result.passages.length||result.status==='stale')return null;
  const l=request.locale,o=l==='vi'?'en':'vi',key=request.text.trim().toLowerCase(),targetText=a.editions[o].text;
  // A one-word capitalised headword is matched only by a capitalised selection: "Chu" the state is not "chu" the word (a capitalised label of several words, "Con hươu", is just the note's convention).
  const wanted=[...new Set(noteTermsOf(a).filter(t=>t[l].toLowerCase()===key&&(!/^\p{Lu}/u.test(t.vi)||/\s/.test(t.vi.trim())||/^\p{Lu}/u.test(request.text.trim()))).map(t=>t[o]))];
  if(wanted.length!==1)return null;
  const low=wanted[0].toLowerCase(),found:{passage:number;span:TextSpan}[]=[];
  result.passages.forEach((p,passage)=>{const t=targetText.slice(p.target.start,p.target.end).toLowerCase();
    for(let i=t.indexOf(low);i>=0;i=t.indexOf(low,i+1)){if(/[\p{L}\p{N}]/u.test(t[i-1]??'')||/[\p{L}\p{N}]/u.test(t[i+low.length]??''))continue;found.push({passage,span:{start:p.target.start+i,end:p.target.start+i+low.length}});}});
  if(found.length!==1)return null;
  const at=found[0],hit=result.passages[at.passage].highlights.some(h=>h.start<at.span.end&&h.end>at.span.start);
  if(hit)return null;
  return {...result,status:'uncertain',passages:result.passages.map((p,i)=>i===at.passage?{...p,highlights:[at.span]}:p)};
}
// A capitalised name the system left without a highlight is highlighted when the same name, ignoring accents ("Hàm Tử" = "Ham Tu"), stands once, capitalised, in the context it returned.
function sameNameAnswer(result:LookupResult,request:LookupRequest,targetText:string):LookupResult|null{
  const name=request.text.trim();
  if(result.status!=='context-only'||!result.passages.length||result.passages.some(p=>p.highlights.length)||!/^\p{Lu}/u.test(name)||/[.!?;:…\n]/u.test(name)||(name.match(/[\p{L}\p{M}]+/gu)?.length??0)>4)return null;
  const fold=(text:string)=>{const out:string[]=[],at:number[]=[],len:number[]=[];
    for(let i=0;i<text.length;){const ch=String.fromCodePoint(text.codePointAt(i)!),f=ch.normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/Đ/g,'D');for(const c of f){out.push(c);at.push(i);len.push(ch.length);}i+=ch.length;}
    return {text:out.join('').toLowerCase(),at,len};};
  const wanted=fold(name).text;if(wanted.replace(/[^a-z0-9]/g,'').length<2)return null;
  const found:{passage:number;span:TextSpan}[]=[];
  result.passages.forEach((p,passage)=>{
    const f=fold(targetText.slice(p.target.start,p.target.end));
    for(let from=f.text.indexOf(wanted);from>=0;from=f.text.indexOf(wanted,from+1)){
      const to=from+wanted.length,start=p.target.start+f.at[from],end=p.target.start+f.at[to-1]+f.len[to-1];
      if(/[a-z0-9]/.test(f.text[from-1]??'')||/[a-z0-9]/.test(f.text[to]??'')||!/\p{Lu}/u.test(targetText[start]))continue;
      found.push({passage,span:{start,end}});
    }
  });
  if(found.length!==1)return null;
  return {...result,status:'uncertain',passages:result.passages.map((p,i)=>i===found[0].passage?{...p,highlights:[found[0].span]}:p)};
}
// A Chinese name the system left without a highlight: "Chương Hàm" and "Zhang Han" read the same characters (Sino-Vietnamese and pinyin). The highlight goes to the one capitalised name of the context
// whose syllables correspond, one by one, through the Unihan readings; with two candidates, or one that does not fit every syllable, nothing is highlighted.
function sinoNameAnswer(result:LookupResult,request:LookupRequest,targetText:string):LookupResult|null{
  const name=request.text.trim();
  if(result.status!=='context-only'||!result.passages.length||result.passages.some(p=>p.highlights.length)||!/^\p{Lu}/u.test(name)||/[.!?;:…\n]/u.test(name)||(name.match(/[\p{L}\p{M}'’]+/gu)?.length??0)>4)return null;
  const found=new Map<string,{passage:number;span:TextSpan}>(),add=(passage:number,start:number,end:number)=>found.set(start+':'+end,{passage,span:{start,end}});
  const segments=request.locale==='en'?pinyinSegments(name):[],syllables=request.locale==='vi'?viSyllables(name):[];
  if(request.locale==='en'&&!segments.length)return null;
  result.passages.forEach((p,passage)=>{
    const text=targetText.slice(p.target.start,p.target.end),at=p.target.start;
    if(request.locale==='vi'){
      const tokens=[...text.matchAll(/\p{Lu}[\p{L}\p{M}'’]*/gu)].map(m=>({start:m.index!,end:m.index!+m[0].length}));
      for(let i=0;i<tokens.length;i++)for(let j=i;j<Math.min(i+4,tokens.length);j++){
        if(j>i&&text.slice(tokens[j-1].end,tokens[j].start)!==' ')break;
        if(viMatchesPinyin(syllables,text.slice(tokens[i].start,tokens[j].end)))add(passage,at+tokens[i].start,at+tokens[j].end);
      }
    }else{
      const tokens=[...text.matchAll(/[\p{L}\p{M}]+/gu)].map(m=>({start:m.index!,end:m.index!+m[0].length,word:m[0].normalize('NFC').toLowerCase()}));
      for(const seg of segments)for(let i=0;i+seg.length<=tokens.length;i++){
        if(!/\p{Lu}/u.test(text[tokens[i].start])||seg.some((s,k)=>(k>0&&text.slice(tokens[i+k-1].end,tokens[i+k].start)!==' ')||!vietnameseReadings(s).has(tokens[i+k].word)))continue;
        add(passage,at+tokens[i].start,at+tokens[i+seg.length-1].end);
      }
    }
  });
  if(found.size!==1)return null;
  const only=[...found.values()][0];
  return {...result,status:'uncertain',passages:result.passages.map((p,i)=>i===only.passage?{...p,highlights:[only.span]}:p)};
}
// A selection in text no group holds lies between two groups of one section; their target text around that point is its context:
// the text between them nobody claims, or, when they touch, both of them.
function gapContext(all:AlignmentArtifact['groups'],request:LookupRequest,locale:Locale,targetLocale:Locale,targetText:string):TextSpan|null{
  if(!/\p{L}/u.test(request.text))return null;
  const around=all.filter(g=>!g.tracks&&g.kind!=='lexical'&&(g.section==='story'||g.section==='critique'));
  if(around.some(g=>g[locale].start<request.end&&g[locale].end>request.start))return null;
  const before=around.filter(g=>g[locale].end<=request.start).sort((a,b)=>b[locale].end-a[locale].end)[0],after=around.filter(g=>g[locale].start>=request.end).sort((a,b)=>a[locale].start-b[locale].start)[0];
  if(!before||!after||before.section!==after.section||before[targetLocale].end>after[targetLocale].start)return null;
  const gap={start:before[targetLocale].end,end:after[targetLocale].start};
  if(around.some(g=>g!==before&&g!==after&&g[targetLocale].start<gap.end&&g[targetLocale].end>gap.start))return null;
  if(/\p{L}/u.test(targetText.slice(gap.start,gap.end)))return gap.end-gap.start<=Math.max(400,4*(after[locale].start-before[locale].end))?gap:null;
  const bridge={start:before[targetLocale].start,end:after[targetLocale].end};
  return bridge.end-bridge.start<=1500?bridge:null;
}
// Pairs written by reading answer only where the word and phrase links gave no highlight at all: such answers were right 27 of 29 times (human sheets 7 and 9),
// while replacing a highlight the links already gave was no better than keeping it (sheets 8 and 9: 18 better, 11 worse, 2 equal; 3 better, 9 worse for a Vietnamese selection).
// For an English selection (the answer is Vietnamese) the labelled pairs also replace a highlight the links gave: sheets 8 and 9 gave 15 better against 2 worse
// (for a Vietnamese selection 3 against 9, so there the links keep it). Only merged after human sheet 11 confirms it on cards not seen before.
function lookupSingle(artifact:AlignmentArtifact,request:LookupRequest):LookupResult {
  const labelledAnywhere=[...artifact.groups,...(artifact.refinedGroups??[])].some(g=>g.labelled?.length);
  if(request.locale==='en'&&labelledAnywhere){
    const labelled=lookupBase(artifact,request,true);
    if(labelled.passages.some(p=>p.highlights.length))return labelled;
  }
  const plain=lookupBase(artifact,request,false);
  if(plain.passages.some(p=>p.highlights.length)||!labelledAnywhere)return plain;
  const labelled=lookupBase(artifact,request,true);
  return labelled.passages.some(p=>p.highlights.length)?labelled:plain;
}
function lookupBase(artifact:AlignmentArtifact,request:LookupRequest,useLabels:boolean):LookupResult {
  const locale=request.locale,targetLocale=locale==='vi'?'en':'vi',source=artifact.editions[locale],target=artifact.editions[targetLocale];
  const empty=(status:LookupResult['status']):LookupResult=>({status,targetLocale,passages:[]});
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
    const around=gapContext(allGroups,request,locale,targetLocale,target.text);
    if(around)return {status:'context-only',targetLocale,targetRevision:target.revision,passages:[{source:{start:request.start,end:request.end,text:request.text},target:{...around,text:target.text.slice(around.start,around.end),breaks:target.breaks?.filter(b=>b>around.start&&b<around.end)},highlights:[]}],unmatchedSource:[{start:request.start,end:request.end}]};
    return empty("unavailable");
  }
  let uncertain=remaining.some(s=>source.text.slice(s.start,s.end).trim()),hasWords=false,incompleteWords=false;
  const passages:LookupPassage[]=[];
  const contexts:TextSpan[]=[];
  const unmatchedSource:TextSpan[]=[],full:boolean[]=[];
  for(const g of groups){
    const supported=!!poem||g.kind==='lexical'||(g.score>=.5&&g.margin>=.015);
    const content=[...analysisText(source.text.slice(g[locale].start,g[locale].end),g.section==='notes').matchAll(/[\p{L}\p{M}\p{N}]/gu)],last=content.at(-1);
    const whole=(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1&&!!last&&request.start<=g[locale].start+content[0].index&&request.end>=g[locale].start+last.index+last[0].length;
    let spans:TextSpan[]=[];const coveredWords:TextSpan[]=[];const sentences:ReturnType<typeof wholeSentenceTargets>=supported||whole?wholeSentenceTargets(artifact,g,request,targetLocale):{covered:[],spans:[]};
    const named=properNameSpan(request.text,target.text,g[targetLocale]);
    const found=!named&&!poem&&g.kind!=='lexical'?phraseTarget(g,request,source.text,locale,targetLocale):null;
    const already:{incomplete:boolean;unmatched:number}={incomplete:incompleteWords,unmatched:unmatchedSource.length};
    if(sentences.unmatched?.length){incompleteWords=true;unmatchedSource.push(...sentences.unmatched.map(s=>({start:Math.max(s.start,request.start),end:Math.min(s.end,request.end)})));}
    const targetSpans=targetWords(g,locale,source,target,!poem&&g.kind!=='lexical');
    const sourceSpans=targetWords(g,targetLocale,target,source,!poem&&g.kind!=='lexical');
    let claimedByOthers:(TextSpan&{from:TextSpan})[]=[];
    const lab=useLabels&&!named&&!poem&&g.kind!=='lexical'&&!sentences.spans.length?labelledAnswer(g,request,source.text,locale,targetLocale):null;
    if(named)spans=[named];
    else if(lab&&!lab.inner){
      spans.push(...lab.spans);coveredWords.push(...lab.covered);uncertain=true;
      // The pairs cover every content word of the selection: a clause the clause logic left unmatched is matched (as a phrase pair does below).
      if(sentences.unmatched?.length){incompleteWords=already.incomplete;unmatchedSource.length=already.unmatched;sentences.unmatched=undefined;}
    }
    else {
      spans.push(...sentences.spans);
      // A link that leaves the smallest clause pair holding the selection and lands in another clause pair is crossed ("live in comfort" linked to "đi" of the sentence before): it is ignored.
      // Only a clause pair with its own score of .5 counts as the home, not a residual one, whose split can cut the counterpart in two.
      const home=!poem&&g.kind!=='lexical'?(g.clausePairs??[]).filter(p=>trusted(p)&&p.score>=.5&&p[locale].some(x=>x.start<=request.start&&x.end>=request.end)).sort((x,y)=>x[locale].reduce((n,z)=>n+z.end-z.start,0)-y[locale].reduce((n,z)=>n+z.end-z.start,0))[0]:undefined;
      const crossed=(tw:TextSpan)=>!!home&&!home[targetLocale].some(h=>tw.start<h.end&&tw.end>h.start)&&g.clausePairs!.some(p=>p!==home&&trusted(p)&&!p[locale].some(x=>x.start<request.end&&x.end>request.start)&&p[targetLocale].some(x=>x.start<tw.end&&x.end>tw.start));
      const words=new Map<string,Map<string,{span:TextSpan;score:number}>>();
      for(const link of supported?g.links:[]){
        const from=link[locale],to=link[targetLocale];
        if(from[0]>=request.end||from[1]<=request.start||!/[\p{L}\p{N}]/u.test(target.text.slice(...to)))continue;
        if(sentences.covered.some(s=>from[0]>=s.start&&from[1]<=s.end))continue;
        const sw=sourceSpans.get(link)!,tw=targetSpans.get(link)!;
        if(crossed(tw))continue;
        if(sw.start<request.start||sw.end>request.end)uncertain=true;
        const key=sw.start+":"+sw.end,tk=tw.start+":"+tw.end,map=words.get(key)??new Map();
        if(!map.has(tk)||map.get(tk)!.score<link.score)map.set(tk,{span:tw,score:link.score});
        words.set(key,map);
      }
      const competing=new Map<string,number>(),outsideLinks:(TextSpan&{from:TextSpan})[]=[];
      if(!poem&&g.kind!=='lexical')for(const link of g.links){
        const from=link[locale];if(from[0]<request.end&&from[1]>request.start)continue;
        if(!/[\p{L}\p{N}]/u.test(source.text.slice(...from))||!/[\p{L}\p{N}]/u.test(target.text.slice(...link[targetLocale])))continue;
        const sw=sourceSpans.get(link)!;if(onlyFunctionWords(source.text.slice(sw.start,sw.end),locale))continue;
        const tw=targetSpans.get(link)!,key=tw.start+':'+tw.end;
        competing.set(key,Math.max(competing.get(key)??0,link.score));outsideLinks.push({start:tw.start,end:tw.end,from:sw});
      }
      claimedByOthers=outsideLinks;
      for(const [sourceKey,map] of words){
        const ranked=[...map.values()].sort((a,b)=>b.score-a.score);
        let keep=ranked.filter(c=>c.score>=ranked[0].score*.8&&c.score>=.03&&c.score*1.35>=(competing.get(c.span.start+':'+c.span.end)??0));
        const [wordStart,wordEnd]=sourceKey.split(':').map(Number);
        // A link whose target lies wholly outside the target of a small strong phrase pair that holds its source word is crossed ("gấu thỏ" against "bears … hares", linked the other way round):
        // the words of the pair that no other word of its window takes are this word's; what another word takes is its raw link piece ("săn"), not the whole word the segmenter made of it ("săn gấu").
        const pickStart=Math.max(wordStart,request.start),pickEnd=Math.min(wordEnd,request.end),lone=(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)===1;
        const holder=keep.length&&!poem&&g.kind!=='lexical'&&lone?g.phrasePairs?.filter(p=>p[locale].start<=wordStart&&p[locale].end>=wordEnd&&(p[locale].start<request.start||p[locale].end>request.end)&&(source.text.slice(p[locale].start,p[locale].end).match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0)<=3&&p.score>=.65&&p.margin>=.15&&keep.every(c=>c.span.end<=p[targetLocale].start||c.span.start>=p[targetLocale].end)).sort((a,b)=>(a[locale].end-a[locale].start)-(b[locale].end-b[locale].start)||b.score-a.score)[0]:undefined;
        if(holder){
          const t=holder[targetLocale],others=g.links.filter(l=>l[locale][0]>=holder[locale].start&&l[locale][1]<=holder[locale].end&&!(l[locale][0]<pickEnd&&l[locale][1]>pickStart)&&l.score>=.3);
          const words=[...target.text.slice(t.start,t.end).matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(m=>({start:t.start+m.index,end:t.start+m.index+m[0].length})).filter(w=>!onlyFunctionWords(target.text.slice(w.start,w.end),targetLocale));
          const left=(taken:TextSpan[])=>words.filter(w=>!taken.some(s=>s.start<w.end&&s.end>w.start));
          const whole=others.map(l=>targetSpans.get(l)!).filter(s=>s.start>=t.start&&s.end<=t.end);
          // Only when the whole words leave nothing do the raw pieces decide, so no earlier answer widens.
          const rest=left(whole).length?left(whole):left(others.map(l=>({start:l[targetLocale][0],end:l[targetLocale][1]})).filter(s=>s.start>=t.start&&s.end<=t.end));
          if(rest.length&&rest.length<=2&&/^\s*$/.test(target.text.slice(rest[0].end,rest.at(-1)!.start))){keep=[{span:{start:rest[0].start,end:rest.at(-1)!.end},score:holder.score}];uncertain=true;}
        }
        // The other side of a swapped list: a lone word whose link target lies inside a small strong phrase pair that does not hold it, while a word of that pair has its best link outside the pair, gets no highlight rather than a wrong one.
        // ("thỏ" is linked to "bears", which belongs to "săn gấu" ↔ "hunting bears", whose "gấu" is linked to "hares".)
        const leaves=(p:NonNullable<typeof g.phrasePairs>[number])=>{
          // Per written word of the pair's source window (not per segmented word: "săn gấu" must not hide the escape of "gấu").
          const best=new Map<number,{score:number;out:boolean}>(),syllables=[...source.text.slice(p[locale].start,p[locale].end).matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(m=>({start:p[locale].start+m.index,end:p[locale].start+m.index+m[0].length}));
          for(const l of g.links){
            const at=syllables.findIndex(s=>l[locale][0]>=s.start&&l[locale][0]<s.end),to=l[targetLocale];
            if(at<0||l[locale][1]>p[locale].end||onlyFunctionWords(source.text.slice(syllables[at].start,syllables[at].end),locale)||(best.get(at)?.score??-1)>=l.score)continue;
            best.set(at,{score:l.score,out:to[1]<=p[targetLocale].start||to[0]>=p[targetLocale].end});
          }
          return [...best.values()].some(b=>b.out&&b.score>=.1);
        };
        if(keep.length&&!holder&&lone&&!poem&&g.kind!=='lexical'&&g.phrasePairs?.some(p=>!(p[locale].start<pickEnd&&p[locale].end>pickStart)&&(source.text.slice(p[locale].start,p[locale].end).match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0)<=3&&p.score>=.8&&p.margin>=.15&&keep.every(c=>c.span.start>=p[targetLocale].start&&c.span.end<=p[targetLocale].end)&&leaves(p)))keep=[];
        // A weak link to a content word that sits beside the kept target across "and"/"or"/a comma, and that no other word claims, completes a coordinated pair ("sáng sủa" = "bright and clear").
        if(keep.length&&!poem&&g.kind!=='lexical')for(const c of ranked)if(!keep.includes(c)&&c.score>=.03&&!competing.has(c.span.start+':'+c.span.end)&&!onlyFunctionWords(target.text.slice(c.span.start,c.span.end),targetLocale)&&keep.some(k=>/^\s*(?:,|and|or|và|hoặc)\s*$/iu.test(c.span.start>=k.span.end?target.text.slice(k.span.end,c.span.start):c.span.end<=k.span.start?target.text.slice(c.span.end,k.span.start):'x')))keep.push(c);
        if(keep.length){const [start,end]=sourceKey.split(':').map(Number);coveredWords.push({start,end});}
        if(keep.length>1)uncertain=true;
        if(keep.some(c=>c.score<.15))uncertain=true;
        // The phrase pair of this one source word widens its link target when it contains it ("everyone" = "mọi người", the link gave "mọi"), by at most two target words that no other word's link claims.
        const pair=!poem&&g.kind!=='lexical'?g.phrasePairs?.filter(p=>p.from===locale&&p[locale].start===wordStart&&p[locale].end===wordEnd&&p.score>=.65&&p.margin>=.15).sort((a,b)=>b.score-a.score)[0]:undefined;
        const widen=(s:TextSpan)=>{
          if(!pair||pair[targetLocale].start>s.start||pair[targetLocale].end<s.end||(pair[targetLocale].start===s.start&&pair[targetLocale].end===s.end))return s;
          const t=pair[targetLocale],extra=[target.text.slice(t.start,s.start),target.text.slice(s.end,t.end)];
          if(extra.some(e=>(e.match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0)>2||/[.!?;:…\n]/u.test(e)||(/\p{L}/u.test(e)&&onlyFunctionWords(e,targetLocale))))return s;
          return claimedByOthers.some(o=>o.start<t.end&&o.end>t.start&&!(o.start<s.end&&o.end>s.start))?s:{start:t.start,end:t.end};
        };
        spans.push(...keep.map(c=>widen(c.span)));
      }
    }
    let highlights=mergeSpans(nameTargets(spans,request,target.text,g[targetLocale],targetLocale),target.text);
    // A highlight that is only function words ("là") lies outside the pair but is dropped further down; it must not make the pair replace a good answer inside it.
    if(lab?.inner){
      const real=highlights.filter(h=>!onlyFunctionWords(target.text.slice(h.start,h.end),targetLocale)),pair=lab.spans[0];
      if(!(real.length&&real.every(h=>h.start>=pair.start&&h.end<=pair.end))){highlights=[{...pair}];coveredWords.push(...lab.covered);uncertain=true;if(sentences.unmatched?.length){incompleteWords=already.incomplete;unmatchedSource.length=already.unmatched;sentences.unmatched=undefined;}}
    }
    // The pieces of one phrase answer are joined when what lies between them is at most four words (and no more than the selection has) nobody else's link claims, with no sentence break: a person reads a phrase as one run.
    // A word the link of a source word within two words of the selection holds ("không" for the "not" before "dare") belongs to the phrase when it lies between its pieces.
    if(!named&&!poem&&g.kind!=='lexical'&&!sentences.spans.length&&highlights.length>1&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1){
      const joined:TextSpan[]=[],most=Math.min(4,request.text.match(/[\p{L}\p{M}]+/gu)!.length);
      const near=(f:TextSpan)=>{const between=f.end<=request.start?source.text.slice(f.end,request.start):f.start>=request.end?source.text.slice(request.end,f.start):null;return between!==null&&(between.match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0)<=1&&!/[.!?;:…\n]/u.test(between);};
      for(const s of highlights){
        const last=joined.at(-1),gap=last?target.text.slice(last.end,s.start):'';
        if(last&&(gap.match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0)<=most&&!/[.!?;:…\n]|\(\d{1,3}\)/u.test(gap)&&!target.breaks?.some(b=>b>last.end&&b<s.start)&&!claimedByOthers.some(c=>c.start<s.start&&c.end>last.end&&!near(c.from)))last.end=s.end;
        else joined.push({...s});
      }
      highlights=joined;
    }
    const inferredTitle=titledNames.some(t=>locale==='en'?t.en.test(request.text)&&highlights.some(s=>t.vi.test(target.text.slice(s.start,s.end))):t.vi.test(request.text)&&highlights.some(s=>t.en.test(target.text.slice(s.start,s.end))));
    let looseWords=false;
    if(!named&&!inferredTitle&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1){
      const from=Math.max(request.start,g[locale].start),end=Math.min(request.end,g[locale].end);
      const selected=[...source.text.slice(from,end).matchAll(/[\p{L}\p{M}]+/gu)].map(m=>({start:from+m.index,end:from+m.index+m[0].length}));
      const missing=selected.filter(w=>/\p{L}/u.test(source.text.slice(w.start,w.end))&&!onlyFunctionWords(source.text.slice(w.start,w.end),locale)&&![...coveredWords,...sentences.covered].some(s=>s.start<=w.start&&s.end>=w.end));
      if(missing.length){
        // A phrase inside one sentence whose content is mostly anchored keeps its highlight as an uncertain suggestion; a lone unlinked word does not erase it.
        const wordsOf=(w:TextSpan)=>source.text.slice(w.start,w.end),content=selected.filter(w=>/\p{L}/u.test(wordsOf(w))&&!onlyFunctionWords(wordsOf(w),locale));
        const essential=missing.some(w=>/^(?:not|never|no|không|chưa|chẳng|đừng)$/iu.test(wordsOf(w)));
        const oneSentence=alignmentUnits(source,g[locale],locale,g.section==='notes').filter(u=>u.start<request.end&&u.end>request.start).length<=1;
        // Unlinked words between two linked ones lie inside the span the pieces already cover (the join ran over them): only those at the two ends of the selection count against its content.
        const covers=(w:TextSpan)=>[...coveredWords,...sentences.covered].some(s=>s.start<=w.start&&s.end>=w.end);
        let firstCovered=selected.findIndex(covers),lastCovered=selected.length-1-[...selected].reverse().findIndex(covers);
        const edgeMissing=firstCovered<0?missing.length:missing.filter(w=>{const at=selected.findIndex(s=>s.start===w.start);return at<firstCovered||at>lastCovered;}).length;
          // A phrase of one sentence whose own words hold too few links is projected from the words beside it: its counterpart lies between the targets of the nearest linked word on each side,
          // where no other word's link stands, without the function words at the ends. A missing negation needs a negation in the projected words.
          const project=():TextSpan|null=>(supported&&!found&&!sentences.unmatched?.length&&oneSentence&&!named&&!poem&&g.kind!=='lexical'&&!sentences.spans.length&&content.length>=1?(()=>{
            const nearest=(side:'left'|'right')=>{
              let best:{tw:TextSpan;at:number;clear:boolean}|null=null;
              for(const l of g.links){
                const f=l[locale];if(l.score<.5||(side==='left'?f[1]>request.start:f[0]<request.end))continue;
                const sw=sourceSpans.get(l)!,tw=targetSpans.get(l)!;
                if(onlyFunctionWords(source.text.slice(sw.start,sw.end),locale)||!/\p{L}/u.test(target.text.slice(tw.start,tw.end))||onlyFunctionWords(target.text.slice(tw.start,tw.end),targetLocale))continue;
                const between=side==='left'?source.text.slice(sw.end,request.start):source.text.slice(request.end,sw.start);
                if(/[.!?;:…\n]|\(\d{1,3}\)/u.test(between))continue;
                const at=side==='left'?sw.end:-sw.start;if(!best||at>best.at)best={tw,at,clear:!(between.match(/[\p{L}\p{M}\p{N}]+/gu)??[]).some(w=>!onlyFunctionWords(w,locale))};
              }
              // The nearest linked word must have only function words between it and the phrase: an unlinked content word there shares the gap, and the projection would be a guess.
              return best&&!best.clear?'blocked' as const:best?.tw??null;
            };
            const left=nearest('left'),right=nearest('right'),gb=g[targetLocale];
            if(left==='blocked'||right==='blocked')return null;
            const lo=left?left.end:gb.start,hi=right?right.start:gb.end;
            if(!left&&!right)return null;
            if(left&&right&&left.end>right.start)return null;
            if((target.text.slice(lo,hi).match(/[\p{L}\p{M}\p{N}]+/gu)?.length??0)>Math.max(6,3*content.length+2))return null;
            const gap=[...target.text.slice(lo,hi).matchAll(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)].map(m=>({start:lo+m.index,end:lo+m.index+m[0].length}));
            const free=gap.map(w=>!claimedByOthers.some(c=>c.start<w.end&&c.end>w.start));
            let run:TextSpan[]=[],bestRun:TextSpan[]=[];
            gap.forEach((w,i)=>{if(free[i]&&!/[.!?;:…\n]|\(\d{1,3}\)/u.test(i>0&&run.length?target.text.slice(run.at(-1)!.end,w.start):'')){run.push(w);}else{if(run.length>bestRun.length)bestRun=run;run=free[i]?[w]:[];}});
            if(run.length>bestRun.length)bestRun=run;
            const isFn=(w:TextSpan)=>onlyFunctionWords(target.text.slice(w.start,w.end),targetLocale)||/^(?:then|so|thus|yet|also|now|rồi|bèn|liền|cũng|còn|bỗng|lại)$/iu.test(target.text.slice(w.start,w.end));
            while(bestRun.length&&isFn(bestRun[0]))bestRun=bestRun.slice(1);
            while(bestRun.length&&isFn(bestRun.at(-1)!))bestRun=bestRun.slice(0,-1);
            if(!bestRun.length||bestRun.length>Math.max(2*content.length+2,4))return null;
            const span={start:bestRun[0].start,end:bestRun.at(-1)!.end};
            if(essential&&!/\b(?:not|no|never|without|none|nor|nothing|cannot|n't|không|chưa|chẳng|đừng|chả)\b|n’t/iu.test(target.text.slice(span.start,span.end)))return null;
            if(highlights.some(h=>h.start<span.start||h.end>span.end))return null;
            return span;
          })():null);
        if(!sentences.unmatched?.length&&highlights.length&&oneSentence&&!essential&&(highlights.length===1?edgeMissing:missing.length)*3<=content.length){
          uncertain=true;
          if(edgeMissing<missing.length){const extended=project();if(extended)highlights=[extended];}
          // The exact phrase pair of the selection completes a link answer that lies inside it when selected words have no link ("Minh Tong of the Tran" = "Minh Tông nhà Trần").
          // Another word's link may hold part of the pair only when that word sits right beside the selection ("dynasty" after "Tran").
          const beside=(f:TextSpan)=>f.start===request.end+(/^\s*/.exec(source.text.slice(request.end))![0].length)||f.end===request.start-(/\s*$/.exec(source.text.slice(0,request.start))![0].length);
          const completed=!!found&&!poem&&g.kind!=='lexical'&&!sentences.spans.length&&highlights.every(h=>h.start>=found.target.start&&h.end<=found.target.end)
            &&!claimedByOthers.some(c=>c.start<found.target.end&&c.end>found.target.start&&!highlights.some(h=>c.start<h.end&&c.end>h.start)&&!beside(c.from));
          if(completed)highlights=[{...found!.target}];
          // Selected words at an edge of the selection that no link reached extend the answer by as many target words at that edge, up to three, unless another word's link holds them;
          // the word right beside the selection may hold them (a compound cut in the middle: "mỉm | cười").
          else if(!named&&!poem&&g.kind!=='lexical'&&!sentences.spans.length){
            const isCovered=(w:TextSpan)=>[...coveredWords,...sentences.covered].some(s=>s.start<=w.start&&s.end>=w.end),missed=new Set(missing.map(w=>w.start));
            let lead=0,trail=0;
            for(const w of selected){if(isCovered(w))break;if(missed.has(w.start))lead++;}
            for(const w of [...selected].reverse()){if(isCovered(w))break;if(missed.has(w.start))trail++;}
            const nextAt=request.end+(/^\s*/.exec(source.text.slice(request.end))![0].length),prevEnd=request.start-(/\s*$/.exec(source.text.slice(0,request.start))![0].length);
            const free=(a:number,b:number,beside:(f:TextSpan)=>boolean)=>!claimedByOthers.some(c=>c.start<b&&c.end>a&&!beside(c.from)),after=/^\s+([\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*)/u,before=/([\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*)\s+$/u;
            for(let n=0;n<Math.min(3,trail);n++){const last=highlights.at(-1)!,m=after.exec(target.text.slice(last.end,last.end+60));if(!m)break;const end=last.end+m[0].length;if(!free(last.end,end,f=>f.start===nextAt)||end>g[targetLocale].end)break;last.end=end;}
            for(let n=0;n<Math.min(3,lead);n++){const first=highlights[0],text=target.text.slice(Math.max(g[targetLocale].start,first.start-60),first.start),m=before.exec(text);if(!m)break;const start=first.start-(text.length-m.index);if(!free(start,first.start,f=>f.end===prevEnd)||start<g[targetLocale].start)break;first.start=start;}
          }
        }
        else{
          const projected=project();
          if(projected){highlights=[projected];uncertain=true;}
          else{incompleteWords=true;unmatchedSource.push(...missing);looseWords=missing.some(w=>!sentences.unmatched?.some(u=>u.start<=w.start&&u.end>=w.end));}
        }
      }
    }
    // A phrase pair answers only when word evidence could not: empty, or incomplete for this selection. It never narrows or widens good word links.
    // Punctuation or a space beside the pair (the clause unit ends after its comma) is not unmatched content; a letter is.
    const lettersIn=(a:number,b:number)=>b>a&&/\p{L}/u.test(source.text.slice(a,b));
    // A strong exact phrase pair beats word links that miss it entirely (a swapped pair in a list); links that overlap it are kept, never widened.
    const contradicted=(target:TextSpan)=>highlights.length>0&&!highlights.some(h=>h.start<target.end&&h.end>target.start);
    if(found&&!sentences.unmatched?.some(u=>lettersIn(Math.max(u.start,request.start),found.source.start)||lettersIn(found.source.end,Math.min(u.end,request.end)))&&(!highlights.length||(incompleteWords&&!already.incomplete)||contradicted(found.target))){
      incompleteWords=already.incomplete;unmatchedSource.length=already.unmatched;sentences.unmatched=undefined;looseWords=false;highlights=[found.target];uncertain=true;
    }
    const sourceBlock=shortBlock(source,request);
    if(artifact.refinementVersion===1&&g.section!=='notes'&&sourceBlock&&!nameSelection(request.text)&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>2){
      const whole=analysisText(source.text.slice(sourceBlock.start,sourceBlock.end),false).replace(/^[\s"“”‘’«»'\-–—]+|[\s"“”‘’«»',.;:!?]+$/gu,'');
      if(request.text.replace(/^[\s"“”‘’«»'\-–—]+|[\s"“”‘’«»',.;:!?]+$/gu,'')===whole)highlights=mergeSpans(highlights.map(s=>{const expanded=shortBlock(target,s)??s,t=g.tracks?.[targetLocale];return t?{start:Math.max(t.start,expanded.start),end:Math.min(t.end,expanded.end)}:expanded;}),target.text);
    }
    if(highlights.length&&!sentences.spans.length&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1&&!onlyFunctionWords(request.text,locale)&&highlights.every(s=>onlyFunctionWords(target.text.slice(s.start,s.end),targetLocale)))highlights=[];
    if(!poem&&!named&&!sentences.spans.length&&highlights.length>1&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>1&&!onlyFunctionWords(request.text,locale)){
      highlights=highlights.filter(s=>!onlyFunctionWords(target.text.slice(s.start,s.end),targetLocale));uncertain ||= highlights.length>1;
    }
    // A selection inside one pair whose words the links left partly unmatched: the pair answers it (the unmatched words are all inside the pair).
    if(lab?.inner&&incompleteWords&&!already.incomplete&&unmatchedSource.slice(already.unmatched).every(u=>lab.covered.some(c=>c.start<=u.start&&c.end>=u.end))){
      highlights=[{...lab.spans[0]}];coveredWords.push(...lab.covered);uncertain=true;incompleteWords=already.incomplete;unmatchedSource.length=already.unmatched;sentences.unmatched=undefined;looseWords=false;
    }
    hasWords ||= highlights.length>0;
    uncertain ||= g.score<.82||g.margin<.015;
    const bounds=sentences.spans.length&&highlights.length?{start:Math.min(...highlights.map(s=>s.start)),end:Math.max(...highlights.map(s=>s.end))}:g[targetLocale];
    contexts.push(sentences.unmatched?.length&&!looseWords?groundedContext(g,locale,targetLocale,sentences.unmatched,sentences.grounded??[]):g[targetLocale]);
    full.push(sentences.spans.length>0&&!sentences.unmatched?.length&&!looseWords);
    passages.push({source:{...g[locale],text:source.text.slice(g[locale].start,g[locale].end)},target:{...bounds,text:target.text.slice(bounds.start,bounds.end),breaks:target.breaks?.filter(p=>p>bounds.start&&p<bounds.end)},highlights});
  }
  if(!poem&&!note&&groups.length&&groups.every(g=>g.section===groups[0].section&&g.section!=='notes')){
    // Source text the pairing left in no group lies between two groups. The target text between the same two groups, if no other group claims it, belongs to it.
    // Only interior gaps (between two selected groups) of a selection every group of which matched whole are closed: the highlight then runs across them. Any other gap gives context only.
    const around=allGroups.filter(g=>g.section===groups[0].section&&!g.tracks),chosen=new Set(groups.map(g=>g.id)),found:{s:TextSpan;gap:TextSpan;letters:boolean;interior:boolean}[]=[];
    let closable=groups.length>1&&!incompleteWords&&!unmatchedSource.length&&full.every(Boolean);
    for(const s of remaining){
      if((source.text.slice(s.start,s.end).match(/\p{L}+/gu)?.length??0)<2||around.some(g=>g[locale].start<s.end&&g[locale].end>s.start))continue;
      const before=around.filter(g=>g[locale].end<=s.start).sort((a,b)=>b[locale].end-a[locale].end)[0],after=around.filter(g=>g[locale].start>=s.end).sort((a,b)=>a[locale].start-b[locale].start)[0];
      const gap=before&&after?{start:before[targetLocale].end,end:after[targetLocale].start}:null;
      if(!before||!after||!gap||gap.end<gap.start||gap.end-gap.start>Math.max(400,4*(s.end-s.start))||around.some(g=>g[targetLocale].start<gap.end&&g[targetLocale].end>gap.start)){closable=false;continue;}
      found.push({s,gap,letters:/\p{L}/u.test(target.text.slice(gap.start,gap.end)),interior:chosen.has(before.id)&&chosen.has(after.id)});
    }
    // A closed gap may hold at most three times its own length of target text (and 120 characters at least): more is a different passage, not the translation of the orphan.
    if(closable&&found.length&&found.every(f=>f.interior&&f.gap.end-f.gap.start<=Math.max(120,3*(f.s.end-f.s.start)))){
      for(const f of found){
        const at=passages.findLastIndex(p=>p.source.end<=f.s.start);
        if(at<0)continue;
        // The passage now runs over the gap on both sides, so the coverage check sees its source and its target as covered.
        const p=passages[at];p.source={start:p.source.start,end:f.s.end,text:source.text.slice(p.source.start,f.s.end)};
        if(f.letters){p.highlights=mergeSpans([...p.highlights,f.gap],target.text);p.target={...p.target,end:f.gap.end,text:target.text.slice(p.target.start,f.gap.end)};}
      }
    }else{
      const gaps:(readonly [LookupPassage,TextSpan])[]=[];
      for(const f of found){
        if(!f.letters)continue;
        gaps.push([{source:{...f.s,text:source.text.slice(f.s.start,f.s.end)},target:{...f.gap,text:target.text.slice(f.gap.start,f.gap.end),breaks:target.breaks?.filter(b=>b>f.gap.start&&b<f.gap.end)},highlights:[]},f.gap]);
        incompleteWords=true;unmatchedSource.push(f.s);
      }
      if(gaps.length){
        const merged=[...passages.map((p,i)=>[p,contexts[i]] as const),...gaps].sort((a,b)=>a[0].source.start-b[0].source.start);
        passages.splice(0,passages.length,...merged.map(m=>m[0]));contexts.splice(0,contexts.length,...merged.map(m=>m[1]));
      }
    }
  }
  if(incompleteWords){hasWords=false;for(const [i,p] of passages.entries()){const b=contexts[i];p.highlights=[];p.target={...b,text:target.text.slice(b.start,b.end),breaks:target.breaks?.filter(x=>x>b.start&&x<b.end)};}}
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
  // Two passages whose sources touch (nothing but punctuation between them) and whose targets leave a short stretch of the other edition between them that no other group claims: the stretch is the part of the counterpart
  // the pairing missed, and the passages join across it ("looked up to the heavens, and lamented:" between "she bathed … (4)," and "Forsaken by husband…").
  if(!poem&&!note&&joined.length===2&&groups.every(g=>(g.section==='story'||g.section==='critique')&&!g.tracks)){
    const [a,b]=joined,own=new Set(groups.map(g=>g.id));
    const gap={start:a.target.end,end:b.highlights.length?Math.min(b.target.end,b.highlights[0].start):b.target.start};
    const gapText=target.text.slice(gap.start,gap.end);
    if(b.target.start>=a.target.end-1&&gap.end>gap.start&&/\p{L}/u.test(gapText)&&!/\n/.test(gapText)&&!/[.!?…]\s*\p{Lu}/u.test(gapText.trim().slice(0,-1))&&gap.end-gap.start<=Math.max(160,2*(b.source.end-b.source.start))
      &&!/\p{L}/u.test(source.text.slice(a.source.end,b.source.start))&&!allGroups.some(g=>!own.has(g.id)&&g[targetLocale].start<gap.end&&g[targetLocale].end>gap.start)&&a.highlights.length&&b.highlights.length){
      a.highlights=mergeSpans([...a.highlights,{start:gap.start,end:gap.end},...b.highlights],target.text);
      a.target={start:a.target.start,end:Math.max(a.target.end,b.target.end),text:target.text.slice(a.target.start,Math.max(a.target.end,b.target.end)),breaks:target.breaks?.filter(x=>x>a.target.start&&x<Math.max(a.target.end,b.target.end))};
      a.source={start:a.source.start,end:b.source.end,text:source.text.slice(a.source.start,b.source.end)};
      joined.splice(1,1);
    }
  }
  // A whole sentence whose one counterpart passage ends in the middle of its sentence: the rest of that sentence, when no group claims it, is the part of the counterpart the pairing left out ("Thus," and "he was entirely right to petition…").
  if(!poem&&!note&&joined.length===1&&groups.every(g=>(g.section==='story'||g.section==='critique')&&!g.tracks)&&/[.!?…]["”’)]*$/u.test(request.text.trim())&&/(^|[.!?…\n]["”’)]*\s*)$/u.test(source.text.slice(Math.max(0,request.start-8),request.start))&&(request.text.match(/[\p{L}\p{M}]+/gu)?.length??0)>=4){
    const p=joined[0],text=target.text,taken=(a:number,b:number)=>allGroups.some(g=>g[targetLocale].start<b&&g[targetLocale].end>a);
    let start=p.target.start,end=p.target.end;
    {const floor=Math.max(0,start-240);let boundary=floor===0?0:-1;
      for(let k=start-1;k>=floor;k--){const c=text[k];if(c==='\n'||(/[.!?…]/.test(c)&&/^["”’)]*(?:\s|$|\p{Lu})/u.test(text.slice(k+1,k+4)))){boundary=k+1;break;}}
      if(boundary>=0){while(boundary<start&&/[\s"”’)]/.test(text[boundary]))boundary++;start=boundary;}}
    {const m=/[.!?…]+["”’)]*(?=\s|$|\p{Lu})/u.exec(text.slice(end,end+300)),nl=text.slice(end,end+300).indexOf('\n');const stop=m&&(nl<0||m.index<nl)?end+m.index+m[0].length:null;if(stop&&stop>end&&!/[.!?…]["”’)]*\s*$/u.test(text.slice(Math.max(0,end-4),end)))end=stop;}
    const lead=text.slice(start,p.target.start),trail=text.slice(p.target.end,end);
    const okLead=start===p.target.start||(/\p{L}/u.test(lead)&&!taken(start,p.target.start)&&!/\n/.test(lead)),okTrail=end===p.target.end||(/\p{L}/u.test(trail)&&!taken(p.target.end,end)&&!/\n/.test(trail));
    const size=end-start,ratio=size/Math.max(1,request.end-request.start);
    if((start!==p.target.start||end!==p.target.end)&&okLead&&okTrail&&ratio>=.4&&ratio<=2.5){
      const wholeBefore=p.highlights.length===1&&p.highlights[0].start<=p.target.start&&p.highlights[0].end>=p.target.end;
      p.target={start,end,text:text.slice(start,end),breaks:target.breaks?.filter(b=>b>start&&b<end)};
      if(wholeBefore)p.highlights=[{start,end}];
    }
  }
  return {status:hasWords?(uncertain?"uncertain":"match"):"context-only",targetLocale,targetRevision:target.revision,sourceBreaks:source.breaks?.filter(b=>b>request.start&&b<request.end),passages:joined,...(unmatchedSource.length?{unmatchedSource}:{})};
}
