// @vitest-environment jsdom
import { expect, it } from "vitest";
import { rangeFromOffsets } from "../src/lib/reader";
it("starts a boundary anchor in the next text node instead of the previous paragraph", () => {
  const root = document.createElement("article");
  root.innerHTML =
    "<p>First paragraph.</p><p>Target <strong>passage</strong>.</p>";
  const offset = "First paragraph.".length;
  const range = rangeFromOffsets(root, offset, offset + 6)!;
  expect(range.toString()).toBe("Target");
  expect(range.startContainer.parentElement).toBe(root.children[1]);
});
it("resolves a text selection across inline formatting without altering its quote", () => {
  const root = document.createElement("article");
  root.innerHTML = "<p>Some <em>formatted</em> words.</p>";
  expect(rangeFromOffsets(root, 5, 14)!.toString()).toBe("formatted");
});
