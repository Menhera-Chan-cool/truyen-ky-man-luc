import {
  requireEditor,
  apiError,
  jsonBody,
  HttpError,
} from "../../../../src/lib/server";
export async function POST(request: Request) {
  try {
    const { client, user } = await requireEditor(request);
    const body = await jsonBody(request);
    if (
      typeof body.path !== "string" ||
      !body.path.startsWith(`${user.id}/`) ||
      !new RegExp("^[a-zA-Z0-9/_-]+\\.(jpg|jpeg|png|gif|webp|pdf)$").test(
        body.path,
      )
    )
      throw new HttpError("Invalid asset path");
    const { data, error } = await client.storage
      .from("book-assets")
      .download(body.path);
    if (error || !data)
      throw new Error("Upload the asset before registering it");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const signature = Array.from(bytes.slice(0, 12));
    const mime =
      signature[0] === 255 && signature[1] === 216 && signature[2] === 255
        ? "image/jpeg"
        : signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
          ? "image/png"
          : new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8")
            ? "image/gif"
            : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
                new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
              ? "image/webp"
              : new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
                ? "application/pdf"
                : null;
    if (
      !mime ||
      mime !== body.contentType ||
      (mime !== "application/pdf" && bytes.length > 10 * 1024 * 1024)
    )
      throw new HttpError("Invalid file signature or image exceeds 10 MB");
    if (mime === "application/pdf") {
      const { PDFDocument } = await import("pdf-lib");
      await PDFDocument.load(bytes);
    }
    const { error: insertError } = await client
      .from("assets")
      .insert({ path: body.path, content_type: mime, created_by: user.id });
    if (insertError) throw new Error(insertError.message);
    return Response.json({ url: `/api/assets/${body.path}`, path: body.path });
  } catch (e) {
    return apiError(e);
  }
}
