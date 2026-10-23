import JSZip from "jszip";
import { parse } from "node-html-parser";
import {
  chapterNumber,
  escapeHtml,
  safeArchivePath,
  stripTitle,
} from "./content";
import { cleanHtml } from "./sanitize";
import type { ImportChapter, Locale } from "./types";
import knownTitles from "../data/english-titles.json";

const MAX_FILE = 50 * 1024 * 1024,
  MAX_UNPACKED = 200 * 1024 * 1024;
export async function readArchiveEntry(
  zip: JSZip,
  name: string,
  limit: number,
): Promise<Uint8Array> {
  const entry = zip.file(name);
  if (!entry) throw new Error(`Missing archive entry: ${name}`);
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let length = 0,
      failed = false;
    // JSZip exposes file streams but omits this method from its published types.
    const stream = (
      entry as JSZip.JSZipObject & {
        internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
      }
    ).internalStream("uint8array");
    stream.on("data", (chunk: Uint8Array) => {
      length += chunk.length;
      if (length > limit) {
        failed = true;
        stream.pause();
        reject(new Error("Archive entry exceeds byte limit"));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      if (failed) return;
      const result = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(result);
    });
    stream.resume();
  });
}
async function zipText(zip: JSZip, name: string) {
  return new TextDecoder().decode(
    await readArchiveEntry(zip, name, 8 * 1024 * 1024),
  );
}
function toBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined")
    return Buffer.from(bytes).toString("base64");
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
}
export async function openArchive(bytes: Uint8Array) {
  if (bytes.length > MAX_FILE) throw new Error("File exceeds 50 MB");
  // Inspect metadata first; CRC checking during load would inflate every entry before limits apply.
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  if (entries.length > 2500) throw new Error("Too many archive entries");
  let size = 0;
  for (const entry of entries) {
    const length =
      (entry as unknown as { _data?: { uncompressedSize: number } })._data
        ?.uncompressedSize ?? 0;
    size += length;
    if (size > MAX_UNPACKED) throw new Error("Archive expands beyond 200 MB");
    if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name)
      throw new Error("Unsafe archive path");
  }
  return zip;
}
const makeChapter = (
  html: string,
  fallback: string,
  index: number,
  masthead: string[] = [],
): ImportChapter => {
  let result = stripTitle(html);
  if (
    masthead.length &&
    (chapterNumber(fallback) || /lời tựa|preface/i.test(fallback))
  ) {
    const normalize = (value: string) =>
      value
        .normalize("NFC")
        .toLocaleLowerCase()
        .replace(/\(\*\)|\s+/g, "");
    const root = parse(html),
      blocks = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,div");
    const heading = blocks.findIndex(
      (el) => normalize(el.textContent) === normalize(fallback),
    );
    if (heading >= 0) {
      const repeated = new Set(
        [...masthead, "www.dtv-ebook.com"].map(normalize),
      );
      blocks.slice(0, heading).forEach((el) => {
        if (repeated.has(normalize(el.textContent))) {
          const id = el.getAttribute("id");
          if (id) el.replaceWith(`<span id="${escapeHtml(id)}"></span>`);
          else el.remove();
        }
      });
      const id = blocks[heading].getAttribute("id");
      if (id)
        blocks[heading].replaceWith(`<span id="${escapeHtml(id)}"></span>`);
      else blocks[heading].remove();
      result = { title: fallback, html: root.toString() };
    }
  }
  const title = result.title || fallback;
  const n = chapterNumber(title) || chapterNumber(fallback);
  return {
    id: n
      ? `chapter-${n}`
      : /lời tựa|preface/i.test(title)
        ? "preface"
        : `section-${index + 1}`,
    title,
    html: cleanHtml(result.html),
    kind: "text",
  };
};
export async function importFile(
  bytes: Uint8Array,
  name: string,
  locale: Locale | string,
): Promise<ImportChapter[]> {
  if (bytes.length > MAX_FILE) throw new Error("File exceeds 50 MB");
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "epub") {
    const zip = await openArchive(bytes);
    const container = parse(await zipText(zip, "META-INF/container.xml"));
    const opfPath = container
      .querySelector("rootfile")
      ?.getAttribute("full-path");
    if (!opfPath) throw new Error("EPUB container is missing");
    const opf = parse(await zipText(zip, opfPath));
    const masthead = opf
      .querySelectorAll("*")
      .filter((el) =>
        ["title", "creator"].includes(
          el.tagName.toLowerCase().split(":").pop()!,
        ),
      )
      .map((el) => el.textContent.trim());
    const manifest = new Map(
      opf
        .querySelectorAll("manifest item")
        .map((el) => [el.getAttribute("id")!, el]),
    );
    const chapters: { path: string; chapter: ImportChapter }[] = [];
    const navNames = new Map<string, string>();
    const ncxEntry = Object.values(zip.files).find((e) =>
      e.name.endsWith(".ncx"),
    );
    if (ncxEntry) {
      const ncx = parse(await zipText(zip, ncxEntry.name));
      for (const nav of ncx.querySelectorAll("navPoint")) {
        const src = nav.querySelector("content")?.getAttribute("src");
        if (src)
          navNames.set(
            safeArchivePath(ncxEntry.name, src),
            nav.querySelector("navLabel text")?.textContent ?? "",
          );
      }
    }
    for (const ref of opf.querySelectorAll("spine itemref")) {
      const item = manifest.get(ref.getAttribute("idref") ?? "");
      if (!item) throw new Error("Broken EPUB spine");
      if (!/html/.test(item.getAttribute("media-type") ?? "")) continue;
      const path = safeArchivePath(opfPath, item.getAttribute("href") ?? "");
      const entry = zip.file(path);
      if (!entry) throw new Error(`Missing EPUB chapter: ${path}`);
      const doc = parse(await zipText(zip, path));
      const body = doc.querySelector("body") ?? doc;
      let embeddedSize = 0;
      if (
        /^(mục lục|table of contents|contents)$/i.test(
          (doc.querySelector("title")?.textContent ?? "").trim(),
        ) ||
        (item.getAttribute("properties") ?? "").split(/\s+/).includes("nav")
      )
        continue;
      for (const img of body.querySelectorAll("img")) {
        const src = img.getAttribute("src");
        if (!src) continue;
        const imagePath = safeArchivePath(path, src);
        const image = zip.file(imagePath);
        if (!image) throw new Error(`Missing EPUB image: ${imagePath}`);
        const ext = imagePath.split(".").pop()?.toLowerCase();
        const mime = ext === "jpg" ? "jpeg" : ext;
        if (!["jpeg", "png", "gif", "webp"].includes(mime ?? "")) {
          img.remove();
          continue;
        }
        const base64 = toBase64(
          await readArchiveEntry(zip, imagePath, 10 * 1024 * 1024),
        );
        embeddedSize += base64.length;
        if (embeddedSize > 25 * 1024 * 1024)
          throw new Error("Embedded images exceed the chapter preview limit");
        img.setAttribute("src", `data:image/${mime};base64,${base64}`);
      }
      const fallback =
        navNames.get(path) || doc.querySelector("title")?.textContent || name;
      const chapter = makeChapter(
        body.innerHTML,
        fallback,
        chapters.length,
        masthead,
      );
      if (!chapter.title.trim()) continue;
      chapters.push({ path, chapter });
    }
    for (const { path, chapter } of chapters) {
      const doc = parse(chapter.html);
      for (const link of doc.querySelectorAll("a[href]")) {
        const href = link.getAttribute("href")!;
        if (href.startsWith("#") || /^[a-z]+:/i.test(href)) continue;
        const target = chapters.find(
          (c) => c.path === safeArchivePath(path, href),
        );
        if (target)
          link.setAttribute(
            "href",
            target.path === path
              ? `#${href.split("#")[1] ?? ""}`
              : `/${locale}/read/${target.chapter.id}${href.includes("#") ? "#" + href.split("#")[1] : ""}`,
          );
      }
      chapter.html = cleanHtml(doc.toString());
    }
    if (!chapters.length) throw new Error("EPUB contains no readable chapters");
    return chapters.map((c) => c.chapter);
  }
  if (extension === "docx") {
    const archive = await openArchive(bytes);
    let expanded = 0;
    for (const entry of Object.values(archive.files)) {
      if (entry.dir) continue;
      expanded += (
        await readArchiveEntry(archive, entry.name, 50 * 1024 * 1024)
      ).length;
      if (expanded > MAX_UNPACKED)
        throw new Error("DOCX expands beyond byte limit");
    }
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml(
      typeof window === "undefined"
        ? { buffer: Buffer.from(bytes) }
        : { arrayBuffer: bytes.slice().buffer },
    );
    const number = chapterNumber(name);
    const known = (knownTitles as Record<string, string>)[`chapter-${number}`];
    if (locale === "en" && number && known) {
      const first = parse(result.value)
        .querySelectorAll("p,h1,h2,h3")
        .find((p) => p.textContent.trim());
      const title = known.replace(/^Chapter\s+\d+\s*:\s*/i, "");
      const pattern = title
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/['’]/g, "['’]")
        .replace(/\s+/g, "\\s+");
      const marker = first?.textContent
        .trim()
        .match(
          new RegExp(
            `^(?:Chapter\\s*)?${number}\\s*:\\s*${pattern}(?:\\s*\\(\\*\\))?`,
            "iu",
          ),
        );
      if (marker)
        return [
          {
            id: `chapter-${number}`,
            title: known,
            html: cleanHtml(stripTitle(result.value, marker[0]).html),
            kind: "text",
          },
        ];
    }
    return [makeChapter(result.value, name.replace(/\.docx$/i, ""), 0)];
  }
  if (extension === "pdf") {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw new Error("Invalid PDF");
    return [
      {
        id: `pdf-${crypto.randomUUID()}`,
        title: name.replace(/\.pdf$/i, ""),
        html: "",
        kind: "pdf",
        pdfBytes: bytes,
      },
    ];
  }
  if (!["txt", "html", "htm"].includes(extension ?? ""))
    throw new Error("Supported: EPUB, DOCX, TXT, HTML, PDF");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (extension === "txt") {
    const parts = text
      .replace(/\r\n/g, "\n")
      .split(/(?=^(?:Chapter|Chương)\s+\d+\s*[:.—-])/gimu)
      .filter((s) => s.trim());
    return parts.map((s, i) => {
      const lines = s.trim().split("\n");
      const heading = lines.shift()!;
      return makeChapter(
        `<h1>${escapeHtml(heading)}</h1>` +
          lines
            .join("\n")
            .split(/\n\s*\n/)
            .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
            .join(""),
        name,
        i,
      );
    });
  }
  const body = parse(text);
  const safe = cleanHtml((body.querySelector("body") ?? body).innerHTML);
  const parts = safe.split(/(?=<h[12](?:\s[^>]*)?>)/i).filter((s) => s.trim());
  return parts.map((s, i) => makeChapter(s, name.replace(/\.html?$/i, ""), i));
}
