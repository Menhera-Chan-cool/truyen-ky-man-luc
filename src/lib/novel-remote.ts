"use client";
import {adminRequest} from "./supabase";
import {uncertainRequest} from "./request-deadline";
import {cleanHtml} from "./sanitize";
type Selection={id:string;locale:string;expectedRevision:number};
type Save=Selection&{title:string;html:string;kind:string;pdfPath?:string|null};
type Mutation=Partial<Save>&{action?:string;items?:Save[];ids?:string[];meta?:unknown;publish?:boolean};
type Head={chapter_id:string;locale:string;revision:number;draft_id:string|null;published_id:string|null};
type State={editions:Head[];chapters:{id:string}[];book:{revision:number;draft:unknown;published:unknown}};
const headFor=(state:State,item:Partial<Selection>)=>state.editions.find(h=>h.chapter_id===item.id&&h.locale===item.locale);
function sameJson(a:unknown,b:unknown){
 const ordered=(_key:string,value:unknown)=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value;
 return JSON.stringify(a,ordered)===JSON.stringify(b,ordered);
}
async function saved(state:State,item:Save){
 const head=headFor(state,item);if(!head?.draft_id||head.revision!==item.expectedRevision+1)return false;
 const version=await adminRequest(`chapters?id=${encodeURIComponent(item.id)}&locale=${item.locale}&version=${head.draft_id}`,undefined,"GET");
 return version.chapter_id===item.id&&version.locale===item.locale&&version.revision===item.expectedRevision+1&&version.title===item.title&&version.html===cleanHtml(item.html)&&version.kind===item.kind&&(version.pdf_path??null)===(item.pdfPath??null);
}
async function matches(path:string,write:Mutation,state:State,before?:State){
 if(path==="book")return state.book.revision===write.expectedRevision!+1&&sameJson(state.book.draft,write.meta)&&(!write.publish||sameJson(state.book.published,write.meta));
 if(write.action==="reorder")return state.book.revision===write.expectedRevision!+1&&sameJson(state.chapters.map(c=>c.id),write.ids);
 if(write.action==="archive")return !state.chapters.some(c=>c.id===write.id);
 if(["publish","withdraw","publish-batch"].includes(write.action??"")){
  const items=write.action==="publish-batch"?write.items??[]:[write];
  return items.length>0&&items.every(item=>{const old=before&&headFor(before,item),head=headFor(state,item);return !!old&&!!head&&old.revision===item.expectedRevision&&head.revision===item.expectedRevision&&head.draft_id===old.draft_id&&head.published_id===(write.action==="withdraw"?null:old.draft_id);});
 }
 const items=write.action==="import"?write.items??[]:[write as Save];
 if(!items.length)return false;
 for(let i=0;i<items.length;i+=4)if((await Promise.all(items.slice(i,i+4).map(item=>saved(state,item)))).some(ok=>!ok))return false;
 return true;
}
export async function novelRequest(path:string,body?:unknown,method="POST",signal?:AbortSignal){
 if(!body||method!=="POST"||!["chapters","book"].includes(path))return adminRequest(path,body,method,signal);
 const write=body as Mutation;
 const before=path==="chapters"&&["publish","withdraw","publish-batch"].includes(write.action??"")?await adminRequest("state",undefined,"GET",signal) as State:undefined;
 try{return await adminRequest(path,body,method,signal,write.action==="import"||write.action==="publish-batch"?30000:15000);}
 catch(error){
  if(!uncertainRequest(error)||signal?.aborted)throw error;
  try{const state=await adminRequest("state",undefined,"GET",signal) as State;if(await matches(path,write,state,before))return {data:null,reconciled:true};}catch{}
  throw Error("Chưa xác nhận được kết quả trên server / Server outcome unknown. Giữ phần đang sửa và tải lại bản server để kiểm tra trước khi lưu hoặc xuất bản lại.");
 }
}
