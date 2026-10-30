"use client";
import { openDB } from "idb";
import type {Locale} from "./types";
import { useEffect, useRef, useState } from "react";
import {
  comicMime,
  validComicDraft,
  type ComicDraft,
  type ComicPage,
} from "./comic";
type StoredComicDraft = Omit<ComicDraft, "pages"> & {
  pages: (Omit<ComicPage, "blob"> & { data?: ArrayBuffer; blob?: Blob })[];
};
export async function serializeComicDraft(
  draft: ComicDraft,
): Promise<StoredComicDraft> {
  const pages: StoredComicDraft["pages"] = [];
  for (const page of draft.pages) {
    const { blob, ...rest } = page;
    pages.push(blob ? { ...rest, data: await blob.arrayBuffer() } : rest);
  }
  return { ...draft, pages };
}
export function restoreComicDraft(stored: StoredComicDraft): ComicDraft {
  return validComicDraft({
    ...stored,
    pages: stored.pages.map((page) => {
      if (!page.data) return page as ComicPage;
      if (
        !(page.data instanceof ArrayBuffer) ||
        page.data.byteLength > 20 * 1024 * 1024
      )
        throw Error("Dữ liệu trang ảnh không hợp lệ.");
      const mime = comicMime(
        new Uint8Array(page.data, 0, Math.min(16, page.data.byteLength)),
      );
      if (!mime) throw Error("Dữ liệu trang ảnh không hợp lệ.");
      const { data, ...rest } = page;
      return {
        ...rest,
        bytes: data.byteLength,
        blob: new Blob([data], { type: mime }),
      };
    }),
  });
}
const connection = () =>
  openDB("tkml-comic-local-preview", 1, {
    upgrade(db) {
      db.createObjectStore("chapters", { keyPath: "id" });
      db.createObjectStore("preferences");
    },
  });
let db: ReturnType<typeof connection> | undefined;
const getDB = () => (db ??= connection());
export async function readComicDraft(
  id: string,
  locale:Locale="vi",
): Promise<ComicDraft | undefined> {
  const d = await (await getDB()).get("chapters",locale==="vi"?id:`en:${id}`);
  return d ? restoreComicDraft({...d,id}) : undefined;
}
export type ComicSummary = {
  id: string;
  title: string;
  pages: number;
  updatedAt: number;
  source: "local" | "sample" | "missing" | "published";
};
export async function localComicSummaries(locale:Locale="vi"): Promise<ComicSummary[]> {
  const drafts = (await (await getDB()).getAll("chapters")) as (ComicDraft&{chapterId?:string;locale?:Locale})[];
  return drafts
    .filter((d) => d && (d.locale??"vi")===locale&&typeof d.id === "string" && Array.isArray(d.pages))
    .map((d) => ({
      id: d.chapterId??d.id,
      title: d.title,
      pages: d.pages.length,
      updatedAt: d.updatedAt,
      source: "local",
    }));
}
export async function saveComicDraft(
  draft: ComicDraft,
  expectedRevision: number,
  locale:Locale="vi",
): Promise<ComicDraft> {
  validComicDraft(draft);
  // Materialize bytes before opening the transaction; avoid WebKit's async Blob-preparation path.
  const record = await serializeComicDraft(draft);
  const tx = (await getDB()).transaction("chapters", "readwrite");
  try {
    const key=locale==="vi"?draft.id:`en:${draft.id}`;
    const current = await tx.store.get(key);
    if ((current?.revision ?? 0) !== expectedRevision) {
      throw Error("Bản nháp đã được sửa ở cửa sổ khác. Tải lại trước khi lưu.");
    }
    const saved = {
      ...draft,
      revision: expectedRevision + 1,
      updatedAt: Date.now(),
    };
    await tx.store.put({
      ...record,
      id:key,chapterId:draft.id,locale,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    });
    await tx.done;
    return saved;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* The failed transaction may already be closed. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}
export async function comicPreference<T>(key: string): Promise<T | undefined> {
  return (await getDB()).get("preferences", key);
}
export async function saveComicPreference(key: string, value: unknown) {
  await (await getDB()).put("preferences", value, key);
}
export function useComicUrls(pages: ComicPage[]) {
  const cache = useRef(new Map<string, { blob: Blob; url: string }>()),
    [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const keep = new Set(pages.map((p) => p.id)),
      next: Record<string, string> = {};
    for (const [id, v] of cache.current)
      if (!keep.has(id)) {
        URL.revokeObjectURL(v.url);
        cache.current.delete(id);
      }
    for (const p of pages) {
      if (p.path) {
        next[p.id] = p.path;
        continue;
      }
      if (!p.blob) continue;
      let v = cache.current.get(p.id);
      if (v?.blob !== p.blob) {
        if (v) URL.revokeObjectURL(v.url);
        v = { blob: p.blob, url: URL.createObjectURL(p.blob) };
        cache.current.set(p.id, v);
      }
      next[p.id] = v.url;
    }
    setUrls(next);
  }, [pages]);
  useEffect(
    () => () => {
      for (const v of cache.current.values()) URL.revokeObjectURL(v.url);
      cache.current.clear();
    },
    [],
  );
  return urls;
}
