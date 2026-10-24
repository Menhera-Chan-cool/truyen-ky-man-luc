import { expect, it } from "vitest";
import { findBookText as find, prepareBookText } from "../src/lib/book-search";
const findBookText = (
  chapters: Parameters<typeof prepareBookText>[0],
  query: string,
) => find(prepareBookText(chapters), query);
const index = [
  {
    chapterId: "chapter-2",
    title: "Nghĩa phụ",
    revision: 4,
    text: "A 😀 người nghĩa phụ. NGƯỜI NGHĨA PHỤ! Đêm.",
  },
];
it("finds accent/case insensitive phrases with original UTF-16 anchors", () => {
  const found = findBookText(index, "NGUOI nghia phu");
  expect(found.matches).toHaveLength(2);
  for (const m of found.matches)
    expect(index[0].text.slice(m.start, m.end).toLocaleLowerCase()).toBe(
      "người nghĩa phụ",
    );
  expect(found.matches[0].revision).toBe(4);
});
it("preserves decomposed combining marks and treats punctuation literally", () => {
  const text = "Nghi\u0303a [phu].";
  const r = findBookText([{ ...index[0], text }], "nghia [phu]");
  expect(text.slice(r.matches[0].start, r.matches[0].end)).toBe(
    "Nghi\u0303a [phu]",
  );
});
it("bounds results and ignores empty queries", () => {
  expect(findBookText(index, "   ").matches).toEqual([]);
  const r = findBookText([{ ...index[0], text: "word ".repeat(150) }], "word");
  expect(r.matches).toHaveLength(100);
  expect(r.truncated).toBe(true);
});
