import {
  requireEditor,
  apiError,
  jsonBody,
  HttpError,
  serviceClient,
} from "../../../../src/lib/server";
import {validHeadingFontId} from "../../../../src/lib/heading-fonts";
import {publicRead,readFetch} from "../../../../src/lib/public-read";
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
      if(meta.headingFont!==undefined&&!validHeadingFontId(meta.headingFont))throw new HttpError("Invalid heading font");
      for (const url of [meta.frontCover, meta.backCover])
        if (
          url &&
          !/^\/book\/cover\.jpg$|^\/api\/assets\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|gif)$/.test(
            url,
          )
        )
          throw new HttpError("Upload covers to the book storage");
      if (body.publish)
        for (const url of new Set(
          [meta.frontCover, meta.backCover].filter(Boolean),
        )) {
          if (url === "/book/cover.jpg") continue;
          const path = url.slice("/api/assets/".length),
            registered = await client
              .from("assets")
              .select("path")
              .eq("path", path)
              .maybeSingle();
          if (
            registered.error ||
            !registered.data ||
            !(await client.storage.from("book-assets").exists(path)).data
          )
            throw new HttpError(
              "Cover file is unavailable. Upload it again before publishing.",
            );
        }
    }
    const fonts=[...new Set([body.meta.vi.headingFont,body.meta.en.headingFont].filter(id=>id&&id!=="default"))];
    if(body.publish&&fonts.length){
      const {data:registered,error:lookup}=await client.from("heading_fonts").select("id,path").in("id",fonts).eq("archived",false);
      if(lookup)throw new HttpError("Cannot check heading fonts. Retry publishing.",503);
      if(registered?.length!==fonts.length)throw new HttpError("A heading font was removed. Choose another font before publishing.");
      for(const font of registered){const {data:exists,error}=await publicRead(signal=>serviceClient(readFetch(signal)).storage.from("heading-fonts").exists(font.path));if(error||!exists)throw new HttpError("Heading font file is unavailable. Retry or choose another font.",error?503:400);}
    }
    const { data, error,status } = await client.rpc("save_book", {
      p_meta: body.meta,
      p_expected_revision: body.expectedRevision,
      p_publish: !!body.publish,
    });
    if (error) throw status===0||status>=500?new HttpError(error.message,503):new Error(error.message);
    return Response.json({ revision: data });
  } catch (e) {
    return apiError(e);
  }
}
