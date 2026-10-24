export type SearchChapter = {
  chapterId: string;
  title: string;
  revision: number;
  text: string;
};
export type SearchMatch = Omit<SearchChapter, "text"> & {
  start: number;
  end: number;
  snippet: string;
};
function fold(text: string) {
  let value = "",
    offset = 0;
  const positions: number[] = [];
  for (const character of text) {
    const normalized = character
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
    value += normalized;
    for (let i = 0; i < normalized.length; i++) positions.push(offset);
    offset += character.length;
  }
  return { value, positions };
}
export function prepareBookText(chapters: SearchChapter[]) {
  return chapters.map((chapter) => ({ ...chapter, ...fold(chapter.text) }));
}
export function findBookText(
  chapters: ReturnType<typeof prepareBookText>,
  query: string,
) {
  const needle = fold(query.trim()).value,
    matches: SearchMatch[] = [];
  if (!needle) return { matches, truncated: false };
  for (const chapter of chapters) {
    const { value, positions } = chapter;
    let from = 0,
      at: number;
    while ((at = value.indexOf(needle, from)) !== -1) {
      if (matches.length === 100) return { matches, truncated: true };
      const start = positions[at],
        end = positions[at + needle.length] ?? chapter.text.length;
      matches.push({
        chapterId: chapter.chapterId,
        title: chapter.title,
        revision: chapter.revision,
        start,
        end,
        snippet:
          (start > 60 ? "…" : "") +
          chapter.text.slice(
            Math.max(0, start - 60),
            Math.min(chapter.text.length, end + 90),
          ) +
          (end + 90 < chapter.text.length ? "…" : ""),
      });
      from = at + needle.length;
    }
  }
  return { matches, truncated: false };
}
