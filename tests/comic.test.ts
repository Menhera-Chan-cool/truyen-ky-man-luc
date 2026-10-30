import { it, expect } from "vitest";
import JSZip from "jszip";
import {
  naturalComicOrder,
  moveComicPage,
  comicMime,
  normalizeComicSettings,
  type ComicPage,
} from "../src/lib/comic";
import { unpackComicFiles } from "../src/lib/comic-import";
import { serializeComicDraft, restoreComicDraft } from "../src/lib/comic-db";
it("stores image bytes without Blob/File preparation and restores identical IDs and pixels", async () => {
  const data = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const draft = {
    id: "chapter-1",
    title: "Ảnh thử",
    direction: "ltr" as const,
    revision: 0,
    updatedAt: 0,
    pages: [
      {
        id: "image-1",
        name: "page.png",
        width: 1,
        height: 1,
        bytes: data.length,
        hash: "test",
        blob: new Blob([data], { type: "image/png" }),
      },
    ],
  };
  const stored = await serializeComicDraft(draft);
  expect(stored.pages[0]).not.toHaveProperty("blob");
  expect(stored.pages[0].data).toBeInstanceOf(ArrayBuffer);
  const restored = restoreComicDraft(stored);
  expect(restored.pages[0].id).toBe("image-1");
  expect(new Uint8Array(await restored.pages[0].blob!.arrayBuffer())).toEqual(
    data,
  );
});
const pages = ["page10.png", "page2.png", "page01.png"].map((name, n) => ({
  id: String(n),
  name,
})) as ComicPage[];
it("sorts numbered pages naturally without changing the original", () => {
  expect(naturalComicOrder(pages).map((p) => p.name)).toEqual([
    "page01.png",
    "page2.png",
    "page10.png",
  ]);
  expect(pages[0].name).toBe("page10.png");
});
it("moves stable page IDs without mutating page objects and rejects invalid indices", () => {
  const moved = moveComicPage(pages, 0, 2);
  expect(moved.map((p) => p.id)).toEqual(["1", "2", "0"]);
  expect(moved[2]).toBe(pages[0]);
  expect(() => moveComicPage(pages, -1, 2)).toThrow();
});
it("checks actual raster signatures instead of trusting an extension", () => {
  expect(comicMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    "image/png",
  );
  expect(comicMime(new Uint8Array([255, 216, 255, 224]))).toBe("image/jpeg");
  expect(
    comicMime(new TextEncoder().encode('<svg onload="alert(1)"/>')),
  ).toBeUndefined();
});
it("normalizes reader preferences with bounds and an explicit mode", () => {
  expect(
    normalizeComicSettings({
      mode: "bad",
      zoom: 900,
      gap: -4,
      direction: "rtl",
      autoSpeed: 9000,
      keyboardStep: 0,
      dim: 999,
      progress: "invalid",
    }),
  ).toMatchObject({
    mode: "vertical",
    zoom: 200,
    gap: 0,
    direction: "rtl",
    autoSpeed: 600,
    keyboardStep: 10,
    dim: 100,
    progress: "left",
  });
});
it("unpacks image archives in natural order and ignores harmless metadata", async () => {
  const zip = new JSZip();
  const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  zip
    .file("page10.png", image)
    .file("page2.png", image)
    .file("ComicInfo.xml", "<ComicInfo/>");
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const files = await unpackComicFiles([
    new File([bytes.slice().buffer as ArrayBuffer], "chapter.cbz"),
  ]);
  expect(files.map((f) => f.name)).toEqual(["page2.png", "page10.png"]);
});
it("rejects corrupt files, unsafe paths and active content without a partial result", async () => {
  await expect(
    unpackComicFiles([new File(["not a png"], "page.png")]),
  ).rejects.toThrow();
  const zip = new JSZip().file(
    "../page.png",
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  await expect(
    unpackComicFiles([
      new File(
        [
          (await zip.generateAsync({ type: "uint8array" })).slice()
            .buffer as ArrayBuffer,
        ],
        "bad.zip",
      ),
    ]),
  ).rejects.toThrow();
  await expect(
    unpackComicFiles([new File(["<svg/>"], "page.svg")]),
  ).rejects.toThrow();
});
