import {it,expect} from 'vitest';
import {makeAlignmentInput,matchesAlignmentInput} from '../scripts/align-novel/input';
it('binds a prepared result to both exact source versions and canonical text',()=>{
 const edition={versionId:'00000000-0000-4000-8000-000000000001',revision:1,html:'<p>Text.</p>'};
 const input=makeAlignmentInput('chapter-1',{vi:edition,en:edition});
 const artifact={codec:input.editions.vi.codec,chapterId:input.chapterId,editions:input.editions};
 expect(matchesAlignmentInput(artifact,input)).toBe(true);
 expect(matchesAlignmentInput({...artifact,editions:{...artifact.editions,en:{...input.editions.en,versionId:'00000000-0000-4000-8000-000000000002'}}},input)).toBe(false);
 expect(matchesAlignmentInput({...artifact,editions:{...artifact.editions,vi:{...input.editions.vi,text:'Different'}}},input)).toBe(false);
});
it('rejects worker input outside the chapter and text limits',()=>{
 const edition={versionId:'00000000-0000-4000-8000-000000000001',revision:1,html:'<p>Text.</p>'};
 expect(()=>makeAlignmentInput('../private',{vi:edition,en:edition})).toThrow();
 expect(()=>makeAlignmentInput('chapter-1',{vi:{...edition,revision:0},en:edition})).toThrow();
});
