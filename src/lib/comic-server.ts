import "server-only";
import { publicClient, HttpError } from "./server";
import type { ComicDraft } from "./comic";
import type { ComicSummary } from "./comic-db";
import type { ComicHead } from "./comic-publication";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {Locale} from "./types";
import {publicRead,readFetch} from "./public-read";
export async function publicComic(chapterId: string,locale:Locale) {
  const [edition,index]=await Promise.all([
    publicRead(signal=>publicClient(readFetch(signal)).rpc("get_public_comic",{p_id:chapterId,p_locale:locale})),
    publicRead(signal=>publicClient(readFetch(signal)).rpc("get_public_comic_index",{p_locale:locale}))
  ]);
  if(edition.error||index.error) throw new HttpError("Cannot load comics. Please retry.",503);
  return {edition:edition.data as ComicDraft|null, summaries:index.data as ComicSummary[]};
}
export async function comicHead(client: SupabaseClient, chapterId: string,locale:Locale): Promise<ComicHead> {
  const {data:head,error}=await client.from("comic_editions").select("draft_id,published_id,revision").eq("chapter_id",chapterId).eq("locale",locale).maybeSingle();
  if(error) throw new HttpError("Cannot load comic drafts. Please retry.",503);
  if(!head) return {draft:null,publishedRevision:null,revision:0};
  const ids=[head.draft_id,head.published_id].filter(Boolean);
  const {data:versions,error:versionError}=await client.from("comic_versions").select("id,chapter_id,title,direction,pages,revision,created_at").eq("locale",locale).in("id",ids);
  if(versionError) throw new HttpError("Cannot load comic version. Please retry.",503);
  const draft=versions?.find(v=>v.id===head.draft_id), published=versions?.find(v=>v.id===head.published_id);
  return {revision:head.revision,draftRevision:draft?.revision??null,publishedRevision:published?.revision??null,draft:draft?{
    id:draft.chapter_id,title:draft.title,direction:draft.direction,pages:draft.pages,revision:head.revision,updatedAt:Date.parse(draft.created_at)
  }:null};
}
