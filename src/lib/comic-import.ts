import JSZip from "jszip";
import { comicMime, naturalComicOrder, type ComicPage } from "./comic";
import { safeArchivePath } from "./content";
const IMAGE = 20 * 1024 * 1024,
  TOTAL = 200 * 1024 * 1024;
async function boundedImage(
  entry: JSZip.JSZipObject,
  limit: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let bytes = 0,
      failed = false;
    const stream = (
      entry as JSZip.JSZipObject & {
        internalStream(t: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
      }
    ).internalStream("uint8array");
    stream.on("data", (chunk: Uint8Array) => {
      bytes += chunk.length;
      if (bytes > limit) {
        failed = true;
        stream.pause();
        reject(Error("Ảnh trong ZIP vượt giới hạn dung lượng."));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      if (failed) return;
      const out = new Uint8Array(bytes);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      resolve(out);
    });
    stream.resume();
  });
}
export async function unpackComicFiles(files: File[]): Promise<File[]> {
  if (!files.length) throw Error("Hãy chọn ảnh hoặc một tệp ZIP/CBZ.");
  const result: File[] = [];
  let total = 0;
  const add = async (file: File) => {
    if (
      !/\.(png|jpe?g|webp)$/i.test(file.name) ||
      file.size > IMAGE ||
      file.size === 0
    )
      throw Error(`${file.name}: chỉ nhận PNG, JPG, WebP; tối đa 20 MB/ảnh.`);
    const mime = comicMime(
      new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    );
    if (!mime) throw Error(`${file.name}: tệp không phải ảnh hợp lệ.`);
    total += file.size;
    if (total > TOTAL || result.length >= 300)
      throw Error("Tối đa 300 ảnh và 200 MB mỗi lượt.");
    result.push(
      new File([file], file.name, {
        type: mime,
        lastModified: file.lastModified,
      }),
    );
  };
  for (const file of files) {
    if (!/\.(zip|cbz)$/i.test(file.name)) {
      await add(file);
      continue;
    }
    if (file.size > 50 * 1024 * 1024) throw Error("Tệp ZIP/CBZ vượt 50 MB.");
    const zip = await JSZip.loadAsync(await file.arrayBuffer()),
      entries = Object.values(zip.files);
    if (entries.length > 2500) throw Error("ZIP có quá nhiều tệp.");
    for (const e of entries) {
      if (e.unsafeOriginalName && e.unsafeOriginalName !== e.name)
        throw Error("ZIP chứa đường dẫn không an toàn.");
      safeArchivePath("", e.name);
      if (e.dir || e.name.startsWith("__MACOSX/") || /(^|\/)\./.test(e.name))
        continue;
      if (/\.(svg|html?|js|exe)$/i.test(e.name))
        throw Error("ZIP chứa loại tệp không được phép.");
      if (!/\.(png|jpe?g|webp)$/i.test(e.name)) continue;
      const bytes = await boundedImage(e, Math.min(IMAGE, TOTAL - total));
      await add(
        new File([bytes.slice().buffer as ArrayBuffer], e.name, {
          type: comicMime(bytes),
        }),
      );
    }
  }
  if (!result.length) throw Error("Không tìm thấy ảnh trong tệp đã chọn.");
  return naturalComicOrder(result);
}
export async function importComicPages(
  files: File[],
  existing: ComicPage[],
  onProgress: (done: number, total: number) => void = () => {},
): Promise<{ pages: ComicPage[]; duplicates: number }> {
  const unpacked = await unpackComicFiles(files),
    pages: ComicPage[] = [],
    hashes = new Set(existing.map((p) => p.hash));
  let duplicates = 0;
  for (let n = 0; n < unpacked.length; n++) {
    const file = unpacked[n];
    const data = await file.arrayBuffer();
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hashes.has(hash)) {
      duplicates++;
      onProgress(n + 1, unpacked.length);
      continue;
    }
    const url = URL.createObjectURL(file),
      image = new Image();
    image.src = url;
    try {
      await image.decode();
      if (
        image.naturalWidth < 1 ||
        image.naturalHeight < 1 ||
        image.naturalWidth * image.naturalHeight > 40_000_000
      )
        throw Error("Kích thước ảnh quá lớn.");
      pages.push({
        id: crypto.randomUUID(),
        name: file.name.slice(-250),
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        hash,
        blob: new Blob([data], { type: file.type }),
      });
      hashes.add(hash);
    } catch {
      throw Error(
        `${file.name}: không đọc được ảnh hoặc ảnh vượt 40 triệu pixel.`,
      );
    } finally {
      URL.revokeObjectURL(url);
    }
    onProgress(n + 1, unpacked.length);
  }
  if (
    existing.length + pages.length > 300 ||
    [...existing, ...pages].reduce((sum, p) => sum + p.bytes, 0) > TOTAL
  )
    throw Error("Một chương tối đa 300 ảnh và 200 MB.");
  return { pages, duplicates };
}
