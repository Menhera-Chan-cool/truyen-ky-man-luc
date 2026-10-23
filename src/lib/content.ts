import { parse } from "node-html-parser";

export const tx = (locale: string, vi: string, en: string) =>
  locale === "vi" ? vi : en;
export function missingChapterTitle(id: string, locale: string) {
  const number = chapterNumber(id);
  const label =
    id === "preface"
      ? tx(locale, "Lời tựa", "Preface")
      : number
        ? `${tx(locale, "Chương", "Chapter")} ${number}`
        : tx(locale, "Phần nội dung", "Section");
  return `${label} · ${tx(locale, "Chưa có bản dịch", "Translation forthcoming")}`;
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function chapterNumber(value: string): number | null {
  const match = value.match(/(?:chương|chapter)[\s-]*(\d+)|^\s*(\d+)\s*:/iu);
  return match ? Number(match[1] ?? match[2]) : null;
}
export function safeArchivePath(base: string, href: string): string {
  const decoded = decodeURIComponent(href.split("#")[0]);
  if (/^[a-z][\w+.-]*:|^[/\\]|\0/i.test(decoded))
    throw new Error("Unsafe EPUB path");
  const parts = base.replace(/\\/g, "/").split("/").slice(0, -1);
  for (const part of decoded.replace(/\\/g, "/").split("/")) {
    if (part === "..") {
      if (!parts.length) throw new Error("EPUB path traversal");
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}
export function stripTitle(
  html: string,
  title?: string,
): { title: string; html: string } {
  const root = parse(html);
  const first = root.querySelector("h1,h2,h3,p");
  if (!first) return { title: title ?? "", html };
  const text = first.textContent.trim();
  const found =
    title ??
    (/^H[1-3]$/.test(first.tagName) ||
    (text.length <= 300 && /^(chương|chapter|lời tựa|preface)\b/iu.test(text))
      ? text
      : "");
  if (found && text.startsWith(found)) {
    const remainder = text.slice(found.length).trim();
    if (remainder) first.set_content(escapeHtml(remainder));
    else first.remove();
  }
  return { title: found, html: root.toString() };
}
export function validateImport<
  T extends { id: string; title: string; html: string },
>(items: T[], existing: string[], replace: boolean): T[] {
  if (!items.length) throw new Error("Select at least one chapter");
  if (new Set(items.map((c) => c.id)).size !== items.length)
    throw new Error("Duplicate chapter IDs");
  for (const c of items) {
    if (
      !/^[a-z0-9-]{1,80}$/.test(c.id) ||
      !c.title.trim() ||
      c.title.length > 300
    )
      throw new Error("Invalid chapter");
    if (existing.includes(c.id) && !replace)
      throw new Error("Confirm replace before overwriting chapters");
  }
  return items;
}
export function translationUrl(text: string, locale: string): string {
  const params = new URLSearchParams({
    sl: locale,
    tl: locale === "vi" ? "en" : "vi",
    text: text.slice(0, 5000),
    op: "translate",
  });
  return `https://translate.google.com/?${params}`;
}
export function resolveAnchor(
  anchor: { revision: number; start: number; end: number; text: string },
  revision: number,
  text: string,
): [number, number] | null {
  if (
    anchor.revision !== revision ||
    anchor.start < 0 ||
    anchor.end <= anchor.start ||
    text.slice(anchor.start, anchor.end) !== anchor.text
  )
    return null;
  return [anchor.start, anchor.end];
}
