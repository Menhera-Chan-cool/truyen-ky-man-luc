import { expect, it } from "vitest";
import {
  parseReaderBackup,
  mergeBackupNotes,
  MAX_BACKUP_BYTES,
} from "../src/lib/reader-backup";
import { defaultSettings } from "../src/lib/types";
const note = {
  id: "note-1",
  chapterId: "chapter-1",
  locale: "vi",
  revision: 2,
  start: 0,
  end: 5,
  text: "Hello",
  color: "#f3dd83",
  note: "Personal note",
  createdAt: 1,
};
const file = () => ({
  format: "truyen-ky-man-luc-reader-backup",
  version: 1,
  bookId: "truyen-ky-man-luc",
  exportedAt: "2026-10-23T00:00:00.000Z",
  settings: defaultSettings,
  progress: [
    {
      key: "vi:last",
      value: {
        chapterId: "chapter-1",
        revision: 2,
        ratio: 0.4,
        page: 3,
        anchor: 45,
        pdfPage: 2,
        pdfZoom: 1.5,
      },
    },
  ],
  annotations: [note],
});
it("restores older backups with short pauses enabled and preserves an explicit opt out", () => {
  const legacy = { ...defaultSettings } as Record<string, unknown>;
  delete legacy.shortPauses;
  expect(
    parseReaderBackup(JSON.stringify({ ...file(), settings: legacy })).settings,
  ).toMatchObject({ shortPauses: true });
  expect(
    parseReaderBackup(
      JSON.stringify({
        ...file(),
        settings: { ...defaultSettings, shortPauses: false },
      }),
    ).settings,
  ).toMatchObject({ shortPauses: false });
  expect(() =>
    parseReaderBackup(
      JSON.stringify({
        ...file(),
        settings: { ...defaultSettings, shortPauses: "false" },
      }),
    ),
  ).toThrow();
});
it("round trips a device backup including exact anchors and PDF position", () => {
  const parsed = parseReaderBackup(JSON.stringify(file()));
  expect(parsed.annotations[0].note).toBe("Personal note");
  expect(parsed.progress[0].value.anchor).toBe(45);
  expect(parsed.progress[0].value.pdfPage).toBe(2);
});
it("rejects foreign books, unsupported versions, unsafe images, bad offsets and malformed settings", () => {
  for (const change of [
    { bookId: "other" },
    { version: 99 },
    {
      progress: [
        {
          key: "vi:chapter-2",
          value: { chapterId: "chapter-1", revision: 1, page: 0, ratio: 0.4 },
        },
      ],
    },
    { annotations: [{ ...note, image: "javascript:alert(1)" }] },
    { annotations: [{ ...note, start: -1 }] },
    { settings: { ...defaultSettings, background: "url(x)" } },
  ])
    expect(() =>
      parseReaderBackup(JSON.stringify({ ...file(), ...change })),
    ).toThrow();
  expect(() => parseReaderBackup("null")).toThrow();
  expect(() => parseReaderBackup("[")).toThrow();
});
it("preserves both conflicting notes and makes repeated restore idempotent", () => {
  const existing = { ...note, note: "Edited on this device" };
  const incoming = parseReaderBackup(JSON.stringify(file())).annotations;
  const merged = mergeBackupNotes([existing as never], incoming);
  expect(merged).toHaveLength(2);
  expect(merged.map((n) => n.note)).toContain("Edited on this device");
  expect(merged[1].id).not.toBe(note.id);
  expect(mergeBackupNotes(merged, incoming)).toHaveLength(2);
});
it("bounds file size, duplicate progress keys and PDF values before any device writes", () => {
  expect(() => parseReaderBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toThrow();
  const backup = file();
  backup.progress.push(backup.progress[0]);
  expect(() => parseReaderBackup(JSON.stringify(backup))).toThrow();
  for (const pdf of [{ pdfPage: 0 }, { pdfZoom: 4 }, { pdfPage: 1.2 }])
    expect(() =>
      parseReaderBackup(
        JSON.stringify({ ...file(), annotations: [{ ...note, ...pdf }] }),
      ),
    ).toThrow();
  for (const image of [
    "data:image/svg+xml,<svg/>",
    "file:///private",
    "javascript:alert(1)",
  ])
    expect(() =>
      parseReaderBackup(
        JSON.stringify({ ...file(), annotations: [{ ...note, image }] }),
      ),
    ).toThrow();
});
