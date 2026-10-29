import {
  requireEditor,
  jsonBody,
  apiError,
  HttpError,
} from "../../../../src/lib/server";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const { client } = await requireEditor(request);
    const r = await client
      .from("editor_presence")
      .select("user_id,email,chapter_id,locale,seen_at")
      .gt("seen_at", new Date(Date.now() - 90_000).toISOString());
    if (r.error) throw new Error(r.error.message);
    return Response.json(r.data, { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await requireEditor(request),
      b = await jsonBody(request);
    if (
      typeof b.lease !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(b.lease) ||
      typeof b.leave !== "boolean" ||
      (!b.leave &&
        (!/^[a-z0-9-]{1,80}$/.test(b.chapterId) ||
          !["vi", "en"].includes(b.locale)))
    )
      throw new HttpError("Invalid editing presence");
    const r = await client.rpc("editor_heartbeat", {
      p_lease: b.lease,
      p_chapter: b.chapterId ?? "",
      p_locale: b.locale ?? "vi",
      p_leave: b.leave,
    });
    if (r.error) throw new Error(r.error.message);
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return apiError(e);
  }
}
