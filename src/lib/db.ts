import { openDB } from "idb";
import type {
  Annotation,
  Progress,
  ReaderSettings,
  ListeningProgress,
  Locale,
} from "./types";
import { normalizeSettings } from "./reader";
import { mergeBackupNotes, type ReaderBackup } from "./reader-backup";
let database: ReturnType<typeof openDB> | undefined;
const connection = () =>
  (database ??= openDB("truyen-ky-man-luc", 1, {
    upgrade(db) {
      db.createObjectStore("preferences");
      db.createObjectStore("progress");
      db.createObjectStore("annotations", { keyPath: "id" });
    },
  }));
export async function readSettings() {
  return (await connection()).get("preferences", "reader") as Promise<
    ReaderSettings | undefined
  >;
}
function mirrorSettings(settings: ReaderSettings) {
  try {
    document.cookie = `book-reader=${encodeURIComponent(JSON.stringify(normalizeSettings(settings)))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    /* IndexedDB still works when cookies are blocked. */
  }
}
export async function writeSettings(settings: ReaderSettings) {
  mirrorSettings(settings);
  await (await connection()).put("preferences", settings, "reader");
}
export async function readProgress(locale: string, chapterId?: string) {
  return (await connection()).get(
    "progress",
    `${locale}:${chapterId ?? "last"}`,
  ) as Promise<Progress | undefined>;
}
export async function writeProgress(locale: string, progress: Progress) {
  const db = await connection();
  const tx = db.transaction("progress", "readwrite");
  await tx.store.put(progress, `${locale}:last`);
  await tx.store.put(progress, `${locale}:${progress.chapterId}`);
  await tx.done;
}
export async function readAnnotations() {
  return (await connection()).getAll("annotations") as Promise<Annotation[]>;
}
export async function readListening(locale: Locale) {
  return (await connection()).get(
    "preferences",
    `listening:${locale}`,
  ) as Promise<ListeningProgress | undefined>;
}
export async function writeListening(value: ListeningProgress) {
  await (
    await connection()
  ).put("preferences", value, `listening:${value.locale}`);
}
export async function saveAnnotation(annotation: Annotation) {
  await (await connection()).put("annotations", annotation);
}
export async function deleteAnnotation(id: string) {
  await (await connection()).delete("annotations", id);
}
export async function readDeviceBackup(): Promise<ReaderBackup> {
  const db = await connection(),
    tx = db.transaction(["preferences", "progress", "annotations"], "readonly");
  const [settings, values, keys, annotations, vi, en] = await Promise.all([
    tx.objectStore("preferences").get("reader"),
    tx.objectStore("progress").getAll(),
    tx.objectStore("progress").getAllKeys(),
    tx.objectStore("annotations").getAll(),
    tx.objectStore("preferences").get("listening:vi"),
    tx.objectStore("preferences").get("listening:en"),
  ]);
  await tx.done;
  return {
    format: "truyen-ky-man-luc-reader-backup",
    version: 1,
    bookId: "truyen-ky-man-luc",
    exportedAt: new Date().toISOString(),
    settings: settings ? normalizeSettings(settings) : null,
    progress: keys.map((key, i) => ({ key: String(key), value: values[i] })),
    annotations,
    listening: [vi, en].filter(Boolean),
  };
}
export async function restoreDeviceBackup(
  backup: ReaderBackup,
  restoreReading: boolean,
) {
  const db = await connection(),
    tx = db.transaction(
      ["preferences", "progress", "annotations"],
      "readwrite",
    );
  try {
    const existing = (await tx
      .objectStore("annotations")
      .getAll()) as Annotation[];
    const notes = mergeBackupNotes(existing, backup.annotations);
    for (const note of notes.slice(existing.length))
      await tx.objectStore("annotations").put(note);
    if (restoreReading) {
      for (const p of backup.listening ?? [])
        await tx.objectStore("preferences").put(p, `listening:${p.locale}`);
      for (const p of backup.progress)
        await tx.objectStore("progress").put(p.value, p.key);
      if (backup.settings)
        await tx.objectStore("preferences").put(backup.settings, "reader");
    }
    await tx.done;
    if (restoreReading && backup.settings) mirrorSettings(backup.settings);
    return { added: notes.length - existing.length, kept: existing.length };
  } catch (e) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw e;
  }
}
