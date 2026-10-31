import {it,expect} from 'vitest';import seed from '../src/data/book.json';
import {validateOfflineBook,publicAssetPath,bookAssetPaths} from '../src/lib/offline-book';
it('accepts only the published book shape and approved book assets',()=>{
 const b=validateOfflineBook(seed);expect(b.chapters.filter(c=>c.id.startsWith('chapter-'))).toHaveLength(20);
 expect(publicAssetPath('/book/cover.jpg')).toBe(true);expect(publicAssetPath('/api/admin/state')).toBe(false);expect(publicAssetPath('https://elsewhere.test/file')).toBe(false);
 const bad=structuredClone(seed);bad.meta.vi.frontCover='/api/admin/source';expect(()=>validateOfflineBook(bad)).toThrow();
 const duplicate=structuredClone(seed);duplicate.chapters.push(duplicate.chapters[0]);expect(()=>validateOfflineBook(duplicate)).toThrow();
});
it('includes selected fonts once without accepting a font as an image cover',()=>{
 const b=validateOfflineBook(seed),id='22222222-2222-4222-8222-222222222222',path='/api/heading-fonts/'+id;
 b.meta.vi.headingFont=id;b.meta.en.headingFont=id;
 expect(bookAssetPaths(validateOfflineBook(b)).filter(p=>p===path)).toHaveLength(1);
 expect(publicAssetPath(path)).toBe(false);
 expect(()=>validateOfflineBook({...b,meta:{...b.meta,vi:{...b.meta.vi,frontCover:path}}})).toThrow();
 expect(()=>validateOfflineBook({...b,meta:{...b.meta,vi:{...b.meta.vi,headingFont:'url(https://evil)'}}})).toThrow();
});
