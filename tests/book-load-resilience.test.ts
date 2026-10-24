import { beforeEach, expect, it, vi } from "vitest";
import { getBook } from "../src/lib/server";
import * as sanitizer from "../src/lib/sanitize";
vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
const book = () => ({
  id: "truyen-ky-man-luc",
  chapters: [
    {
      id: "chapter-1",
      order: 1,
      vi: {
        title: "Việt",
        revision: 1,
        kind: "text",
        html: "<p>Việt<script>bad()</script></p>",
      },
      en: {
        title: "English",
        revision: 2,
        kind: "text",
        html: "<p>English<script>bad()</script></p>",
      },
    },
  ],
});
const good = () => ({ data: book(), error: null, status: 200 });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server");
  rpc.mockReset().mockImplementation(async () => good());
  vi.restoreAllMocks();
});
it("retries a transient public read once before returning the published book", async () => {
  for (const status of [0, 429, 503]) {
    rpc
      .mockReset()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Temporary" },
        status,
      })
      .mockResolvedValueOnce(good());
    expect((await getBook()).chapters).toHaveLength(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  }
});
it("stops after two failed reads and never falls back to bundled chapters", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: "Temporary" },
    status: 503,
  });
  await expect(getBook()).rejects.toThrow("Cannot load");
  expect(rpc).toHaveBeenCalledTimes(2);
});
it("does not retry permission or schema failures", async () => {
  for (const status of [400, 401, 403, 404]) {
    rpc
      .mockReset()
      .mockResolvedValue({ data: null, error: { message: "Denied" }, status });
    await expect(getBook()).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  }
});
it("prepares only the requested locale while retaining both editions' metadata", async () => {
  const clean = vi.spyOn(sanitizer, "cleanHtml");
  const result = await getBook(true, "vi");
  expect(result.chapters[0].vi?.html).toBe("<p>Việt</p>");
  expect(result.chapters[0].en).toMatchObject({
    title: "English",
    revision: 2,
    html: "",
  });
  expect(clean).toHaveBeenCalledTimes(1);
  clean.mockClear();
  const en = await getBook(true, "en");
  expect(en.chapters[0].en?.html).toBe("<p>English</p>");
  expect(en.chapters[0].vi?.html).toBe("");
  expect(clean).toHaveBeenCalledTimes(1);
});
it("keeps both sanitized editions for existing full-book callers and the offline source intact", async () => {
  const both = await getBook();
  expect(both.chapters[0].vi?.html).not.toContain("script");
  expect(both.chapters[0].en?.html).toBe("<p>English</p>");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  const edition = await getBook(true, "vi");
  expect(edition.chapters.find((c) => c.en)?.en?.html).toBe("");
  const full = await getBook();
  expect(full.chapters.find((c) => c.en)?.en?.html.length).toBeGreaterThan(0);
});
