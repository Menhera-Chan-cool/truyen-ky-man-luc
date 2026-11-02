import DOMPurify from "isomorphic-dompurify";
import { parse, HTMLElement, type Node } from "node-html-parser";
const sectionLabel = /^(critique|notes|lời\s+(bình|bàn)|chú\s+(thích|giải))\s*[:：]?$/iu;
function splitFirstLine(nodes: Node[]): {before: string; after: string} {
  let before = "", after = "", found = false;
  for (const node of nodes) {
    if (found) { after += node.toString(); continue; }
    if (node instanceof HTMLElement && node.rawTagName === "br") {
      found = true;
      continue;
    }
    if (node instanceof HTMLElement && node.querySelector("br")) {
      const parts = splitFirstLine(node.childNodes),
        left = node.clone() as HTMLElement, right = node.clone() as HTMLElement;
      left.set_content(parts.before);
      right.set_content(parts.after);
      right.removeAttribute("id");
      before += left.outerHTML;
      after += right.outerHTML;
      found = true;
    } else before += node.toString();
  }
  return {before, after};
}
export function cleanHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "small",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "figure",
      "figcaption",
      "hr",
      "span",
      "div",
      "section",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "mark",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "id",
      "class",
      "style",
      "width",
      "height",
      "colspan",
      "rowspan",
      "start",
      "data-type",
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const root = parse(clean);
  for (const el of root.querySelectorAll("[style]")) {
    const styles = (el.getAttribute("style") ?? "")
      .split(";")
      .filter((s) =>
        /^\s*(text-align|font-weight|font-style|text-decoration|vertical-align|white-space)\s*:\s*[a-z0-9\s-]+$/i.test(
          s,
        ),
      );
    if (styles.length) el.setAttribute("style", styles.join(";"));
    else el.removeAttribute("style");
  }
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (!/^\/(?!\/)|^data:image\/(png|jpeg|webp|gif);base64,/i.test(src))
      img.removeAttribute("src");
    img.setAttribute("loading", "lazy");
  }
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    if (!/^(#|\/(?!\/)|https?:\/\/|[a-z0-9._-]+(?:[/?#]|$))/i.test(href))
      a.removeAttribute("href");
    if (/^https?:/i.test(href)) {
      a.setAttribute("rel", "noopener noreferrer");
      a.setAttribute("target", "_blank");
    }
  }
  // Word imports can store a section label and its prose in the same paragraph.
  for (const p of root.querySelectorAll("p")) {
    if (p.closest("li,blockquote,td,th") || p.querySelector("img,table")) continue;
    if (sectionLabel.test(p.textContent.trim())) { p.tagName = "h3"; continue; }
    if (!p.querySelector("br")) continue;
    const parts = splitFirstLine(p.childNodes);
    if (!sectionLabel.test(parse(parts.before).textContent.trim())) continue;
    const body = p.clone() as HTMLElement;
    body.removeAttribute("id");
    body.set_content(parts.after);
    p.tagName = "h3";
    p.set_content(parts.before);
    if (parts.after) p.insertAdjacentHTML("afterend", body.outerHTML);
  }
  return root.toString();
}
