import {expect,it} from 'vitest';
import {lookupArtifact,validateAlignmentArtifact,type AlignmentArtifact,type TextSpan} from '../src/lib/novel-lookup';
const span=(text:string,q:string):TextSpan=>({start:text.indexOf(q),end:text.indexOf(q)+q.length});
function fixture():AlignmentArtifact{
 const vi='Lan còn nhỏ, sau khi lấy chồng, cư xử khéo với họ hàng, sống hòa thuận, được mọi người khen.',en='Though Lan was young, she married and treated her kin tactfully. She lived in harmony and was praised.';
 const v=['Lan còn nhỏ,','sau khi lấy chồng,','cư xử khéo với họ hàng,','sống hòa thuận,','được mọi người khen.'].map(q=>span(vi,q));
 const e=['Though Lan was young,','she married and treated her kin tactfully.','She lived in harmony and was praised.'].map(q=>span(en,q));
 const a:AlignmentArtifact={schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-2',createdAt:'',refinementVersion:1,editions:{vi:{text:vi,revision:1,versionId:'00000000-0000-4000-8000-000000000001',hash:'a'.repeat(64)},en:{text:en,revision:1,versionId:'00000000-0000-4000-8000-000000000002',hash:'b'.repeat(64)}},groups:[{id:'0',section:'story',score:.8,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:v,en:e},links:[{vi:[0,3],en:[7,10],score:.9},{vi:[v[1].start,v[1].start+3],en:[e[1].start,e[1].start+3],score:.9},{vi:[v[2].start,v[2].start+2],en:[e[2].start,e[2].start+3],score:.9}]}]};
 a.groups[0].clausePairs=[{vi:v.slice(0,3),en:e.slice(0,2),score:.85,margin:.12},{vi:v.slice(3),en:e.slice(2),score:.86,margin:.1}];
 return a;
}
function query(a:AlignmentArtifact,l:'vi'|'en',s:TextSpan){return lookupArtifact(a,{chapterId:a.chapterId,locale:l,revision:1,...s,text:a.editions[l].text.slice(s.start,s.end)});}
it.each(['en','vi'] as const)('keeps a many-to-many sentence counterpart without taking the next sentence: %s',l=>{
 const a=fixture(),pair=a.groups[0].clausePairs![0],s={start:pair[l][0].start,end:pair[l].at(-1)!.end},other=l==='en'?'vi':'en',r=query(a,l,s);
 const expected=a.editions[other].text.slice(pair[other][0].start,pair[other].at(-1)!.end);
 expect(r.passages.map(p=>p.target.text).join('')).toBe(expected);
 expect(r.passages.flatMap(p=>p.highlights.map(h=>a.editions[other].text.slice(h.start,h.end)))).toEqual([expected]);
});
it('does not certify an entire selected clause after finding only one name or prefix anchor',()=>{
 const a=fixture();delete a.groups[0].clausePairs;
 const r=query(a,'en',{start:0,end:a.groups[0].parts!.en[1].end});
 expect(r.status).toBe('context-only');expect(r.passages[0].target.text).toContain('cư xử khéo với họ hàng');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 expect(r.unmatchedSource?.length).toBeGreaterThan(0);
});
it('preserves an explicit mapping abstention through the source coverage wrapper',()=>{
 const a=fixture();a.groups[0].clausePairs=[];const r=query(a,'en',{start:0,end:a.groups[0].parts!.en[1].end});
 expect(r.status).toBe('context-only');expect(r.unmatchedSource?.length).toBeGreaterThan(0);expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('does not promote a partial source clause to the entire mapped sentence',()=>{
 const a=fixture(),r=query(a,'en',span(a.editions.en.text,'married'));
 expect(r.passages.flatMap(p=>p.highlights).some(s=>s.end>=a.groups[0].parts!.vi[2].end)).toBe(false);
});
it('requires the actual selection to cover the final word of a mapped sentence',()=>{
 const a=fixture(),end=a.editions.en.text.indexOf('tactfully')+'tactful'.length,r=query(a,'en',{start:0,end});
 expect(r.passages.flatMap(p=>p.highlights).some(s=>s.end===a.groups[0].parts!.vi[2].end)).toBe(false);
});
it('does not crop away unresolved content after a complete mapped sentence',()=>{
 const a=fixture(),end=a.editions.en.text.indexOf('She lived')+'She lived'.length,r=query(a,'en',{start:0,end});
 expect(r.status).toBe('context-only');expect(r.passages[0].target.text).toContain('sống hòa thuận');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('validates sentence correspondences against their group and exact retained parts',()=>{
 const a=fixture();expect(()=>validateAlignmentArtifact(a)).not.toThrow();a.groups[0].clausePairs![0].vi[0]={start:0,end:a.editions.vi.text.length+1};
 expect(()=>validateAlignmentArtifact(a)).toThrow();
});
it('rejects competing or overlapping sentence maps instead of combining their targets',()=>{
 const a=fixture();a.groups[0].clausePairs!.push(a.groups[0].clausePairs![0]);
 expect(()=>validateAlignmentArtifact(a)).toThrow();
});
it('uses a validated nested correspondence for a selected clause inside a coarser map',()=>{
 const a=fixture(),p=a.groups[0].clausePairs![0],fine={vi:[p.vi[0]],en:[p.en[0]],score:.9,margin:.1};a.groups[0].clausePairs!.push(fine);
 expect(()=>validateAlignmentArtifact(a)).not.toThrow();const r=query(a,'en',p.en[0]);
 expect(r.passages[0].target.text).toBe(a.editions.vi.text.slice(fine.vi[0].start,fine.vi[0].end));
});
it('can use coherent word evidence when an implicit subject has no literal link',()=>{
 const a=fixture(),vi='Anh đi vội, khoác áo choàng.',en='He departed rapidly, wearing a cloak.';
 const v=[span(vi,'Anh đi vội,'),span(vi,'khoác áo choàng.')],e=[span(en,'He departed rapidly,'),span(en,'wearing a cloak.')];
 a.editions.vi.text=vi;a.editions.en.text=en;a.groups=[{id:'0',section:'story',score:.9,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:v,en:e},links:[['đi','departed'],['vội','rapidly'],['khoác','wearing'],['áo choàng','cloak']].map(([v,e])=>({vi:[span(vi,v).start,span(vi,v).end],en:[span(en,e).start,span(en,e).end],score:.9}))}];
 const r=query(a,'en',e[0]);expect(r.passages[0].target.text).toBe('Anh đi vội,');expect(r.passages[0].highlights).toHaveLength(1);
});
it('retains multiple target clauses with coherent content support and no votes from the next sentence',()=>{
 const a=fixture(),vi='Lan chào hỏi, giúp đỡ họ hàng, rồi về nhà.',en='Lan greets and assists her relatives. She goes home.';
 const v=[span(vi,'Lan chào hỏi,'),span(vi,'giúp đỡ họ hàng,'),span(vi,'rồi về nhà.')],e=[span(en,'Lan greets and assists her relatives.'),span(en,'She goes home.')];
 a.editions.vi.text=vi;a.editions.en.text=en;a.groups=[{id:'0',section:'story',score:.9,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:v,en:e},links:[['Lan','Lan'],['chào','greets'],['giúp','assists'],['họ hàng','relatives'],['về','goes'],['nhà','home']].map(([v,e])=>({vi:[span(vi,v).start,span(vi,v).end],en:[span(en,e).start,span(en,e).end],score:.9}))}];
 const r=query(a,'en',e[0]);expect(r.passages[0].target.text).toBe('Lan chào hỏi, giúp đỡ họ hàng,');expect(r.passages[0].highlights).toHaveLength(1);
});
it('cannot use a broader group sentence map to escape a paired note scope',()=>{
 const vi='(1) Người tốt.\n(2) Người khác.',en='(1) A good person.\n(2) Another person.',a=fixture();
 a.editions.vi={...a.editions.vi,text:vi,breaks:[vi.indexOf('(2)')]};a.editions.en={...a.editions.en,text:en,breaks:[en.indexOf('(2)')]};
 const v=span(vi,'(1) Người tốt.'),e=span(en,'(1) A good person.');a.notePairs=[{vi:v,en:e,score:.95,margin:.1}];
 a.groups=[{id:'notes',section:'notes',score:.95,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[],clausePairs:[{vi:[span(vi,'(2) Người khác.')],en:[e],score:.9,margin:.1}]}];
 const r=query(a,'en',e);expect(r.passages.every(p=>p.target.end<=v.end)).toBe(true);expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('trusts a flagged residual pair at its lower floor but never an unflagged pair at that score',()=>{
 const a=fixture(),pair=a.groups[0].clausePairs![0],whole={start:pair.en[0].start,end:pair.en.at(-1)!.end},expected=a.editions.vi.text.slice(pair.vi[0].start,pair.vi.at(-1)!.end);
 a.groups[0].clausePairs=[{...pair,score:.45,margin:.1,residual:true}];
 expect(query(a,'en',whole).passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).toEqual([expected]);
 a.groups[0].clausePairs=[{...pair,score:.45,margin:.1}];
 expect(query(a,'en',whole).passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).not.toEqual([expected]);
 a.groups[0].clausePairs=[{...pair,score:.35,margin:.1,residual:true}];
 expect(query(a,'en',whole).passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).not.toEqual([expected]);
});
it('rejects a residual flag that is not a boolean',()=>{
 const a=fixture();(a.groups[0].clausePairs![0] as {residual?:unknown}).residual='yes';
 expect(()=>validateAlignmentArtifact(a)).toThrow();
});
function sentences():AlignmentArtifact{
 const vi='Vi một, vi hai. Vi ba, vi bốn. Vi năm, vi sáu.',en='En one, en two. En three, en four. En five, en six.';
 const v=['Vi một,','vi hai.','Vi ba,','vi bốn.','Vi năm,','vi sáu.'].map(q=>span(vi,q)),e=['En one,','en two.','En three,','en four.','En five,','en six.'].map(q=>span(en,q));
 const a=fixture();a.editions.vi.text=vi;a.editions.en.text=en;
 a.groups=[{id:'0',section:'story',score:.9,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:v,en:e},links:[],clausePairs:[{vi:v.slice(0,2),en:e.slice(0,2),score:.8,margin:.2},{vi:v.slice(4),en:e.slice(4),score:.8,margin:.2}]}];
 return a;
}
it('keeps the context at the gap between trusted pairs when a middle sentence has no counterpart yet',()=>{
 const a=sentences(),r=query(a,'en',{start:0,end:a.groups[0].parts!.en[3].end});
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 const context=r.passages.map(p=>p.target.text).join(' ');
 expect(context).toContain('Vi một');expect(context).toContain('vi bốn');expect(context).not.toContain('Vi năm');
 expect(r.unmatchedSource?.length).toBeGreaterThan(0);
});
it('falls back to the whole group when no trusted pair bounds the unresolved sentence',()=>{
 const a=sentences();a.groups[0].clausePairs=[];const r=query(a,'en',{start:0,end:a.groups[0].parts!.en[3].end});
 expect(r.passages.map(p=>p.target.text).join(' ')).toContain('vi sáu');
});
it('keeps an uncertain highlight when most content of a phrase inside one sentence is anchored',()=>{
 const vi='Xoay thế thiên hạ ở trí chứ không phải ở sức.',en='Turning the realm depends on wisdom not brute strength.',a=fixture();
 a.editions.vi.text=vi;a.editions.en.text=en;delete a.groups[0].clausePairs;
 const links=[['không phải','not'],['sức','brute'],['sức','strength'],['Xoay','Turning'],['thế thiên hạ','realm']].map(([v,e])=>({vi:[span(vi,v).start,span(vi,v).end] as [number,number],en:[span(en,e).start,span(en,e).end] as [number,number],score:.9}));
 a.groups=[{id:'0',section:'story',score:.9,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:[{start:0,end:vi.length}],en:[{start:0,end:en.length}]},links}];
 const r=query(a,'en',span(en,'wisdom not brute strength'));
 expect(r.status).toBe('uncertain');expect(r.passages.flatMap(p=>p.highlights)).not.toEqual([]);
 const mostlyMissing=query(a,'en',span(en,'depends on wisdom not brute'));
 expect(mostlyMissing.passages.flatMap(p=>p.highlights).length===0||mostlyMissing.status!=='match').toBe(true);
});
