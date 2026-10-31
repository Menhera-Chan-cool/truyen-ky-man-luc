"use client";
import {openDB} from "idb";
import {comicMime,validComicDraft,type ComicDraft,type ComicPage} from "./comic";
import type {Locale} from "./types";
export type RecoveryScope={accountId:string;chapterId:string;locale:Locale};
export type UploadCheckpoint={path:string;hash:string;phase:"uploading"|"uploaded"|"registered";asset?:ComicPage};
type PageRecord=Omit<ComicPage,"blob">&{imageKey?:string};
type RecordDraft=Omit<ComicDraft,"pages">&{pages:PageRecord[]};
type RecoveryRecord={key:string;scope:string;sequence:number;savedAt:number;draft?:RecordDraft;discarded?:boolean};
export type RecoveryCandidate={key:string;sequence:number;savedAt:number;title:string;revision:number;pages:number};
let connection:ReturnType<typeof openDB>|undefined;
function db(){return connection??=openDB("tkml-comic-editor-recovery",1,{upgrade(d){d.createObjectStore("drafts",{keyPath:"key"}).createIndex("scope","scope");d.createObjectStore("images");d.createObjectStore("uploads");}});}
export function recoveryScope(s:RecoveryScope){
  if(!/^[a-f0-9-]{36}$/.test(s.accountId)||!/^[a-z0-9-]{1,80}$/.test(s.chapterId)||!["vi","en"].includes(s.locale))throw Error("Invalid recovery context");
  return `${s.accountId}:${s.locale}:${s.chapterId}`;
}
export const recoveryKey=(s:RecoveryScope,session:string)=>`${recoveryScope(s)}:${session}`;
function checkDraft(draft:ComicDraft){validComicDraft({...draft,title:typeof draft.title==="string"&&!draft.title.trim()?"Untitled":draft.title});return draft;}
export async function writeRecovery(scope:RecoveryScope,session:string,sequence:number,draft:ComicDraft){
  checkDraft(draft);if(draft.id!==scope.chapterId||!Number.isSafeInteger(sequence)||sequence<0)throw Error("Invalid recovery draft");
  const store=await db(),key=recoveryKey(scope,session),buffers=new Map<string,ArrayBuffer>(),sources=new Map<string,Blob>();
  const pages=draft.pages.map(p=>{const {blob,...meta}=p;if(!blob)return meta;const imageKey=`${scope.accountId}:${p.hash}`;sources.set(imageKey,blob);return {...meta,imageKey};});
  for(let attempt=0;attempt<3;attempt++){
    const tx=store.transaction(["drafts","images"],"readwrite");
    try{
      const current=await tx.objectStore("drafts").get(key) as RecoveryRecord|undefined;
      if(current&&current.sequence>=sequence){await tx.done;return false;}
      const missing:string[]=[];
      for(const imageKey of sources.keys())if(!buffers.has(imageKey)&&await tx.objectStore("images").getKey(imageKey)===undefined)missing.push(imageKey);
      if(missing.length){await tx.done;for(const imageKey of missing)buffers.set(imageKey,await sources.get(imageKey)!.arrayBuffer());continue;}
      for(const [imageKey,data] of buffers)if(await tx.objectStore("images").getKey(imageKey)===undefined)await tx.objectStore("images").put(data,imageKey);
      const record:RecoveryRecord={key,scope:recoveryScope(scope),sequence,savedAt:Date.now(),draft:{...draft,pages}};
      await tx.objectStore("drafts").put(record);await tx.done;return true;
    }catch(e){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw e;}
  }
  throw Error("Recovery storage changed. Retry saving.");
}
export async function listRecoveries(scope:RecoveryScope):Promise<RecoveryCandidate[]>{
  const records=await (await db()).getAllFromIndex("drafts","scope",recoveryScope(scope)) as RecoveryRecord[];
  return records.filter(r=>!r.discarded&&r.draft&&Array.isArray(r.draft.pages)).map(r=>({key:r.key,sequence:r.sequence,savedAt:r.savedAt,title:r.draft!.title,revision:r.draft!.revision,pages:r.draft!.pages.length})).sort((a,b)=>b.savedAt-a.savedAt);
}
export async function readRecovery(scope:RecoveryScope,key:string):Promise<ComicDraft>{
  const store=await db(),record=await store.get("drafts",key) as RecoveryRecord|undefined;
  if(!record?.draft||record.discarded||record.scope!==recoveryScope(scope))throw Error("Recovery draft unavailable");
  const pages:ComicPage[]=[];
  for(const p of record.draft.pages){
    const {imageKey,...meta}=p;
    if(!imageKey){pages.push(meta);continue;}
    if(imageKey!==`${scope.accountId}:${p.hash}`)throw Error("Invalid recovery image");
    const data=await store.get("images",imageKey) as ArrayBuffer|undefined;
    if(!(data instanceof ArrayBuffer)||data.byteLength!==p.bytes||data.byteLength>20*1024*1024)throw Error("Recovery image unavailable");
    const mime=comicMime(new Uint8Array(data,0,Math.min(16,data.byteLength)));if(!mime)throw Error("Invalid recovery image");
    pages.push({...meta,blob:new Blob([data],{type:mime})});
  }
  return checkDraft({...record.draft,pages});
}
export async function discardRecovery(scope:RecoveryScope,key:string,sequence:number,expectedSequence?:number){
  const store=await db(),tx=store.transaction(["drafts","images"],"readwrite");
  try{
    const drafts=tx.objectStore("drafts"),current=await drafts.get(key) as RecoveryRecord|undefined;
    if(current&&(current.scope!==recoveryScope(scope)||current.sequence>sequence||expectedSequence!==undefined&&current.sequence!==expectedSequence)){await tx.done;return false;}
    await drafts.put({key,scope:recoveryScope(scope),sequence,savedAt:Date.now(),discarded:true} satisfies RecoveryRecord);
    const records=await drafts.getAll() as RecoveryRecord[],used=new Set(records.flatMap(r=>r.discarded?[]:r.draft?.pages.flatMap(p=>p.imageKey?[p.imageKey]:[])??[]));
    for(const imageKey of await tx.objectStore("images").getAllKeys())if(typeof imageKey==="string"&&imageKey.startsWith(scope.accountId+":")&&!used.has(imageKey))await tx.objectStore("images").delete(imageKey);
    await tx.done;return true;
  }catch(e){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw e;}
}
const uploadKey=(scope:RecoveryScope,page:ComicPage)=>`${recoveryScope(scope)}:${page.id}:${page.hash}`;
export async function readUploadCheckpoint(scope:RecoveryScope,page:ComicPage):Promise<UploadCheckpoint|undefined>{
  const r=await (await db()).get("uploads",uploadKey(scope,page)) as UploadCheckpoint|undefined;
  if(!r||r.hash!==page.hash||!new RegExp(`^${scope.accountId}/comics/[a-f0-9-]{36}\\.(png|jpg|webp)$`).test(r.path)||!["uploading","uploaded","registered"].includes(r.phase))return;
  return r;
}
export async function writeUploadCheckpoint(scope:RecoveryScope,page:ComicPage,value:UploadCheckpoint){await (await db()).put("uploads",value,uploadKey(scope,page));}
export async function clearUploadCheckpoints(scope:RecoveryScope,pages:ComicPage[]){
  const store=await db(),tx=store.transaction("uploads","readwrite");for(const p of pages)await tx.store.delete(uploadKey(scope,p));await tx.done;
}
