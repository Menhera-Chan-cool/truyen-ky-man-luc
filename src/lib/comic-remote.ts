"use client";
import {browserClient,adminRequest} from "./supabase";
import {comicMime,type ComicDraft,type ComicPage} from "./comic";
import type {ComicHead} from "./comic-publication";
import type {Locale} from "./types";
export const readSharedComic=(id:string,locale:Locale):Promise<ComicHead>=>adminRequest(`comic?chapter=${encodeURIComponent(id)}&locale=${locale}`,undefined,"GET");
export async function saveSharedComic(draft:ComicDraft,locale:Locale,uploaded:Map<string,ComicPage>,progress:(s:string)=>void):Promise<ComicHead> {
  const client=browserClient(), {data:{user},error}=await client.auth.getUser();
  if(error||!user) throw Error("Please sign in again");
  const pages:ComicPage[]=[];
  for(const page of draft.pages) {
    if(page.path?.startsWith("/api/comic/assets/")) {pages.push(page);continue;}
    const cached=uploaded.get(page.id);
    if(cached&&cached.hash===page.hash) {pages.push(cached);continue;}
    progress(`${pages.length+1}/${draft.pages.length}`);
    let blob=page.blob;
    if(!blob&&/^\/comic-demo\/demo-0[12]\.png$/.test(page.path??"")) {
      const response=await fetch(page.path!);if(!response.ok) throw Error("Cannot load sample image");blob=await response.blob();
    }
    if(!blob||blob.size<1||blob.size>20*1024*1024) throw Error("Invalid image or image exceeds 20 MB");
    const mime=comicMime(new Uint8Array(await blob.slice(0,16).arrayBuffer()));
    if(!mime) throw Error("Unsupported image");
    const path=`${user.id}/comics/${crypto.randomUUID()}.${mime==="image/jpeg"?"jpg":mime.slice(6)}`;
    const {error:uploadError}=await client.storage.from("comic-assets").upload(path,blob,{contentType:mime,upsert:false});
    if(uploadError) throw Error(uploadError.message);
    const asset=await adminRequest("comic/assets",{path});
    const saved={id:page.id,name:page.name,...asset} as ComicPage;
    uploaded.set(page.id,saved);pages.push(saved);
  }
  return adminRequest("comic",{action:"save",locale,draft:{...draft,pages}});
}
export const publishSharedComic=(id:string,locale:Locale,revision:number,withdraw=false):Promise<ComicHead>=>
  adminRequest("comic",{action:withdraw?"withdraw":"publish",locale,id,revision});
