import type { Locale } from "./types";
import { rangeFromOffsets } from "./reader";

export function decorateFootnotes(
  root: HTMLElement,
  locale: Locale,
  chapterId: string,
) {
  const blocks = [
    ...root.querySelectorAll<HTMLElement>("p,li,h1,h2,h3,h4,hr"),
  ].filter((el) => !el.parentElement?.closest("p,li"));
  const heading = (el: HTMLElement) =>
    /^(?:chú thích|chú giải|ghi chú|notes|footnotes|endnotes|annotations)\s*(?:[:\n]|\(\*\)|$)/iu.test(
      (el.textContent ?? "").trim(),
    );
  const divider = (el: HTMLElement) =>
    el.tagName === "HR" || /^[-_—]{3,}$/.test((el.textContent ?? "").trim());
  const section = blocks.findIndex((el) => heading(el) || divider(el));
  const definitions: { number: string; block: HTMLElement; index: number }[] =
    [];
  if (section >= 0)
    blocks.forEach((block, index) => {
      const match = (block.textContent ?? "").match(
        /^\s*(?:\((\d{1,3})\)|(\d{1,3})\))\s+\S/u,
      );
      if (
        match &&
        (index > section || (index === section - 1 && match[1] === "1"))
      )
        definitions.push({ number: match[1] ?? match[2], block, index });
    });
  // Known source labels are missing here; note 7 of chapter 3 spans two paragraphs.
  if (section >= 0 && locale === "vi") {
    const labels =
      chapterId === "chapter-3" && !definitions.length
        ? [
            /^Chợ Nam Xang:/iu,
            /^Măng ngọc:/iu,
            /^(?:é|én) ngọc:/iu,
            /^Lưng thắt ve vàng:/iu,
            /^Đường:/iu,
            /^Dị An:/iu,
            /^Ban Cơ:/iu,
            /^Hàn Dũ(?:\s|:)/iu,
            /^Hồng Phất:/iu,
          ]
        : chapterId === "chapter-14" && definitions.at(-1)?.number === "30"
          ? [
              /^Cổ lâu:/iu,
              /^Nguyễn Bằng Cử:/iu,
              /^Hoàng Hối Khanh:/iu,
              /^Lê Cảnh Kỳ:/iu,
              /^Lưu Thúc Kiệm:/iu,
              /^Lấy ý trong câu nói của Vi Trung/iu,
              /^Thiên Dân chinh/iu,
              /^Cửa bể Kỳ La/iu,
              /^Nguyên, Bạch:/iu,
              /^Lưu là quan Thái sử/iu,
              /^Lấy ý một câu trong Hệ từ/iu,
              /^Bói cỏ bói rùa:/iu,
              /^Xử sĩ:/iu,
            ]
          : [];
    const found = labels.map((label) =>
      blocks
        .map((block, index) => ({ block, index }))
        .filter(
          ({ block, index }) =>
            index > section && label.test((block.textContent ?? "").trim()),
        ),
    );
    if (found.every((matches) => matches.length === 1))
      found.forEach(([item], index) =>
        definitions.push({
          ...item,
          number: String(index + (chapterId === "chapter-3" ? 1 : 31)),
        }),
      );
  }
  const notes = new Map<string, { target: HTMLElement; text: string }>();
  definitions.forEach((definition, index) => {
    if (
      definitions.filter((item) => item.number === definition.number).length !==
      1
    )
      return;
    const { block, number } = definition;
    if (!/^\s*(?:\(\d+\)|\d+\))/.test(block.textContent ?? "")) {
      block.classList.add("footnote-legacy");
      block.dataset.footnoteNumber = number;
    }
    if (!block.id) {
      let id = `reader-footnote-${number}`,
        suffix = 1;
      while (root.querySelector(`#${id}`))
        id = `reader-footnote-${number}-${suffix++}`;
      block.id = id;
    }
    const text = blocks
      .slice(definition.index, definitions[index + 1]?.index)
      .filter((el) => !heading(el) && !divider(el))
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
    notes.set(number, { target: block, text });
  });
  const decorate = (
    link: HTMLAnchorElement,
    number: string,
    target: HTMLElement,
    text: string,
  ) => {
    link.classList.add("footnote-ref");
    link.dataset.footnote = "true";
    link.dataset.tooltip = text;
    link.setAttribute(
      "aria-label",
      `${locale === "vi" ? "Chú thích" : "Footnote"} ${number}`,
    );
    link.href = `#${encodeURIComponent(target.id)}`;
    if (
      /^\(\d+\)$/.test(link.textContent ?? "") &&
      !link.querySelector(".footnote-paren")
    ) {
      // Keep parentheses in DOM text so existing annotation offsets remain valid.
      const open = document.createElement("span"),
        close = document.createElement("span");
      for (const span of [open, close]) {
        span.className = "footnote-paren";
        span.setAttribute("aria-hidden", "true");
      }
      open.textContent = "(";
      close.textContent = ")";
      link.replaceChildren(open, document.createTextNode(number), close);
    }
  };
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const number = link.textContent
      ?.trim()
      .match(/^[\[(]?(\d{1,3})[\])]?$/)?.[1];
    let target: HTMLElement | undefined;
    try {
      const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
      target = [...root.querySelectorAll<HTMLElement>("[id]")].find(
        (el) => el.id === id,
      );
    } catch {
      continue;
    }
    if (
      number &&
      target &&
      (link.closest("sup") || notes.get(number)?.target === target)
    )
      decorate(
        link,
        number,
        target,
        notes.get(number)?.text ?? target.textContent ?? "",
      );
  }
  if (!definitions.length) return;
  const boundary = document.createRange();
  boundary.selectNodeContents(root);
  boundary.setEndBefore(definitions[0].block);
  const body = boundary.toString();
  for (const match of [...body.matchAll(/\((\d{1,3})\)/g)].reverse()) {
    const note = notes.get(match[1]);
    if (!note) continue;
    const range = rangeFromOffsets(
      root,
      match.index,
      match.index + match[0].length,
    );
    if (!range || range.startContainer.parentElement?.closest("a,code,pre"))
      continue;
    const link = document.createElement("a");
    link.textContent = match[0];
    decorate(link, match[1], note.target, note.text);
    range.deleteContents();
    range.insertNode(link);
  }
}
export function footnoteSpeechText(root: HTMLElement) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null,
    text = "";
  while ((node = walk.nextNode())) {
    const value = node.textContent ?? "";
    text += node.parentElement?.closest(".footnote-ref")
      ? " ".repeat(value.length)
      : value;
  }
  return text;
}
