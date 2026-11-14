import {expect,it} from 'vitest';
import {lookupArtifact,validateAlignmentArtifact,type AlignmentArtifact,type TextSpan} from '../src/lib/novel-lookup';

const span=(text:string,quote:string,from=0):TextSpan=>({start:text.indexOf(quote,from),end:text.indexOf(quote,from)+quote.length});
function fixture(){
 const lines={vi:['Mây về núi.','Mưa rơi sân.'],en:['Clouds return.','Rain falls.']};
 const lead={vi:'Ông hỏi rằng: ',en:'He asked: '},tail={vi:'Có đúng không?',en:'Is that true?'};
 const dialogue={vi:lead.vi+'“'+lines.vi.join(' / ')+'” '+tail.vi,en:lead.en+'“'+lines.en.join(' / ')+'” '+tail.en};
 const texts={vi:lines.vi.join('\n')+'\n'+dialogue.vi+'\nLời bình:\nMột lời bình.\nChú thích:\n(1) Mây: Một cảnh vật.',en:lines.en.join('\n')+'\n'+dialogue.en+'\nCritique\nA comment.\nNotes\n(7) Clouds: A scene.'};
 const edition=(l:'vi'|'en')=>({text:texts[l],breaks:[...texts[l].matchAll(/\n/g)].map(m=>m.index+1),revision:1,versionId:'00000000-0000-4000-8000-000000000001',hash:'a'.repeat(64)});
 const a:AlignmentArtifact={schema:1,codec:'reader-dom-1',algorithm:'test',chapterId:'chapter-1',createdAt:'',editions:{vi:edition('vi'),en:edition('en')},groups:[],poems:[],poetryScopes:{vi:[],en:[]}};
 const track=(l:'vi'|'en',quoted:boolean)=>{const from=quoted?texts[l].indexOf(dialogue[l]):0,ls=lines[l].map(q=>span(texts[l],q,from));return {id:l+(quoted?'-quoted':'-original'),start:ls[0].start,end:ls[1].end,lines:ls};};
 for(const l of ['vi','en'] as const){
  const other=l==='vi'?'en':'vi',source=track(l,true),target=track(other,false);
  a.poems!.push({vi:l==='vi'?source:target,en:l==='en'?source:target,score:.8,margin:.1,primary:{vi:true,en:true},correspondences:source.lines.map((s,i)=>({vi:l==='vi'?[s]:[target.lines[i]],en:l==='en'?[s]:[target.lines[i]],score:.8,evidence:'direct-window'}))});
  a.poetryScopes![l]=[track(l,false),source];
 }
 for(const q of [lead,tail])a.groups.push({id:String(a.groups.length),section:'story',score:.95,margin:.1,vi:span(texts.vi,q.vi,texts.vi.indexOf(dialogue.vi)),en:span(texts.en,q.en,texts.en.indexOf(dialogue.en)),links:[]});
 const v=span(texts.vi,'(1) Mây:'),e=span(texts.en,'(7) Clouds:');
 a.notePairs=[{vi:{start:v.start,end:texts.vi.length},en:{start:e.start,end:texts.en.length},score:.95,margin:.1}];
 return {a,dialogue,lines,lead,tail};
}
function query(a:AlignmentArtifact,l:'vi'|'en',s:TextSpan){return lookupArtifact(a,{chapterId:a.chapterId,locale:l,revision:1,...s,text:a.editions[l].text.slice(s.start,s.end)});}

it.each(['vi','en'] as const)('preserves the whole mixed dialogue and its quoted occurrence: %s',l=>{
 const {a,dialogue}=fixture(),other=l==='vi'?'en':'vi',r=query(a,l,span(a.editions[l].text,dialogue[l]));
 const text=r.passages.map(p=>p.target.text).join('\n');
 expect(text).toContain(other==='vi'?'Ông hỏi':'He asked');expect(text).toContain(other==='vi'?'Có đúng không?':'Is that true?');
 const floor=a.editions[other].text.indexOf(dialogue[other]);
 expect(r.passages.every(p=>p.target.start>=floor&&p.target.end<=floor+dialogue[other].length)).toBe(true);
});
it.each(['vi','en'] as const)('keeps standalone poetry behavior when only the quote is selected: %s',l=>{
 const {a,dialogue,lines}=fixture(),other=l==='vi'?'en':'vi',r=query(a,l,span(a.editions[l].text,lines[l].join(' / '),a.editions[l].text.indexOf(dialogue[l])));
 expect(r.passages[0].target.text).toBe(lines[other].join('\n'));expect(r.passages[0].highlights).toHaveLength(1);
});
it('processes critique and its body separately instead of dropping either',()=>{
 const {a}=fixture(),vi=span(a.editions.vi.text,'Một lời bình.'),en=span(a.editions.en.text,'A comment.');
 a.groups.push({id:'critique',section:'critique',vi,en,score:.95,margin:.1,links:[]});
 const r=query(a,'en',span(a.editions.en.text,'Critique\nA comment.'));
 expect(r.passages.map(p=>p.target.text).join('\n')).toBe('Lời bình\nMột lời bình.');
});
it('does not advertise a complete result when part of the source has no counterpart',()=>{
 const {a,dialogue,tail}=fixture();a.groups=a.groups.filter(g=>a.editions.en.text.slice(g.en.start,g.en.end)!==tail.en);
 const r=query(a,'en',span(a.editions.en.text,dialogue.en));
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 expect(r.unmatchedSource?.some(s=>a.editions.en.text.slice(s.start,s.end).includes(tail.en))).toBe(true);
});
it('does not let a matched poem hide an explicit unpaired poem',()=>{
 const {a,dialogue,lines}=fixture(),start=a.editions.en.text.indexOf(dialogue.en),s=span(a.editions.en.text,lines.en.join(' / '),start);
 a.poems=[];const r=query(a,'en',span(a.editions.en.text,dialogue.en));
 expect(r.status).toBe('context-only');expect(r.passages.flatMap(p=>p.highlights)).toEqual([]);
 expect(r.unmatchedSource?.some(p=>p.start<=s.start&&p.end>=s.end)).toBe(true);
});
it('preserves a semantic note and its heading without assuming note numbers',()=>{
 const {a}=fixture(),v=a.editions.vi.text.indexOf('(1)'),e=a.editions.en.text.indexOf('(7)');
 const r=query(a,'en',{start:a.editions.en.text.indexOf('Notes'),end:a.editions.en.text.length});
 expect(r.passages.map(p=>p.target.text).join('\n')).toContain('Chú thích');
 expect(r.passages.some(p=>p.source.start===e&&p.target.start===v)).toBe(true);
});
it('keeps partial verse queries inside the local quote without inventing a precise counterpart',()=>{
 const {a,dialogue}=fixture(),start=a.editions.en.text.indexOf(dialogue.en),end=a.editions.en.text.indexOf('Rain',start)+4;
 const r=query(a,'en',{start,end});
 expect(r.status).toBe('context-only');
 expect(r.passages.flatMap(p=>p.highlights).every(s=>s.start>=a.editions.vi.text.indexOf(dialogue.vi))).toBe(true);
});
it('does not mutate canonical poems, links, source text or revision bindings',()=>{
 const {a,dialogue}=fixture(),before=structuredClone(a);query(a,'en',span(a.editions.en.text,dialogue.en));
 expect(a).toEqual(before);
});
it('does not change the mixed result when unrelated content is added after its source blocks',()=>{
 const {a,dialogue}=fixture(),s=span(a.editions.en.text,dialogue.en),before=query(a,'en',s);
 for(const l of ['vi','en'] as const){a.editions[l].breaks!.push(a.editions[l].text.length);a.editions[l].text+='\nUnrelated material.';}
 expect(query(a,'en',s)).toEqual(before);
});
it('tracks uncovered source text even for an ordinary prose selection',()=>{
 const {a,lead}=fixture(),from=a.editions.en.text.indexOf(lead.en),end=from+lead.en.length;
 a.poems=[];a.poetryScopes={vi:[],en:[]};a.groups=a.groups.filter(g=>g.en.start!==from);
 const r=query(a,'en',{start:from,end});expect(r.status).toBe('unavailable');
 expect(r.unmatchedSource).toEqual([{start:from,end}]);
});
it('retains UTF16 positions with decomposed Vietnamese and supplementary characters',()=>{
 const a:AlignmentArtifact=JSON.parse(JSON.stringify(fixture().a));
 for(const l of ['vi','en'] as const){
  const prefix=l==='vi'?'😀 A\u0301. ':'😀 A. ',e=a.editions[l],n=prefix.length;
  const shift=(s:TextSpan)=>{s.start+=n;s.end+=n;};
  e.text=prefix+e.text;e.breaks=e.breaks!.map(b=>b+n);e.breaks.unshift(n);
  for(const g of a.groups)shift(g[l]);
  for(const p of a.poems!){shift(p[l]);p[l].lines.forEach(shift);p.correspondences.forEach(c=>c[l].forEach(shift));}
  for(const p of a.poetryScopes![l])shift(p);
  for(const p of a.notePairs!)shift(p[l]);
 }
 expect(()=>validateAlignmentArtifact(a)).not.toThrow();
 const start=a.editions.en.text.indexOf('He asked:'),end=a.editions.en.text.indexOf('Is that true?',start)+'Is that true?'.length;
 const r=query(a,'en',{start,end});
 expect(r.passages.map(p=>p.target.text).join('\n')).toContain('Ông hỏi');
 for(const p of r.passages){expect(a.editions.en.text.slice(p.source.start,p.source.end)).toBe(p.source.text);expect(a.editions.vi.text.slice(p.target.start,p.target.end)).toBe(p.target.text);}
});
