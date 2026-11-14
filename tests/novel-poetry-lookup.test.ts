import {expect,it} from 'vitest';
import {lookupArtifact,validateAlignmentArtifact,type AlignmentArtifact,type LookupRequest} from '../src/lib/novel-lookup';
function fixture():AlignmentArtifact{
 const vi='Mây núi\nMây về núi.\nMưa rơi sân.\nVăn xuôi khác.',en='Mountain Clouds\nClouds return (5).\nRain falls.\nOther prose.';
 const line=(text:string,quote:string)=>({start:text.indexOf(quote),end:text.indexOf(quote)+quote.length});
 const v=[line(vi,'Mây về núi.'),line(vi,'Mưa rơi sân.')],e=[line(en,'Clouds return (5).'),line(en,'Rain falls.')];
 return {schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'',editions:{vi:{text:vi,revision:1,versionId:'00000000-0000-4000-8000-000000000001',hash:'a'.repeat(64)},en:{text:en,revision:1,versionId:'00000000-0000-4000-8000-000000000002',hash:'b'.repeat(64)}},
  groups:[{id:'bad-word-vote',section:'story',score:.95,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[{vi:[vi.indexOf('Văn'),vi.indexOf('Văn')+3],en:[e[1].start,e[1].start+4],score:.9}]}],
  poetryScopes:{vi:v,en:e},poems:[{vi:{id:'v',start:v[0].start,end:v[1].end,lines:v,title:line(vi,'Mây núi')},en:{id:'e',start:e[0].start,end:e[1].end,lines:e,title:line(en,'Mountain Clouds')},score:.75,margin:.1,primary:{vi:true,en:true},correspondences:v.map((s,i)=>({vi:[s],en:[e[i]],score:.7,evidence:'direct-window' as const}))}]};
}
function request(a:AlignmentArtifact,quote:string):LookupRequest{const start=a.editions.en.text.indexOf(quote);return {chapterId:a.chapterId,locale:'en',revision:1,start,end:start+quote.length,text:quote};}
const targetText=(result:ReturnType<typeof lookupArtifact>)=>result.passages.map(p=>p.target.text).join('\n');
it('uses the corresponding poem line rather than unrelated high-scoring raw word votes',()=>{
 const a=fixture(),r=lookupArtifact(a,request(a,'Rain falls.'));
 expect(targetText(r)).toBe('Mưa rơi sân.');expect(r.passages[0].highlights).toHaveLength(1);expect(r.status).toBe('uncertain');
});
it.each(['Clouds return (5).','Clouds return'])('ignores a footnote marker when recognizing the complete selected line: %s',quote=>{
 const a=fixture();expect(targetText(lookupArtifact(a,request(a,quote)))).toBe('Mây về núi.');
});
it('keeps every selected line in the same rendering',()=>{
 const a=fixture(),quote=a.editions.en.text.slice(a.poems![0].en.start,a.poems![0].en.end),r=lookupArtifact(a,request(a,quote));
 expect(targetText(r)).toBe('Mây về núi.\nMưa rơi sân.');
});
it('shows only poem context when the selected line has no reliable individual correspondence',()=>{
 const a=fixture();a.poems![0].correspondences.pop();const r=lookupArtifact(a,request(a,'Rain falls.'));
 expect(r.status).toBe('context-only');expect(targetText(r)).toBe('Mây về núi.\nMưa rơi sân.');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('bounds a smaller word query to its corresponding line instead of letting it borrow prose',()=>{
 const a=fixture(),r=lookupArtifact(a,request(a,'Rain'));
 expect(targetText(r)).toBe('Mưa rơi sân.');expect(r.status).toBe('context-only');
});
it('does not use a different poem line when the selected word lacks a trusted line mapping',()=>{
 const a=fixture();a.poems![0].correspondences.pop();const rain=a.editions.en.text.indexOf('Rain');
 a.groups[0].links=[{vi:[a.poems![0].vi.lines[0].start,a.poems![0].vi.lines[0].start+3],en:[rain,rain+4],score:.9}];
 const r=lookupArtifact(a,request(a,'Rain'));expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('looks up poem titles through their actual paired title spans',()=>{
 const a=fixture();expect(targetText(lookupArtifact(a,request(a,'Mountain Clouds')))).toBe('Mây núi');
});
it('does not invent a word result for one half of a two-to-one verse correspondence',()=>{
 const a=fixture(),p=a.poems![0];p.correspondences=[{vi:p.vi.lines,en:p.en.lines,score:.7,evidence:'surrounding-window'}];
 const r=lookupArtifact(a,request(a,'Rain falls.'));expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('abstains for an explicit but unpaired poem even if prose word candidates exist',()=>{
 const a=fixture();a.poems=[];expect(lookupArtifact(a,request(a,'Rain falls.')).status).toBe('unavailable');
});
it('never advertises full-poem precision for an explicitly uncertain rendering',()=>{
 const a=fixture(),p=a.poems![0];p.contextOnly=true;
 const r=lookupArtifact(a,request(a,a.editions.en.text.slice(p.en.start,p.en.end)));
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('rejects a correspondence escaping the actual poem lines',()=>{
 const a=fixture();expect(()=>validateAlignmentArtifact(a)).not.toThrow();a.poems![0].correspondences[0].vi=[{start:0,end:999}];
 expect(()=>validateAlignmentArtifact(a)).toThrow();
});
