import {expect,it} from 'vitest';
import {lookupArtifact,validateAlignmentArtifact,type AlignmentArtifact} from '../src/lib/novel-lookup';

function sample(){
 const vi='Một câu gốc.\nHai câu gốc.\nMột câu dịch.\nHai câu dịch.',en='First line.\nSecond line.';
 const a:AlignmentArtifact={schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'',refinementVersion:1,
  editions:{vi:{revision:1,versionId:'00000000-0000-4000-8000-000000000001',hash:'a'.repeat(64),text:vi,breaks:[0,...[...vi.matchAll(/\n/g)].map(m=>m.index+1),vi.length]},en:{revision:1,versionId:'00000000-0000-4000-8000-000000000002',hash:'b'.repeat(64),text:en,breaks:[0,12,en.length]}},groups:[]};
 const split=vi.indexOf('Một câu dịch.');
 for(const [start,end,id,primary] of [[0,split-1,'original',false],[split,vi.length,'translation',true]] as const){
  const middle=vi.indexOf('\n',start)+1;
  for(const [from,to,es,ee,score] of [[start,middle-1,0,11,primary?.85:.99],[middle,end,12,en.length,primary?.99:.85]]){
   a.groups.push({id:id+from,section:'story',vi:{start:from,end:to},en:{start:es,end:ee},score,margin:.1,primary:{vi:true,en:primary},
    tracks:{vi:{id,start,end},en:{id:'poem',start:0,end:en.length}},links:[]});
  }
 }
 return a;
}
it('keeps a single preferred rendering when a multi-line query has competing per-line scores',()=>{
 const a=sample(),text=a.editions.en.text;
 const result=lookupArtifact(a,{chapterId:'chapter-1',locale:'en',revision:1,start:0,end:text.length,text});
 expect(result.passages.map(p=>p.target.text).join('\n')).toBe(a.editions.vi.text.slice(a.editions.vi.text.indexOf('Một câu dịch.')));
});
it('rejects malformed tracks or groups escaping their declared track',()=>{
 const a=sample();expect(()=>validateAlignmentArtifact(a)).not.toThrow();
 a.groups[0].tracks!.vi.end=1;expect(()=>validateAlignmentArtifact(a)).toThrow();
});
