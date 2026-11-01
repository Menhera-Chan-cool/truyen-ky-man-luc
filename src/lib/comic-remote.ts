"use client";
import {browserClient,adminRequest} from "./supabase";
import {comicMime,type ComicDraft,type ComicPage} from "./comic";
import type {ComicHead} from "./comic-publication";
import type {Locale} from "./types";
import {readUploadCheckpoint,writeUploadCheckpoint,type UploadCheckpoint} from "./comic-recovery";
async function deadline<T>(run:(signal:AbortSignal)=>PromiseLike<T>,ms=15000):Promise<T>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve().then(()=>run(controller.signal)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{const error=new Error("Hết thời gian chờ / Request timed out. Bản nháp vẫn được giữ; hãy kiểm tra mạng rồi thử lại.");error.name="TimeoutError";controller.abort(error);reject(error);},ms);})]);}finally{clearTimeout(timer);}
}
const request=(path:string,body?:unknown,method="POST")=>deadline(signal=>adminRequest(path,body,method,signal),path==="comic/assets"?45000:15000);
const uncertain=(error:unknown)=>error instanceof TypeError||error instanceof SyntaxError||(error instanceof Error&&["TimeoutError","AbortError"].includes(error.name))||Number((error as {status?:number})?.status)>=500;
async function confirmWrite(write:()=>Promise<ComicHead>,id:string,locale:Locale,matches:(head:ComicHead)=>boolean):Promise<ComicHead>{
 try{return await write();}catch(error){
  if(!uncertain(error))throw error;
  try{const head=await readSharedComic(id,locale);if(matches(head))return head;}catch{}
  throw Error("Chưa xác nhận được kết quả trên server / Server outcome unknown. Giữ bản nháp và tải lại để kiểm tra trước khi lưu hoặc xuất bản lại.");
 }
}
export const readSharedComic=(id:string,locale:Locale):Promise<ComicHead>=>request(`comic?chapter=${encodeURIComponent(id)}&locale=${locale}`,undefined,"GET");
export async function saveSharedComic(draft:ComicDraft,locale:Locale,uploaded:Map<string,UploadCheckpoint>,progress:(s:string)=>void,warning:(s:string)=>void=()=>{}):Promise<ComicHead> {
  const client=browserClient(), {data:{user},error}=await deadline(()=>client.auth.getUser());
  if(error||!user) throw Error("Please sign in again");
  const owner=user.id,scope={accountId:owner,chapterId:draft.id,locale},pages:ComicPage[]=new Array(draft.pages.length);
  let cursor=0,done=0,failure:unknown;
  async function checkpoint(page:ComicPage,value:UploadCheckpoint){uploaded.set(page.id,value);try{await writeUploadCheckpoint(scope,page,value);}catch{warning("checkpoint");}}
  async function upload(page:ComicPage,index:number){
    if(page.path?.startsWith("/api/comic/assets/")) {pages[index]=page;return;}
    let cached=uploaded.get(page.id);
    if(cached?.hash!==page.hash)cached=undefined;
    if(!cached)try{cached=await readUploadCheckpoint(scope,page);}catch{warning("checkpoint");}
    if(cached?.phase==="registered"&&cached.asset) {pages[index]=cached.asset;return;}
    let blob=page.blob;
    if(!blob&&/^\/comic-demo\/demo-0[12]\.png$/.test(page.path??"")) {
      blob=await deadline(async signal=>{const response=await fetch(page.path!,{signal});if(!response.ok)throw Error("Cannot load sample image");return response.blob();});
    }
    if(!blob||blob.size<1||blob.size>20*1024*1024) throw Error("Invalid image or image exceeds 20 MB");
    const mime=comicMime(new Uint8Array(await blob.slice(0,16).arrayBuffer()));
    if(!mime) throw Error("Unsupported image");
    const path=cached?.path??`${owner}/comics/${crypto.randomUUID()}.${mime==="image/jpeg"?"jpg":mime.slice(6)}`;
    if(cached?.phase==="uploading"){
      try{const asset=await request("comic/assets",{path});if(asset.hash!==page.hash||asset.bytes!==page.bytes)throw Error("Uploaded image does not match the original");const saved={id:page.id,name:page.name,...asset} as ComicPage;await checkpoint(page,{path,hash:page.hash,phase:"registered",asset:saved});pages[index]=saved;return;}
      catch(error){if(Number((error as {status?:number}).status)!==400)throw error;}
    }
    if(cached?.phase!=="uploaded"){
      await checkpoint(page,{path,hash:page.hash,phase:"uploading"});
      // Storage uploads may finish after timeout; the immutable checkpoint path confirms late completion.
      const {error:uploadError}=await deadline(()=>client.storage.from("comic-assets").upload(path,blob!,{contentType:mime,upsert:false}),120000);
      // A previous upload may have completed before its response was lost. Registration verifies its hash.
      if(uploadError&&Number(uploadError.statusCode)!==409) throw Error(uploadError.message);
      await checkpoint(page,{path,hash:page.hash,phase:"uploaded"});
    }
    const asset=await request("comic/assets",{path});
    if(asset.hash!==page.hash||asset.bytes!==page.bytes)throw Error("Uploaded image does not match the original. Keep the draft and retry.");
    const saved={id:page.id,name:page.name,...asset} as ComicPage;
    await checkpoint(page,{path,hash:page.hash,phase:"registered",asset:saved});pages[index]=saved;
  }
  async function worker(){while(!failure&&cursor<draft.pages.length){const index=cursor++;try{progress(`${done}/${draft.pages.length} · ${draft.pages[index].name}`);await upload(draft.pages[index],index);done++;progress(`${done}/${draft.pages.length}`);}catch(e){failure=e;}}}
  await Promise.all([worker(),worker()]);
  if(failure)throw failure;
  const saved={...draft,pages};
  const content=(d:ComicDraft)=>JSON.stringify({title:d.title.trim(),direction:d.direction,pages:d.pages.map(({id,name,path,width,height,bytes,hash})=>({id,name,path,width,height,bytes,hash}))});
  return confirmWrite(()=>request("comic",{action:"save",locale,draft:saved}),draft.id,locale,head=>head.revision===draft.revision+1&&!!head.draft&&content(head.draft)===content(saved));
}
export async function publishSharedComic(id:string,locale:Locale,revision:number,withdraw=false):Promise<ComicHead>{
 const before=await readSharedComic(id,locale);
 if(before.revision!==revision)throw Error("Conflict: reload the latest comic draft");
 return confirmWrite(()=>request("comic",{action:withdraw?"withdraw":"publish",locale,id,revision}),id,locale,head=>head.revision===revision+1&&(withdraw?head.publishedRevision===null:before.draftRevision!=null&&head.publishedRevision===before.draftRevision));
}
