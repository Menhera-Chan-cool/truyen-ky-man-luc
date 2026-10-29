import {it,expect} from 'vitest';import seed from '../src/data/book.json';
import {validateOfflineBook,publicAssetPath} from '../src/lib/offline-book';
it('accepts only the published book shape and approved book assets',()=>{
 const b=validateOfflineBook(seed);expect(b.chapters.filter(c=>c.id.startsWith('chapter-'))).toHaveLength(20);
 expect(publicAssetPath('/book/cover.jpg')).toBe(true);expect(publicAssetPath('/api/admin/state')).toBe(false);expect(publicAssetPath('https://elsewhere.test/file')).toBe(false);
 const bad=structuredClone(seed);bad.meta.vi.frontCover='/api/admin/source';expect(()=>validateOfflineBook(bad)).toThrow();
 const duplicate=structuredClone(seed);duplicate.chapters.push(duplicate.chapters[0]);expect(()=>validateOfflineBook(duplicate)).toThrow();
});
