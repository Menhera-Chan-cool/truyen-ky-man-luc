import { requireEditor, apiError } from "../../../../src/lib/server";
export async function GET(request: Request) {
  try {
    const { client, member } = await requireEditor(request);
    const [book, chapters, editions] = await Promise.all([
      client.from("book").select("*").single(),
      client
        .from("chapters")
        .select("*")
        .eq("archived", false)
        .order("sort_order"),
      client.from("chapter_editions").select("*"),
    ]);
    for (const result of [book, chapters, editions])
      if (result.error) throw new Error(result.error.message);
    const ids = (editions.data ?? []).map((e) => e.draft_id).filter(Boolean);
    const versions = ids.length
      ? await client
          .from("chapter_versions")
          .select(
            "id,chapter_id,locale,title,kind,pdf_path,revision,created_at",
          )
          .in("id", ids)
      : { data: [], error: null };
    if (versions.error) throw new Error(versions.error.message);
    return Response.json(
      {
        book: book.data,
        chapters: chapters.data,
        editions: editions.data,
        versions: versions.data,
        member,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
