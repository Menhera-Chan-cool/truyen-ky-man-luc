// Stress set for the footnote-term dictionary. Every story occurrence of a headword term of a chapter's own notes, in both directions, is looked up and recorded
// with its sentence, the context the lookup returned and the highlights; the rule is judged on the occurrences it changes, which are labelled by reading
// the source sentence and the context only (never the highlight): is the other headword the counterpart of the term at this place?
// Usage: npx tsx scripts/align-novel/note-term-eval.ts list ARTIFACT_DIR OCCURRENCES.json   (enumerate and look up with the current code)
//        npx tsx scripts/align-novel/note-term-eval.ts replay ARTIFACT_DIR OCCURRENCES.json OUT.json   (look up the same occurrences again, e.g. on an older checkout)
import fs from "node:fs";
import {lookupArtifact,validateAlignmentArtifact,noteTermsOf,type AlignmentArtifact} from "../../src/lib/novel-lookup";
const [mode,dir,file,out]=process.argv.slice(2);
const load=(ch:number)=>validateAlignmentArtifact(JSON.parse(fs.readFileSync(dir+"/chapter-"+ch+".json","utf8")));
const run=(a:AlignmentArtifact,l:"vi"|"en",start:number,end:number)=>{
  const E:any=a.editions,o=l==="vi"?"en":"vi",r=lookupArtifact(a,{chapterId:a.chapterId,locale:l,revision:E[l].revision,start,end,text:E[l].text.slice(start,end)});
  return {status:r.status,highlights:r.passages.flatMap((p:any)=>p.highlights.map((h:any)=>E[o].text.slice(h.start,h.end))),
    context:r.passages.map((p:any)=>E[o].text.slice(p.target.start,p.target.end)).join(" … ").slice(0,700)};
};
if(mode==="list"){
  const rows:any[]=[];
  for(let ch=1;ch<=20;ch++){
    const a=load(ch),E:any=a.editions;
    for(const t of noteTermsOf(a))for(const l of ["vi","en"] as const){
      const term=t[l],want=t[l==="vi"?"en":"vi"],text:string=E[l].text,low=text.toLowerCase();
      for(let i=low.indexOf(term.toLowerCase());i>=0;i=low.indexOf(term.toLowerCase(),i+1)){
        const end=i+term.length;if(/[\p{L}\p{N}]/u.test(text[i-1]??"")||/[\p{L}\p{N}]/u.test(text[end]??""))continue;
        if(!a.groups.some(g=>g.section==="story"&&g[l].start<=i&&i<g[l].end))continue;
        const from=Math.max(text.slice(0,i).search(/[^.!?\n]*$/),i-220),to=(()=>{const m=/[.!?\n]/.exec(text.slice(end));return Math.min(text.length,end+(m?m.index+1:250),end+260);})();
        rows.push({chapter:ch,dir:l,term:text.slice(i,end),want,start:i,end,atMarker:/^\s?\(\d{1,3}\)/.test(text.slice(end)),sentence:text.slice(from,to),...run(a,l,i,end)});
      }}}
  fs.writeFileSync(file,JSON.stringify(rows,null,1));console.log(rows.length,"occurrences");
}else{
  const rows=JSON.parse(fs.readFileSync(file,"utf8")) as any[],cache=new Map<number,AlignmentArtifact>();
  const res=rows.map(r=>{if(!cache.has(r.chapter))cache.set(r.chapter,load(r.chapter));return {...r,...run(cache.get(r.chapter)!,r.dir,r.start,r.end)};});
  fs.writeFileSync(out,JSON.stringify(res,null,1));console.log(res.length,"replayed");
}
