import {it,expect} from 'vitest';
import {makeAlignmentInput} from '../scripts/align-novel/input';
import {makeContextInput} from '../scripts/align-novel/context-input';
import {notePair,structureLookup} from '../src/lib/novel-lookup-structure';
import type {AlignmentArtifact} from '../src/lib/novel-lookup';

function fixture(vi:string,en='<p>Story.</p>'){
 const edition=(html:string,revision:number)=>({html,revision,versionId:'00000000-0000-4000-8000-00000000000'+revision});
 return makeAlignmentInput('chapter-1',{vi:edition(vi,1),en:edition(en,2)});
}

it('keeps published editions unchanged while preparing clauses and plain paragraph section headings',()=>{
 const input=fixture('<p>Truyện (12), lời kể.</p><p>Lời bình:</p><p>Than ôi, còn điều tốt.</p><p>Chú thích:</p><p>(9) Hàn Dũ: Giảng (8).</p>',
  '<p>Story (12), narration.</p><p>Critique</p><p>Alas, a comment.</p><p>Notes</p><p>(8) Han Yu: Explanation (9).</p>');
 const before=JSON.stringify(input),result=makeContextInput(input);
 expect(result.editions).toBe(input.editions);expect(JSON.stringify(input)).toBe(before);
 expect(result.units.vi.filter(u=>u.section==='story').map(u=>[u.quote,u.text])).toEqual([['Truyện (12),','Truyện     ,'],['lời kể.','lời kể.']]);
 expect(result.units.vi.filter(u=>u.section==='critique').map(u=>u.quote)).toEqual(['Than ôi,','còn điều tốt.']);
 expect(result.units.vi.filter(u=>u.section==='notes').map(u=>u.noteId)).toEqual(['9','9']);
 expect(result.units.en.filter(u=>u.section==='notes').map(u=>u.noteId)).toEqual(['8','8']);
 expect(result.units.vi.find(u=>u.quote==='Giảng (8).')?.text).toBe('Giảng (8).');
 expect(result.structures.vi.notes.map(n=>n.id)).toEqual(['9']);expect(result.structures.en.notes.map(n=>n.id)).toEqual(['8']);
});

it.each(['(*) Nguyên văn:','*Nguyên văn:'])('recognizes notes without a notes heading after %s metadata',prefix=>{
 const result=makeContextInput(fixture(`<p>Chuyện.</p><p>Lời bình:</p><p>Bình luận.</p><p>${prefix} Tên cũ.</p><p>(9) Hàn Dũ: Một văn hào.</p>`));
 expect(result.structures.vi.notes.map(n=>n.id)).toEqual(['9']);
 expect(result.units.vi.filter(u=>u.section==='critique').map(u=>u.quote)).toEqual(['Bình luận.']);
 expect(result.units.vi.filter(u=>u.section==='notes').map(u=>u.noteId)).toEqual(['9','9']);
 expect(result.units.vi.some(u=>u.quote.includes('Nguyên văn')||u.quote.includes('Tên cũ'))).toBe(false);
});

it('uses numbered note blocks as the floor when no notes heading or title metadata exists',()=>{
 const result=makeContextInput(fixture('<p>Chuyện.</p><p>Lời bình:</p><p>Bình luận.</p><p>(5) Nhân vật: Giảng nghĩa.</p>'));
 expect(result.structures.vi.notes.map(n=>n.id)).toEqual(['5']);
 expect(result.units.vi.filter(u=>u.section==='critique').map(u=>u.quote)).toEqual(['Bình luận.']);
 expect(result.units.vi.filter(u=>u.section==='notes').map(u=>u.noteId)).toEqual(['5','5']);
});

it('keeps an embedded original title from moving the notes floor into the story',()=>{
 const result=makeContextInput(fixture('<p>Chuyện.</p><p>* Nguyên văn: Tên cũ.</p><p>Tiếp chuyện.</p><p>Lời bình:</p><p>Bình luận.</p><p>Chú thích:</p><p>(1) Một lời chú.</p>'));
 expect(result.units.vi.filter(u=>u.section==='story').map(u=>u.quote)).toEqual(['Chuyện.','Tiếp chuyện.']);
 expect(result.units.vi.filter(u=>u.section==='notes').map(u=>u.quote)).toEqual(['(1) Một lời chú.']);
 expect(result.units.vi.some(u=>u.quote.includes('Tên cũ'))).toBe(false);
});

it('excludes every original-title block and preserves a note cross-reference as a source ID',()=>{
 const result=makeContextInput(fixture('<p>Lời bình:</p><p>Bình luận.</p><p>(*) Nguyên văn: Tên thứ nhất.</p><p>* Nguyên văn: Tên thứ hai.</p><p>(6) Xem chú thích (4) cùng chuyện.</p>'));
 expect(result.structures.vi.originals).toHaveLength(2);expect(result.structures.vi.notes[0].reference).toBe('4');
 expect(result.units.vi.map(u=>u.quote)).toEqual(['Bình luận.','(6) Xem chú thích (4) cùng chuyện.']);
 expect(result.units.vi[1]).toMatchObject({section:'notes',noteId:'6',text:'(6) Xem chú thích (4) cùng chuyện.'});
});

it('preserves UTF16 mappings, decomposed text and both repeated verse occurrences',()=>{
 const nfd='Tốt'.normalize('NFD');
 const input=fixture(`<p>😀 ${nfd} (12), ta đi.</p><p>II</p><p>Câu lặp.</p><p>Câu lặp.</p>`),result=makeContextInput(input);
 expect(result.units.vi[0]).toMatchObject({start:0,end:14,quote:`😀 ${nfd} (12),`,text:`😀 ${nfd}     ,`});
 expect(result.units.vi[0].starts.slice(0,2)).toEqual([0,1]);expect(result.units.vi[0].ends.slice(0,2)).toEqual([1,2]);
 expect(result.units.vi[1]).toMatchObject({start:15,end:21,quote:'ta đi.',starts:[15,16,17,18,19,20],ends:[16,17,18,19,20,21]});
 const verses=result.units.vi.filter(u=>u.quote==='Câu lặp.');expect(verses).toHaveLength(2);expect(verses[0].end).toBe(verses[1].start);
 expect(result.units.vi.some(u=>u.quote==='II')).toBe(false);
 for(const u of result.units.vi){expect(u.text.length).toBe(u.quote.length);expect(u.starts).toHaveLength(u.text.length);expect(u.ends).toHaveLength(u.text.length);expect(input.editions.vi.text.slice(u.start,u.end)).toBe(u.quote);}
});

it.each([['labse-context-mbert-1',true],['labse-book-mbert-2',true],['e5-mbert-uts95-1',false]] as const)('calibrates note scoping for %s while retaining the stricter direct-label guard',(algorithm,accepted)=>{
 const input=fixture('<p>Chú thích:</p><p>(9) Hàn Dũ: Một nhà văn.</p>','<p>Notes</p><p>(8) Han Yu: A writer.</p>');
 const context=makeContextInput(input),vi=context.structures.vi.notes[0],en=context.structures.en.notes[0];
 const artifact:AlignmentArtifact={...input,schema:1,codec:input.editions.vi.codec,algorithm,createdAt:'',groups:[],notePairs:[{vi,en,score:.65,margin:.05}]};
 const span=vi.label!,request={...span,chapterId:input.chapterId,locale:'vi' as const,revision:1,text:input.editions.vi.text.slice(span.start,span.end)};
 expect(notePair(artifact,request)?.targets).toEqual(accepted?[en]:[]);
 expect(structureLookup(artifact,request)).toBeUndefined();
});
