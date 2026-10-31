"use client";
import {browserClient,adminRequest} from "./supabase";
import {comicMime,type ComicDraft,type ComicPage} from "./comic";
import type {ComicHead} from "./comic-publication";
import type {Locale} from "./types";
import {readUploadCheckpoint,writeUploadCheckpoint,type UploadCheckpoint} from "./comic-recovery";
export const readSharedComic=(id:string,locale:Locale):Promise<ComicHead>=>adminRequest(`comic?chapter=${encodeURIComponent(id)}&locale=${locale}`,undefined,"GET");
export async function saveSharedComic(draft:ComicDraft,locale:Locale,uploaded:Map<string,UploadCheckpoint>,progress:(s:string)=>void,warning:(s:string)=>void=()=>{}):Promise<ComicHead> {
  const client=browserClient(), {data:{user},error}=await client.auth.getUser();
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
      const response=await fetch(page.path!);if(!response.ok) throw Error("Cannot load sample image");blob=await response.blob();
    }
    if(!blob||blob.size<1||blob.size>20*1024*1024) throw Error("Invalid image or image exceeds 20 MB");
    const mime=comicMime(new Uint8Array(await blob.slice(0,16).arrayBuffer()));
    if(!mime) throw Error("Unsupported image");
    const path=cached?.path??`${owner}/comics/${crypto.randomUUID()}.${mime==="image/jpeg"?"jpg":mime.slice(6)}`;
    if(cached?.phase!=="uploaded"){
      await checkpoint(page,{path,hash:page.hash,phase:"uploading"});
      const {error:uploadError}=await client.storage.from("comic-assets").upload(path,blob,{contentType:mime,upsert:false});
      // A previous upload may have completed before its response was lost. Registration verifies its hash.
      if(uploadError&&Number(uploadError.statusCode)!==409) throw Error(uploadError.message);
      await checkpoint(page,{path,hash:page.hash,phase:"uploaded"});
    }
    const asset=await adminRequest("comic/assets",{path});
    if(asset.hash!==page.hash||asset.bytes!==page.bytes)throw Error("Uploaded image does not match the original. Keep the draft and retry.");
    const saved={id:page.id,name:page.name,...asset} as ComicPage;
    await checkpoint(page,{path,hash:page.hash,phase:"registered",asset:saved});pages[index]=saved;
  }
  async function worker(){while(!failure&&cursor<draft.pages.length){const index=cursor++;try{progress(`${done}/${draft.pages.length} · ${draft.pages[index].name}`);await upload(draft.pages[index],index);done++;progress(`${done}/${draft.pages.length}`);}catch(e){failure=e;}}}
  await Promise.all([worker(),worker()]);
  if(failure)throw failure;
  return adminRequest("comic",{action:"save",locale,draft:{...draft,pages}});
}
export const publishSharedComic=(id:string,locale:Locale,revision:number,withdraw=false):Promise<ComicHead>=>
  adminRequest("comic",{action:withdraw?"withdraw":"publish",locale,id,revision});
