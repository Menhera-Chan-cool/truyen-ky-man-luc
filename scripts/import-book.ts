import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { parse } from "node-html-parser";
import { importFile } from "../src/lib/importer";
import { chapterNumber, stripTitle } from "../src/lib/content";
import { cleanHtml } from "../src/lib/sanitize";
import type { Book } from "../src/lib/types";

const source =
  process.argv[2] ??
  "C:/Users/Admin/Downloads/Truyen Ky Man Luc - Nguyen Du.epub";
const englishDir = process.argv[3] ?? "D:/truyenkimanluc";
const titles = [
  "The Tale at the Shrine of King Xiang",
  "The Tale of the Virtuous Wife of Khoai Chau",
  "The Tale of the Silk-Cotton Tree",
  "The Tale of the Tea Boy’s Descent into the Mortal World",
  "The Strange Encounter at the Western Estate",
  "The Lawsuit at the Dragon Palace",
  "The Tale of Dao Thi’s Karmic Retribution",
  "The Tale of the Judge of Tan Vien Shrine",
  "The Tale of Tu Thuc, Who Wed an Immortal",
  "The Tale of Pham Tu Hu’s Journey to the Celestial Court",
  "The Night Banquet on the Da River",
  "The Tale of the Woman of Nam Xuong",
  "The Tale of the Demon of Xuong Giang",
  "The Dialogue of the Woodcutter of Mount Na",
  "The Tale of the Abandoned Temple in Dong Trieu District",
  "The Tale of Thuy Tieu",
  "The Tale of General Ly",
  "The Tale of Le Nuong",
  "A Discourse on Poetry at Kim Hoa",
  "The Tale of the Yaksha General",
];
const bytes = await readFile(source);
const zip = await JSZip.loadAsync(bytes);
await mkdir("public/book", { recursive: true });
await mkdir("src/data", { recursive: true });
await writeFile(
  "public/book/cover.jpg",
  await zip.file("cover.jpg")!.async("uint8array"),
);
const imported = await importFile(bytes, path.basename(source), "vi");
const book: Book = {
  id: "truyen-ky-man-luc",
  author: "Nguyễn Dữ",
  revision: 1,
  meta: {
    vi: {
      title: "Truyền kỳ mạn lục",
      summary:
        "Hai mươi câu chuyện về người và cõi khác. Những cuộc gặp gỡ kỳ lạ, tình yêu, lẽ công bằng và số phận con người qua ngòi bút Nguyễn Dữ.",
      frontCover: "/book/cover.jpg",
    },
    en: {
      title: "Records of Strange Tales",
      summary:
        "Twenty tales between the human world and the unseen. Strange encounters, love, justice, and human fate in the stories of Nguyễn Dữ.",
      frontCover: "/book/cover.jpg",
    },
  },
  chapters: [],
};
for (const part of imported) {
  const n =
    chapterNumber(part.title) ||
    chapterNumber(part.id.replace("chapter-", "Chapter "));
  if (!n && !/tựa|preface/i.test(part.title)) continue;
  const id = n ? `chapter-${n}` : "preface";
  const html = cleanHtml(part.html);
  book.chapters.push({
    id,
    order: n ?? 0,
    vi: {
      title: part.title.replace(/\s*\(\*\)\s*$/, ""),
      html,
      revision: 1,
      kind: "text",
    },
  });
}
const files = (await readdir(englishDir))
  .filter((f) => f.toLowerCase().endsWith(".docx"))
  .sort((a, b) => (chapterNumber(a) ?? 0) - (chapterNumber(b) ?? 0));
const mammoth = await import("mammoth");
for (const file of files) {
  const n = chapterNumber(file);
  assert(n && n >= 1 && n <= 20, `Unexpected file ${file}`);
  const { value } = await mammoth.convertToHtml({
    buffer: await readFile(path.join(englishDir, file)),
  });
  const doc = parse(value);
  const first = doc
    .querySelectorAll("p,h1,h2,h3")
    .find((p) => p.textContent.trim());
  assert(first, `Empty ${file}`);
  const rawTitle = titles[n - 1];
  const normalize = (s: string) =>
    s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const text = first.textContent;
  const normal = normalize(text);
  const prefix = normal.match(
    n === 16
      ? /^(?:Chapter\s*)?16\s*:\s*/i
      : new RegExp(`^Chapter\\s*${n}\\s*:\\s*`, "i"),
  )?.[0];
  assert(prefix, `Missing heading in ${file}`);
  assert(
    normalize(normal.slice(prefix.length)).startsWith(normalize(rawTitle)),
    `Title mismatch ${file}`,
  );
  // Some source files put the heading and the opening paragraph in one Word paragraph.
  const titleEnd = prefix.length + normalize(rawTitle).length;
  let consumed = 0,
    cut = 0,
    previousSpace = false;
  for (let i = 0; i < text.length; i++) {
    const space = /\s/.test(text[i]);
    if (space && (previousSpace || !consumed)) {
      previousSpace = true;
      continue;
    }
    consumed++;
    previousSpace = space;
    cut = i + 1;
    if (consumed >= titleEnd) break;
  }
  let remainder = text
    .slice(cut)
    .trim()
    .replace(/^\(\*\)\s*/, "");
  if (remainder) first.set_content(remainder);
  else first.remove();
  const chapter = book.chapters.find((c) => c.id === `chapter-${n}`);
  assert(chapter, `Missing Vietnamese pair ${n}`);
  chapter.en = {
    title: `Chapter ${n}: ${rawTitle}`,
    html: cleanHtml(doc.toString()),
    revision: 1,
    kind: "text",
  };
}
book.chapters.sort((a, b) => a.order - b.order);
assert.equal(
  book.chapters.filter((c) => c.vi && c.id.startsWith("chapter-")).length,
  20,
);
assert.equal(book.chapters.filter((c) => c.en).length, 20);
assert(book.chapters.find((c) => c.id === "preface"));
assert(book.chapters.every((c) => !c.vi || c.vi.html.length > 100));
assert(book.chapters.every((c) => !c.en || c.en.html.length > 100));
await writeFile("src/data/book.json", JSON.stringify(book));
console.log(
  JSON.stringify(
    {
      vietnamese: book.chapters.filter((c) => c.vi).length,
      english: book.chapters.filter((c) => c.en).length,
      chapters: book.chapters.map((c) => ({
        id: c.id,
        vi: c.vi?.title,
        en: c.en?.title,
      })),
    },
    null,
    2,
  ),
);
