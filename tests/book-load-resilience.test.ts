import { beforeEach, expect, it, vi } from "vitest";
import { getBook, resetBookCache } from "../src/lib/server";
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
  resetBookCache();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server");
  rpc.mockReset().mockImplementation(async () => good());
  vi.restoreAllMocks();
});
it("retries a transient public read once before returning the published book", async () => {
  for (const status of [0, 429, 503]) {
    resetBookCache();
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
it("sanitizes each edition once per shared load and hands each reader only the requested locale", async () => {
  const clean = vi.spyOn(sanitizer, "cleanHtml");
  const result = await getBook(true, "vi");
  expect(result.chapters[0].vi?.html).toBe("<p>Việt</p>");
  expect(result.chapters[0].en).toMatchObject({
    title: "English",
    revision: 2,
    html: "",
  });
  expect(clean).toHaveBeenCalledTimes(2);
  clean.mockClear();
  const en = await getBook(true, "en");
  expect(en.chapters[0].en?.html).toBe("<p>English</p>");
  expect(en.chapters[0].vi?.html).toBe("");
  expect(clean).not.toHaveBeenCalled();
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

it("shares one published book per instance between readers and drops a failed load at once", async () => {
  rpc.mockReset().mockResolvedValue(good());
  await getBook(true, "vi"); await getBook(true, "en"); await getBook(true);
  expect(rpc.mock.calls.filter((c) => c[0] === "get_public_book")).toHaveLength(1);
  const vi = await getBook(true, "vi"), en = await getBook(true, "en");
  expect(vi.chapters[0].en!.html).toBe(""); expect(en.chapters[0].vi!.html).toBe(""); expect(en.chapters[0].en!.html).not.toContain("script");
  resetBookCache(); rpc.mockReset().mockResolvedValueOnce({ data: null, error: { message: "down" }, status: 500 }).mockResolvedValueOnce({ data: null, error: { message: "down" }, status: 500 }).mockResolvedValue(good());
  await expect(getBook(true)).rejects.toThrow("Cannot load");
  await expect(getBook(true)).resolves.toBeTruthy();
});
