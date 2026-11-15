// Stress set for the rules that answer a capitalised name the lookup left without a highlight (same name ignoring accents, Sino-Vietnamese against pinyin).
// Every capitalised name of the story text (one to three capitalised words, not at the start of a sentence; the first occurrence of each string per chapter) is looked up in both directions;
// the occurrences a rule changes are labelled from the source sentence and the returned context only, before the highlight is read.
// Usage: npx tsx scripts/align-novel/name-rule-eval.ts list ARTIFACT_DIR OCCURRENCES.json
//        npx tsx scripts/align-novel/name-rule-eval.ts replay ARTIFACT_DIR OCCURRENCES.json OUT.json   (the same selections again, e.g. on an older checkout)
import fs from "node:fs";
import {lookupArtifact,validateAlignmentArtifact,type AlignmentArtifact} from "../../src/lib/novel-lookup";
const [mode,dir,file,out]=process.argv.slice(2);
const load=(ch:number)=>validateAlignmentArtifact(JSON.parse(fs.readFileSync(dir+"/chapter-"+ch+".json","utf8")));
const run=(a:AlignmentArtifact,l:"vi"|"en",start:number,end:number)=>{
  const E:any=a.editions,o=l==="vi"?"en":"vi",r=lookupArtifact(a,{chapterId:a.chapterId,locale:l,revision:E[l].revision,start,end,text:E[l].text.slice(start,end)});
  return {status:r.status,highlights:r.passages.flatMap((p:any)=>p.highlights.map((h:any)=>E[o].text.slice(h.start,h.end))),
    context:r.passages.map((p:any)=>E[o].text.slice(p.target.start,p.target.end)).join(" … ").slice(0,900)};
};
if(mode==="list"){
  const rows:any[]=[];
  for(let ch=1;ch<=20;ch++){
    const a=load(ch),E:any=a.editions;
    for(const l of ["vi","en"] as const){
      const text:string=E[l].text,seen=new Set<string>();
      for(const m of text.matchAll(/\p{Lu}[\p{L}\p{M}'’]+(?: \p{Lu}[\p{L}\p{M}'’]+){0,2}/gu)){
        const i=m.index!,end=i+m[0].length,before=text.slice(Math.max(0,i-3),i);
        if(/(^|[.!?:"“”—\n])\s*$/u.test(before)||seen.has(m[0])||!a.groups.some(g=>g.section==="story"&&g[l].start<=i&&i<g[l].end))continue;
        seen.add(m[0]);
        const from=Math.max(text.slice(0,i).search(/[^.!?\n]*$/),i-200),mm=/[.!?\n]/.exec(text.slice(end)),to=Math.min(text.length,end+(mm?mm.index+1:240),end+240);
        rows.push({chapter:ch,dir:l,term:m[0],start:i,end,sentence:text.slice(from,to),...run(a,l,i,end)});
      }}}
  fs.writeFileSync(file,JSON.stringify(rows,null,1));console.log(rows.length,"names");
}else{
  const rows=JSON.parse(fs.readFileSync(file,"utf8")) as any[],cache=new Map<number,AlignmentArtifact>();
  fs.writeFileSync(out,JSON.stringify(rows.map(r=>{if(!cache.has(r.chapter))cache.set(r.chapter,load(r.chapter));return {...r,...run(cache.get(r.chapter)!,r.dir,r.start,r.end)};}),null,1));console.log(rows.length,"replayed");
}
