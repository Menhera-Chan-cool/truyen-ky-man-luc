import { it, expect } from "vitest";
import {
  parsePronunciations,
  pronounceText,
  mergeRecent,
  parseRecent,
  parsePageInput,
  validateFont,
} from "../src/lib/reader-extras";
it("maps expanded pronunciation boundaries back to original UTF-16 and matches whole names", () => {
  const source = "😀 An và Anh gặp Nguyễn Dữ.";
  const rules = parsePronunciations([
    { from: "An", to: "A nờ" },
    { from: "Nguyễn Dữ", to: "nguyễn dữ ơi" },
  ]);
  const r = pronounceText(source, rules);
  expect(r.text).toBe("😀 A nờ và Anh gặp nguyễn dữ ơi.");
  expect(r.offsets[r.text.indexOf("Anh")]).toBe(source.indexOf("Anh"));
  expect(r.offsets[r.text.indexOf("dữ ơi")]).toBe(source.indexOf("Nguyễn"));
  expect(r.offsets.at(-1)).toBe(source.length);
  expect(pronounceText("ς", [{ from: "Σ", to: "sigma" }]).text).toBe("sigma");
  expect(() => parsePronunciations([{ from: "", to: "bad" }])).toThrow();
});
it("deduplicates recent semantic positions, preserves locales and limits history", () => {
  const p = {
    chapterId: "chapter-1",
    locale: "vi" as const,
    revision: 2,
    anchor: 25,
    ratio: 0.2,
    page: 1,
    at: 1,
  };
  expect(mergeRecent([{ ...p, at: 0 }], { ...p, at: 2 })).toEqual([
    { ...p, at: 2 },
  ]);
  expect(mergeRecent([p], { ...p, locale: "en", at: 2 })).toHaveLength(2);
  expect(() => parseRecent([{ ...p, anchor: 3_000_000 }])).toThrow();
  expect(parsePageInput("3", 8)).toBe(2);
  expect(() => parsePageInput("9", 8)).toThrow();
  expect(() => parsePageInput("1.5", 8)).toThrow();
});
it("validates local font type, magic and size before parsing", () => {
  expect(
    validateFont("my.woff2", new Uint8Array([119, 79, 70, 50, 0]), 5),
  ).toBe("woff2");
  expect(() =>
    validateFont("bad.ttf", new Uint8Array([119, 79, 70, 50]), 4),
  ).toThrow();
  expect(() =>
    validateFont("large.woff2", new Uint8Array([119, 79, 70, 50]), 4_000_000),
  ).toThrow();
});
