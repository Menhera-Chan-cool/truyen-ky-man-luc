import { expect, it } from "vitest";
import { normalizeSettings, settingsFromCookie } from "../src/lib/reader";
import { defaultSettings } from "../src/lib/types";
import { parseReaderBackup } from "../src/lib/reader-backup";
it("defaults legacy settings to ebook and retains a chosen book presentation", () => {
  expect(normalizeSettings({}).layout).toBe("ebook");
  expect(normalizeSettings({ layout: "book" }).layout).toBe("book");
  expect(
    settingsFromCookie(encodeURIComponent(JSON.stringify({ layout: "book" })))
      .layout,
  ).toBe("book");
  expect(normalizeSettings({ layout: "other" } as any).layout).toBe("ebook");
});
it("round-trips book layout but accepts a backup from before the new field", () => {
  const backup = {
    format: "truyen-ky-man-luc-reader-backup",
    version: 1,
    bookId: "truyen-ky-man-luc",
    exportedAt: new Date(0).toISOString(),
    settings: { ...defaultSettings, layout: "book" },
    progress: [],
    annotations: [],
  };
  expect(parseReaderBackup(JSON.stringify(backup)).settings?.layout).toBe(
    "book",
  );
  delete (backup.settings as any).layout;
  expect(parseReaderBackup(JSON.stringify(backup)).settings?.layout).toBe(
    "ebook",
  );
  (backup.settings as any).layout = "invalid";
  expect(() => parseReaderBackup(JSON.stringify(backup))).toThrow();
});
