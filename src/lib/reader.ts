import { defaultSettings, type ReaderSettings } from "./types";
export const readerFonts = [
  {
    value: "Literata",
    label: "Literata (Serif)",
    family: '"Literata Variable", Georgia, serif',
  },
  {
    value: "Lora",
    label: "Lora (Serif)",
    family: '"Lora Variable", Georgia, serif',
  },
  {
    value: "Merriweather",
    label: "Merriweather (Serif)",
    family: '"Merriweather Variable", Georgia, serif',
  },
  { value: "Georgia", label: "Georgia (Serif)", family: "Georgia, serif" },
  {
    value: "Be Vietnam Pro",
    label: "Be Vietnam Pro (Sans)",
    family: '"Be Vietnam Pro", sans-serif',
  },
  {
    value: "Inter",
    label: "Inter (Sans)",
    family: '"Inter Variable", "Be Vietnam Pro", sans-serif',
  },
  {
    value: "Roboto",
    label: "Roboto (Sans)",
    family: '"Roboto Variable", "Be Vietnam Pro", sans-serif',
  },
  {
    value: "OpenDyslexic",
    label: "OpenDyslexic",
    family: 'OpenDyslexic, "Be Vietnam Pro", sans-serif',
  },
  {
    value: "JetBrains Mono",
    label: "JetBrains Mono (Monospace)",
    family: '"JetBrains Mono Variable", monospace',
  },
];
export function contrastText(hex: string) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
export function readerPalette(settings: ReaderSettings) {
  return settings.theme === "custom"
    ? {
        background: settings.background,
        foreground: settings.foreground,
        accent: settings.accent,
      }
    : (themes[settings.theme] ?? themes.sepia);
}
export function settingsFromCookie(raw?: string): ReaderSettings {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw ?? ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { ...defaultSettings };
    const values = Object.fromEntries(
      Object.entries(defaultSettings)
        .filter(([key, value]) => typeof parsed[key] === typeof value)
        .map(([key]) => [key, parsed[key]]),
    );
    return normalizeSettings(values);
  } catch {
    return { ...defaultSettings };
  }
}
export function speechSegments(text: string, shortPauses = true): string[] {
  const result: string[] = [];
  for (let sentence of text.split(
    shortPauses ? /\n+/u : /(?<=[.!?…])\s+|\n+/u,
  )) {
    sentence = sentence.trim();
    while (sentence.length > 240) {
      const at = sentence.lastIndexOf(" ", 240);
      const cut = at > 0 ? at : 240;
      result.push(sentence.slice(0, cut));
      sentence = sentence.slice(cut).trim();
    }
    if (sentence) result.push(sentence);
  }
  return result;
}
export function speechText(text: string, shortPauses: boolean) {
  if (!shortPauses) return text;
  return text.replace(/[.:;…—–]+/gu, (mark, at: number) => {
    const before = text[at - 1] ?? "",
      after = text[at + mark.length] ?? "";
    if (mark.length === 1 && /\d/.test(before) && /\d/.test(after)) return mark;
    if (
      mark === "." &&
      ((after && !/[\s"'”’)}\]]/u.test(after)) ||
        /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|TS|ThS|PGS)$/iu.test(
          text.slice(0, at),
        ) ||
        /(?:\b[A-Z]\.)+[A-Z]$/u.test(text.slice(0, at)))
    )
      return mark;
    if (mark === ":" && text.slice(at + 1, at + 3) === "//") return mark;
    // Keep UTF-16 offsets identical so native speech boundaries still match the book.
    return "," + " ".repeat(mark.length - 1);
  });
}
export function normalizeSettings(
  settings: Partial<ReaderSettings>,
): ReaderSettings {
  const value = { ...defaultSettings, ...settings };
  if (!["ebook", "book"].includes(value.layout)) value.layout = "ebook";
  const clamp = (n: number, min: number, max: number, fallback: number) =>
    Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  value.fontSize = clamp(value.fontSize, 14, 36, 20);
  value.lineHeight = clamp(value.lineHeight, 1.2, 2.6, 1.9);
  value.width = clamp(value.width, 480, 1200, 780);
  value.rate = clamp(value.rate, 0.5, 2, 1);
  value.shortPauses =
    typeof value.shortPauses === "boolean" ? value.shortPauses : true;
  value.autoNext = typeof value.autoNext === "boolean" ? value.autoNext : false;
  value.scrollSpeed = clamp(value.scrollSpeed, 8, 100, 28);
  if (!["scroll", "single", "double"].includes(value.mode))
    value.mode = "scroll";
  if (
    !readerFonts.some((font) => font.value === value.font) &&
    !/^font:[0-9a-f-]{36}$/.test(value.font)
  )
    value.font = "Literata";
  if (!["original", "left", "center", "right", "justify"].includes(value.align))
    value.align = "original";
  if (!Object.hasOwn(themes, value.theme) && value.theme !== "custom")
    value.theme = "sepia";
  for (const key of ["background", "foreground", "accent"] as const)
    if (!/^#[0-9a-f]{6}$/i.test(value[key])) value[key] = defaultSettings[key];
  return value;
}
export function countPages(
  width: number,
  viewport: number,
  gap: number,
): number {
  return viewport > 0
    ? Math.max(1, Math.ceil((width + gap - 1) / (viewport + gap)))
    : 1;
}
export const themes: Record<
  string,
  { background: string; foreground: string; accent: string }
> = {
  light: { background: "#fffdf8", foreground: "#28251f", accent: "#8d342b" },
  sepia: { background: "#f5f0e5", foreground: "#302b23", accent: "#8d342b" },
  warm: { background: "#f6e6ca", foreground: "#382c20", accent: "#803d23" },
  coffee: { background: "#362e27", foreground: "#f0dcc0", accent: "#e7b87c" },
  dark: { background: "#171923", foreground: "#ede7d9", accent: "#d5ac79" },
  dim: { background: "#282a30", foreground: "#d9d5cc", accent: "#deba8e" },
  eink: { background: "#ffffff", foreground: "#000000", accent: "#000000" },
};
export const annotationColors = [
  "#f3dd83",
  "#b6d8bd",
  "#adcce9",
  "#d6b6da",
  "#e6bd9e",
  "#c4b9e2",
  "#e4aeb2",
  "#a3d6d2",
];
export function rangeFromOffsets(
  root: Node,
  start: number,
  end: number,
): Range | null {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null,
    offset = 0;
  const range = document.createRange();
  let started = false;
  while ((node = walk.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (!started && start >= offset && start < offset + length) {
      range.setStart(node, start - offset);
      started = true;
    }
    if (started && end <= offset + length) {
      range.setEnd(node, end - offset);
      return range;
    }
    offset += length;
  }
  return null;
}
export function visibleTextOffset(
  root: HTMLElement,
  viewport: DOMRect,
  paged: boolean,
): number | undefined {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null,
    offset = 0;
  while ((node = walk.nextNode())) {
    const text = node.textContent ?? "",
      length = text.length;
    if (text.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const intersects = [...range.getClientRects()].some(
        (r) =>
          r.right > viewport.left + 1 &&
          r.left < viewport.right - 1 &&
          r.bottom > viewport.top + 1 &&
          r.top < viewport.bottom,
      );
      if (intersects) {
        let low = 0,
          high = length - 1;
        while (low < high) {
          const mid = Math.floor((low + high) / 2);
          range.setStart(node, mid);
          range.setEnd(node, mid + 1);
          const r = range.getBoundingClientRect();
          const before = paged
            ? r.right <= viewport.left + 1 ||
              (r.left < viewport.right && r.bottom <= viewport.top + 1)
            : r.bottom <= viewport.top + 1;
          if (before) low = mid + 1;
          else high = mid;
        }
        return offset + low;
      }
    }
    offset += length;
  }
}
export function selectionAnchor(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null;
  const prefix = range.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  return {
    start: prefix.toString().length,
    end: prefix.toString().length + range.toString().length,
    text: range.toString(),
    rect: range.getBoundingClientRect(),
  };
}
