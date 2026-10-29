import {
  requireEditor,
  apiError,
  jsonBody,
  HttpError,
} from "../../../../src/lib/server";
import { cleanHtml } from "../../../../src/lib/sanitize";
import { validateImport } from "../../../../src/lib/content";
import { reviewPublication } from "../../../../src/lib/publication-review";
function validate(item: Record<string, unknown>) {
  if (
    !["vi", "en"].includes(String(item.locale)) ||
    !["text", "illustration", "pdf"].includes(String(item.kind)) ||
    !Number.isInteger(item.expectedRevision) ||
    Number(item.expectedRevision) < 0
  )
    throw new HttpError("Invalid chapter fields");
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.html !== "string" ||
    item.html.length > 2_000_000
  )
    throw new HttpError("Invalid chapter content");
  validateImport(
    [{ id: item.id, title: item.title, html: item.html }],
    [],
    true,
  );
  return {
    id: item.id,
    locale: String(item.locale),
    title: item.title,
    html: cleanHtml(item.html),
    kind: String(item.kind),
    pdfPath: typeof item.pdfPath === "string" ? item.pdfPath : null,
    expectedRevision: Number(item.expectedRevision),
  };
}
export async function GET(request: Request) {
  try {
    const { client } = await requireEditor(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id"),
      locale = url.searchParams.get("locale"),
      version = url.searchParams.get("version");
    if (
      !id ||
      !/^[a-z0-9-]{1,80}$/.test(id) ||
      !["vi", "en"].includes(locale ?? "")
    )
      throw new HttpError("Invalid history selection");
    const query = client.from("chapter_versions");
    if (version) {
      if (!/^[0-9a-f-]{36}$/i.test(version))
        throw new HttpError("Invalid revision ID");
      const { data, error } = await query
        .select("*")
        .eq("chapter_id", id)
        .eq("locale", locale)
        .eq("id", version)
        .single();
      if (error) throw new Error(error.message);
      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
    }
    const before = Number(url.searchParams.get("before") ?? 2147483647);
    if (!Number.isInteger(before) || before < 1 || before > 2147483647)
      throw new HttpError("Invalid revision cursor");
    const { data, error } = await query
      .select("id,chapter_id,locale,title,kind,pdf_path,revision,created_at")
      .eq("chapter_id", id)
      .eq("locale", locale)
      .lt("revision", before)
      .order("revision", { ascending: false })
      .limit(51);
    if (error) throw new Error(error.message);
    const items = (data ?? []).slice(0, 50);
    return Response.json(
      { items, next: (data?.length ?? 0) > 50 ? items.at(-1)?.revision : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await requireEditor(request);
    const body = await jsonBody(request);
    let result;
    if (body.action === "publish-batch") {
      if (
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > 100 ||
        body.items.some(
          (i: { expectedRevision?: number }) =>
            !Number.isInteger(i.expectedRevision),
        )
      )
        throw new HttpError("Invalid publication selection");
      const issues = await reviewPublication(client, body.items);
      if (issues.some((i) => i.severity === "error"))
        return Response.json(
          { error: "Publication checks failed", issues },
          { status: 422, headers: { "Cache-Control": "no-store" } },
        );
      result = await client.rpc("publish_chapters", { p_items: body.items });
    } else if (body.action === "publish" || body.action === "withdraw") {
      if (!Number.isInteger(body.expectedRevision))
        throw new HttpError("Expected revision required");
      if (body.action === "publish") {
        const issues = await reviewPublication(client, [
          {
            id: body.id,
            locale: body.locale,
            expectedRevision: body.expectedRevision,
          },
        ]);
        if (issues.some((i) => i.severity === "error"))
          return Response.json(
            { error: "Publication checks failed", issues },
            { status: 422, headers: { "Cache-Control": "no-store" } },
          );
      }
      result = await client.rpc("publish_chapter", {
        p_id: body.id,
        p_locale: body.locale,
        p_expected_revision: body.expectedRevision,
        p_withdraw: body.action === "withdraw",
      });
    } else if (body.action === "archive")
      result = await client.rpc("archive_chapter", { p_id: body.id });
    else if (body.action === "reorder") {
      if (!Array.isArray(body.ids) || !Number.isInteger(body.expectedRevision))
        throw new HttpError("Invalid chapter order");
      result = await client.rpc("reorder_chapters", {
        p_ids: body.ids,
        p_expected_revision: body.expectedRevision,
      });
    } else if (body.action === "import") {
      if (
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > 100
      )
        throw new HttpError("Select between 1 and 100 chapters");
      const items = body.items.map(validate);
      const { data: existing, error } = await client
        .from("chapter_editions")
        .select("chapter_id,locale");
      if (error) throw new Error(error.message);
      if (
        !body.confirmReplace &&
        items.some((i: Record<string, unknown>) =>
          existing?.some((e) => e.chapter_id === i.id && e.locale === i.locale),
        )
      )
        throw new HttpError("Confirm replace before overwriting chapters", 409);
      if (
        new Set(
          items.map((i: Record<string, unknown>) => `${i.id}:${i.locale}`),
        ).size !== items.length
      )
        throw new HttpError("Duplicate chapters");
      result = await client.rpc("save_chapters_with_reason", {
        p_items: items,
        p_reason: "import",
      });
    } else {
      const item = validate(body);
      result = await client.rpc("save_chapter", {
        p_id: item.id,
        p_locale: item.locale,
        p_title: item.title,
        p_html: item.html,
        p_kind: item.kind,
        p_pdf_path: item.pdfPath ?? null,
        p_expected_revision: item.expectedRevision,
      });
    }
    if (result.error) throw new Error(result.error.message);
    return Response.json(
      { data: result.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
