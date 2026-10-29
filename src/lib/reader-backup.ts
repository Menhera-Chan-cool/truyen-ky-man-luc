import {
  defaultSettings,
  type Annotation,
  type Progress,
  type ReaderSettings,
  type ListeningProgress,
} from "./types";
import { normalizeSettings } from "./reader";
import {
  parsePronunciations,
  parseRecent,
  type PronunciationRule,
  type RecentPlace,
} from "./reader-extras";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export type ReaderBackup = {
  format: "truyen-ky-man-luc-reader-backup";
  version: 1;
  bookId: "truyen-ky-man-luc";
  exportedAt: string;
  settings: ReaderSettings | null;
  progress: { key: string; value: Progress }[];
  annotations: Annotation[];
  listening?: ListeningProgress[];
  pronunciations?: { vi: PronunciationRule[]; en: PronunciationRule[] };
  recent?: RecentPlace[];
};
const bad = (): never => {
  throw new Error("Invalid reader backup");
};
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : bad();
const str = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max ? v : bad();
const num = (v: unknown, min: number, max: number, integer = false) =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= min &&
  v <= max &&
  (!integer || Number.isInteger(v))
    ? v
    : bad();
const chapter = (v: unknown) => {
  const s = str(v, 80);
  return /^[a-z0-9-]{1,80}$/.test(s) ? s : bad();
};
function pdfFields(v: Record<string, unknown>) {
  return {
    ...(v.pdfPage === undefined
      ? {}
      : { pdfPage: num(v.pdfPage, 1, 1_000_000, true) }),
    ...(v.pdfZoom === undefined ? {} : { pdfZoom: num(v.pdfZoom, 0.5, 3) }),
  };
}
export function parseReaderBackup(text: string): ReaderBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) bad();
  const v = object(JSON.parse(text));
  if (
    v.format !== "truyen-ky-man-luc-reader-backup" ||
    v.version !== 1 ||
    v.bookId !== "truyen-ky-man-luc"
  )
    bad();
  const exportedAt = str(v.exportedAt, 40);
  if (!Number.isFinite(Date.parse(exportedAt))) bad();
  let settings: ReaderSettings | null = null;
  if (v.settings !== null) {
    const raw = object(v.settings);
    const selected: Record<string, unknown> = {};
    for (const [k, d] of Object.entries(defaultSettings)) {
      const value =
        ["shortPauses", "layout", "autoNext"].includes(k) &&
        raw[k] === undefined
          ? d
          : raw[k];
      if (typeof value !== typeof d) bad();
      if (typeof value === "string") str(value, 512);
      selected[k] = value;
    }
    settings = normalizeSettings(selected);
    if (Object.entries(settings).some(([k, value]) => value !== selected[k]))
      bad();
  }
  const progressItems =
    Array.isArray(v.progress) && v.progress.length <= 2000 ? v.progress : bad();
  const noteItems =
    Array.isArray(v.annotations) && v.annotations.length <= 10000
      ? v.annotations
      : bad();
  const listeningItems =
    v.listening === undefined
      ? []
      : Array.isArray(v.listening) && v.listening.length <= 2
        ? v.listening
        : bad();
  const listening: ListeningProgress[] = listeningItems.map((item: unknown) => {
    const p = object(item);
    if (
      (p.locale !== "vi" && p.locale !== "en") ||
      typeof p.completed !== "boolean"
    )
      bad();
    return {
      locale: p.locale as "vi" | "en",
      chapterId: chapter(p.chapterId),
      revision: num(p.revision, 0, 2_147_483_647, true),
      offset: num(p.offset, 0, 2_000_000, true),
      completed: p.completed as boolean,
      ...(p.pdfPage === undefined
        ? {}
        : { pdfPage: num(p.pdfPage, 1, 1_000_000, true) }),
    };
  });
  if (new Set(listening.map((p) => p.locale)).size !== listening.length) bad();
  const progress = progressItems.map((item: unknown) => {
    const p = object(item),
      raw = object(p.value),
      key = str(p.key, 90),
      chapterId = chapter(raw.chapterId);
    const match = /^(vi|en):([a-z0-9-]{1,80})$/.exec(key);
    if (!match || (match[2] !== "last" && match[2] !== chapterId)) bad();
    const value: Progress = {
      chapterId,
      revision: num(raw.revision, 0, 2_147_483_647, true),
      ratio: num(raw.ratio, 0, 1),
      page: num(raw.page, 0, 1_000_000, true),
      ...(raw.anchor === undefined
        ? {}
        : { anchor: num(raw.anchor, 0, 2_000_000, true) }),
      ...pdfFields(raw),
    };
    return { key, value };
  });
  if (new Set(progress.map((p) => p.key)).size !== progress.length) bad();
  const annotations = noteItems.map((item: unknown) => {
    const a = object(item),
      id = str(a.id, 120),
      locale = a.locale;
    if (
      !/^[a-zA-Z0-9_-]{1,120}$/.test(id) ||
      (locale !== "vi" && locale !== "en")
    )
      bad();
    const color = str(a.color, 7);
    if (!/^#[a-f0-9]{6}$/i.test(color)) bad();
    let image: string | undefined;
    if (a.image !== undefined) {
      image = str(a.image, 2048);
      if (image.startsWith("/") && !image.startsWith("//")) {
        if (image.includes("\\")) bad();
      } else {
        const url = new URL(image);
        if (!["https:", "http:"].includes(url.protocol)) bad();
      }
    }
    const start = num(a.start, 0, 2_000_000, true),
      end = num(a.end, start, 2_000_000, true);
    return {
      id,
      chapterId: chapter(a.chapterId),
      locale,
      revision: num(a.revision, 0, 2_147_483_647, true),
      start,
      end,
      text: str(a.text, 100_000),
      note: str(a.note, 100_000),
      color,
      createdAt: num(a.createdAt, 0, 8_640_000_000_000_000, true),
      ...(image ? { image } : {}),
      ...pdfFields(a),
    } as Annotation;
  });
  return {
    format: "truyen-ky-man-luc-reader-backup",
    version: 1,
    bookId: "truyen-ky-man-luc",
    exportedAt,
    settings,
    progress,
    annotations,
    listening,
    ...(v.pronunciations === undefined
      ? {}
      : {
          pronunciations: {
            vi: parsePronunciations(object(v.pronunciations).vi),
            en: parsePronunciations(object(v.pronunciations).en),
          },
        }),
    ...(v.recent === undefined ? {} : { recent: parseRecent(v.recent) }),
  };
}
export function mergeBackupNotes(
  existing: Annotation[],
  incoming: Annotation[],
): Annotation[] {
  const signature = (a: Annotation) =>
    JSON.stringify([
      a.chapterId,
      a.locale,
      a.revision,
      a.start,
      a.end,
      a.text,
      a.image ?? "",
      a.note,
      a.color,
      a.createdAt,
      a.pdfPage ?? null,
      a.pdfZoom ?? null,
    ]);
  const ids = new Set(existing.map((a) => a.id)),
    seen = new Set(existing.map(signature)),
    merged = [...existing];
  for (const a of incoming) {
    const key = signature(a);
    if (seen.has(key)) continue;
    const value = ids.has(a.id) ? { ...a, id: crypto.randomUUID() } : a;
    merged.push(value);
    ids.add(value.id);
    seen.add(key);
  }
  return merged;
}
