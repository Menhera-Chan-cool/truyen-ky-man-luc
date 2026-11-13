import {it,expect} from 'vitest';
import {lookupArtifact,type AlignmentArtifact} from '../src/lib/novel-lookup';
import {alignmentStructure,notePair} from '../src/lib/novel-lookup-structure';
function fixture(vi:string[],en:string[]):AlignmentArtifact{
 const edition=(parts:string[],revision:number)=>({text:parts.join(''),breaks:parts.slice(0,-1).map((_,i)=>parts.slice(0,i+1).join('').length),revision,versionId:'00000000-0000-4000-8000-00000000000'+revision,hash:'a'.repeat(64)});
 return {schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'2026-11-12',editions:{vi:edition(vi,1),en:edition(en,2)},groups:[]};
}
function query(a:AlignmentArtifact,locale:'vi'|'en',quote:string){const t=a.editions[locale].text,start=t.indexOf(quote);return lookupArtifact(a,{chapterId:a.chapterId,locale,revision:a.editions[locale].revision,start,end:start+quote.length,text:quote});}
const terms=(a:AlignmentArtifact,r:ReturnType<typeof query>)=>r.passages.flatMap(p=>p.highlights.map(s=>a.editions[r.targetLocale].text.slice(s.start,s.end)));
it('pairs actual critique headings without requiring model links',()=>{
 const a=fixture(['Truyện.','Lời bình:','Lời bình của tác giả.'],['Story.','Critique','The author comments.']);
 expect(terms(a,query(a,'en','Critique'))).toEqual(['Lời bình']);
 expect(terms(a,query(a,'vi','Lời bình:'))).toEqual(['Critique']);
});
it('pairs original-title metadata instead of matching it to critique text',()=>{
 const a=fixture(['Lời bình:','Bình luận.','(*) Nguyên văn: Mộc miên thụ truyện.','(1) Chợ Nam Xang: Một địa danh.'],['Critique','A comment.','Notes','(*) Original title: Moc Mien Thu Truyen (The Silk-Cotton Tree).','(1) Nam Xang Market: A place.']);
 expect(terms(a,query(a,'vi','(*) Nguyên văn: Mộc miên thụ truyện.'))).toEqual(['(*) Original title: Moc Mien Thu Truyen (The Silk-Cotton Tree).']);
});
it('matches the original-title value when its metadata prefix was not selected',()=>{
 const a=fixture(['(*) Nguyên văn: Mộc miên thụ truyện.'],['(*) Original title: Moc Mien Thu Truyen (The Silk-Cotton Tree).']);
 expect(terms(a,query(a,'vi','Mộc miên thụ truyện.'))).toEqual(['Moc Mien Thu Truyen']);
 expect(terms(a,query(a,'en','Moc Mien Thu Truyen'))).toEqual(['Mộc miên thụ truyện']);
});
it('pairs note labels by the same note ID even when the model classified notes incorrectly',()=>{
 const a=fixture(['Lời bình:','Bình luận.','(*) Nguyên văn: Truyện.','(6) Dị An: Lý Thanh Chiếu, một thi nhân.','(9) Hàn Dũ là một văn hào.'],['Critique','A comment.','Notes','(*) Original title: Tale.','(6) Yi\'an: Li Qingzhao, a poet.','(9) Han Yu (768–824): A writer.']);
 a.notePairs=alignmentStructure(a,'vi').notes.map(n=>({vi:{start:n.start,end:n.end},en:alignmentStructure(a,'en').notes.find(m=>m.id===n.id)!,score:.96,margin:.1}));
 expect(terms(a,query(a,'vi','Dị An:'))).toEqual(["Yi'an"]);
 expect(terms(a,query(a,'vi','Hàn Dũ'))).toEqual(['Han Yu']);
});
it('does not turn an absent note topic into the word See in a cross-reference',()=>{
 const a=fixture(['Chú thích:','(6) Xem chú thích (4) cùng chuyện.'],['Notes','(6) Zhangtai willow: See note (4) to this same tale.']);
 a.notePairs=[{vi:alignmentStructure(a,'vi').notes[0],en:alignmentStructure(a,'en').notes[0],score:.96,margin:.1}];
 a.groups=[{id:'0',section:'notes',vi:{start:10,end:a.editions.vi.text.length},en:{start:5,end:a.editions.en.text.length},score:.99,margin:.1,links:[{vi:[14,17],en:[9,17],score:1}]}];
 const r=query(a,'en','Zhangtai willow');expect(r.status).toBe('context-only');expect(terms(a,r)).toEqual([]);expect(r.passages[0].target.text).toContain('Xem chú thích (4)');
});
it('shows the complete paired note when an uncorroborated caption has no translated caption',()=>{
 const a=fixture(['Chú thích:','(5) Đời xưa. Có một người.'],['Notes','(8) A person: A tale from long ago.']);
 const vi=alignmentStructure(a,'vi').notes[0],en=alignmentStructure(a,'en').notes[0];
 a.notePairs=[{vi,en,score:.96,margin:.1}];
 a.groups=[{id:'bad-caption',section:'notes',vi:{start:vi.start,end:vi.start+12},en:{start:en.start,end:en.end},score:.95,margin:.1,links:[{vi:[vi.start+4,vi.start+7],en:[en.label!.start,en.label!.end],score:1}]}];
 const r=query(a,'en','A person');expect(r.status).toBe('context-only');expect(terms(a,r)).toEqual([]);expect(r.passages[0].target.text).toContain('Có một người.');
});
it('uses a validated semantic note pair rather than assuming equal note numbers',()=>{
 const a=fixture(['Chú thích:','(9) Hàn Dũ là một văn hào.'],['Notes','(9) Li Jing and Hongfu: Another subject.','(12) Han Yu: A writer.']);
 a.notePairs=[{vi:alignmentStructure(a,'vi').notes[0],en:alignmentStructure(a,'en').notes[1],score:.96,margin:.1}];
 expect(terms(a,query(a,'vi','Hàn Dũ'))).toEqual(['Han Yu']);
});
it('recognizes notes without literal numbering instead of dropping the entire notes section',()=>{
 const a=fixture(['Chú thích:','Tên một nhân vật: Giải thích.','Một địa danh: Giải thích khác.'],['Notes','(1) A person: Explanation.','(2) A place: Another explanation.']);
 expect(alignmentStructure(a,'vi').notes).toHaveLength(2);
});
it('keeps a single-word exclamation as a word lookup instead of promoting it to a sentence',()=>{
 const a=fixture(['Than ôi, cuộc đời ngắn ngủi.'],['Alas! Life is short.']);
 a.groups=[{id:'0',section:'critique',vi:{start:0,end:a.editions.vi.text.length},en:{start:0,end:a.editions.en.text.length},score:.95,margin:.1,links:[{vi:[0,7],en:[0,4],score:.9}]}];
 expect(terms(a,query(a,'en','Alas'))).toEqual(['Than ôi']);
});
it('excludes standalone Roman section markers from a verse answer',()=>{
 const vi='Giai kỳ nhẫn phụ thử lương tiêu',en='Blest with this tryst, how could I let so fine a night slip away?';
 const a=fixture([vi],['II',en]);a.groups=[{id:'0',section:'story',vi:{start:0,end:vi.length},en:{start:0,end:a.editions.en.text.length},score:.95,margin:.1,links:[]}];
 expect(terms(a,query(a,'vi',vi))).toEqual([en]);
});
it('keeps an existing title with a selected name, without adding it when only the name is selected',()=>{
 const a=fixture(['Hạng vương bắt Lưu Bang.'],['Hegemon Xiang captured Liu Bang.']);
 a.groups=[{id:'0',section:'story',vi:{start:0,end:a.editions.vi.text.length},en:{start:0,end:a.editions.en.text.length},score:.95,margin:.1,links:[{vi:[0,4],en:[8,13],score:.95}]}];
 expect(terms(a,query(a,'en','Hegemon Xiang'))).toEqual(['Hạng vương']);
 expect(terms(a,query(a,'en','Xiang'))).toEqual(['Hạng']);
});
it('does not mix an unrelated lower-case phrase into a proper-name result',()=>{
 const a=fixture(['Cổ áp Nha nói chuyện.'],['Gu Yaya was speaking.']);
 a.groups=[{id:'0',section:'story',vi:{start:0,end:a.editions.vi.text.length},en:{start:0,end:a.editions.en.text.length},score:.95,margin:.1,links:[{vi:[0,2],en:[0,2],score:.95},{vi:[3,9],en:[3,7],score:.95},{vi:[10,19],en:[3,7],score:.95}]}];
 expect(terms(a,query(a,'en','Gu Yaya'))).toEqual(['Cổ áp Nha']);
});
it('does not pair different original titles merely because they share a metadata role',()=>{
 const a=fixture(['Lời bình:','Bình luận.','(*) Nguyên văn: Tản Viên từ phán sự lục.'],['Critique','Comment.','Notes','(*) Original title: Dao Thi Nghiep Oan Ky.']);
 const r=query(a,'vi','(*) Nguyên văn: Tản Viên từ phán sự lục.');expect(r.status).toBe('unavailable');expect(terms(a,r)).toEqual([]);
});
it('keeps titles when looking up a Vietnamese named title in reverse',()=>{
 const a=fixture(['Hạng vương bắt Lưu Bang.'],['Hegemon Xiang captured Liu Bang.']);
 a.groups=[{id:'0',section:'story',vi:{start:0,end:a.editions.vi.text.length},en:{start:0,end:a.editions.en.text.length},score:.95,margin:.1,links:[{vi:[0,4],en:[8,13],score:.95}]}];
 expect(terms(a,query(a,'vi','Hạng vương'))).toEqual(['Hegemon Xiang']);
});
it('keeps existing note word links usable before a contextual artifact is available',()=>{
 const a=fixture(['Chú thích:','(1) Nhà.'],['Notes','(1) House.']);
 const vi=a.editions.vi.text.indexOf('Nhà'),en=a.editions.en.text.indexOf('House');
 a.groups=[{id:'legacy',section:'notes',vi:{start:10,end:a.editions.vi.text.length},en:{start:5,end:a.editions.en.text.length},score:.95,margin:.1,links:[{vi:[vi,vi+3],en:[en,en+5],score:.95}]}];
 expect(terms(a,query(a,'vi','Nhà'))).toEqual(['House']);
 a.notePairs=[];expect(query(a,'vi','Nhà').status).toBe('unavailable');
});
it('keeps semantic note scopes when one translated note combines two source notes',()=>{
 const a=fixture(['Chú thích:','(1) Người thứ nhất.','(2) Người thứ hai.'],['Notes','(7) Two people: Combined explanation.']);
 const vi=alignmentStructure(a,'vi').notes,en=alignmentStructure(a,'en').notes;
 a.notePairs=[{vi:{start:vi[0].start,end:vi[1].end},en:en[0],score:.9,margin:.1}];
 for(const source of vi){const request={...source,locale:'vi' as const,chapterId:a.chapterId,revision:1,text:a.editions.vi.text.slice(source.start,source.end)};expect(notePair(a,request)?.baseTargets).toEqual(en);}
});
it('retains both target notes when one source note corresponds to a translated note range',()=>{
 const a=fixture(['Chú thích:','(1) Hai người: Giải thích chung.'],['Notes','(7) The first person.','(8) The second person.']);
 const vi=alignmentStructure(a,'vi').notes,en=alignmentStructure(a,'en').notes;
 a.notePairs=[{vi:vi[0],en:{start:en[0].start,end:en[1].end},score:.9,margin:.1}];
 const source=vi[0],request={...source,locale:'vi' as const,chapterId:a.chapterId,revision:1,text:a.editions.vi.text.slice(source.start,source.end)};
 expect(notePair(a,request)?.baseTargets).toEqual(en);expect(notePair(a,request)?.target).toBeUndefined();
});
