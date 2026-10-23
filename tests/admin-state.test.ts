import { expect, it, vi } from "vitest";
import { GET } from "../app/api/admin/state/route";
const rows: Record<string, Record<string, unknown>[]> = {
  book: [
    {
      id: "truyen-ky-man-luc",
      draft: { vi: {}, en: {} },
      published: { vi: {}, en: {} },
      revision: 1,
    },
  ],
  chapters: [{ id: "chapter-1", sort_order: 1, archived: false }],
  chapter_editions: [
    {
      chapter_id: "chapter-1",
      locale: "vi",
      draft_id: "version-2",
      published_id: "version-1",
      revision: 2,
    },
  ],
  chapter_versions: [
    {
      id: "version-1",
      chapter_id: "chapter-1",
      locale: "vi",
      title: "Old",
      html: "Old body".repeat(10000),
    },
    {
      id: "version-2",
      chapter_id: "chapter-1",
      locale: "vi",
      title: "Draft",
      html: "Draft body".repeat(10000),
      revision: 2,
      kind: "text",
      pdf_path: null,
      created_at: "2026-10-23",
    },
  ],
};
function table(name: string) {
  let selected = [...rows[name]],
    fields = "*";
  const result = () => ({
    data: selected.map((row) =>
      fields === "*"
        ? row
        : Object.fromEntries(fields.split(",").map((k) => [k, row[k]])),
    ),
    error: null,
  });
  const q = {
    select(value: string) {
      fields = value;
      return q;
    },
    eq(key: string, value: unknown) {
      selected = selected.filter((r) => r[key] === value);
      return q;
    },
    in(key: string, values: unknown[]) {
      selected = selected.filter((r) => values.includes(r[key]));
      return q;
    },
    order() {
      return q;
    },
    single: async () => ({ ...result(), data: result().data[0] }),
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(result()).then(resolve);
    },
  };
  return q;
}
vi.mock("../src/lib/server", () => ({
  requireEditor: async () => ({
    client: { from: table },
    member: { role: "editor" },
  }),
  apiError: (e: Error) => Response.json({ error: e.message }, { status: 400 }),
}));
it("returns only current version summaries; HTML is fetched through the guarded version endpoint", async () => {
  const response = await GET(new Request("http://localhost/api/admin/state"));
  expect(response.status).toBe(200);
  const state = await response.json();
  expect(state.versions).toHaveLength(1);
  expect(state.versions[0].title).toBe("Draft");
  expect(state.versions[0]).not.toHaveProperty("html");
  expect(JSON.stringify(state).length).toBeLessThan(2000);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
