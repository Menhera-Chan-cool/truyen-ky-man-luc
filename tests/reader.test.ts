import { it, expect } from "vitest";
import {
  speechSegments,
  speechText,
  normalizeSettings,
  countPages,
  contrastText,
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
