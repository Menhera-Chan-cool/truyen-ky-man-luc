import { it, expect } from "vitest";
import {
  speechSegments,
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
