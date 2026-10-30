// @vitest-environment jsdom
import { expect, it } from "vitest";
import { decorateFootnotes, footnoteSpeechText } from "../src/lib/footnotes";
import seed from "../src/data/book.json";
function article(html: string) {
  const root = document.createElement("article");
  root.innerHTML = html;
  return root;
}
it("links only matched references and preserves every original UTF-16 offset", () => {
  const root = article(
    "<p>A 😀 name (1), again (1), year (1330), ordinary (8).</p><p>Chú thích:</p><p>(1) A <em>long</em> note.</p><p>Continuation.</p><p>(2) Another note.</p>",
  );
  const text = root.textContent;
  decorateFootnotes(root, "vi", "chapter-1");
  expect(root.textContent).toBe(text);
  const refs = root.querySelectorAll<HTMLAnchorElement>(".footnote-ref");
  expect(refs).toHaveLength(2);
  expect(refs[0].dataset.tooltip).toBe("(1) A long note.\nContinuation.");
  expect(refs[0].getAttribute("aria-label")).toBe("Chú thích 1");
  expect(root.querySelector(refs[0].getAttribute("href")!)?.textContent).toBe(
    "(1) A long note.",
  );
  expect(footnoteSpeechText(root)).toBe(
    text!.replaceAll("name (1)", "name    ").replace("again (1)", "again    "),
  );
  expect(footnoteSpeechText(root).length).toBe(text!.length);
  decorateFootnotes(root, "vi", "chapter-1");
  expect(root.querySelectorAll(".footnote-ref")).toHaveLength(2);
  expect(root.textContent).toBe(text);
});
it("handles split inline formatting, alternate labels and existing linked references", () => {
  const root = article(
    '<p>Word <strong>(</strong>1<em>)</em> and <sup><a href="#existing">2</a></sup>.</p><h2>Notes</h2><p>1) First.</p><p id="existing">(2) Second.</p>',
  );
  const text = root.textContent;
  decorateFootnotes(root, "en", "chapter-14");
  expect(root.querySelectorAll(".footnote-ref")).toHaveLength(2);
  expect(root.textContent).toBe(text);
  expect(footnoteSpeechText(root)).toBe(
    "Word     and  .Notes1) First.(2) Second.",
  );
  expect(
    root.querySelector('a[href="#existing"]')?.getAttribute("aria-label"),
  ).toBe("Footnote 2");
});
it("does not reinterpret ordinary numbered lists or unmatched citations", () => {
  const root = article(
    "<p>Pick (1) then (2).</p><p>(1) Open.</p><p>(2) Close.</p>",
  );
  decorateFootnotes(root, "vi", "chapter-1");
  expect(root.querySelectorAll(".footnote-ref")).toHaveLength(0);
  expect(footnoteSpeechText(root)).toBe(root.textContent);
});
it("recognizes a DOCX note heading joined to an original-title note by line breaks", () => {
  const root = article(
    "<p>Name (1).</p><p><strong>Notes<br><br>(*) Original title.</strong></p><ul><li>(1) The note.</li></ul>",
  );
  decorateFootnotes(root, "en", "chapter-1");
  expect(root.querySelectorAll(".footnote-ref")).toHaveLength(1);
});
it("links the first note when its definition shares the note-heading paragraph",()=>{
  for(const [locale,heading] of [["vi","Chú thích:"],["en","Notes:"]] as const) {
    const root=article(`<p>Name (1) and (2).</p><p><strong>${heading}</strong> (1) First note.</p><p>(2) Second note.</p>`),text=root.textContent;
    decorateFootnotes(root,locale,"preface");
    const refs=[...root.querySelectorAll<HTMLAnchorElement>(".footnote-ref")];
    expect(refs).toHaveLength(2);
    expect(refs[0].dataset.tooltip).toBe("(1) First note.");
    expect(root.querySelector(refs[0].getAttribute("href")!)?.textContent).toContain(heading);
    expect(root.textContent).toBe(text);
    expect(footnoteSpeechText(root).startsWith("Name     and    .")).toBe(true);
    decorateFootnotes(root,locale,"preface");expect(root.querySelectorAll(".footnote-ref")).toHaveLength(2);
  }
});
it("keeps the early preface note and gives repeated definitions no ambiguous link", () => {
  const root = article(
    "<p>Preface (1) and (2).</p><p>(1) First.</p><p>Chú thích</p><p>(2) Second.</p><p>(2) Duplicate.</p>",
  );
  decorateFootnotes(root, "vi", "preface");
  expect(
    [...root.querySelectorAll(".footnote-ref")].map((e) => e.textContent),
  ).toEqual(["(1)"]);
});
it("maps the known legacy chapter-3 labels and includes both paragraphs of note 7", () => {
  const root = article(
    "<p>Chợ Nam Xang (1), Ban Cơ và Sái nữ (7), Hàn Dũ (8), Hồng Phất (9).</p><p>------------------------</p><p>(*) Nguyên văn: Mộc miên thụ truyện.</p><p>Chợ Nam Xang: the market.</p><p>Măng ngọc: fingers.</p><p>é ngọc: hairpin.</p><p>Lưng thắt ve vàng: waist.</p><p>Đường: blossom.</p><p>Dị An: poet.</p><p>Ban Cơ: first poet.</p><p>Sái nữ: second poet.</p><p>Hàn Dũ: author.</p><p>Hồng Phất: lady.</p>",
  );
  const text = root.textContent;
  decorateFootnotes(root, "vi", "chapter-3");
  expect(root.querySelectorAll(".footnote-ref")).toHaveLength(4);
  expect(
    root
      .querySelector('[aria-label="Chú thích 7"]')
      ?.getAttribute("data-tooltip"),
  ).toContain("Sái nữ: second poet.");
  expect(root.textContent).toBe(text);
});
it("links the unlabeled tail of Vietnamese chapter 14 without changing the source text", () => {
  const root = article(
    seed.chapters.find((ch) => ch.id === "chapter-14")!.vi!.html,
  );
  const text = root.textContent;
  decorateFootnotes(root, "vi", "chapter-14");
  expect(
    root
      .querySelector('[aria-label="Chú thích 31"]')
      ?.getAttribute("data-tooltip"),
  ).toContain("Cổ lâu");
  expect(
    root
      .querySelector('[aria-label="Chú thích 43"]')
      ?.getAttribute("data-tooltip"),
  ).toContain("Xử sĩ");
  expect(
    root
      .querySelector("#reader-footnote-43")
      ?.getAttribute("data-footnote-number"),
  ).toBe("43");
  expect(root.textContent).toBe(text);
});
