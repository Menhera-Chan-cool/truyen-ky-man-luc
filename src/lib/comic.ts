import demo from "../data/comic-demo.json";
export type ComicPage = {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  path?: string;
  blob?: Blob;
};
export type ComicDraft = {
  id: string;
  title: string;
  pages: ComicPage[];
  direction: "ltr" | "rtl";
  revision: number;
  updatedAt: number;
};
export type ComicSettings = {
  mode: "vertical" | "single";
  direction: "ltr" | "rtl";
  zoom: number;
  gap: number;
  stretch: boolean;
  keyboardMode: "fast" | "smooth";
  keyboardStep: number;
  autoSpeed: number;
  progress: "left" | "top" | "bottom" | "right" | "none";
  preload: "some" | "all";
  grayscale: boolean;
  dim: number;
  onlyWithImages: boolean;
};
export const defaultComicSettings: ComicSettings = {
  mode: "vertical",
  direction: "ltr",
  zoom: 50,
  gap: 0,
  stretch: true,
  keyboardMode: "fast",
  keyboardStep: 100,
  autoSpeed: 150,
  progress: "left",
  preload: "some",
  grayscale: false,
  dim: 0,
  onlyWithImages: false,
};
const names = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });
export function naturalComicOrder<T extends { name: string }>(pages: T[]): T[] {
  return [...pages].sort((a, b) => names.compare(a.name, b.name));
}
export function moveComicPage<T>(pages: T[], from: number, to: number): T[] {
  if (
    ![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < pages.length)
  )
    throw Error("Vị trí trang không hợp lệ.");
  const copy = [...pages];
  const [page] = copy.splice(from, 1);
  copy.splice(to, 0, page);
  return copy;
}
export function comicMime(b: Uint8Array): string | undefined {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (
    new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(b.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
}
export function normalizeComicSettings(value: unknown): ComicSettings {
  const v = (
    value && typeof value === "object" ? value : {}
  ) as Partial<ComicSettings>;
  const number = (
    key: "zoom" | "gap" | "keyboardStep" | "autoSpeed" | "dim",
    min: number,
    max: number,
  ) =>
    typeof v[key] === "number" && Number.isFinite(v[key])
      ? Math.max(min, Math.min(max, v[key]!))
      : defaultComicSettings[key];
  return {
    mode: ["vertical", "single"].includes(v.mode ?? "") ? v.mode! : "vertical",
    direction: v.direction === "rtl" ? "rtl" : "ltr",
    zoom: number("zoom", 10, 200),
    gap: number("gap", 0, 100),
    stretch: v.stretch !== false,
    keyboardMode: v.keyboardMode === "smooth" ? "smooth" : "fast",
    keyboardStep: number("keyboardStep", 10, 200),
    autoSpeed: number("autoSpeed", 20, 600),
    progress: ["left", "top", "bottom", "right", "none"].includes(
      v.progress ?? "",
    )
      ? v.progress!
      : "left",
    preload: v.preload === "all" ? "all" : "some",
    grayscale: v.grayscale === true,
    dim: number("dim", 0, 100),
    onlyWithImages: v.onlyWithImages === true,
  };
}
export function sampleComic(id: string, title: string): ComicDraft {
  return {
    id,
    title,
    direction: "ltr",
    revision: 0,
    updatedAt: 0,
    pages:
      id === "chapter-1"
        ? demo.map((p, n) => ({
            ...p,
            id: `sample-${n + 1}`,
            name: `Truyen-ky-mau-0${n + 1}.png`,
          }))
        : [],
  };
}
export function validComicDraft(d: ComicDraft) {
  if (
    !d ||
    !/^[a-z0-9-]{1,80}$/.test(d.id) ||
    typeof d.title !== "string" ||
    !d.title.trim() ||
    d.title.length > 300 ||
    !["ltr", "rtl"].includes(d.direction) ||
    !Array.isArray(d.pages) ||
    d.pages.length > 300
  )
    throw Error("Bản nháp truyện tranh không hợp lệ.");
  const ids = new Set<string>();
  let bytes = 0;
  for (const p of d.pages) {
    if (
      !p ||
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      p.name.length > 250 ||
      !Number.isInteger(p.width) ||
      !Number.isInteger(p.height) ||
      p.width < 1 ||
      p.height < 1 ||
      p.width * p.height > 40_000_000 ||
      !Number.isInteger(p.bytes) ||
      p.bytes < 0 ||
      p.bytes > 20 * 1024 * 1024 ||
      typeof p.hash !== "string" ||
      (p.path && !/^\/comic-demo\/demo-0[12]\.png$/.test(p.path) &&
        !/^\/api\/comic\/assets\/[a-f0-9-]{36}\/comics\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(p.path)) ||
      (!p.blob && !p.path) ||
      (p.blob && !(p.blob instanceof Blob))
    )
      throw Error("Có trang ảnh không hợp lệ.");
    ids.add(p.id);
    bytes += p.blob?.size ?? p.bytes;
  }
  if (bytes > 200 * 1024 * 1024) throw Error("Tổng ảnh vượt 200 MB.");
  return d;
}
