import { describe, expect, it } from "vitest";
import { missingChapterTitle } from "../src/lib/content";
it("labels an untranslated chapter by its own identity rather than calling it a preface", () => {
  expect(missingChapterTitle("chapter-5", "en")).toBe(
    "Chapter 5 · Translation forthcoming",
  );
  expect(missingChapterTitle("preface", "en")).toBe(
    "Preface · Translation forthcoming",
  );
});
import {
  chapterNumber,
  safeArchivePath,
  stripTitle,
  validateImport,
  resolveAnchor,
} from "../src/lib/content";

describe("bilingual content and import boundaries", () => {
  it("orders chapter 2 before chapter 10 and recognises the exceptional chapter 16", () => {
    expect(chapterNumber("Chương-2.docx")).toBe(2);
    expect(chapterNumber("Chương-10.docx")).toBe(10);
    expect(chapterNumber("  16: The Tale of Thuy Tieu")).toBe(16);
  });
  it("removes a standalone heading without swallowing the opening paragraph", () => {
    expect(
      stripTitle("<h1>Chapter 2: A story</h1><p>Tu Dat lived here.</p>"),
    ).toEqual({
      title: "Chapter 2: A story",
      html: "<p>Tu Dat lived here.</p>",
    });
  });
  it("keeps the opening paragraph when a long Word paragraph includes a heading", () => {
    const html =
      "<p>Chapter 2: A story " + "Opening words. ".repeat(40) + "</p>";
    expect(stripTitle(html).html).toContain("Opening words.");
    expect(
      stripTitle(
        "<p>Chapter 2: A story Tu Dat lived here.</p>",
        "Chapter 2: A story",
      ).html,
    ).toBe("<p>Tu Dat lived here.</p>");
  });
  it("resolves relative EPUB paths and refuses traversal", () => {
    expect(safeArchivePath("Text/C1.html", "../cover.jpg")).toBe("cover.jpg");
    expect(() => safeArchivePath("C1.html", "../../secret")).toThrow();
    expect(() => safeArchivePath("C1.html", "https://evil.test")).toThrow();
  });
  it("requires explicit confirmation before replacing a selected chapter", () => {
    expect(() =>
      validateImport(
        [{ id: "chapter-1", title: "One", html: "<p>Text</p>" }],
        ["chapter-1"],
        false,
      ),
    ).toThrow(/replace/i);
    expect(
      validateImport(
        [{ id: "chapter-1", title: "One", html: "<p>Text</p>" }],
        ["chapter-1"],
        true,
      ),
    ).toHaveLength(1);
  });
  it("does not attach a note to a different edition revision", () => {
    expect(
      resolveAnchor(
        { revision: 1, start: 0, end: 5, text: "hello" },
        2,
        "hello again",
      ),
    ).toBeNull();
    expect(
      resolveAnchor(
        { revision: 1, start: 0, end: 5, text: "hello" },
        1,
        "hello again",
      ),
    ).toEqual([0, 5]);
    expect(
      resolveAnchor(
        { revision: 1, start: 0, end: 5, text: "wrong" },
        1,
        "hello again",
      ),
    ).toBeNull();
  });
});
