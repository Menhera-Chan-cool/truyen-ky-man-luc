// Sentence-level measure with confidence intervals and a tolerance for 1-to-n sentence splits.
// usage: npx tsx scripts/align-novel/measure-sentences.ts DATA_DIR OUT.json GOLD.json [GOLD2.json ...]
// GOLD files are {gold:[{chapter,stratum?,source?,vi:[s,e],en:[s,e]}]}; pairs repeated in several files are counted once.
// Per directional case (the sentence of one edition selected, the other edition's gold sentence is the target):
//   answered      the lookup highlights something
//   strict hit    character-span F1 >= .5 against the gold (the protocol's old definition)
//   tolerant hit  strict hit, or the highlight covers the gold (recall >= .9) and is at most 1.6 times what the selected sentence should translate to, or lies inside the gold (precision >= .9) and is at least half of that size:
//                 the English often splits one Vietnamese sentence into several, so a right answer can be longer or shorter than the single gold sentence
//   context has gold  a returned passage contains the whole gold span (the grouping is right even where nothing is highlighted)
// Rates carry a Wilson 95% interval; a target is "met" only when the LOWER bound reaches it.
import fs from 'node:fs';import {lookupArtifact,validateAlignmentArtifact} from '../../src/lib/novel-lookup';
const [dir,out,...goldFiles]=process.argv.slice(2);
if(!dir||!out||!goldFiles.length)throw Error('usage: measure-sentences.ts DATA_DIR OUT.json GOLD.json [GOLD2.json ...]');
type Gold={chapter:number;stratum?:string;source?:string;vi:[number,number];en:[number,number]};
const seen=new Set<string>(),gold:Gold[]=[];
for(const f of goldFiles)for(const g of JSON.parse(fs.readFileSync(f,'utf8')).gold as Gold[]){const k=g.chapter+':'+g.vi+':'+g.en;if(!seen.has(k)){seen.add(k);gold.push(g);}}
const memo=new Map<number,any>();const art=(n:number)=>{if(!memo.has(n))memo.set(n,validateAlignmentArtifact(JSON.parse(fs.readFileSync(dir+'/chapter-'+n+'.json','utf8'))));return memo.get(n);};
const wilson=(k:number,n:number,z=1.96)=>{if(!n)return [0,0];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),s=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [(c-s)/d,(c+s)/d];};
const rows:any[]=[];
for(const g of gold){const a=art(g.chapter);
 for(const locale of ['vi','en'] as const){const other=locale==='vi'?'en':'vi',span=g[locale],want=g[other],text=a.editions[locale].text;
  const r=lookupArtifact(a,{chapterId:a.chapterId,locale,revision:a.editions[locale].revision,start:span[0],end:span[1],text:text.slice(span[0],span[1])});
  const hl=r.passages.flatMap((p:any)=>p.highlights),inter=(s:any)=>Math.max(0,Math.min(s.end,want[1])-Math.max(s.start,want[0]));
  const hit=hl.reduce((n:number,s:any)=>n+inter(s),0),tot=hl.reduce((n:number,s:any)=>n+s.end-s.start,0),goldLen=want[1]-want[0];
  const P=tot?hit/tot:0,R=hit/goldLen,F=P+R?2*P*R/(P+R):0;
  // what the selected sentence should translate to, in characters (the median English/Vietnamese length ratio of the gold pairs is 1.17)
  const expected=(span[1]-span[0])*(locale==='vi'?1.17:1/1.17);
  const strict=F>=.5,tolerant=strict||(R>=.9&&tot<=1.6*expected)||(P>=.9&&tot>=.5*expected);
  rows.push({chapter:g.chapter,stratum:g.stratum??'dev',source:g.source??'note',locale,answered:hl.length>0,strict,tolerant,wrong:hl.length>0&&hit===0,ctx:r.passages.some((p:any)=>p.target.start<=want[0]&&p.target.end>=want[1]),P,R});}}
const metric=(rs:any[])=>{const n=rs.length,c=(f:(r:any)=>boolean)=>rs.filter(f).length,ans=c(r=>r.answered);
 const rate=(k:number,d:number)=>({k,n:d,rate:d?k/d:0,ci:wilson(k,d)});
 return {n,coverage:rate(ans,n),strictOfAll:rate(c(r=>r.strict),n),tolerantOfAll:rate(c(r=>r.tolerant),n),tolerantOfAnswered:rate(c(r=>r.answered&&r.tolerant),ans),wrongOfAnswered:rate(c(r=>r.wrong),ans),contextHasGold:rate(c(r=>r.tolerant||r.ctx),n)};};
const groups:Record<string,any[]>={all:rows,'vi->en':rows.filter(r=>r.locale==='vi'),'en->vi':rows.filter(r=>r.locale==='en')};
const report:Record<string,any>={};for(const [k,v] of Object.entries(groups))report[k]=metric(v);
fs.writeFileSync(out,JSON.stringify({checkedAt:new Date().toISOString(),pairs:gold.length,report,rows}));
const f=(x:any)=>`${(100*x.rate).toFixed(1)}% [${(100*x.ci[0]).toFixed(1)}-${(100*x.ci[1]).toFixed(1)}] (${x.k}/${x.n})`;
console.log(`pairs ${gold.length}`);
for(const [k,m] of Object.entries(report))console.log(`${k.padEnd(7)} n=${m.n} coverage ${f(m.coverage)} | strict hit of all ${f(m.strictOfAll)} | tolerant hit of all ${f(m.tolerantOfAll)} | tolerant of answered ${f(m.tolerantOfAnswered)} | wrong of answered ${f(m.wrongOfAnswered)} | context has gold ${f(m.contextHasGold)}`);
