import { beforeEach, expect, it, vi } from "vitest";
import { requireEditor } from "../src/lib/server";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ getUser: vi.fn(), member: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth,
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: auth.member }) }) }),
    }),
  }),
}));
const request = () =>
  new Request("http://localhost/api/admin/state", {
    headers: { authorization: "Bearer test-token" },
  });
const valid = { data: { user: { id: "editor" } }, error: null };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server");
  auth.getUser.mockReset().mockResolvedValue(valid);
  auth.member
    .mockReset()
    .mockResolvedValue({ data: { role: "editor", active: true }, error: null });
});
it("rechecks a transient Auth failure without retrying the protected mutation", async () => {
  auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: { status: 0, name: "AuthRetryableFetchError" },
  });
  expect((await requireEditor(request())).member.role).toBe("editor");
  expect(auth.getUser).toHaveBeenCalledTimes(2);
});
it("reports an unavailable Auth service as 503, while invalid sessions remain 401", async () => {
  auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { status: 503 },
  });
  await expect(requireEditor(request())).rejects.toMatchObject({ status: 503 });
  auth.getUser
    .mockReset()
    .mockResolvedValue({ data: { user: null }, error: { status: 401 } });
  await expect(requireEditor(request())).rejects.toMatchObject({ status: 401 });
  expect(auth.getUser).toHaveBeenCalledTimes(1);
});
it("distinguishes membership outages from revoked and owner-only permissions", async () => {
  auth.member.mockResolvedValueOnce({
    data: null,
    error: { code: "PGRST000" },
  });
  await expect(requireEditor(request())).rejects.toMatchObject({ status: 503 });
  auth.member.mockResolvedValueOnce({
    data: null,
    error: { code: "PGRST116" },
  });
  await expect(requireEditor(request())).rejects.toMatchObject({ status: 403 });
  await expect(requireEditor(request(), true)).rejects.toMatchObject({
    status: 403,
  });
});
