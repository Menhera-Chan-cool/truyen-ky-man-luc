import {expect,it} from 'vitest';
import {lookupArtifact,type AlignmentArtifact} from '../src/lib/novel-lookup';
function fixture(score=.95,margin=.1):AlignmentArtifact{
 const vi='Thật diệu tuyệt.',en='Wonderful flowers.';
 return {schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'',editions:{vi:{text:vi,revision:1,versionId:'00000000-0000-4000-8000-000000000001',hash:'a'.repeat(64),words:[{start:5,end:15}]},en:{text:en,revision:1,versionId:'00000000-0000-4000-8000-000000000002',hash:'b'.repeat(64)}},groups:[{id:'0',section:'story',score,margin,vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[{vi:[10,15],en:[10,17],score:.64}]}]};
}
function query(a:AlignmentArtifact,quote:string){const start=a.editions.en.text.indexOf(quote);return lookupArtifact(a,{chapterId:a.chapterId,locale:'en',revision:1,start,end:start+quote.length,text:quote});}
it.each([[.499,-.03],[.8,-.03],[.49,.1]])('does not advertise a strong token vote inside an unreliable prose group: %s/%s',(score,margin)=>{
 const r=query(fixture(score,margin),'flowers');expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('rejects a target compound claimed more strongly by another content word',()=>{
 const a=fixture();a.groups[0].links.push({vi:[5,7],en:[0,9],score:.99});
 const r=query(a,'flowers');expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
});
it('keeps a supported word in a reliable prose group',()=>{
 const r=query(fixture(),'flowers');expect(r.passages[0].highlights).toHaveLength(1);
});
it('does not bypass parent confidence when a single word fills the entire group',()=>{
 const a=fixture(.49,-.03);a.editions.en.text='flowers';a.groups[0].en={start:0,end:7};a.groups[0].links=[{vi:[10,15],en:[0,7],score:.95}];
 expect(query(a,'flowers').status).toBe('context-only');
});
it('does not present disconnected word votes as one complete partial prose phrase',()=>{
 const a=fixture(),vi='Đỏ rất lâu rồi xanh.',en='The red blue colors shine.';
 a.editions.vi={...a.editions.vi,text:vi,words:undefined};a.editions.en={...a.editions.en,text:en};
 a.groups[0]={...a.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[{vi:[0,2],en:[4,7],score:.9},{vi:[15,19],en:[8,12],score:.9}]};
 const r=query(a,'red blue');expect(r.status).toBe('uncertain');expect(r.passages.flatMap(p=>p.highlights)).toHaveLength(2);
});
it.each([['flowers','hoa'],['thoughts','ý']])('separates a noisy Vietnamese compound only with complete independent word evidence: %s',(source,expected)=>{
 const a=fixture(),vi='lời hoa ý gấm',en='words flowers thoughts brocade';
 a.editions.vi={...a.editions.vi,text:vi,words:[{start:0,end:3},{start:4,end:9},{start:10,end:13}]};a.editions.en={...a.editions.en,text:en};
 a.groups[0]={...a.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[{vi:[0,3],en:[0,5],score:.95},{vi:[4,7],en:[6,13],score:.7},{vi:[8,9],en:[14,22],score:.99},{vi:[10,13],en:[23,30],score:.95}]};
 const r=query(a,source);expect(r.passages.flatMap(p=>p.highlights.map(s=>vi.slice(s.start,s.end)))).toEqual([expected]);
 const start=vi.indexOf(expected),reverse=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start,end:start+expected.length,text:expected});
 expect(reverse.passages.flatMap(p=>p.highlights.map(s=>en.slice(s.start,s.end)))).toEqual([source]);
 const both=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start:4,end:9,text:'hoa ý'});
 expect(both.passages.flatMap(p=>p.highlights.map(s=>en.slice(s.start,s.end)))).toEqual(['flowers thoughts']);
});
