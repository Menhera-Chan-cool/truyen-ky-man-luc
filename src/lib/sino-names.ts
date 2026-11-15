import table from "../data/sino-pinyin.json";
// Chinese names stand in Sino-Vietnamese in the Vietnamese edition ("Chương Hàm") and in pinyin in the English one ("Zhang Han"): two readings of the same characters.
// src/data/sino-pinyin.json maps each Sino-Vietnamese syllable to the pinyin syllables (no tones) of the characters it reads, from Unihan (see docs/UNIHAN-NOTICE.md).
const toPinyin=table as Record<string,string[]>;
let toVi:Map<string,string[]>|null=null;
const reverse=()=>{if(toVi)return toVi;toVi=new Map();for(const [v,ps] of Object.entries(toPinyin))for(const p of ps)toVi.set(p,[...(toVi.get(p)??[]),v]);return toVi;};
const letters=(s:string)=>s.normalize("NFD").replace(/\p{M}/gu,"").replace(/[đĐ]/g,m=>m==="đ"?"d":"D").toLowerCase().replace(/[^a-z]/g,"");
export const viSyllables=(name:string)=>(name.normalize("NFC").match(/[\p{L}\p{M}]+/gu)??[]).map(w=>w.toLowerCase());
/** The Vietnamese syllables read as the pinyin string (every syllable known, the concatenation of one pinyin reading each equal to the string). */
export function viMatchesPinyin(vi:string[],pinyin:string):boolean{
  const target=letters(pinyin);if(!vi.length||!target)return false;
  const go=(i:number,at:number):boolean=>i===vi.length?at===target.length:(toPinyin[vi[i]]??[]).some(p=>target.startsWith(p,at)&&go(i+1,at+p.length));
  return go(0,0);
}
/** Segmentations of a pinyin string into known syllables, each with the Vietnamese readings that may stand for it (at most a handful of segmentations). */
export function pinyinSegments(pinyin:string):string[][]{
  const target=letters(pinyin),map=reverse(),out:string[][]=[];
  const go=(at:number,acc:string[])=>{if(out.length>=8)return;if(at===target.length){out.push(acc);return;}for(let n=Math.min(6,target.length-at);n>=1;n--){const s=target.slice(at,at+n);if(map.has(s))go(at+n,[...acc,s]);}};
  go(0,[]);return out;
}
export const vietnameseReadings=(pinyinSyllable:string)=>new Set(reverse().get(pinyinSyllable)??[]);
