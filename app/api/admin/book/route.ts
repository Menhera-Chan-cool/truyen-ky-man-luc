import {
  requireEditor,
  apiError,
  jsonBody,
  HttpError,
} from "../../../../src/lib/server";
export async function POST(request: Request) {
  try {
    const { client } = await requireEditor(request);
    const body = await jsonBody(request);
    if (!Number.isInteger(body.expectedRevision))
      throw new HttpError("Expected book revision required");
    for (const locale of ["vi", "en"]) {
      const meta = body.meta?.[locale];
      if (
        !meta ||
        typeof meta.title !== "string" ||
        !meta.title.trim() ||
        meta.title.length > 300 ||
        typeof meta.summary !== "string" ||
        meta.summary.length > 20000
      )
        throw new HttpError("Invalid title or introduction");
      for (const url of [meta.frontCover, meta.backCover])
        if (
          url &&
          !/^\/book\/cover\.jpg$|^\/api\/assets\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|gif)$/.test(
            url,
          )
        )
          throw new HttpError("Upload covers to the book storage");
    }
    const { data, error } = await client.rpc("save_book", {
      p_meta: body.meta,
      p_expected_revision: body.expectedRevision,
      p_publish: !!body.publish,
    });
    if (error) throw new Error(error.message);
    return Response.json({ revision: data });
  } catch (e) {
    return apiError(e);
  }
}
