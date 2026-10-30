import { validComicDraft, type ComicDraft } from "./comic";
export type ComicHead = { draft: ComicDraft | null; publishedRevision: number | null; revision: number };
export const comicAssetPath = (path: unknown): path is string =>
  typeof path === "string" && /^[a-f0-9-]{36}\/comics\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path);
export function publicationDraft(value: unknown): ComicDraft {
  const d = validComicDraft(value as ComicDraft);
  if (!Number.isSafeInteger(d.revision) || d.revision < 0) throw Error("Invalid revision");
  if (d.pages.some(p => p.blob || !p.path?.startsWith("/api/comic/assets/") ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(p.id) || !/^[a-f0-9]{64}$/.test(p.hash)))
    throw Error("Upload and register every comic page before saving");
  return {...d, title:d.title.trim(), pages:d.pages.map(({id,name,path,width,height,bytes,hash})=>({id,name,path,width,height,bytes,hash}))};
}
