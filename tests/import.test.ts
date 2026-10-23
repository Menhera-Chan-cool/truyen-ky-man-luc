import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { importFile, readArchiveEntry } from "../src/lib/importer";
import { cleanHtml } from "../src/lib/sanitize";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { slicePdf } from "../src/lib/pdf";
describe("untrusted uploads", () => {
  it("separates a repeated source masthead from the EPUB chapter body", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
    );
    zip.file(
      "book.opf",
      '<package><metadata><dc:title>Truyền Kỳ Mạn Lục</dc:title><dc:creator>Nguyễn Dữ</dc:creator></metadata><manifest><item id="c" href="c.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>',
    );
    zip.file(
      "c.html",
      '<html><head><title>Chương 1: Câu chuyện</title></head><body><div id="toc-C1">Truyền Kỳ Mạn Lục</div><div>Nguyễn Dữ</div><div>www.dtv-ebook.com</div><h4>Chương 1: Câu Chuyện (*)</h4><p>Quan Thừa chỉ Hồ Tông Thốc (1) là người hay chữ.</p><p>(1) Chú thích vẫn còn.</p></body></html>',
    );
    const [part] = await importFile(
      await zip.generateAsync({ type: "uint8array" }),
      "sample.epub",
      "vi",
    );
    expect(part.html).not.toContain("www.dtv-ebook.com");
    expect(part.html).not.toContain("<h4>");
    expect(part.html).toContain('id="toc-C1"');
    expect(part.html).toContain("Quan Thừa chỉ Hồ Tông Thốc (1)");
    expect(part.html).toContain("Chú thích vẫn còn.");
  });
  it("publishes only the selected PDF pages and refuses invalid ranges", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.addPage([200, 200]);
    doc.addPage([300, 300]);
    const original = await doc.save();
    const result = await PDFDocument.load(await slicePdf(original, 2, 2));
    expect(result.getPageCount()).toBe(1);
    expect(result.getPage(0).getWidth()).toBe(200);
    expect((await PDFDocument.load(original)).getPageCount()).toBe(3);
    await expect(slicePdf(original, 0, 2)).rejects.toThrow();
  });
  it("removes executable HTML and unsafe URLs but keeps notes and emphasis", () => {
    const html = cleanHtml(
      '<p onclick="alert(1)"><strong>Story</strong><a href="#note">1</a><img src="javascript:alert(1)"></p><script>alert(1)</script><iframe src="https://bad.test"></iframe>',
    );
    expect(html).toContain("<strong>Story</strong>");
    expect(html).toContain('href="#note"');
    expect(html).not.toMatch(/onclick|javascript:|<script|<iframe/);
  });
  it("splits TXT chapters and keeps numbers in natural order", async () => {
    const result = await importFile(
      new TextEncoder().encode(
        "Chapter 2: Two\n\nText two.\n\nChapter 10: Ten\n\nText ten.",
      ),
      "book.txt",
      "en",
    );
    expect(result.map((c) => c.id)).toEqual(["chapter-2", "chapter-10"]);
    expect(result[0].html).toContain("Text two.");
  });
  it("rejects malformed or disguised EPUB files", async () => {
    await expect(
      importFile(new TextEncoder().encode("not a zip"), "bad.epub", "vi"),
    ).rejects.toThrow();
  });
  it("stops a decompression stream before exceeding its byte limit", async () => {
    const zip = new JSZip();
    zip.file("large.txt", "x".repeat(100000));
    const loaded = await JSZip.loadAsync(
      await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
    );
    await expect(readArchiveEntry(loaded, "large.txt", 32)).rejects.toThrow(
      /limit/i,
    );
  });
  it("imports the supplied merged-heading DOCX without swallowing its first paragraph", async () => {
    const [chapter] = await importFile(
      await readFile("tests/fixtures/chapter-2.docx"),
      "Chương-2.docx",
      "en",
    );
    expect(chapter.title).toBe(
      "Chapter 2: The Tale of the Virtuous Wife of Khoai Chau",
    );
    expect(chapter.html).toContain("Tu Dat, a man of Khoai Chau");
    expect(chapter.html).not.toContain("Chapter 2: The Tale");
  });
  it("uses the EPUB spine and rewrites cross-chapter footnotes", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    );
    zip.file(
      "OPS/book.opf",
      '<package><manifest><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
    );
    zip.file(
      "OPS/a.xhtml",
      '<html><body><h1>Chapter 1: One</h1><p>Text <a href="b.xhtml#note">note</a></p></body></html>',
    );
    zip.file(
      "OPS/b.xhtml",
      '<html><body><h1>Chapter 2: Two</h1><p id="note">The note.</p></body></html>',
    );
    const result = await importFile(
      await zip.generateAsync({ type: "uint8array" }),
      "book.epub",
      "en",
    );
    expect(result.map((c) => c.id)).toEqual(["chapter-1", "chapter-2"]);
    expect(result[0].html).toContain("/en/read/chapter-2#note");
  });
});
