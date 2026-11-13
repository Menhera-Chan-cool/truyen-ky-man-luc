import fs from "node:fs/promises";
import path from "node:path";
import {lookupArtifact,validateAlignmentArtifact,type TextSpan,type AlignmentArtifact} from "../../src/lib/novel-lookup";
import type {Locale} from "../../src/lib/types";

const [directory,output]=process.argv.slice(2);if(!directory||!output)throw Error('Usage: evaluate.ts ARTIFACT_DIR REPORT.json');
const pairs=JSON.parse(await fs.readFile(new URL('./evaluation.json',import.meta.url),'utf8')) as [string,string,string,string][];
type EvaluationRow={chapter:string;kind:string;locale:Locale;quote:string;expected:string;status:string;predicted:string[];context:string[];precision:number;recall:number;f1:number;hit:boolean};
const artifacts=new Map<string,AlignmentArtifact>();const rows:EvaluationRow[]=[];
function locate(text:string,quote:string){
 let from=0,at:number;
 while((at=text.indexOf(quote,from))>=0){
  const left=at?text[at-1]:"",right=text[at+quote.length]??"";
  if(!(/[\p{L}\p{N}]/u.test(quote[0])&&/[\p{L}\p{M}\p{N}]/u.test(left))&&!(/[\p{L}\p{N}]/u.test(quote.at(-1)!)&&/[\p{L}\p{M}\p{N}]/u.test(right)))return at;
  from=at+1;
 }
 return -1;
}
for(const [chapter,kind,vi,en]of pairs){
 if(!artifacts.has(chapter))artifacts.set(chapter,validateAlignmentArtifact(JSON.parse(await fs.readFile(path.join(directory,chapter+'.json'),'utf8'))));
 const artifact=artifacts.get(chapter)!;
 for(const locale of ['vi','en'] as Locale[]){
  const quote=locale==='vi'?vi:en,expected=locale==='vi'?en:vi,target=locale==='vi'?'en':'vi';
  const sourceText=artifact.editions[locale].text,targetText=artifact.editions[target].text;
  const start=locate(sourceText,quote),at=locate(targetText,expected);
  if(start<0||at<0)throw Error('Gold quote missing: '+JSON.stringify({chapter,locale,quote,expected}));
  const result=lookupArtifact(artifact,{chapterId:chapter,locale,revision:artifact.editions[locale].revision,start,end:start+quote.length,text:quote});
  const gt={start:at,end:at+expected.length};
  const overlap=(s:TextSpan)=>Math.max(0,Math.min(s.end,gt.end)-Math.max(s.start,gt.start));
  const spans=result.passages.flatMap(p=>p.highlights);
  const hit=spans.reduce((n,s)=>n+overlap(s),0),total=spans.reduce((n,s)=>n+s.end-s.start,0);
  const precision=total?hit/total:0,recall=hit/expected.length,f1=precision+recall?2*precision*recall/(precision+recall):0;
  rows.push({chapter,kind,locale,quote,expected,status:result.status,predicted:spans.map(s=>targetText.slice(s.start,s.end)),context:result.passages.map(p=>p.target.text),precision,recall,f1,hit:f1>=.5});
 }
}
const summary=Object.fromEntries(['word','phrase','sentence'].map(kind=>{const set=rows.filter(r=>r.kind===kind);return [kind,{cases:set.length,hits:set.filter(r=>r.hit).length,meanF1:set.reduce((n,r)=>n+r.f1,0)/set.length,coverage:set.filter(r=>r.predicted.length).length/set.length}];}));
await fs.writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
