// Footnote anchors: the footnote marker "(n)" sits right after a term in both editions, with the same n, so the word before it is a parallel anchor in prose.
// Usage: npx tsx scripts/align-novel/anchor-eval.ts ARTIFACT_DIR REPORT.json
// Each anchor is looked up in both directions (the last word before the marker). A hit is a highlight that overlaps the last word ("main") or one of the last three words ("window") before the other edition's marker.
// The gold is the marker position, not a labelled counterpart: it is exact for names and noisy for common words, so the report splits the anchors by kind (name with the same letters ignoring accents, other name, common word).
import fs from 'node:fs';import {lookupArtifact,validateAlignmentArtifact} from '../../src/lib/novel-lookup';
// Footnote markers "(n)" sit right after a term in both editions; the n-th marker of one edition is the n-th marker of the other.
const dir=process.argv[2],out=process.argv[3];
type Span={start:number;end:number};
const rows:any[]=[];
for(let ch=1;ch<=20;ch++){
 const a=validateAlignmentArtifact(JSON.parse(fs.readFileSync(dir+'/chapter-'+ch+'.json','utf8')));
 const E:any=a.editions;
 const markers=(l:'vi'|'en')=>{const t=E[l].text,m=new Map<number,number[]>();for(const x of t.matchAll(/(?<=[\p{L}\p{M}])\s?\((\d{1,3})\)/gu)){const n=+x[1];m.set(n,[...(m.get(n)??[]),x.index!]);}return m;};
 const mv=markers('vi'),me=markers('en');
 const words=(l:'vi'|'en'):Span[]=>E[l].words??[...E[l].text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((m:any)=>({start:m.index,end:m.index+m[0].length}));
 const W={vi:words('vi'),en:words('en')};
 const lastWords=(l:'vi'|'en',at:number,k:number)=>{ // up to k words before position at, no sentence punctuation between
  const t=E[l].text,ws=W[l].filter(w=>w.end<=at).slice(-k),res:Span[]=[];
  for(let i=ws.length-1;i>=0;i--){const next=res[0]?res[0].start:at;if(/[.!?;:,"”“]/u.test(t.slice(ws[i].end,next)))break;res.unshift(ws[i]);}
  return res;};
 for(const [n,pv] of mv){const pe=me.get(n);if(!pe||pv.length!==1||pe.length!==1)continue;
  const av=lastWords('vi',pv[0],1)[0],ae3=lastWords('en',pe[0],3),ae=ae3.at(-1),av3=lastWords('vi',pv[0],3);
  if(!av||!ae)continue;
  for(const l of ['vi','en'] as const){
   const o=l==='vi'?'en':'vi',sel=l==='vi'?av:ae,tgt=l==='vi'?ae3:av3,tgtMain=l==='vi'?ae:av3.at(-1)!;
   const r=lookupArtifact(a,{chapterId:a.chapterId,locale:l,revision:E[l].revision,start:sel.start,end:sel.end,text:E[l].text.slice(sel.start,sel.end)});
   const hl=r.passages.flatMap((p:any)=>p.highlights) as Span[];
   const ov=(s:Span,t:Span)=>s.start<t.end&&s.end>t.start;
   const inWin=hl.filter(h=>tgt.some(t=>ov(h,t))),onMain=hl.filter(h=>ov(h,tgtMain));
   rows.push({chapter:ch,n,dir:l+'->'+o,sel:E[l].text.slice(sel.start,sel.end),gold:tgt.map(t=>E[o].text.slice(t.start,t.end)).join(' '),goldMain:E[o].text.slice(tgtMain.start,tgtMain.end),
    status:r.status,answered:hl.length>0,hitMain:onMain.length>0,hitWin:inWin.length>0,
    got:hl.map(h=>E[o].text.slice(h.start,h.end)),exactMain:hl.length>0&&hl.every(h=>tgt.some(t=>h.start>=t.start&&h.end<=t.end)&&true)});
  }}
}
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const kind=(x:any)=>/^\p{Lu}/u.test(x.sel)?(x.sel.split(/\s+/).some((w:string)=>fold(w).length>=2&&x.gold.split(/\s+/).some((g:string)=>fold(g)===fold(w)))?'name, same letters':'name, other spelling'):'common word';
for(const r of rows)r.kind=kind(r);
fs.writeFileSync(out,JSON.stringify(rows,null,1));
for(const k of ['name, same letters','name, other spelling','common word']){const r=rows.filter(x=>x.kind===k),ans=r.filter(x=>x.answered).length,hit=r.filter(x=>x.hitWin).length;console.log(k.padEnd(22),JSON.stringify({n:r.length,answered:+(ans/Math.max(r.length,1)).toFixed(3),hitOfAll:+(hit/Math.max(r.length,1)).toFixed(3),hitOfAnswered:+(hit/Math.max(ans,1)).toFixed(3)}));}
for(const d of ['vi->en','en->vi','all']){const r=rows.filter(x=>d==='all'||x.dir===d),n=r.length,ans=r.filter(x=>x.answered).length;
 console.log(d,JSON.stringify({n,answered:ans,hitMain:r.filter(x=>x.hitMain).length,hitWin:r.filter(x=>x.hitWin).length,recallMain:+(r.filter(x=>x.hitMain).length/n).toFixed(3),recallWin:+(r.filter(x=>x.hitWin).length/n).toFixed(3),precWin:+(r.filter(x=>x.hitWin).length/Math.max(ans,1)).toFixed(3),withinWin:r.filter(x=>x.exactMain).length}));}
