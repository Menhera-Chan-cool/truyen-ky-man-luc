import { openDB } from "idb";
import type { Annotation, Progress, ReaderSettings } from "./types";
import { normalizeSettings } from "./reader";
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
export async function writeSettings(settings: ReaderSettings) {
  try {
    document.cookie = `book-reader=${encodeURIComponent(JSON.stringify(normalizeSettings(settings)))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    /* IndexedDB still works when cookies are blocked. */
  }
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
export async function saveAnnotation(annotation: Annotation) {
  await (await connection()).put("annotations", annotation);
}
export async function deleteAnnotation(id: string) {
  await (await connection()).delete("annotations", id);
}
