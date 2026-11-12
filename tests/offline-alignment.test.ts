import {it,expect} from 'vitest';
import {verifyOfflineAlignment,offlineAlignmentKey} from '../src/lib/offline-alignment';
import type {Book} from '../src/lib/types';
const versionId='00000000-0000-4000-8000-000000000001';
const artifact={schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'2026-11-12',editions:{vi:{versionId,revision:1,hash:'a'.repeat(64),text:'VI'},en:{versionId,revision:2,hash:'b'.repeat(64),text:'EN'}},groups:[]};
const book={id:'truyen-ky-man-luc',author:'Nguyễn Dữ',revision:1,meta:{vi:{title:'VI',summary:'',frontCover:'/book/cover.jpg'},en:{title:'EN',summary:'',frontCover:'/book/cover.jpg'}},chapters:[{id:'chapter-1',order:1,vi:{title:'VI',html:'<p>VI</p>',revision:1,kind:'text'},en:{title:'EN',html:'<p>EN</p>',revision:2,kind:'text'}}]} as Book;
it('verifies raw bytes and both downloaded edition revisions before storing lookup data',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(artifact)).buffer;
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 expect((await verifyOfflineAlignment(bytes,hash,book,'chapter-1')).chapterId).toBe('chapter-1');
 await expect(verifyOfflineAlignment(bytes,'0'.repeat(64),book,'chapter-1')).rejects.toThrow();
 await expect(verifyOfflineAlignment(bytes,hash,{...book,chapters:book.chapters.map(c=>({...c,en:{...c.en!,revision:3}}))},'chapter-1')).rejects.toThrow();
 expect(offlineAlignmentKey(hash)).toBe('offline-novel-alignment:v1:'+hash);expect(()=>offlineAlignmentKey('../secret')).toThrow();
});
