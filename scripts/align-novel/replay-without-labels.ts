// usage: tsx scripts/align-novel/replay-without-labels.ts CASES DATA OUT [LOOKUP_MODULE]
// Replays selections (label_benchmark.py cases) with every `labelled` list of the groups removed first, so only the word, phrase and clause links answer.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [casesFile,dir,outFile,mod]=process.argv.slice(2);
const {lookupArtifact,validateAlignmentArtifact}=await import(pathToFileURL(path.resolve(mod??'src/lib/novel-lookup.ts')).href);
const cases=JSON.parse(fs.readFileSync(casesFile,'utf8')) as any[];
const memo=new Map<number,any>();
const art=(n:number)=>{if(!memo.has(n)){const j=JSON.parse(fs.readFileSync(path.join(dir,'chapter-'+n+'.json'),'utf8'));for(const g of [...(j.groups??[]),...(j.refinedGroups??[])])delete g.labelled;memo.set(n,validateAlignmentArtifact(j));}return memo.get(n);};
const out=cases.map(c=>{const a=art(c.chapter),l=c.locale as 'vi'|'en';
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:l,revision:a.editions[l].revision,start:c.start,end:c.end,text:c.text});
 return {id:c.id,status:r.status,highlights:r.passages.flatMap((p:any)=>p.highlights.map((h:any)=>({start:h.start,end:h.end}))),passages:r.passages.map((p:any)=>({start:p.target.start,end:p.target.end}))};});
fs.writeFileSync(outFile,JSON.stringify(out));
const c=(s:string)=>out.filter(x=>x.status===s).length;console.log(JSON.stringify({n:out.length,match:c('match'),uncertain:c('uncertain'),contextOnly:c('context-only'),unavailable:c('unavailable'),noHighlight:out.filter(x=>!x.highlights.length).length}));
