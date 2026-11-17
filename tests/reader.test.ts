import { it, expect } from "vitest";
import {
  speechSegments,
  speechText,
  normalizeSettings,
  countPages,
  contrastText,
  snapToWords,
} from "../src/lib/reader";
it("retains the additional reading fonts in saved settings", () => {
  for (const font of [
    "Lora",
    "Merriweather",
    "Inter",
    "Roboto",
    "OpenDyslexic",
    "JetBrains Mono",
  ])
    expect(normalizeSettings({ font }).font).toBe(font);
});
it("keeps selected controls readable on both light and dark theme accents", () => {
  expect(contrastText("#d5ac79")).toBe("#000000");
  expect(contrastText("#8d342b")).toBe("#ffffff");
});
it("speech segmentation preserves the text without dropping long sentences", () => {
  const text =
    "A long sentence " + "with words ".repeat(100) + ". Then the end!";
  const chunks = speechSegments(text);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((c) => c.length <= 240)).toBe(true);
  expect(chunks.join(" ").replace(/\s+/g, " ").trim()).toBe(
    text.replace(/\s+/g, " ").trim(),
  );
});
it("keeps short sentences together to avoid restarting the voice at every full stop", () => {
  const text = "Một câu. Câu tiếp: đợi... rồi đi.";
  expect(speechSegments(text)).toEqual([text]);
  expect(speechSegments(text, false)).toEqual([
    "Một câu.",
    "Câu tiếp: đợi...",
    "rồi đi.",
  ]);
});
it("softens speech punctuation without moving word boundaries or altering the source", () => {
  const text = "Xin chào. Nghe này: chờ… một chút; rồi đi—nhé.";
  expect(speechText(text, true)).toBe(
    "Xin chào, Nghe này, chờ, một chút, rồi đi,nhé,",
  );
  expect(speechText("Đợi... nhé", true)).toBe("Đợi,   nhé");
  expect(speechText(text, false)).toBe(text);
  expect(speechText(text, true).length).toBe(text.length);
});
it("preserves decimal numbers, times, domains and common abbreviations while shortening pauses", () => {
  expect(
    speechText("3.14 lúc 12:30. Mr. Brown ở example.com. U.S.A.", true),
  ).toBe("3.14 lúc 12:30, Mr. Brown ở example.com, U.S.A.");
});
it("restores bounded settings and a supported reading mode", () => {
  expect(
    normalizeSettings({
      fontSize: 500,
      lineHeight: 0,
      mode: "unknown",
    } as never),
  ).toMatchObject({ fontSize: 36, lineHeight: 1.2, mode: "scroll" });
});
it("counts column spreads including the last partial spread", () => {
  expect(countPages(3100, 1000, 48)).toBe(4);
  expect(countPages(0, 0, 48)).toBe(1);
});
it("widens a selection that cuts a word in half to the whole word, and leaves whole words alone", () => {
  const snap = (text: string, quote: string, from = 0) => {
    const start = text.indexOf(quote, from);
    const [s, e] = snapToWords(text, start, start + quote.length);
    return text.slice(s, e);
  };
  const english = "its kernels combine a high starch; it only survived in South America, says Smith.";
  expect(snap(english, "mbin")).toBe("combine"); // inside one word
  expect(snap(english, "outh Ame")).toBe("South America"); // starts and ends in the middle of a word
  expect(snap(english, "South America")).toBe("South America"); // already whole words
  expect(snap(english, "America,")).toBe("America,"); // punctuation is a boundary
  expect(snap(english, "ernels comb")).toBe("kernels combine");
  expect(snap("They don't go", "do")).toBe("don't"); // an apostrophe between letters belongs to the word
  expect(snap("a well-known term", "ell-kn")).toBe("well-known");
  expect(snap("Cờ đỏ xanh bay.", "ỏ xa")).toBe("đỏ xanh"); // Vietnamese syllables with marks
  expect(snap("Cờ đỏ xanh bay.", "đỏ xanh")).toBe("đỏ xanh");
  // verse lines run together: a lower-case letter followed by a capital is a boundary
  expect(snap("Quan TrungKhói tan", "Khói")).toBe("Khói");
  expect(snap("Quan TrungKhói tan", "ung")).toBe("Trung");
  expect(snapToWords("abc", 0, 3)).toEqual([0, 3]);
  expect(snapToWords("", 0, 0)).toEqual([0, 0]);
});
