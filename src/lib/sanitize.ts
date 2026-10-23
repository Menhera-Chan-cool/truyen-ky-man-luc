import DOMPurify from "isomorphic-dompurify";
import { parse } from "node-html-parser";
export function cleanHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
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
  return root.toString();
}
