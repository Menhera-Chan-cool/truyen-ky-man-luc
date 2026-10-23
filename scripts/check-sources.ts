import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { parse } from "node-html-parser";
import { chapterNumber } from "../src/lib/content";
import type { Book } from "../src/lib/types";
import mammoth from "mammoth";
const book = JSON.parse(await readFile("src/data/book.json", "utf8")) as Book;
const source =
  process.argv[2] ??
  "C:/Users/Admin/Downloads/Truyen Ky Man Luc - Nguyen Du.epub";
const english = process.argv[3] ?? "D:/truyenkimanluc";
const zip = await JSZip.loadAsync(await readFile(source));
const normalize = (s: string) =>
  s.normalize("NFC").replace(/\s+/g, " ").replace(/[‘’]/g, "'").trim();
const paragraphs = (html: string) =>
  parse(html)
    .querySelectorAll("p")
    .map((p) => normalize(p.textContent))
    .filter(Boolean);
let viParagraphs = 0,
  enParagraphs = 0;
for (const chapter of book.chapters) {
  if (!chapter.vi) continue;
  const n =
    chapter.id === "preface" ? 0 : Number(chapter.id.replace("chapter-", ""));
  const original = await zip.file(`Text/C${n}.html`)!.async("string");
  const expected = paragraphs(original),
    actual = paragraphs(chapter.vi.html);
  assert.deepEqual(
    actual,
    expected,
    `Vietnamese paragraphs changed in ${chapter.id}`,
  );
  assert(
    !chapter.vi.html.includes("www.dtv-ebook.com"),
    `Repeated masthead remains in ${chapter.id}`,
  );
  viParagraphs += actual.length;
}
for (const filename of await readdir(english)) {
  if (!filename.endsWith(".docx")) continue;
  const n = chapterNumber(filename)!;
  const edition = book.chapters.find((c) => c.id === `chapter-${n}`)!.en!;
  const { value } = await mammoth.convertToHtml({
    buffer: await readFile(path.join(english, filename)),
  });
  const original = paragraphs(value);
  const title = edition.title
    .replace(/^Chapter\s+\d+\s*:\s*/i, "")
    .replace(/[‘’]/g, "'");
  const pattern = title
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  original[0] = original[0]
    .replace(
      new RegExp(
        `^(?:Chapter\\s*)?${n}\\s*:\\s*${pattern}(?:\\s*\\(\\*\\))?`,
        "i",
      ),
      "",
    )
    .trim();
  const expected = original.filter(Boolean),
    actual = paragraphs(edition.html);
  assert.deepEqual(
    actual,
    expected,
    `English paragraphs changed in ${filename}`,
  );
  enParagraphs += actual.length;
}
assert.equal(book.chapters.filter((c) => c.vi).length, 21);
assert.equal(book.chapters.filter((c) => c.en).length, 20);
console.log(
  JSON.stringify({
    vietnameseEditions: 21,
    englishEditions: 20,
    vietnameseParagraphs: viParagraphs,
    englishParagraphs: enParagraphs,
    allParagraphsMatchSources: true,
  }),
);
