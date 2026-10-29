import { expect, it } from "vitest";
import { parse } from "node-html-parser";
import {
  replaceHtmlText,
  diffBlocks,
  inspectEditions,
} from "../src/lib/editor-tools";
it("replaces literal phrases across inline markup, preserves attributes and escapes replacement text", () => {
  const original =
    '<p>Nguyễn <em>Dữ</em> &amp; Nguyễn Dữ</p><a href="/Nguyễn-Dữ">Nguyễn Dữ</a><img src="/Nguyễn-Dữ.png">';
  const r = replaceHtmlText(original, "Nguyễn Dữ", "<Bản mới> $&", true);
  expect(r.count).toBe(3);
  const root = parse(r.html);
  expect(root.querySelector("em")).not.toBeNull();
  expect(root.querySelector("a")?.getAttribute("href")).toBe("/Nguyễn-Dữ");
  expect(root.querySelector("img")?.getAttribute("src")).toBe("/Nguyễn-Dữ.png");
  expect(root.textContent).toContain("<Bản mới> $&");
  expect(root.querySelector("bản")).toBeNull();
  expect(replaceHtmlText("<p>a</p><p>b</p>", "ab", "bad", false).count).toBe(0);
  expect(() => replaceHtmlText("<p>x</p>", "", "x", false)).toThrow();
});
it("reports added, deleted and formatting-only paragraphs safely", () => {
  const r = diffBlocks(
    "<p>A</p><p>Old</p><p>Z</p>",
    "<p><strong>A</strong></p><p>New</p><p>Z</p>",
  );
  expect(r).toEqual(
    expect.arrayContaining([
      { kind: "format", text: "A" },
      { kind: "removed", text: "Old" },
      { kind: "added", text: "New" },
      { kind: "same", text: "Z" },
    ]),
  );
  expect(diffBlocks("", "<p>New</p>")).toEqual([
    { kind: "added", text: "New" },
  ]);
  expect(
    diffBlocks('<img src="/a.png"><p>A</p>', '<img src="/b.png"><p>A</p>').map(
      (p) => p.kind,
    ),
  ).toEqual(["removed", "added", "same"]);
});
it("finds empty chapters, duplicate locale titles, dangling references and broken image candidates", () => {
  const r = inspectEditions([
    {
      id: "chapter-1",
      locale: "vi",
      title: "Same",
      html: "<p>Text (2)</p><p>Chú thích:</p><p>(1) Note</p><img>",
      kind: "text",
    },
    {
      id: "chapter-2",
      locale: "vi",
      title: " same ",
      html: "<p> </p>",
      kind: "text",
    },
    {
      id: "chapter-3",
      locale: "en",
      title: "Same",
      html: '<p><a href="#missing">1</a></p>',
      kind: "text",
    },
  ]);
  expect(r.map((i) => i.code)).toEqual(
    expect.arrayContaining([
      "missing-note",
      "missing-image",
      "empty-chapter",
      "duplicate-title",
      "missing-target",
    ]),
  );
  expect(r.filter((i) => i.code === "duplicate-title")).toHaveLength(2);
});
