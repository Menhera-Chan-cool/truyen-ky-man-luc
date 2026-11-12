import {it,expect} from "vitest";
import {lookupArtifact,validateAlignmentArtifact,validateLookupRequest,type AlignmentArtifact} from "../src/lib/novel-lookup";

const artifact:AlignmentArtifact={schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'2026-11-12T00:00:00Z',
 editions:{vi:{revision:1,versionId:'00000000-0000-4000-8000-000000000001',hash:'a'.repeat(64),text:'Một người tốt bụng.'},en:{revision:2,versionId:'00000000-0000-4000-8000-000000000002',hash:'b'.repeat(64),text:'A kind person.'}},
 groups:[{id:'0',section:'story',vi:{start:0,end:18},en:{start:0,end:14},score:.95,margin:.1,links:[{vi:[4,9],en:[7,13],score:.8},{vi:[10,13],en:[2,6],score:.8},{vi:[14,18],en:[2,6],score:.7}]}]};
it('bounds anonymous lookup input and rejects malformed selections',()=>{
 const valid={chapterId:'chapter-1',locale:'vi',revision:1,start:0,end:3,text:'Một'};
 expect(validateLookupRequest(valid)).toEqual(valid);
 for(const changes of [{locale:'fr'},{chapterId:'../file'},{start:-1},{end:4},{text:'x'.repeat(2001)},{revision:1.2}])expect(()=>validateLookupRequest({...valid,...changes})).toThrow();
});
it('finds the contextual phrase in either direction and keeps original quotes',()=>{
 const forward=lookupArtifact(artifact,{chapterId:'chapter-1',locale:'vi',revision:1,start:10,end:18,text:'tốt bụng'});
 expect(forward.status).toBe('match');expect(forward.passages[0].highlights.map(s=>artifact.editions.en.text.slice(s.start,s.end))).toEqual(['kind']);
 const reverse=lookupArtifact(artifact,{chapterId:'chapter-1',locale:'en',revision:2,start:2,end:6,text:'kind'});
 expect(reverse.passages[0].highlights.map(s=>artifact.editions.vi.text.slice(s.start,s.end))).toEqual(['tốt bụng']);
});
it('refuses a stale revision or wrong source quote',()=>{
 const request={chapterId:'chapter-1',locale:'vi' as const,revision:2,start:10,end:18,text:'tốt bụng'};
 expect(lookupArtifact(artifact,request).status).toBe('stale');expect(lookupArtifact(artifact,{...request,revision:1,text:'other'}).status).toBe('stale');
});
it('returns sentence context when no trustworthy word link exists',()=>{
 const result=lookupArtifact({...artifact,groups:artifact.groups.map(g=>({...g,links:[]}))},{chapterId:'chapter-1',locale:'vi',revision:1,start:10,end:18,text:'tốt bụng'});
 expect(result.status).toBe('context-only');expect(result.passages[0].target.text).toBe('A kind person.');expect(result.passages[0].highlights).toEqual([]);
});
it('does not accept corrupt out-of-bounds worker artifacts',()=>{
 expect(()=>validateAlignmentArtifact(artifact)).not.toThrow();
 expect(()=>validateAlignmentArtifact({...artifact,groups:[{...artifact.groups[0],en:{start:0,end:99}}]})).toThrow();
});
it('chooses the strongest contextual group when automatic candidates overlap',()=>{
 const noisy={...artifact,groups:[{...artifact.groups[0],id:'weak',score:.77,margin:0,links:[]},...artifact.groups]};
 const result=lookupArtifact(noisy,{chapterId:'chapter-1',locale:'vi',revision:1,start:10,end:18,text:'tốt bụng'});
 expect(result.passages).toHaveLength(1);expect(result.passages[0].highlights).toEqual([{start:2,end:6}]);
});
it('anchors a unique transliterated proper name in its matched sentence rather than another name',()=>{
 const vi='Cẩm Giàng ở Tây Đô.',en='Cam Giang near Tay Do.';
 const named={...artifact,editions:{vi:{...artifact.editions.vi,text:vi},en:{...artifact.editions.en,text:en}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[]}]};
 for(const locale of ['vi','en'] as const){
  const text=locale==='vi'?'Cẩm Giàng':'Cam Giang',target=locale==='vi'?'en':'vi';
  const result=lookupArtifact(named,{chapterId:'chapter-1',locale,revision:named.editions[locale].revision,start:0,end:text.length,text});
  expect(result.passages[0].highlights.map(s=>named.editions[target].text.slice(s.start,s.end))).toEqual([locale==='vi'?'Cam Giang':'Cẩm Giàng']);
 }
});
it('keeps the complete Vietnamese compound identified by the worker',()=>{
 const compound={...artifact,editions:{...artifact.editions,vi:{...artifact.editions.vi,words:[{start:10,end:18}]}},groups:[{...artifact.groups[0],links:[{vi:[14,18] as [number,number],en:[2,6] as [number,number],score:.8}]}]};
 const result=lookupArtifact(compound,{chapterId:'chapter-1',locale:'en',revision:2,start:2,end:6,text:'kind'});
 expect(result.passages[0].highlights).toEqual([{start:10,end:18}]);
});
