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
 expect(query(a,'en',e).passages.flatMap(p=>p.highlights)).not.toEqual([v]);
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
it('returns the target text between the neighbouring groups as context when part of the selection lies in no group',()=>{
 const a=gapFixture(),r=query(a,'vi',{start:a.editions.vi.text.indexOf('Chồng'),end:a.editions.vi.text.length});
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
