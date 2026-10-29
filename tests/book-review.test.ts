import { it, expect, vi } from "vitest";
const rpc = vi.fn(async () => ({ data: 2, error: null }));
vi.mock("../src/lib/server", () => ({
  requireEditor: async () => ({
    client: {
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      storage: {
        from: () => ({ exists: async () => ({ data: false, error: null }) }),
      },
    },
  }),
  jsonBody: (r: Request) => r.json(),
  HttpError: class extends Error {},
  apiError: (e: Error) => Response.json({ error: e.message }, { status: 400 }),
}));
import { POST } from "../app/api/admin/book/route";
it("refuses publishing an unregistered cover before changing book metadata", async () => {
  const meta = {
    title: "Book",
    summary: "",
    frontCover: "/api/assets/missing.png",
  };
  const r = await POST(
    new Request("http://localhost/api/admin/book", {
      method: "POST",
      body: JSON.stringify({
        meta: { vi: meta, en: meta },
        publish: true,
        expectedRevision: 1,
      }),
    }),
  );
  expect(r.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
