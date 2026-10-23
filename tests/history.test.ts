import { it, expect, vi } from "vitest";
import { GET } from "../app/api/admin/chapters/route";
const records = Array.from({ length: 61 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  chapter_id: "chapter-1",
  locale: "en",
  title: "A saved chapter",
  html: "<p>Saved content.</p>".repeat(1000),
  kind: "text",
  pdf_path: null,
  revision: i + 1,
  created_at: "2026-10-22T00:00:00Z",
}));
// Supabase is external; this adapter supplies its row/projection boundary, not authentication.
function table() {
  let rows = [...records],
    fields = "*";
  const q = {
    select: (value: string) => {
      fields = value;
      return q;
    },
    eq: (field: string, value: unknown) => {
      rows = rows.filter((r) => r[field as keyof typeof r] === value);
      return q;
    },
    lt: (field: string, value: number) => {
      rows = rows.filter((r) => Number(r[field as keyof typeof r]) < value);
      return q;
    },
    order: () => {
      rows.sort((a, b) => b.revision - a.revision);
      return q;
    },
    limit: async (n: number) => ({
      data: rows.slice(0, n).map(project),
      error: null,
    }),
    single: async () => ({
      data: rows[0] ? project(rows[0]) : null,
      error: null,
    }),
  };
  function project(row: (typeof records)[number]) {
    return fields === "*"
      ? row
      : Object.fromEntries(
          fields.split(",").map((k) => [k, row[k as keyof typeof row]]),
        );
  }
  return q;
}
vi.mock("../src/lib/server", () => ({
  requireEditor: async () => ({ client: { from: () => table() } }),
  apiError: (e: Error) => Response.json({ error: e.message }, { status: 400 }),
  HttpError: class extends Error {},
  jsonBody: (r: Request) => r.json(),
}));
it("returns a bounded history page without embedding every saved chapter body", async () => {
  const response = await GET(
    new Request("http://localhost/api/admin/chapters?id=chapter-1&locale=en"),
  );
  const body = await response.json();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items).toHaveLength(50);
  expect(body.items[0].revision).toBe(61);
  expect(body.items[0].html).toBeUndefined();
  expect(body.next).toBe(12);
  expect(JSON.stringify(body).length).toBeLessThan(30000);
});
it("loads older history using a revision cursor and fetches a body only on demand", async () => {
  const page = await GET(
    new Request(
      "http://localhost/api/admin/chapters?id=chapter-1&locale=en&before=12",
    ),
  );
  const older = await page.json();
  expect(older.items?.[0]?.revision).toBe(11);
  expect(older.items).toHaveLength(11);
  expect(older.next).toBeNull();
  const version = await GET(
    new Request(
      `http://localhost/api/admin/chapters?id=chapter-1&locale=en&version=${records[0].id}`,
    ),
  );
  expect((await version.json()).html).toBe(records[0].html);
});
