import { requireEditor, apiError, HttpError } from "../../../../src/lib/server";
export async function GET(request: Request) {
  try {
    const { client } = await requireEditor(request);
    const cursor = new URL(request.url).searchParams.get("before");
    let q = client
      .from("admin_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(51);
    if (cursor) {
      const [at, id] = cursor.split("~");
      if (
        !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(at) ||
        !Number.isFinite(Date.parse(at)) ||
        !/^[0-9a-f-]{36}$/i.test(id)
      )
        throw new HttpError("Invalid audit cursor");
      q = q.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
    }
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    const items = r.data.slice(0, 50),
      last = items.at(-1);
    return Response.json(
      {
        items,
        next:
          r.data.length > 50 && last ? last.created_at + "~" + last.id : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
