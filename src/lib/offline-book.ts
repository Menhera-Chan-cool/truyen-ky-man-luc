import { parse } from "node-html-parser";
import { cleanHtml } from "./sanitize";
import type { Book, Chapter, Locale } from "./types";
import {validHeadingFontId,headingFontId} from "./heading-fonts";
export const OFFLINE_KEY = "offline-book:v1",
  OFFLINE_CACHE_PREFIX = "tkml-offline-data-";
export const publicAssetPath = (value: string) =>
  value === "/book/cover.jpg" ||
  /^\/api\/assets\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|gif|webp|pdf)$/.test(value);
export function validateOfflineBook(value: unknown): Book {
  const b = value as Book;
  if (
    !b ||
    b.id !== "truyen-ky-man-luc" ||
    typeof b.author !== "string" ||
    b.author.length > 200 ||
    !Number.isInteger(b.revision) ||
    b.revision < 0 ||
    !Array.isArray(b.chapters) ||
    !b.chapters.length ||
    b.chapters.length > 100 ||
    !b.meta
  )
    throw Error("Invalid published book");
  for (const l of ["vi", "en"] as const) {
    const m = b.meta[l];
    if (
      !m ||
      typeof m.title !== "string" ||
      m.title.length > 300 ||
      typeof m.summary !== "string" ||
      m.summary.length > 20000 ||
      !publicAssetPath(m.frontCover) ||
      (m.backCover && !publicAssetPath(m.backCover))
      || (m.headingFont!==undefined&&!validHeadingFontId(m.headingFont))
    )
      throw Error("Invalid public book metadata");
  }
  let size = 0;
  const ids = new Set<string>();
  const chapters: Chapter[] = b.chapters.map((c) => {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[a-z0-9-]{1,80}$/.test(c.id) ||
      ids.has(c.id) ||
      !Number.isFinite(c.order)
    )
      throw Error("Invalid chapter");
    ids.add(c.id);
    const result: Chapter = { id: c.id, order: c.order };
    for (const l of ["vi", "en"] as Locale[]) {
      const e = c[l];
      if (!e) continue;
      if (
        typeof e.title !== "string" ||
        e.title.length > 300 ||
        typeof e.html !== "string" ||
        e.html.length > 2_000_000 ||
        !Number.isInteger(e.revision) ||
        e.revision < 0 ||
        !["text", "illustration", "pdf"].includes(e.kind) ||
        (e.kind === "pdf" &&
          (!e.pdfPath || !publicAssetPath("/api/assets/" + e.pdfPath)))
      )
        throw Error("Invalid published edition");
      size += e.html.length;
      const html = cleanHtml(e.html);
      for (const img of parse(html).querySelectorAll("img"))
        if (!publicAssetPath(img.getAttribute("src") ?? ""))
          throw Error("Offline book contains an unmanaged image");
      result[l] = {
        title: e.title,
        html,
        revision: e.revision,
        kind: e.kind,
        ...(e.pdfPath ? { pdfPath: e.pdfPath } : {}),
      };
    }
    return result;
  });
  if (size > 20_000_000) throw Error("Offline text exceeds 20 MB");
  return {
    id: b.id,
    author: b.author,
    meta: { vi: { ...b.meta.vi }, en: { ...b.meta.en } },
    chapters,
    revision: b.revision,
  };
}
export function bookAssetPaths(book: Book) {
  const urls = new Set<string>();
  for (const l of ["vi", "en"] as const) {
    const font=headingFontId(book.meta[l].headingFont);if(font!=="default")urls.add("/api/heading-fonts/"+font);
    urls.add(book.meta[l].frontCover);
    if (book.meta[l].backCover) urls.add(book.meta[l].backCover!);
  }
  for (const c of book.chapters)
    for (const l of ["vi", "en"] as const) {
      const e = c[l];
      if (!e) continue;
      for (const img of parse(e.html).querySelectorAll("img"))
        urls.add(img.getAttribute("src") ?? "");
      if (e.pdfPath) urls.add("/api/assets/" + e.pdfPath);
    }
  return [...urls].filter(url=>publicAssetPath(url)||/^\/api\/heading-fonts\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(url));
}
export type OfflineBook = {
  book: Book;
  cacheName: string;
  assets: string[];
  downloadedAt: string;
  bytes: number;
};
