import type { Locale, Progress } from "./types";
export type PronunciationRule = { from: string; to: string };
export type RecentPlace = Progress & { locale: Locale; at: number };
export function parsePronunciations(value: unknown): PronunciationRule[] {
  if (!Array.isArray(value) || value.length > 50)
    throw Error("Use at most 50 pronunciation rules");
  const result = value.map((v) => {
    if (
      !v ||
      typeof v.from !== "string" ||
      typeof v.to !== "string" ||
      !v.from.trim() ||
      !v.to.trim() ||
      v.from.length > 100 ||
      v.to.length > 200 ||
      /[\x00-\x1f]/.test(v.from + v.to)
    )
      throw Error("Invalid pronunciation rule");
    return { from: v.from.trim(), to: v.to.trim() };
  });
  if (new Set(result.map((v) => v.from.toLowerCase())).size !== result.length)
    throw Error("Duplicate pronunciation rule");
  return result;
}
export function pronounceText(source: string, rules: PronunciationRule[]) {
  if (!rules.length)
    return {
      text: source,
      offsets: Array.from({ length: source.length + 1 }, (_, i) => i),
    };
  const sorted = [...rules].sort((a, b) => b.from.length - a.from.length),
    pattern = new RegExp(
      sorted
        .map((r) => "(" + r.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")")
        .join("|"),
      "giu",
    );
  let text = "",
    at = 0;
  const offsets: number[] = [];
  const original = (end: number) => {
    for (; at < end; at++) {
      text += source[at];
      offsets.push(at);
    }
  };
  for (const match of source.matchAll(pattern)) {
    const start = match.index!,
      end = start + match[0].length,
      first = Array.from(match[0])[0],
      last = Array.from(match[0]).at(-1)!,
      before = Array.from(source.slice(0, start)).at(-1) ?? "",
      after = Array.from(source.slice(end))[0] ?? "";
    if (
      (/[\p{L}\p{N}_]/u.test(first) && /[\p{L}\p{N}_]/u.test(before)) ||
      (/[\p{L}\p{N}_]/u.test(last) && /[\p{L}\p{N}_]/u.test(after))
    )
      continue;
    const rule =
      sorted[
        match.findIndex((value, index) => index > 0 && value !== undefined) - 1
      ];
    original(start);
    text += rule.to;
    for (let i = 0; i < rule.to.length; i++) offsets.push(start);
    at = end;
  }
  original(source.length);
  offsets.push(source.length);
  return { text, offsets };
}
export function mergeRecent(items: RecentPlace[], item: RecentPlace) {
  return [
    item,
    ...items.filter(
      (p) =>
        !(
          p.chapterId === item.chapterId &&
          p.locale === item.locale &&
          p.revision === item.revision &&
          p.anchor === item.anchor &&
          p.pdfPage === item.pdfPage
        ),
    ),
  ].slice(0, 30);
}
export function parseRecent(value: unknown): RecentPlace[] {
  if (!Array.isArray(value) || value.length > 30)
    throw Error("Invalid recent positions");
  return value.map((p) => {
    if (
      !p ||
      !["vi", "en"].includes(p.locale) ||
      typeof p.chapterId !== "string" ||
      !/^[a-z0-9-]{1,80}$/.test(p.chapterId) ||
      !Number.isInteger(p.revision) ||
      p.revision < 0 ||
      p.revision > 2_147_483_647 ||
      !Number.isFinite(p.at) ||
      p.at < 0 ||
      p.at > 8_640_000_000_000_000 ||
      !Number.isFinite(p.ratio) ||
      p.ratio < 0 ||
      p.ratio > 1 ||
      !Number.isInteger(p.page) ||
      p.page < 0 ||
      p.page > 1_000_000 ||
      (p.anchor !== undefined &&
        (!Number.isInteger(p.anchor) ||
          p.anchor < 0 ||
          p.anchor > 2_000_000)) ||
      (p.pdfPage !== undefined &&
        (!Number.isInteger(p.pdfPage) ||
          p.pdfPage < 1 ||
          p.pdfPage > 1_000_000)) ||
      (p.pdfZoom !== undefined &&
        (!Number.isFinite(p.pdfZoom) || p.pdfZoom < 0.5 || p.pdfZoom > 3))
    )
      throw Error("Invalid recent position");
    return {
      chapterId: p.chapterId,
      locale: p.locale,
      revision: p.revision,
      ratio: p.ratio,
      page: p.page,
      at: p.at,
      ...(p.anchor === undefined ? {} : { anchor: p.anchor }),
      ...(p.pdfPage === undefined ? {} : { pdfPage: p.pdfPage }),
      ...(p.pdfZoom === undefined ? {} : { pdfZoom: p.pdfZoom }),
    } as RecentPlace;
  });
}
export function parsePageInput(value: string, pages: number) {
  if (!/^\d+$/.test(value.trim())) throw Error("Enter a whole page number");
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > pages)
    throw Error("Page outside this chapter");
  return page - 1;
}
export function validateFont(name: string, bytes: Uint8Array, size: number) {
  if (size < 4 || size > 3 * 1024 * 1024)
    throw Error("Font must be at most 3 MB");
  const magic = String.fromCharCode(...bytes.slice(0, 4)),
    extension = name.split(".").at(-1)?.toLowerCase();
  const actual =
    magic === "wOF2"
      ? "woff2"
      : magic === "wOFF"
        ? "woff"
        : magic === "OTTO"
          ? "otf"
          : (bytes[0] === 0 &&
                bytes[1] === 1 &&
                bytes[2] === 0 &&
                bytes[3] === 0) ||
              magic === "true"
            ? "ttf"
            : null;
  if (!actual || actual !== extension)
    throw Error("Use a valid TTF, OTF, WOFF or WOFF2 font");
  return actual;
}
