import {
  requireEditor,
  jsonBody,
  apiError,
  HttpError,
} from "../../../../src/lib/server";
import {
  replaceHtmlText,
  replaceLiteral,
} from "../../../../src/lib/editor-tools";
import { cleanHtml } from "../../../../src/lib/sanitize";
export async function POST(request: Request) {
  try {
    const { client } = await requireEditor(request),
      body = await jsonBody(request);
    if (
      !["vi", "en"].includes(body.locale) ||
      typeof body.find !== "string" ||
      typeof body.replacement !== "string" ||
      typeof body.caseSensitive !== "boolean" ||
      typeof body.includeTitles !== "boolean" ||
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 100
    )
      throw new HttpError("Invalid replacement request");
    if (
      body.items.some(
        (i: { id: string; expectedRevision: number }) =>
          !i ||
          !/^[a-z0-9-]{1,80}$/.test(i.id) ||
          !Number.isInteger(i.expectedRevision),
      ) ||
      new Set(body.items.map((i: { id: string }) => i.id)).size !==
        body.items.length
    )
      throw new HttpError("Invalid replacement selection");
    const { data: heads, error } = await client
      .from("chapter_editions")
      .select("*")
      .eq("locale", body.locale)
      .in(
        "chapter_id",
        body.items.map((i: { id: string }) => i.id),
      );
    if (error) throw new Error(error.message);
    for (const i of body.items)
      if (
        !heads?.some(
          (h) =>
            h.chapter_id === i.id &&
            h.revision === i.expectedRevision &&
            h.draft_id,
        )
      )
        throw new HttpError("Conflict: reload before replacement", 409);
    const versions = await client
      .from("chapter_versions")
      .select("*")
      .in(
        "id",
        heads!.map((h) => h.draft_id),
      );
    if (versions.error) throw new Error(versions.error.message);
    const items = [];
    let matches = 0;
    for (const v of versions.data!) {
      const changed = replaceHtmlText(
          v.html,
          body.find,
          body.replacement,
          body.caseSensitive,
        ),
        title = body.includeTitles
          ? replaceLiteral(
              v.title,
              body.find,
              body.replacement,
              body.caseSensitive,
            )
          : { text: v.title, count: 0 };
      if (!changed.count && !title.count) continue;
      if (
        !title.text.trim() ||
        title.text.length > 300 ||
        changed.html.length > 2_000_000
      )
        throw new HttpError("Replacement creates invalid chapter content");
      matches += changed.count + title.count;
      items.push({
        id: v.chapter_id,
        locale: v.locale,
        title: title.text,
        html: cleanHtml(changed.html),
        kind: v.kind,
        pdfPath: v.pdf_path,
        expectedRevision: heads!.find((h) => h.chapter_id === v.chapter_id)!
          .revision,
      });
    }
    if (!items.length) return Response.json({ chapters: 0, matches: 0 });
    const result = await client.rpc("save_chapters_with_reason", {
      p_items: items,
      p_reason: "replace",
    });
    if (result.error) throw new Error(result.error.message);
    return Response.json(
      { chapters: items.length, matches },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
