import type {Locale} from './types';
import type {TextSpan} from './novel-lookup';
export type PoetryHint=TextSpan&{id:string;lines:TextSpan[];title?:TextSpan;evidence:'br'|'verse-block'|'named-poem'|'couplet';flattened?:boolean;renderingBreaks?:number[]};
export type PoetryBlock=TextSpan&{tag:string;emphasis:TextSpan[];bold:TextSpan[];brs:number[]};
const marker=/^(?:(?:[IVXLCDM]+[.)]?|\d{1,3})$|(?:lời\s+(?:bình|bàn)|critique|notes|chú\s+(?:thích|giải)|ghi chú)\s*[:：]?$|(?:\(\*\)|\*)?\s*(?:nguyên văn|original title)\s*:|chapter\s+\d|chương\s+\d)/iu;
const intro=/(?:poem|verses?|quatrain|couplet|following\s+(?:piece|lines)|lines\s+such\s+as|two\s+lines|funeral\s+oration|elegy|ngâm\s+rằng|nối(?:\s+được)?\s+vần|ứng\s+khẩu|(?:có|hai|vài|mấy)\s+câu|(?:bài|câu|đoạn)\s+(?:thơ|thi|phú|ca|từ)|(?:ngâm|vịnh|đề|đọc|viết|làm|chép|tặng)(?:\s+[\p{L}\p{M}]+){0,3}\s+(?:thơ|thi|phú)|(?:thơ|thi|phú)\s+(?:rằng|sau)|văn\s+tế)/iu;
const count=(s:string)=>(s.replace(/\(\d{1,3}\)/g,' ').match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)??[]).length;
const dialogue=(s:string)=>/^[\-–—"“”‘’«»]/u.test(s);
export function poetryHints(text:string,blocks:PoetryBlock[],locale:Locale):PoetryHint[]{
 const trim=(p:TextSpan):TextSpan=>{const s=text.slice(p.start,p.end);return {start:p.start+s.length-s.trimStart().length,end:p.end-(s.length-s.trimEnd().length)}};
 const value=(p:TextSpan)=>text.slice(p.start,p.end);
 const rhetorical=(s:string)=>!!title&&count(s)<=12&&/[?？]/u.test(s)&&/,$/u.test(s);
 const verseColon=(s:string)=>!!title&&run.length>=2&&count(s)<=12&&/[:：]$/u.test(s)&&!/(?:nói|hỏi|đáp|rằng|said|asked|replied)\s*[:：]$/iu.test(s);
 const lineLike=(p:TextSpan,explicit=false,continued=false)=>{const s=value(p).replace(/\(\d{1,3}\)/g,' ').trim();return count(s)>=2&&count(s)<=(explicit||continued?40:18)&&s.length<=300&&!dialogue(s)&&(!s.endsWith(':')||explicit||verseColon(s))&&!marker.test(s)&&(explicit||((!/[.!?]\s+(?=\p{Lu})/u.test(s)||rhetorical(s))&&!/[:：]\s*["“]/u.test(s)));};
 const spans=(p:TextSpan,cuts:number[])=>[p.start,...cuts.filter(c=>c>p.start&&c<p.end),p.end].sort((a,b)=>a-b)
  .filter((n,i,a)=>!i||n!==a[i-1]).flatMap((start,i,a)=>i===a.length-1?[]:[trim({start,end:a[i+1]})]).filter(p=>p.end>p.start&&value(p)!=='/');
 const newlineCuts=(p:TextSpan)=>[...value(p).matchAll(/\r?\n|\s+\/\s+/gu)].flatMap(m=>[p.start+m.index,p.start+m.index+m[0].length]);
 const poems:PoetryHint[]=[];let run:TextSpan[]=[],style=false,trigger=false,title:TextSpan|undefined,namedCollection=false,renderingBreaks:number[]=[];
 const add=(lines:TextSpan[],evidence:PoetryHint['evidence'],label?:TextSpan,flattened=false,possibleBreaks:number[]=[])=>{
  if(locale==='vi'&&lines.length>=4){
   const frequencies=new Map<number,number>();for(const p of lines){const n=count(value(p));if(n>=5&&n<=8)frequencies.set(n,(frequencies.get(n)??0)+1);}
   const dominant=[...frequencies].sort((a,b)=>b[1]-a[1])[0];
   if(dominant&&dominant[1]>=4)lines=lines.flatMap(p=>{
    const analysis=value(p).replace(/\(\d{1,3}\)/g,m=>' '.repeat(m.length));
    const cuts=[...analysis.matchAll(/[,;]\s+(?=\p{Lu})/gu)].map(m=>p.start+m.index+m[0].length),parts=spans(p,cuts);
    return parts.length>=2&&parts.length<=3&&parts.every(q=>count(value(q))===dominant[0])?parts:[p];
   });
  }
  if(!lines.length)return;const start=lines[0].start,end=lines.at(-1)!.end;
  if(poems.some(p=>p.start===start&&p.end===end))return;
  poems.push({id:'poem-'+start,start,end,lines,title:label,evidence, ...(flattened?{flattened:true}:{}),...(possibleBreaks.length?{renderingBreaks:possibleBreaks}:{})});
 };
 const flush=()=>{if(run.length>=2&&(style||trigger||title||run.length>=4))add(run,title?'named-poem':run.length===2?'couplet':'verse-block',title,false,renderingBreaks);run=[];style=false;trigger=false;title=undefined;renderingBreaks=[];};
 const clean=blocks.map(b=>({...b,...trim(b)})).filter(b=>b.end>b.start);
 for(let index=0;index<clean.length;index++){
  const block=clean[index],s=value(block);if(!s.trim())continue;
  if(marker.test(s)){flush();continue;}
  const credit=s.replace(/^[([]|[)\]]$/gu,'').trim();
  if(count(credit)>=4&&count(credit)<=14&&(/\bdịch\s+(?:thơ|nghĩa)$/iu.test(credit)||/^(?:translated|translation)\s+by\s/iu.test(credit))){flush();namedCollection=false;continue;}
  if(/^(?:Nghĩa là|Dịch(?: thơ| nghĩa)?|Diễn nghĩa|Translation)\s*[:：]?$/iu.test(s)){
   const before=poems.length;flush();const previous=poems.at(-1);
   if(poems.length>before||(previous&&previous.end===clean[index-1]?.end)){trigger=true;title=previous?.title;namedCollection=!!title;}
   continue;
  }
  if(trigger&&!run.length&&/^(?:It is said|Rằng|Nói rằng)\s*[:：]$/iu.test(s))continue;
  const bold=block.bold.find(p=>p.start===block.start&&count(value(p))<=12&&!marker.test(value(p)));
  const wholeBold=!!bold&&value({start:bold.end,end:block.end}).trim()==='';
  const ordinalTitle=/^(?:Bài|Bức|Khúc|Thiên)\s+(?:thứ\s+)?[\p{L}\p{M}\d]+\s*[:：]\s*\S/iu.test(s);
  const genreTitle=/^(?:Bài|Khúc|Thiên)\s+(?:ca|thơ|từ|phú|vịnh)(?=\s|$)[^.!?：:]{0,90}$/iu.test(s);
  const plainTitle=locale==='vi'&&(!run.length||namedCollection)&&count(s)<=4&&!/[.,;!?：:]$/u.test(s)&&clean.slice(index+1,index+5).length===4&&clean.slice(index+1,index+5).every(p=>lineLike(p));
  if((wholeBold||plainTitle||ordinalTitle||genreTitle)&&s.length<=100){flush();title={start:block.start,end:block.end};trigger=true;namedCollection=true;continue;}
  let body:TextSpan={start:block.start,end:block.end},label=title;
  if(bold&&bold.end<block.end&&block.brs.some(p=>p>=bold.end)){
   flush();label=trim(bold);body=trim({start:bold.end,end:block.end});
  }
  const emphasis=block.emphasis.filter(p=>p.start>=body.start&&p.end<=body.end&&count(value(p))>=2)
   .filter((p,i,a)=>!a.some((q,j)=>j!==i&&q.start<=p.start&&q.end>=p.end&&(q.start<p.start||q.end>p.end||j<i)));
  const bodyLetters=Math.max(1,value(body).replace(/[^\p{L}\p{M}]/gu,'').length);
  const italicLetters=emphasis.reduce((n,p)=>n+value(p).replace(/[^\p{L}\p{M}]/gu,'').length,0),italic=italicLetters/bodyLetters>=.7;
  const split=spans(body,[...block.brs,...newlineCuts(body)]);
  if(split.length>=2&&split.every(p=>lineLike(p,true))&&(italic||trigger||label||split.length>=4)){
   const active=label;flush();add(split,active?'named-poem':'br',active);continue;
  }
  if(emphasis.length>=2&&italic&&emphasis.every(p=>lineLike(p,true))){
   const active=label;flush();add(emphasis.map(trim),active?'named-poem':'verse-block',active);continue;
  }
  // Quoted couplets can sit inside prose; retain only the actual emphasized quote.
  if(!italic)for(const em of emphasis){const lines=spans(em,[...block.brs,...newlineCuts(em)]);if(lines.length>=2&&lines.every(p=>lineLike(p,true)))add(lines,'couplet');}
  if(!run.length&&(trigger||label)&&!italic&&count(value(body))>=20&&(value(body).match(/[.!?](?:\s|$)/gu)?.length??0)>=2){const active=label;flush();add([body],active?'named-poem':'verse-block',active,true);continue;}
  if(lineLike(body,italic,locale==='en'&&run.length>=2&&(trigger||!!title||style||run.length>=4))){
   if(run.length&&style!==italic)flush();
   if(run.length>=4&&rhetorical(value(body).replace(/\(\d{1,3}\)/g,' ').trim()))renderingBreaks.push(body.start);
   run.push(body);style=italic;continue;
  }
  const activeTitle=label,activeTrigger=trigger,wasEmpty=!run.length;flush();
  if(wasEmpty&&(activeTrigger||activeTitle)&&count(value(body))>=20&&body.end-body.start<=16000){add([body],activeTitle?'named-poem':'verse-block',activeTitle,true);continue;}
  const cue=s.replace(/\(\d{1,3}\)/g,' ').trim();
  namedCollection=false;
  if(intro.test(cue.slice(-180))&&/[:：]$/u.test(cue)){trigger=true;}
 }
 flush();return poems.sort((a,b)=>a.start-b.start||a.end-b.end);
}
