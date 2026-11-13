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
it('uses contextual groups without requiring a duplicate refinedGroups payload',()=>{
 const a={...artifact,algorithm:'labse-context-mbert-1',refinementVersion:1 as const};
 const result=lookupArtifact(a,{chapterId:'chapter-1',locale:'vi',revision:1,start:10,end:18,text:'tốt bụng'});
 expect(result.passages[0]?.highlights.map(s=>a.editions.en.text.slice(s.start,s.end))).toEqual(['kind']);
});
it('does not claim a complete counterpart across an excluded metadata gap',()=>{
 const first='Mở đầu.',gap='(*) Nguyên văn: Tên khác.',last='Kết thúc.',vi=first+gap+last,en='A translated paragraph.';
 const a:AlignmentArtifact={...artifact,algorithm:'labse-context-mbert-1',refinementVersion:1,editions:{vi:{...artifact.editions.vi,text:vi,breaks:[first.length,first.length+gap.length]},en:{...artifact.editions.en,text:en}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},parts:{vi:[{start:0,end:first.length},{start:first.length+gap.length,end:vi.length}],en:[{start:0,end:en.length}]},links:[]}]};
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start:0,end:vi.length,text:vi});
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 expect(()=>validateAlignmentArtifact({...a,groups:[{...a.groups[0],parts:{vi:[{start:0,end:999}],en:a.groups[0].parts!.en}}]})).toThrow();
});
it('refuses a stale revision or wrong source quote',()=>{
 const request={chapterId:'chapter-1',locale:'vi' as const,revision:2,start:10,end:18,text:'tốt bụng'};
 expect(lookupArtifact(artifact,request).status).toBe('stale');expect(lookupArtifact(artifact,{...request,revision:1,text:'other'}).status).toBe('stale');
});
it('returns sentence context when no trustworthy word link exists',()=>{
 const result=lookupArtifact({...artifact,groups:artifact.groups.map(g=>({...g,links:[]}))},{chapterId:'chapter-1',locale:'vi',revision:1,start:10,end:18,text:'tốt bụng'});
 expect(result.status).toBe('context-only');expect(result.passages[0].target.text).toBe('A kind person.');expect(result.passages[0].highlights).toEqual([]);
});
it('does not advertise half of a selected content phrase as its full counterpart',()=>{
 const vi='Cờ đỏ xanh bay.',en='The red and blue flags wave.';
 const a={...artifact,editions:{vi:{...artifact.editions.vi,text:vi},en:{...artifact.editions.en,text:en}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[{vi:[3,5] as [number,number],en:[4,7] as [number,number],score:.95}]}]};
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start:3,end:10,text:'đỏ xanh'});
 expect(r.status).toBe('context-only');expect(r.passages[0].highlights).toEqual([]);expect(r.passages[0].target.text).toBe(en);
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

const viLead='Rượu say nằm ngủ, ông Hồ chiêm bao thấy một người đến nói với mình rằng:',viLine='- Tôi vâng chỉ của đức vua tôi, mời ngài đến chơi nói chuyện.';
const enLead='Heavy with wine, he lay down to sleep and dreamed that a messenger came to him, saying:',enLine='By command of my sovereign, I have come to invite you for a visit and a conversation.';
function dialogueArtifact():AlignmentArtifact{
 const vi=viLead+viLine,en=enLead+'"'+enLine+'"';
 const span=(text:string,word:string,from=0)=>{const at=text.indexOf(word,from);return [at,at+word.length] as [number,number];};
 return {...artifact,editions:{vi:{...artifact.editions.vi,text:vi,breaks:[viLead.length]},en:{...artifact.editions.en,text:en,breaks:[enLead.length]}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[
  ['Tôi','I'],['chỉ','command'],['của','of'],['đức','sovereign'],['vua','sovereign'],['tôi','my'],['mời','invite'],['ngài','you'],['đến','to'],['chuyện','conversation'],
 ].map(([left,right])=>({vi:span(vi,left,viLead.length),en:span(en,right,enLead.length),score:.95}))}]} ;
}
it('returns the whole counterpart dialogue sentence in both directions, even inside a larger group',()=>{
 const a=dialogueArtifact();
 for(const locale of ['vi','en'] as const){
  const quote=locale==='vi'?viLine:enLine,target=locale==='vi'?'en':'vi',start=a.editions[locale].text.indexOf(quote);
  const r=lookupArtifact(a,{chapterId:a.chapterId,locale,revision:a.editions[locale].revision,start,end:start+quote.length,text:quote});
  expect(r.passages.flatMap(p=>p.highlights.map(s=>a.editions[target].text.slice(s.start,s.end)))).toEqual([locale==='vi'?enLine:viLine.slice(2)]);
 }
});
it('does not pass a lone English function word off as the meaning of a content phrase',()=>{
 const a=dialogueArtifact(),text='đến chơi',start=a.editions.vi.text.indexOf(text,viLead.length);
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start,end:start+text.length,text});
 expect(r.status).toBe('context-only');expect(r.passages[0].highlights).toEqual([]);
});
it('keeps a short phrase precise rather than expanding it to the entire dialogue',()=>{
 const a=dialogueArtifact(),text='mời ngài',start=a.editions.vi.text.indexOf(text,viLead.length);
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start,end:start+text.length,text});
 expect(r.passages[0].highlights.map(s=>a.editions.en.text.slice(s.start,s.end))).toEqual(['invite you']);
});
it('does not turn a long partial phrase into a whole sentence based on character ratio',()=>{
 const vi='Đó là một người tốt bụng.',en='That is a kind person.',phrase='một người tốt bụng';
 const at=(text:string,quote:string)=>{const start=text.search(new RegExp('(?<![\\p{L}\\p{M}])'+quote+'(?![\\p{L}\\p{M}])','u'));return [start,start+quote.length] as [number,number];};
 const a={...artifact,editions:{vi:{...artifact.editions.vi,text:vi},en:{...artifact.editions.en,text:en}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[['một','a'],['người','person'],['tốt','kind'],['bụng','kind']].map(([left,right])=>({vi:at(vi,left),en:at(en,right),score:.95}))}]};
 const start=vi.indexOf(phrase),r=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start,end:start+phrase.length,text:phrase});
 expect(r.passages[0].highlights.map(s=>en.slice(s.start,s.end))).toEqual(['a kind person']);
});
it('preserves both target sentences when the complete source group is selected',()=>{
 const vi='Anh tới còn cô đi.',en='He arrived. She left.';
 const a={...artifact,editions:{vi:{...artifact.editions.vi,text:vi},en:{...artifact.editions.en,text:en}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[{vi:[0,3] as [number,number],en:[0,2] as [number,number],score:.9},{vi:[4,7] as [number,number],en:[3,10] as [number,number],score:.9},{vi:[12,14] as [number,number],en:[12,15] as [number,number],score:.9},{vi:[15,17] as [number,number],en:[16,20] as [number,number],score:.9}]}]};
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'vi',revision:1,start:0,end:vi.length,text:vi});
 expect(r.passages[0].highlights.map(s=>en.slice(s.start,s.end))).toEqual([en]);
});
it('recognizes a complete verse line without requiring selection of its footnote marker',()=>{
 const beforeVi='Cái thế anh hùng sức nhổ núi,',lineVi='Sở ca bốn mặt lệ tràn lan,',vi=beforeVi+lineVi+' (21)';
 const beforeEn='A peerless hero with the strength to lift the mountains,',lineEn='Four faces of Chu songs, and tears streaming wide',en=beforeEn+lineEn+' (21),';
 const pair=(left:string,right:string)=>{const l=vi.indexOf(left,beforeVi.length),r=en.indexOf(right,beforeEn.length);return {vi:[l,l+left.length] as [number,number],en:[r,r+right.length] as [number,number],score:.95};};
 const a={...artifact,editions:{vi:{...artifact.editions.vi,text:vi,breaks:[beforeVi.length]},en:{...artifact.editions.en,text:en,breaks:[beforeEn.length]}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[pair('bốn','Four'),pair('mặt','faces'),pair('tràn lan','streaming wide')]}]};
 for(const locale of ['vi','en'] as const){
  const quote=locale==='vi'?lineVi:lineEn,target=locale==='vi'?'en':'vi',start=a.editions[locale].text.indexOf(quote);
  const r=lookupArtifact(a,{chapterId:a.chapterId,locale,revision:a.editions[locale].revision,start,end:start+quote.length,text:quote});
  expect(r.passages.flatMap(p=>p.highlights.map(s=>a.editions[target].text.slice(s.start,s.end)))).toEqual([locale==='vi'?lineEn+' (21),':lineVi]);
 }
});
it('narrows a coarse bilingual group to the two corresponding lines rather than all neighboring text',()=>{
 const en='Five years of struggle.Only a burial.',vi='Câu khác.Một câu khác nữa.Năm năm hoài công.Còn được vùi trong mả.Ghi chú khác.';
 const from=(text:string,quote:string)=>{const start=text.indexOf(quote);return [start,start+quote.length] as [number,number];};
 const a={...artifact,editions:{vi:{...artifact.editions.vi,text:vi,breaks:['Một','Năm','Còn','Ghi'].map(s=>vi.indexOf(s))},en:{...artifact.editions.en,text:en,breaks:[en.indexOf('Only')]}},groups:[{...artifact.groups[0],vi:{start:0,end:vi.length},en:{start:0,end:en.length},links:[['Năm','Five'],['công','struggle'],['Còn','Only'],['mả','burial']].map(([left,right])=>({vi:from(vi,left),en:from(en,right),score:.95}))}]};
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'en',revision:2,start:0,end:en.length,text:en});
 expect(r.passages[0].target.text).toBe('Năm năm hoài công.Còn được vùi trong mả.');
 expect(r.passages[0].highlights.map(s=>vi.slice(s.start,s.end))).toEqual(['Năm năm hoài công.Còn được vùi trong mả.']);
});
it('joins consecutive counterpart groups without a false gap in the middle',()=>{
 const vi='Anh tới.Cô đi.',en='He arrived.She left.';
 const a={...artifact,editions:{vi:{...artifact.editions.vi,text:vi,breaks:[8]},en:{...artifact.editions.en,text:en,breaks:[11]}},groups:[{...artifact.groups[0],vi:{start:0,end:8},en:{start:0,end:11},links:[]},{...artifact.groups[0],id:'1',vi:{start:8,end:vi.length},en:{start:11,end:en.length},links:[]}]};
 const r=lookupArtifact(a,{chapterId:a.chapterId,locale:'en',revision:2,start:0,end:en.length,text:en});
 expect(r.passages).toHaveLength(1);expect(r.passages[0].target.text).toBe(vi);expect(r.sourceBreaks).toEqual([11]);
});
