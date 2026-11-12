import type {Locale} from "./types";
export const alignmentCodec = "reader-dom-1";
export type TextSpan = {start:number;end:number};
export type AlignmentArtifact = {
  schema:1;codec:string;algorithm:string;chapterId:string;createdAt:string;
  editions:Record<Locale,{revision:number;versionId:string;hash:string;text:string;words?:TextSpan[];breaks?:number[]}>;
  groups:{id:string;section:string;vi:TextSpan;en:TextSpan;score:number;margin:number;primary?:Record<Locale,boolean>;
    links:{vi:[number,number];en:[number,number];score:number}[]}[];
};
export type LookupRequest = {chapterId:string;locale:Locale;revision:number;start:number;end:number;text:string};
export type LookupPassage = {source:TextSpan&{text:string};target:TextSpan&{text:string;breaks?:number[]};highlights:TextSpan[]};
export type ComparisonFocus = Record<Locale,TextSpan&{text:string;revision:number}>;
export type LookupResult = {status:"match"|"uncertain"|"context-only"|"unavailable"|"stale"|"pending"|"missing";
  targetLocale:Locale;targetRevision?:number;passages:LookupPassage[]};

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
  for(const g of a.groups){
    if(!g||!valid(g.vi,a.editions.vi.text)||!valid(g.en,a.editions.en.text)||!Number.isFinite(g.score)||!Number.isFinite(g.margin)||!Array.isArray(g.links)||g.links.length>100000)invalid();
    for(const link of g.links){
      if(!link||!Number.isFinite(link.score)||link.score<0||link.score>1.001)invalid();
      for(const l of ["vi","en"] as const){
        const span=link[l];
        if(!Array.isArray(span)||span.length!==2||!valid({start:span[0],end:span[1]},a.editions[l].text)||span[0]<g[l].start||span[1]>g[l].end)invalid();
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
export function lookupArtifact(artifact:AlignmentArtifact,request:LookupRequest):LookupResult {
  const locale=request.locale,targetLocale=locale==="vi"?"en":"vi",source=artifact.editions[locale],target=artifact.editions[targetLocale];
  const empty=(status:LookupResult["status"]):LookupResult=>({status,targetLocale,passages:[]});
  if(artifact.chapterId!==request.chapterId||source.revision!==request.revision||request.start<0||request.end<=request.start||request.end>source.text.length||source.text.slice(request.start,request.end)!==request.text)return empty("stale");
  if(request.end-request.start>2000)throw RangeError("Selection too long");
  const rank=(g:AlignmentArtifact['groups'][number])=>g.score-.03*Math.log1p(g[locale].end-g[locale].start)-(g.primary?.[locale]===false ? .1 : 0);
  const candidates=artifact.groups.filter(g=>g[locale].start<request.end&&g[locale].end>request.start).sort((a,b)=>rank(b)-rank(a));
  let remaining:TextSpan[]=[{start:request.start,end:request.end}];
  const groups:AlignmentArtifact['groups']=[];
  for(const g of candidates){
    if(!remaining.some(s=>s.start<g[locale].end&&s.end>g[locale].start))continue;
    groups.push(g);
    remaining=remaining.flatMap(s=>s.end<=g[locale].start||s.start>=g[locale].end?[s]:[
      ...(s.start<g[locale].start?[{start:s.start,end:g[locale].start}]:[]),
      ...(s.end>g[locale].end?[{start:g[locale].end,end:s.end}]:[]),
    ]);
  }
  groups.sort((a,b)=>a[locale].start-b[locale].start);
  if(groups.length>5)throw RangeError("Select at most five sentence groups");
  if(!groups.length)return empty("unavailable");
  let uncertain=remaining.some(s=>source.text.slice(s.start,s.end).trim()),hasWords=false;
  const passages:LookupPassage[]=[];
  for(const g of groups){
    let spans:TextSpan[]=[];
    const named=properNameSpan(request.text,target.text,g[targetLocale]);
    if(named)spans=[named];
    else if(request.end-request.start>=(g[locale].end-g[locale].start)*.6)spans=[g[targetLocale]];
    else {
      const words=new Map<string,Map<string,{span:TextSpan;score:number}>>();
      for(const link of g.links){
        const from=link[locale],to=link[targetLocale];
        if(from[0]>=request.end||from[1]<=request.start||!/[\p{L}\p{N}]/u.test(target.text.slice(...to)))continue;
        const sw=wordSpan(source.text,...from,g[locale],source.words),tw=wordSpan(target.text,...to,g[targetLocale],target.words);
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
    const highlights=mergeSpans(spans,target.text);hasWords ||= highlights.length>0;
    uncertain ||= g.score<.82||g.margin<.015;
    passages.push({source:{...g[locale],text:source.text.slice(g[locale].start,g[locale].end)},target:{...g[targetLocale],text:target.text.slice(g[targetLocale].start,g[targetLocale].end),breaks:target.breaks?.filter(p=>p>g[targetLocale].start&&p<g[targetLocale].end)},highlights});
  }
  return {status:hasWords?(uncertain?"uncertain":"match"):"context-only",targetLocale,targetRevision:target.revision,passages};
}
