import {expect,it} from 'vitest';
import {lookupArtifact,validateAlignmentArtifact,type AlignmentArtifact,type TextSpan} from '../src/lib/novel-lookup';
import {partialKept,partialRule} from '../src/lib/novel-lookup-selection';
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
 // the sentence found is highlighted (partial answer); the passage still runs over the counterpart of the words that were not found
 expect(r.status).toBe('uncertain');expect(r.partial).toBe(true);expect(r.passages[0].target.text).toContain('sống hòa thuận');
 expect(r.passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).toEqual(['Lan còn nhỏ, sau khi lấy chồng, cư xử khéo với họ hàng,']);expect(r.unmatchedSource?.length).toBe(1);
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
it('closes the gap between trusted pairs with an uncertain highlight when the sentence counts agree',()=>{
 const a=sentences(),r=query(a,'en',{start:0,end:a.groups[0].parts!.en[3].end});
 const context=r.passages.map(p=>p.target.text).join(' ');
 expect(context).toContain('Vi một');expect(context).toContain('vi bốn');expect(context).not.toContain('Vi năm');
 expect(r.status).toBe('uncertain');expect(r.passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).toEqual([context.trim()]);
 expect(r.unmatchedSource).toBeUndefined();
});
it('keeps the context only when the selection ends inside a sentence of the gap',()=>{
 const a=sentences(),r=query(a,'en',{start:0,end:a.groups[0].parts!.en[2].end});
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);expect(r.unmatchedSource?.length).toBeGreaterThan(0);
});
it('keeps the context only when the counterpart passage holds more sentences than the selection',()=>{
 const a=sentences(),vi='Vi một, vi hai. Vi ba. Vi bốn. Vi năm, vi sáu.',v=['Vi một,','vi hai.','Vi ba.','Vi bốn.','Vi năm,','vi sáu.'].map(q=>span(vi,q)),g=a.groups[0];
 a.editions.vi.text=vi;a.groups[0]={...g,vi:{start:0,end:vi.length},parts:{vi:v,en:g.parts!.en},clausePairs:[{vi:v.slice(0,2),en:g.parts!.en.slice(0,2),score:.8,margin:.2},{vi:v.slice(4),en:g.parts!.en.slice(4),score:.8,margin:.2}]};
 const r=query(a,'en',{start:0,end:g.parts!.en[3].end});
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);expect(r.unmatchedSource?.length).toBeGreaterThan(0);
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
function plain(vi:string,en:string,parts:{vi:string[];en:string[]},links:[string,string][],pairs?:[string[],string[]][]):AlignmentArtifact{
 const a=fixture();a.editions.vi.text=vi;a.editions.en.text=en;
 const group:AlignmentArtifact['groups'][number]={id:'0',section:'story',score:.9,margin:.1,vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:parts.vi.map(q=>span(vi,q)),en:parts.en.map(q=>span(en,q))},
  links:links.map(([v,e])=>({vi:[span(vi,v).start,span(vi,v).end] as [number,number],en:[span(en,e).start,span(en,e).end] as [number,number],score:.9}))};
 if(pairs)group.clausePairs=pairs.map(([v,e])=>({vi:v.map(q=>span(vi,q)),en:e.map(q=>span(en,q)),score:.8,margin:.2}));
 a.groups=[group];delete a.refinedGroups;return a;
}
it('does not certify a clause when the negation has no counterpart',()=>{
 const en='He did not heed her, but he respected her.',vi='Chàng nghe lời nàng, nhưng vẫn kính trọng nàng.';
 const a=plain(vi,en,{vi:['Chàng nghe lời nàng,','nhưng vẫn kính trọng nàng.'],en:['He did not heed her,','but he respected her.']},[['Chàng','He'],['nghe','heed'],['nàng','her'],['nhưng','but'],['kính trọng','respected']]);
 const r=query(a,'en',span(en,'He did not heed her,'));
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);expect(r.unmatchedSource?.length).toBeGreaterThan(0);
});
it('keeps a repeated sentence at the occurrence that was selected',()=>{
 const vi='Anh đi. Rồi nghỉ. Anh đi. Rồi về.',en='He goes. Then rests. He goes. Then returns.';
 const spans=(text:string,quotes:string[])=>{let at=0;return quotes.map(q=>{const start=text.indexOf(q,at);at=start+q.length;return {start,end:start+q.length};});};
 const vp=spans(vi,['Anh đi.','Rồi nghỉ.','Anh đi.','Rồi về.']),ep=spans(en,['He goes.','Then rests.','He goes.','Then returns.']);
 const a=plain(vi,en,{vi:[vi],en:[en]},[]);
 a.groups[0].parts={vi:vp,en:ep};a.groups[0].clausePairs=vp.map((v,i)=>({vi:[v],en:[ep[i]],score:.8,margin:.2}));
 const r=query(a,'en',ep[2]);
 expect(r.passages.flatMap(p=>p.highlights)).toEqual([vp[2]]);
});
it('treats a note marker as no evidence by itself and ignores it inside a selected sentence',()=>{
 const vi='Họ mong kết duyên Châu Trần (3) từ xưa.',en='They hoped to marry as the Zhu and Chen clans(3) of old.';
 const a=plain(vi,en,{vi:[vi],en:[en]},[['Họ','They']]);a.groups[0].clausePairs=[{vi:[span(vi,vi)],en:[span(en,en)],score:.8,margin:.2}];
 const marker=span(en,'(3)'),alone=query(a,'en',marker);
 expect(alone.passages.flatMap(p=>p.highlights)).toEqual([]);
 const whole=query(a,'en',span(en,en));
 expect(whole.passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).toEqual([vi]);
});
function phraseFixture(){
 const en='Even flute-players and mat-weavers (14) can achieve success;',vi='thổi kèn, dệt chiếu (14) cũng đủ để thành công;';
 const a=plain(vi,en,{vi:[vi],en:[en]},[]),e=span(en,'flute-players and mat-weavers'),v=span(vi,'thổi kèn, dệt chiếu');
 a.groups[0].phrasePairs=[{en:e,vi:v,score:.7,margin:.2,from:'en'},{en:e,vi:v,score:.7,margin:.2,from:'vi'}];
 return {a,en,vi,e,v};
}
it('answers an exact phrase from its phrase pair as an uncertain suggestion, ignoring edge punctuation and a note marker',()=>{
 const {a,e,v,en}=phraseFixture();
 for(const s of [e,{start:e.start,end:e.end+' (14)'.length},{start:e.start-1,end:e.end}]){
  const r=query(a,'en',s);expect(r.status).toBe('uncertain');expect(r.passages.flatMap(p=>p.highlights)).toEqual([v]);
 }
 expect(en.slice(e.start,e.end)).toBe('flute-players and mat-weavers');
});
it('uses the phrase pair of the direction that was asked and nothing for a selection inside its window',()=>{
 const {a,e,v}=phraseFixture();
 const reverse=query(a,'vi',v);expect(reverse.passages.flatMap(p=>p.highlights)).toEqual([e]);
 a.groups[0].phrasePairs=a.groups[0].phrasePairs!.filter(p=>p.from==='en');
 expect(query(a,'vi',v).passages.flatMap(p=>p.highlights)).not.toEqual([e]);
 const inside=query(a,'en',span(a.editions.en.text,'mat-weavers'));
 expect(inside.passages.flatMap(p=>p.highlights)).not.toEqual([v]);
});
it('abstains when two phrase pairs give different counterparts for the same window',()=>{
 const {a,e,v}=phraseFixture(),other=span(a.editions.vi.text,'dệt chiếu');
 a.groups[0].phrasePairs!.push({en:e,vi:other,score:.69,margin:.2,from:'en'});
 expect(query(a,'en',e).passages.flatMap(p=>p.highlights)).not.toEqual([v]);
});
it('rejects phrase pairs that leave their group or carry a bad score',()=>{
 const {a}=phraseFixture();expect(()=>validateAlignmentArtifact(a)).not.toThrow();
 const outside=phraseFixture().a;outside.groups[0].phrasePairs![0].vi={start:0,end:outside.editions.vi.text.length+1};
 expect(()=>validateAlignmentArtifact(outside)).toThrow();
 const bad=phraseFixture().a;bad.groups[0].phrasePairs![0].score=Number.NaN;expect(()=>validateAlignmentArtifact(bad)).toThrow();
});
it('replaces word links that miss a strong exact phrase pair entirely, but not links that overlap it',()=>{
 const {a,en,vi,e,v}=phraseFixture(),wrong=span(vi,'thành công');
 a.groups[0].links=[{vi:[wrong.start,wrong.end],en:[e.start,e.start+'flute-players'.length],score:.9},{vi:[wrong.start,wrong.end],en:[en.indexOf('mat-weavers'),en.indexOf('mat-weavers')+'mat-weavers'.length],score:.9}];
 const r=query(a,'en',e);expect(r.passages.flatMap(p=>p.highlights)).toEqual([v]);expect(r.status).toBe('uncertain');
 a.groups[0].links=[{vi:[v.start,v.start+'thổi'.length],en:[e.start,e.start+'flute-players'.length],score:.9},{vi:[v.start+'thổi kèn, '.length,v.end],en:[en.indexOf('mat-weavers'),en.indexOf('mat-weavers')+'mat-weavers'.length],score:.9}];
 const wide=span(vi,'thổi kèn, dệt chiếu (14) cũng đủ');a.groups[0].phrasePairs=a.groups[0].phrasePairs!.map(p=>({...p,vi:wide}));
 expect(query(a,'en',e).passages.flatMap(p=>p.highlights)).not.toEqual([wide]);
});
it('keeps good word links instead of a longer phrase pair that would widen them',()=>{
 const en='With words like flowers and thoughts like brocade.',vi='Lời hoa ý gấm.',a=plain(vi,en,{vi:[vi],en:[en]},[['Lời','words'],['hoa','flowers'],['gấm','brocade']]);
 const q=span(en,'words like flowers');
 a.groups[0].phrasePairs=[{en:q,vi:span(vi,'Lời hoa ý gấm'),score:.7,margin:.2,from:'en'}];
 const r=query(a,'en',q);expect(r.passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)))).not.toContain('Lời hoa ý gấm');
});
function gapFixture(){
 const vi='Lan còn nhỏ. Chồng nàng đi xa lắm. Nàng ở nhà.',en='Lan was young. Her husband went far away. She stayed home.';
 const group=(id:string,v:string,e:string):AlignmentArtifact['groups'][number]=>({id,section:'story',score:.8,margin:.1,vi:span(vi,v),en:span(en,e),parts:{vi:[span(vi,v)],en:[span(en,e)]},links:[]});
 const a=fixture();a.editions.vi.text=vi;a.editions.en.text=en;a.groups=[group('a','Lan còn nhỏ.','Lan was young.'),group('b','Nàng ở nhà.','She stayed home.')];
 return a;
}
it('highlights the target text between the neighbouring groups, uncertain, when it holds as many sentences as the part of the selection that lies in no group',()=>{
 const a=gapFixture(),r=query(a,'vi',{start:a.editions.vi.text.indexOf('Chồng'),end:a.editions.vi.text.length});
 expect(r.status).toBe('uncertain');expect(r.unmatchedSource).toBeUndefined();
 expect(r.passages.flatMap(p=>p.highlights.map(h=>a.editions.en.text.slice(h.start,h.end)))).toEqual(['Her husband went far away. She stayed home.']);
});
it('returns the target text between the neighbouring groups as context when it holds more sentences than the part of the selection that lies in no group',()=>{
 const a=gapFixture(),en='Lan was young. Her husband went far away. He never wrote. She stayed home.',[first,second]=a.groups;
 a.editions.en.text=en;a.groups=[{...first,en:span(en,'Lan was young.'),parts:{vi:first.parts!.vi,en:[span(en,'Lan was young.')]}},{...second,en:span(en,'She stayed home.'),parts:{vi:second.parts!.vi,en:[span(en,'She stayed home.')]}}];
 const r=query(a,'vi',{start:a.editions.vi.text.indexOf('Chồng'),end:a.editions.vi.text.length});
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 expect(r.unmatchedSource?.map(s=>a.editions.vi.text.slice(s.start,s.end).trim())).toContain('Chồng nàng đi xa lắm.');
 expect(r.passages.some(p=>p.target.text.includes('Her husband went far away.'))).toBe(true);
});
it('gives the target text between two groups as context for a selection that lies in no group',()=>{
 const a=gapFixture(),vi=a.editions.vi.text,r=query(a,'vi',span(vi,'Chồng nàng đi xa lắm'));
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 expect(r.passages.map(p=>p.target.text).join(' ')).toContain('Her husband went far away.');
});
it('falls back to both neighbouring groups when their target texts touch and nothing lies between them',()=>{
 const a=gapFixture(),en=a.editions.en.text,from=en.indexOf('Her husband');
 a.groups[1]={...a.groups[1],en:{start:from,end:en.length},parts:{vi:a.groups[1].parts!.vi,en:[{start:from,end:en.length}]}};
 const r=query(a,'vi',span(a.editions.vi.text,'Chồng nàng đi xa lắm')),text=r.passages.map(p=>p.target.text).join(' ');
 expect(r.status).toBe('context-only');expect(text).toContain('Lan was young.');expect(text).toContain('She stayed home.');
});
it('answers a selection that runs over a group, an orphan clause and a group by highlighting across the orphan',()=>{
 const a=gapFixture(),r=query(a,'vi',{start:0,end:a.editions.vi.text.length});
 expect(r.status).toBe('uncertain');expect(r.unmatchedSource).toBeUndefined();
 const en=a.editions.en.text,hl=r.passages.flatMap(p=>p.highlights);
 expect(hl).toEqual([{start:0,end:en.length}]);
});
it('joins the pieces of a phrase answer across a short unclaimed gap but not across a sentence break',()=>{
 const run=(en:string)=>{
  const vi='Nàng gieo mình xuống sông.',a=plain(vi,en,{vi:[vi],en:[en]},[['gieo','cast'],['mình','herself'],['xuống','into'],['sông','river']]);
  return query(a,'vi',span(vi,'gieo mình xuống sông')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run('She cast herself into the river.')).toEqual(['cast herself into the river']);
 expect(run('She cast herself into. The river.')).toHaveLength(2);
});
it('extends a phrase answer over the target word of an unlinked edge word unless a non-adjacent word holds it',()=>{
 const run=(vi:string,en:string,held:string)=>{
  const a=plain(vi,en,{vi:[vi],en:[en]},[['liếc','glanced'],['rồi','then'],[held,'smiled']]);
  return query(a,'vi',span(vi,'liếc rồi mỉm')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run('Viên liếc rồi mỉm cười.','Vien glanced then smiled.','cười')).toEqual(['glanced then smiled']);
 expect(run('Viên liếc rồi mỉm cười lớn.','Vien glanced then smiled.','lớn')).toEqual(['glanced then']);
});
it('joins phrase pieces across words held by a source word at most one word beside the selection, but not by a farther one',()=>{
 const run=(en:string,held:string)=>{
  const vi='Họ làm ác cũng không dám.',a=plain(vi,en,{vi:[vi],en:[en]},[['làm','do'],['ác','evil'],['dám','dare'],['cũng','even'],['không',held]]);
  return query(a,'en',span(en,'dare to do evil')).passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)));
 };
 expect(run('They would not dare to do evil even so.','not')).toEqual(['làm ác cũng không dám']);
 expect(run('They said no and would dare to do evil even so.','no')).toHaveLength(2);
});
it('completes a coordinated pair with a weak link to the content word beside the kept target, but only across a connector',()=>{
 const run=(en:string,last:string)=>{
  const vi='Trời sáng sủa.',a=plain(vi,en,{vi:[vi],en:[en]},[['Trời','sky'],['sáng sủa','bright']]);
  a.groups[0].links.push({vi:[span(vi,'sáng sủa').start,span(vi,'sáng sủa').end],en:[span(en,last).start,span(en,last).end],score:.04});
  return query(a,'vi',span(vi,'sáng sủa')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run('The sky was bright and clear.','clear')).toEqual(['bright and clear']);
 expect(run('The sky was bright clear.','clear')).toEqual(['bright']);
});
it('completes a link answer with the exact phrase pair when a selected word has no link, only if the pair holds the whole answer',()=>{
 const en='In the reign of Emperor Minh Tong of the Tran dynasty,',vi='Về đời vua Minh Tông nhà Trần,';
 const make=(pairVi:string)=>{
  const a=plain(vi,en,{vi:[vi],en:[en]},[['Minh','Minh'],['Tông','Tong'],['nhà','of']]),q=span(en,'Minh Tong of the Tran');
  a.groups[0].phrasePairs=[{en:q,vi:span(vi,pairVi),score:.87,margin:.6,from:'en'}];
  return query(a,'en',q).passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)));
 };
 expect(make('Minh Tông nhà Trần')).toEqual(['Minh Tông nhà Trần']);
 expect(make('Tông nhà Trần')).not.toEqual(['Tông nhà Trần']);
});
it('widens a link target with the phrase pair of its one source word by content words no other link claims, never by function words alone',()=>{
 const run=(vi:string,pairVi:string)=>{
  const en='He told everyone the news.',a=plain(vi,en,{vi:[vi],en:[en]},[['kể','told'],['mọi','everyone']]),q=span(en,'told everyone');
  a.groups[0].phrasePairs=[{en:span(en,'everyone'),vi:span(vi,pairVi),score:.94,margin:.33,from:'en'}];
  return query(a,'en',q).passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)));
 };
 expect(run('Chàng kể cho mọi người nghe.','mọi người')).toEqual(['kể cho mọi người']);
 expect(run('Chàng kể cho mọi và nghe.','mọi và')).toEqual(['kể cho mọi']);
});
it('answers a lone word from the words of a small strong phrase pair that its crossed link misses, and leaves it alone when the pair is weak',()=>{
 const run=(score:number)=>{
  const en='He goes hunting bears and chasing hares.',vi='Chàng săn gấu bắt thỏ.',a=plain(vi,en,{vi:[vi],en:[en]},[['săn','hunting'],['gấu','hares'],['bắt','chasing'],['thỏ','bears']]);
  a.groups[0].phrasePairs=[{vi:span(vi,'săn gấu'),en:span(en,'hunting bears'),score,margin:.19,from:'en'}];
  return query(a,'vi',span(vi,'gấu')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run(.88)).toEqual(['bears']);
 expect(run(.5)).toEqual(['hares']);
});
it('lets the raw link pieces decide only when the whole words leave nothing of the pair for the selected word',()=>{
 const en='He goes hunting bears and chasing hares.',vi='Chàng săn gấu bắt thỏ.',a=plain(vi,en,{vi:[vi],en:[en]},[['săn','hunting'],['bắt','chasing'],['thỏ','bears']]);
 // the segmenter reads "săn gấu" as one word, so the whole word "săn gấu" is taken by the link of "hunting"
 a.editions.vi.words=['Chàng','săn gấu','bắt','thỏ'].map(w=>span(vi,w));
 a.groups[0].phrasePairs=[{vi:span(vi,'săn gấu'),en:span(en,'hunting bears'),score:.88,margin:.19,from:'en'}];
 expect(query(a,'en',span(en,'bears')).passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)))).toEqual(['gấu']);
});
it('withdraws the highlight of a lone word whose target belongs to a strong pair with a swapped word, and keeps it when no word of the pair escapes',()=>{
 const run=(gauLinksTo:string)=>{
  const en='He goes hunting bears and chasing hares.',vi='Chàng săn gấu bắt thỏ.',a=plain(vi,en,{vi:[vi],en:[en]},[['săn','hunting'],['gấu',gauLinksTo],['bắt','chasing'],['thỏ','bears']]);
  a.groups[0].phrasePairs=[{vi:span(vi,'săn gấu'),en:span(en,'hunting bears'),score:.88,margin:.19,from:'en'}];
  return query(a,'vi',span(vi,'thỏ')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run('hares')).toEqual([]);
 expect(run('bears')).toEqual(['bears']);
});
it('highlights a lone capitalised name left without an answer when the same name ignoring accents stands once, capitalised, in the returned context',()=>{
 const run=(en:string)=>{
  const vi='Chàng tới Lãng rồi về.',a=plain(vi,en,{vi:[vi],en:[en]},[['Chàng','He']]);
  const r=query(a,'vi',span(vi,'Lãng'));
  return {status:r.status,hl:r.passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)))};
 };
 expect(run('He came to Lang and went back.')).toEqual({status:'uncertain',hl:['Lang']});
 expect(run('He came to Lang and left Lang again.').hl).toEqual([]);
 expect(run('He came to lang and went back.').hl).toEqual([]);
 expect(run('He came to Langdon and went back.').hl).toEqual([]);
});
it('answers a footnoted term with the headword of its note in the other edition, when each headword stands before its own marker and the other term stands once in the context',()=>{
 const run=(vi:string,en:string)=>{
  const a=plain(vi,en,{vi:[vi],en:[en]},[['Chàng','He']]);
  const g=a.groups[0],cut=(t:string)=>t.indexOf(String.fromCharCode(10));g.vi={start:0,end:cut(vi)};g.en={start:0,end:cut(en)};g.parts={vi:[g.vi],en:[g.en]}; // the group holds the prose, not the note
  a.notePairs=[{vi:span(vi,'(1) Tầm Dương: một địa danh.'),en:span(en,'(1) Xunyang: a place.'),score:.9,margin:.1}];
  const r=query(a,'vi',span(vi,'Tầm Dương'));
  return r.passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 const vi='Chàng tới Tầm Dương (1) rồi về.\n(1) Tầm Dương: một địa danh.';
 expect(run(vi,'He came to Xunyang (1) and went back.\n(1) Xunyang: a place.')).toEqual(['Xunyang']);
 expect(run(vi,'He came to Xunyang (1) and left Xunyang again.\n(1) Xunyang: a place.')).toEqual([]);
 expect(run(vi,'He came to a city (1) and went back.\n(1) Xunyang: a place.')).toEqual([]);
});
it('answers a Chinese name left without a highlight through the Sino-Vietnamese and pinyin readings of the same characters, in both directions, when exactly one name of the context fits every syllable',()=>{
 const vi='Chàng gặp Chương Hàm rồi về.';
 const ask=(l:'vi'|'en',a:string,b:string,sel:string)=>{
  const [v,e]=[a,b],art=plain(v,e,{vi:[v],en:[e]},[['Chàng','He']]),text=l==='vi'?e:v,q=query(art,l,span(l==='vi'?v:e,sel));
  return q.passages.flatMap(p=>p.highlights.map(h=>text.slice(h.start,h.end)));
 };
 expect(ask('vi',vi,'He met Zhang Han and went back.','Chương Hàm')).toEqual(['Zhang Han']);
 expect(ask('en',vi,'He met Zhang Han and went back.','Zhang Han')).toEqual(['Chương Hàm']);
 expect(ask('vi',vi,'He met Zhang Han and later Zhang Han again.','Chương Hàm')).toEqual([]);
 expect(ask('vi',vi,'He met Zhang Hao and went back.','Chương Hàm')).toEqual([]);
 expect(ask('en','Chàng gặp Vương ế rồi về.','He met Wang Yi and went back.','Wang Yi')).toEqual(['Vương ế']);
});
it('reads "Hoài Âm" as huai yin so that it matches "Huaiyin"',()=>{
 const vi='Chàng gặp Hoài Âm rồi về.',en='He met Huaiyin and went back.',a=plain(vi,en,{vi:[vi],en:[en]},[['Chàng','He']]);
 expect(query(a,'vi',span(vi,'Hoài Âm')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)))).toEqual(['Huaiyin']);
 expect(query(a,'en',span(en,'Huaiyin')).passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)))).toEqual(['Hoài Âm']);
});
it('projects a phrase with no link of its own onto the words between the targets of its linked neighbours, only when nothing but function words stands between them and the phrase',()=>{
 const run=(vi:string)=>{
  const en='Sinh hoped to borrow the royal army for a surprise attack and win back.',a=plain(vi,en,{vi:[vi],en:[en]},[['Sinh','Sinh'],['quân','army'],['cướp','win']]);
  return query(a,'vi',span(vi,'đánh úp')).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run('Sinh muốn nhờ thế quân, đánh úp mà cướp lại.')).toEqual(['surprise attack']);
 expect(run('Sinh muốn nhờ thế quân, đánh úp rất mà cướp lại.')).toEqual([]);
});
it('ignores a link that leaves the clause pair of the selection for another pair: the context stays, the wrong highlight does not',()=>{
 const vi='Bè bạn nhiều người đi làm quan cả. Kẻ sướng người khổ như thế là cớ làm sao?',en='Many of my friends have risen to office. Why should one man live in comfort while another suffers so?';
 const make=(to:string)=>plain(vi,en,{vi:['Bè bạn nhiều người đi làm quan cả.','Kẻ sướng người khổ như thế là cớ làm sao?'],en:['Many of my friends have risen to office.','Why should one man live in comfort while another suffers so?']},[['đi','live'],['quan','office']].map(l=>l[0]==='đi'?[to,l[1]]:l) as [string,string][],[[['Bè bạn nhiều người đi làm quan cả.'],['Many of my friends have risen to office.']],[['Kẻ sướng người khổ như thế là cớ làm sao?'],['Why should one man live in comfort while another suffers so?']]]);
 const marks=(a:AlignmentArtifact)=>query(a,'en',span(en,'live')).passages.flatMap(p=>p.highlights.map(h=>vi.slice(h.start,h.end)));
 expect(marks(make('sướng'))).toEqual(['sướng']);
 const crossed=query(make('đi'),'en',span(en,'live'));
 expect(crossed.passages.flatMap(p=>p.highlights)).toEqual([]);expect(crossed.passages.map(p=>vi.slice(p.target.start,p.target.end)).join('')).toContain('Kẻ sướng người khổ');
});
it('does not project from the links of a group the pairing does not trust: the context stays, the highlight does not',()=>{
 const vi='Sinh muốn nhờ thế quân, đánh úp mà cướp lại.',en='Sinh hoped to borrow the royal army for a surprise attack and win back.',a=plain(vi,en,{vi:[vi],en:[en]},[['Sinh','Sinh'],['quân','army'],['cướp','win']]);
 const ask=()=>query(a,'vi',span(vi,'đánh úp'));
 expect(ask().passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)))).toEqual(['surprise attack']);
 a.groups[0].score=.4;
 const r=ask();
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);expect(r.passages.map(p=>en.slice(p.target.start,p.target.end))).toEqual([en]);
});
it('completes the counterpart of a whole sentence to the end of its own sentence when its one passage stops in the middle and no group claims the rest',()=>{
 const sentence='Cho nên Nhi giữ chức tuần phủ (9) tâu xin phá đền, thật là phải lắm.',whole='Thus, when Nhi served as inspector (9), he was right to petition to destroy shrines.';
 const run=(claimed:boolean)=>{
  const vi=claimed?sentence+' Khác.':sentence,en=whole,a=plain(vi,en,{vi:[vi],en:[en]},[['Nhi','Nhi']]);
  const g=a.groups[0];g.section='critique';g.vi={start:0,end:vi.indexOf('thật')};g.en={start:en.indexOf('when'),end:en.indexOf('inspector (9),')+'inspector (9),'.length};g.parts={vi:[g.vi],en:[g.en]};
  if(claimed){const other=plain(vi,en,{vi:[vi],en:[en]},[]).groups[0];other.id='x';other.section='critique';other.vi={start:vi.indexOf('Khác'),end:vi.length};other.en={start:en.indexOf('he was'),end:en.length};other.parts={vi:[other.vi],en:[other.en]};a.groups.push(other);}
  return query(a,'vi',{start:0,end:sentence.length}).passages.map(p=>en.slice(p.target.start,p.target.end));
 };
 expect(run(false)).toEqual([whole]);
 expect(run(true)).not.toEqual([whole]);
});
it('joins two passages across the short stretch of the other edition that lies between them when no other group claims it',()=>{
 const vi='Nàng tắm gội, ra bến than rằng.',en='She bathed, then lifted her eyes and sighed, went to the shore.',a=plain(vi,en,{vi:[vi],en:[en]},[['tắm','bathed'],['bến','shore']]);
 const g1=a.groups[0];g1.vi={start:0,end:vi.indexOf('ra bến')-1};g1.en={start:0,end:en.indexOf(',')+1};g1.parts={vi:[g1.vi],en:[g1.en]};
 const g2=plain(vi,en,{vi:[vi],en:[en]},[['bến','shore']]).groups[0];g2.id='b';g2.vi={start:vi.indexOf('ra bến'),end:vi.length};g2.en={start:en.indexOf('went'),end:en.length};g2.parts={vi:[g2.vi],en:[g2.en]};a.groups=[g1,g2];
 // the highlight runs across the stretch the pairing left out, not just over the two groups
 expect(query(a,'vi',{start:0,end:vi.length}).passages.map(p=>p.highlights.map(h=>en.slice(h.start,h.end)))).toEqual([[en]]);
});
it('does not count unlinked words between two linked ones against a phrase whose pieces join into one highlight, but still abstains when they stand at its ends',()=>{
 const run=(vi:string,sel:string,links:[string,string][])=>{
  const en='He trained men in arts of war.',a=plain(vi,en,{vi:[vi],en:[en]},links);
  return query(a,'vi',span(vi,sel)).passages.flatMap(p=>p.highlights.map(h=>en.slice(h.start,h.end)));
 };
 expect(run('Chàng giảng dạy binh pháp cho quân.','giảng dạy binh pháp',[['giảng','trained'],['pháp','war']])).toEqual(['trained men in arts of war']);
 expect(run('Chàng giảng dạy binh pháp cho quân.','giảng dạy binh pháp',[['giảng','trained']])).toEqual([]);
});
it('lets labelled pairs that cover a whole clause answer where the clause logic found no pair',()=>{
 const a=fixture();a.groups[0].clausePairs=[];
 const r0=query(a,'en',{start:0,end:a.groups[0].parts!.en[0].end});
 expect(r0.status).toBe('context-only');expect(r0.passages.flatMap(p=>p.highlights)).toEqual([]);
 a.groups[0].labelled=[{en:span(a.editions.en.text,'Though Lan was young'),vi:span(a.editions.vi.text,'Lan còn nhỏ')}];
 const r=query(a,'en',span(a.editions.en.text,'Though Lan was young'));
 expect(r.passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).toEqual(['Lan còn nhỏ']);expect(r.unmatchedSource).toBeUndefined();
});
it('rejects a malformed labelled list: outside its group, empty, or overlapping',()=>{
 const vi='Chàng cưỡi ngựa đi săn.',en='He rode a horse to hunt.';
 const make=()=>{const a=plain(vi,en,{vi:[vi],en:[en]},[]);a.groups[0].labelled=[{vi:span(vi,'cưỡi ngựa'),en:span(en,'rode a horse')},{vi:span(vi,'đi săn'),en:span(en,'hunt')}];return a;};
 expect(()=>validateAlignmentArtifact(make())).not.toThrow();
 const outside=make();outside.groups[0].labelled![1].en={start:0,end:en.length+5};expect(()=>validateAlignmentArtifact(outside)).toThrow();
 const empty=make();empty.groups[0].labelled![0].vi={start:3,end:3};expect(()=>validateAlignmentArtifact(empty)).toThrow();
 const overlap=make();overlap.groups[0].labelled![1].vi=span(vi,'ngựa đi săn');expect(()=>validateAlignmentArtifact(overlap)).toThrow();
});
it('uses a labelled pair only where the links gave no highlight, and never replaces a highlight the links gave',()=>{
 const vi='Chàng cưỡi ngựa đi săn.',en='He rode a horse to hunt.';
 const make=(links:[string,string][])=>{const a=plain(vi,en,{vi:[vi],en:[en]},links);a.groups[0].labelled=[{vi:span(vi,'cưỡi ngựa'),en:span(en,'rode a horse')},{vi:span(vi,'đi săn'),en:span(en,'hunt')}];return a;};
 const ask=(a:AlignmentArtifact,l:'vi'|'en',q:string)=>query(a,l,span(a.editions[l].text,q)).passages.flatMap(p=>p.highlights.map(h=>a.editions[l==='vi'?'en':'vi'].text.slice(h.start,h.end)));
 const linked=make([['ngựa','hunt']]);
 expect(ask(linked,'vi','ngựa')).toEqual(['hunt']);
 const crossed=make([['săn','horse']]);
 expect(ask(crossed,'en','horse')).toEqual(['cưỡi ngựa']);
 expect(ask(crossed,'vi','săn')).toEqual(['horse']);
 const bare=make([]);
 expect(ask(bare,'vi','cưỡi ngựa')).toEqual(['rode a horse']);
 expect(ask(bare,'en','rode a horse')).toEqual(['cưỡi ngựa']);
});
it('lets auxiliaries and pronouns lie outside the labelled pairs only where the links gave no highlight, and never drops a pair that holds such a word',()=>{
 const vi='Mệnh nàng nhẹ hơn chiếc lá.',en='Her fate was lighter than a leaf.';
 const make=(links:[string,string][])=>{const a=plain(vi,en,{vi:[vi],en:[en]},links);a.groups[0].labelled=[{vi:span(vi,'Mệnh'),en:span(en,'fate')},{vi:span(vi,'nhẹ'),en:span(en,'lighter')}];return a;};
 const ask=(a:AlignmentArtifact,l:'vi'|'en',q:string)=>query(a,l,span(a.editions[l].text,q)).passages.flatMap(p=>p.highlights.map(h=>a.editions[l==='vi'?'en':'vi'].text.slice(h.start,h.end)));
 expect(ask(make([]),'en','fate was lighter than')).toEqual(['Mệnh nàng nhẹ hơn']);
 expect(ask(make([]),'en','fate was lighter than a leaf')).toEqual([]);
 const very=plain('Nàng rất buồn.','She was very sad.',{vi:['Nàng rất buồn.'],en:['She was very sad.']},[]);
 very.groups[0].labelled=[{vi:span(very.editions.vi.text,'rất'),en:span(very.editions.en.text,'very')}];
 expect(ask(very,'vi','rất')).toEqual(['very']);
});
it('keeps the highlight of the part found only when the partial rule is on, and flags it',()=>{
 const make=()=>{const a=fixture(),vi=a.editions.vi.text,en=a.editions.en.text,h=span(vi,'họ hàng'),k=span(en,'kin');a.groups[0].links.push({vi:[h.start,h.end],en:[k.start,k.end],score:.9});return a;};
 const run=(a:AlignmentArtifact)=>query(a,'en',span(a.editions.en.text,'kin tactfully'));
 const saved={...partialRule};
 try{
  Object.assign(partialRule,{min:0,words:2,strength:0});
  const off=run(make());
  expect(off.status).toBe('context-only');expect(off.passages.flatMap(p=>p.highlights)).toEqual([]);expect(off.partial).toBeUndefined();
  Object.assign(partialRule,{min:.5,words:2,strength:0});
  const a=make(),on=run(a);
  expect(on.status).toBe('uncertain');expect(on.partial).toBe(true);expect(on.unmatchedSource?.length).toBeGreaterThan(0);
  expect(on.passages.flatMap(p=>p.highlights.map(h=>a.editions.vi.text.slice(h.start,h.end)))).toEqual(['họ hàng']);
  Object.assign(partialRule,{min:.5,words:3,strength:0});
  expect(run(make()).passages.flatMap(p=>p.highlights)).toEqual([]);
 }finally{Object.assign(partialRule,saved);}
});
it('does not keep a partial highlight when the words it lacks include a negation or are too many',()=>{
 const saved={...partialRule},text='The brave knight never returned home',all={start:0,end:text.length},at=(q:string)=>span(text,q),hl=[{source:{start:0,end:0,text:''},target:{start:0,end:1,text:'x'},highlights:[{start:0,end:1}]}] as any;
 try{
  Object.assign(partialRule,{min:.5,words:2,strength:0});
  expect(partialKept(text,all,[at('home')],hl,'en',1)).toBe(true);
  expect(partialKept(text,all,[at('never')],hl,'en',1)).toBe(false);
  expect(partialKept(text,all,[at('knight'),at('never'),at('returned')],hl,'en',1)).toBe(false);
  // "not" and "không" are stop words but still count as a missing negation
  const t2='The brave knight did not return home',all2={start:0,end:t2.length};
  expect(partialKept(t2,all2,[span(t2,'home')],hl,'en',1)).toBe(true);
  expect(partialKept(t2,all2,[span(t2,'not')],hl,'en',1)).toBe(false);
  const t3='Chàng hiệp sĩ dũng cảm không về nhà',all3={start:0,end:t3.length};
  expect(partialKept(t3,all3,[span(t3,'không')],hl,'vi',1)).toBe(false);expect(partialKept(t3,all3,[span(t3,'nhà')],hl,'vi',1)).toBe(true);
  expect(partialKept(text,all,[at('home')],hl,'en',0)).toBe(true);
  Object.assign(partialRule,{min:.5,words:2,strength:.5});
  expect(partialKept(text,all,[at('home')],hl,'en',.4)).toBe(false);
 }finally{Object.assign(partialRule,saved);}
});
