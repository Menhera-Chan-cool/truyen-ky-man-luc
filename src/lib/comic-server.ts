import "server-only";
import { publicClient, HttpError } from "./server";
import type { ComicDraft } from "./comic";
import type { ComicSummary } from "./comic-db";
import type { ComicHead } from "./comic-publication";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function publicComic(chapterId: string) {
  const client=publicClient();
  const [edition,index]=await Promise.all([client.rpc("get_public_comic",{p_id:chapterId}),client.rpc("get_public_comic_index")]);
  if(edition.error||index.error) throw new HttpError("Cannot load comics. Please retry.",503);
  return {edition:edition.data as ComicDraft|null, summaries:index.data as ComicSummary[]};
}
export async function comicHead(client: SupabaseClient, chapterId: string): Promise<ComicHead> {
  const {data:head,error}=await client.from("comic_editions").select("draft_id,published_id,revision").eq("chapter_id",chapterId).maybeSingle();
  if(error) throw new HttpError("Cannot load comic drafts. Please retry.",503);
  if(!head) return {draft:null,publishedRevision:null,revision:0};
  const ids=[head.draft_id,head.published_id].filter(Boolean);
  const {data:versions,error:versionError}=await client.from("comic_versions").select("id,chapter_id,title,direction,pages,revision,created_at").in("id",ids);
  if(versionError) throw new HttpError("Cannot load comic version. Please retry.",503);
  const draft=versions?.find(v=>v.id===head.draft_id), published=versions?.find(v=>v.id===head.published_id);
  return {revision:head.revision,publishedRevision:published?.revision??null,draft:draft?{
    id:draft.chapter_id,title:draft.title,direction:draft.direction,pages:draft.pages,revision:head.revision,updatedAt:Date.parse(draft.created_at)
  }:null};
}
