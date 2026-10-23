import {
  configured,
  publicClient,
  requireEditor,
  serviceClient,
} from "../../../../src/lib/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!configured()) return new Response("Not found", { status: 404 });
  const path = (await params).path.join("/");
  if (!/^[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|gif|webp|pdf)$/.test(path))
    return new Response("Not found", { status: 404 });
  const { data: published } = await publicClient().rpc("can_read_asset", {
    p_path: path,
  });
  if (!published) {
    try {
      await requireEditor(request);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  const { data: registered } = await serviceClient()
    .from("assets")
    .select("content_type")
    .eq("path", path)
    .maybeSingle();
  if (!registered) return new Response("Not found", { status: 404 });
  const { data, error } = await serviceClient()
    .storage.from("book-assets")
    .createSignedUrl(path, 60);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 307,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
