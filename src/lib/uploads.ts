"use client";
import { browserClient, adminRequest } from "./supabase";
export async function uploadAsset(file: Blob, name: string) {
  const client = browserClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Please sign in again");
  const extension = name.split(".").pop()?.toLowerCase();
  if (!["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(extension ?? ""))
    throw new Error("Supported assets: JPG, PNG, WEBP, GIF, PDF");
  if (file.size > (extension === "pdf" ? 50 : 10) * 1024 * 1024)
    throw new Error(
      extension === "pdf" ? "PDF exceeds 50 MB" : "Image exceeds 10 MB",
    );
  const mime =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "pdf"
        ? "application/pdf"
        : `image/${extension}`;
  if (extension !== "pdf") {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
  }
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from("book-assets")
    .upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return adminRequest("assets", { path, contentType: mime });
}
export async function uploadInlineImages(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const uploaded = new Map<string, string>();
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("data:image/")) {
      let url = uploaded.get(src);
      if (!url) {
        const match = src.match(/^data:image\/(jpeg|png|webp|gif);base64,/);
        if (!match) throw new Error("Invalid embedded image");
        const bytes = Uint8Array.from(atob(src.slice(match[0].length)), (c) =>
          c.charCodeAt(0),
        );
        const result = await uploadAsset(
          new Blob([bytes], { type: `image/${match[1]}` }),
          `image.${match[1]}`,
        );
        url = result.url;
        uploaded.set(src, url!);
      }
      img.setAttribute("src", url!);
    }
  }
  return doc.body.innerHTML;
}
export async function storeSource(file: File) {
  const {
    data: { user },
  } = await browserClient().auth.getUser();
  if (!user) throw new Error("Please sign in again");
  const ext = file.name.split(".").pop()?.toLowerCase();
  const mime: Record<string, string> = {
    epub: "application/epub+zip",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pdf: "application/pdf",
    html: "text/html",
    htm: "text/html",
    txt: "text/plain",
  };
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await browserClient()
    .storage.from("book-sources")
    .upload(path, file, {
      contentType: mime[ext ?? ""] ?? "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}
