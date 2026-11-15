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
  // Large PDFs and files an editor sees before publishing keep a private signed redirect.
  if (!published || registered.content_type === "application/pdf")
    return new Response(null, {
      status: 307,
      headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" },
    });
  // Published images are immutable (UUID paths): serve them through Vercel's CDN, not an uncacheable signed URL per view.
  const upstream = await fetch(data.signedUrl);
  if (!upstream.ok || !upstream.body) return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  return new Response(upstream.body, {
    headers: { "Content-Type": registered.content_type, "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable" },
  });
}
