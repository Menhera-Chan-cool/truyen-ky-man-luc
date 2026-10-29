import { parse, NodeType, type Node, type HTMLElement } from "node-html-parser";
export type ReviewEdition = {
  id: string;
  locale: string;
  title: string;
  html: string;
  kind: string;
  pdfPath?: string | null;
};
export type ReviewIssue = {
  id: string;
  locale: string;
  code: string;
  severity: "error" | "warning";
  detail: string;
};
export type DiffPart = {
  kind: "same" | "added" | "removed" | "format";
  text: string;
};
const pattern = (find: string, sensitive: boolean) => {
  if (!find || find.length > 300)
    throw Error("Find text must contain 1–300 characters");
  return new RegExp(
    find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    sensitive ? "gu" : "giu",
  );
};
export function replaceLiteral(
  text: string,
  find: string,
  replacement: string,
  sensitive = false,
) {
  if (replacement.length > 2000)
    throw Error("Replacement exceeds 2000 characters");
  let count = 0;
  const value = text.replace(pattern(find, sensitive), () => {
    count++;
    return replacement;
  });
  return { text: value, count };
}
export function replaceHtmlText(
  html: string,
  find: string,
  replacement: string,
  sensitive = false,
) {
  const regex = pattern(find, sensitive);
  if (replacement.length > 2000)
    throw Error("Replacement exceeds 2000 characters");
  const root = parse(html),
    groups: Node[][] = [];
  let pending: Node[] = [];
  const flush = () => {
    if (pending.length) groups.push(pending);
    pending = [];
  };
  const walk = (node: Node) => {
    if (node.nodeType === NodeType.TEXT_NODE) {
      pending.push(node);
      return;
    }
    if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test((node as HTMLElement).tagName ?? ""))
      return;
    const block =
      /^(P|DIV|SECTION|H[1-6]|LI|UL|OL|BLOCKQUOTE|TR|TD|TH|BR|HR|FIGURE|FIGCAPTION)$/.test(
        (node as HTMLElement).tagName ?? "",
      );
    if (block) flush();
    for (const child of node.childNodes) walk(child);
    if (block) flush();
  };
  walk(root);
  flush();
  let count = 0;
  for (const nodes of groups) {
    const values = nodes.map((n) => n.textContent),
      offsets: number[] = [];
    let total = 0;
    for (const value of values) {
      offsets.push(total);
      total += value.length;
    }
    const matches = [...values.join("").matchAll(regex)];
    count += matches.length;
    for (const m of matches.reverse())
      for (let i = nodes.length - 1; i >= 0; i--) {
        const a = Math.max(0, m.index! - offsets[i]),
          b = Math.min(values[i].length, m.index! + m[0].length - offsets[i]);
        if (a < b) {
          const current = nodes[i].textContent;
          nodes[i].textContent =
            current.slice(0, a) +
            (m.index! >= offsets[i] && m.index! < offsets[i] + values[i].length
              ? replacement
              : "") +
            current.slice(b);
        }
      }
  }
  return { html: root.toString(), count };
}
function blocks(html: string) {
  const root = parse(html),
    items = root
      .querySelectorAll("p,h1,h2,h3,h4,li,figcaption,tr,img")
      .filter((el) => !el.parentNode?.closest("p,li,tr,figcaption"));
  const result = items.map((el) => ({
    text:
      el.tagName === "IMG"
        ? "[Image: " + (el.getAttribute("src") ?? "") + "]"
        : el.textContent +
          el
            .querySelectorAll("img")
            .map((i) => " [Image: " + (i.getAttribute("src") ?? "") + "]")
            .join(""),
    html: el.toString(),
  }));
  return result.length
    ? result
    : root.textContent.trim()
      ? [{ text: root.textContent, html: root.toString() }]
      : [];
}
export function diffBlocks(before: string, after: string): DiffPart[] {
  const a = blocks(before),
    b = blocks(after),
    out: DiffPart[] = [];
  if (a.length * b.length > 2_000_000) {
    let start = 0,
      end = 0;
    while (
      start < a.length &&
      start < b.length &&
      a[start].html === b[start].html
    ) {
      out.push({ kind: "same", text: a[start++].text });
    }
    while (
      end < a.length - start &&
      end < b.length - start &&
      a[a.length - 1 - end].html === b[b.length - 1 - end].html
    )
      end++;
    return [
      ...out,
      ...a
        .slice(start, a.length - end)
        .map((x) => ({ kind: "removed" as const, text: x.text })),
      ...b
        .slice(start, b.length - end)
        .map((x) => ({ kind: "added" as const, text: x.text })),
      ...b
        .slice(b.length - end)
        .map((x) => ({ kind: "same" as const, text: x.text })),
    ];
  }
  const width = b.length + 1,
    table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] =
        a[i].text === b[j].text
          ? 1 + table[(i + 1) * width + j + 1]
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].text === b[j].text) {
      out.push({
        kind: a[i].html === b[j].html ? "same" : "format",
        text: b[j].text,
      });
      i++;
      j++;
    } else if (
      i < a.length &&
      (j >= b.length || table[(i + 1) * width + j] >= table[i * width + j + 1])
    )
      out.push({ kind: "removed", text: a[i++].text });
    else out.push({ kind: "added", text: b[j++].text });
  }
  return out;
}
export function inspectEditions(editions: ReviewEdition[]): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const edition of editions) {
    const root = parse(edition.html),
      add = (
        code: string,
        detail: string,
        severity: "error" | "warning" = "error",
      ) =>
        out.push({
          id: edition.id,
          locale: edition.locale,
          code,
          severity,
          detail,
        });
    if (
      !edition.title.trim() ||
      (edition.kind === "pdf"
        ? !edition.pdfPath
        : !root.textContent.trim() && !root.querySelector("img"))
    )
      add("empty-chapter", "Chương trống / Empty chapter");
    const title = edition.title
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (
      title &&
      editions.some(
        (e) =>
          e.id !== edition.id &&
          e.locale === edition.locale &&
          e.title.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase() ===
            title,
      )
    )
      add("duplicate-title", edition.title, "warning");
    const ids = new Set(root.querySelectorAll("[id]").map((el) => el.id));
    for (const link of root.querySelectorAll('a[href^="#"]')) {
      const href = link.getAttribute("href")!;
      let id = "";
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        /* Report invalid fragment below. */
      }
      if ((id && !ids.has(id)) || !id) add("missing-target", href);
    }
    for (const img of root.querySelectorAll("img"))
      if (!img.getAttribute("src"))
        add(
          "missing-image",
          img.getAttribute("alt") ?? "Ảnh thiếu đường dẫn / Missing image URL",
        );
    const paras = root
      .querySelectorAll("p,li,h1,h2,h3,h4,hr")
      .filter((el) => !el.parentNode?.closest("p,li"));
    const section = paras.findIndex(
      (el) =>
        /^(?:chú thích|chú giải|ghi chú|notes|footnotes|endnotes|annotations)\s*(?:[:\n]|\(\*\)|$)/iu.test(
          el.textContent.trim(),
        ) ||
        el.tagName === "HR" ||
        /^[-_—]{3,}$/.test(el.textContent.trim()),
    );
    const defs = new Set<string>();
    if (section >= 0)
      for (const p of paras.slice(section + 1)) {
        const m = p.textContent.match(
          /^\s*(?:\((\d{1,3})\)|(\d{1,3})\))\s+\S/u,
        );
        if (m) defs.add(m[1] ?? m[2]);
      }
    const legacy =
      edition.locale === "vi" &&
      ((edition.id === "chapter-3" &&
        !defs.size &&
        root.textContent.includes("Chợ Nam Xang:") &&
        root.textContent.includes("Hồng Phất:")) ||
        (edition.id === "chapter-14" &&
          defs.has("30") &&
          root.textContent.includes("Cổ lâu:") &&
          root.textContent.includes("Xử sĩ:")));
    if (legacy)
      for (
        let n = edition.id === "chapter-3" ? 1 : 31;
        n <= (edition.id === "chapter-3" ? 9 : 43);
        n++
      )
        defs.add(String(n));
    const body = (section >= 0 ? paras.slice(0, section) : paras)
      .map((p) => p.textContent)
      .join("\n");
    for (const n of new Set(
      [...body.matchAll(/\((\d{1,3})\)/g)].map((m) => m[1]),
    ))
      if (!defs.has(n)) add("missing-note", "(" + n + ")", "warning");
  }
  return out;
}
