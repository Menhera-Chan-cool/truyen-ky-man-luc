import { beforeEach, it, expect, vi } from "vitest";
import { getBook } from "../src/lib/server";
vi.mock("server-only", () => ({}));
let databaseError = false;
let calledRpc = "";
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async (name: string) => (
      (calledRpc = name),
      {
        data: databaseError
          ? null
          : {
              id: "truyen-ky-man-luc",
              author: "Nguyễn Dữ",
              revision: 4,
              meta: {
                vi: { title: "Published", summary: "", frontCover: "" },
                en: { title: "Published", summary: "", frontCover: "" },
              },
              chapters: [],
            },
        error: databaseError ? { message: "Unavailable" } : null,
      }
    ),
  }),
}));
beforeEach(() => {
  databaseError = false;
  calledRpc = "";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});
it("uses the metadata-only RPC for book details", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  await getBook(false);
  expect(calledRpc).toBe("get_public_book_index");
});
it("serves the bundled edition only when no database is configured", async () => {
  expect((await getBook()).chapters).toHaveLength(21);
});
it("keeps published database state when the server admin key is absent", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  expect((await getBook()).chapters).toHaveLength(0);
});
it("does not resurrect bundled chapters on incomplete or unavailable database configuration", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  await expect(getBook().then((b) => b.chapters.length)).rejects.toThrow();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-key");
  databaseError = true;
  await expect(getBook().then((b) => b.chapters.length)).rejects.toThrow();
});
