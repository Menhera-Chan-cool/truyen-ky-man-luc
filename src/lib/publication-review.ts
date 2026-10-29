import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inspectEditions,
  type ReviewEdition,
  type ReviewIssue,
} from "./editor-tools";
import { HttpError } from "./server";
export type PublicationSelection = {
  id: string;
  locale: string;
  expectedRevision: number;
};
export async function reviewPublication(
  client: SupabaseClient,
  items: PublicationSelection[],
) {
  if (
    !items.length ||
    items.length > 100 ||
    items.some(
      (i) =>
        !i ||
        !/^[a-z0-9-]{1,80}$/.test(i.id) ||
        !["vi", "en"].includes(i.locale) ||
        !Number.isInteger(i.expectedRevision),
    )
  )
    throw new HttpError("Invalid publication selection");
  const [heads, chapters] = await Promise.all([
    client.from("chapter_editions").select("*"),
    client.from("chapters").select("id").eq("archived", false),
  ]);
  if (heads.error || chapters.error)
    throw new Error(heads.error?.message ?? chapters.error?.message);
  const active = new Set(chapters.data!.map((c) => c.id)),
    chosen = new Set(items.map((i) => i.id + ":" + i.locale));
  if (chosen.size !== items.length)
    throw new HttpError("Duplicate publication selection");
  for (const item of items) {
    const head = heads.data!.find(
      (h) => h.chapter_id === item.id && h.locale === item.locale,
    );
    if (
      !active.has(item.id) ||
      !head?.draft_id ||
      head.revision !== item.expectedRevision
    )
      throw new HttpError("Conflict: reload the latest chapter", 409);
  }
  const ids = heads
    .data!.filter((h) => active.has(h.chapter_id))
    .map((h) =>
      chosen.has(h.chapter_id + ":" + h.locale) ? h.draft_id : h.published_id,
    )
    .filter(Boolean);
  const versions = ids.length
    ? await client.from("chapter_versions").select("*").in("id", ids)
    : { data: [], error: null };
  if (versions.error) throw new Error(versions.error.message);
  const editions: ReviewEdition[] = versions.data!.map((v) => ({
    id: v.chapter_id,
    locale: v.locale,
    title: v.title,
    html: v.html,
    kind: v.kind,
    pdfPath: v.pdf_path,
  }));
  const issues = inspectEditions(editions).filter((i) =>
    chosen.has(i.id + ":" + i.locale),
  );
  const paths = new Map<string, ReviewEdition[]>();
  for (const edition of editions.filter((e) =>
    chosen.has(e.id + ":" + e.locale),
  )) {
    const { parse } = await import("node-html-parser");
    const urls = parse(edition.html)
      .querySelectorAll("img")
      .map((img) => img.getAttribute("src") ?? "");
    if (edition.kind === "pdf")
      urls.push("/api/assets/" + (edition.pdfPath ?? ""));
    for (const src of new Set(urls)) {
      if (src === "/book/cover.jpg") continue;
      const match = src.match(
        /^\/api\/assets\/([a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|gif|webp|pdf))$/i,
      );
      if (!match) {
        issues.push({
          id: edition.id,
          locale: edition.locale,
          code: "unmanaged-image",
          severity: "error",
          detail: src.slice(0, 160) || "Missing asset",
        });
        continue;
      }
      paths.set(match[1], [...(paths.get(match[1]) ?? []), edition]);
    }
  }
  const entries = [...paths];
  const registered = entries.length
    ? await client
        .from("assets")
        .select("path")
        .in(
          "path",
          entries.map(([path]) => path),
        )
    : { data: [], error: null };
  if (registered.error) throw new Error(registered.error.message);
  const available = new Set(registered.data!.map((a) => a.path));
  for (let at = 0; at < entries.length; at += 6)
    await Promise.all(
      entries.slice(at, at + 6).map(async ([path, refs]) => {
        const result = available.has(path)
          ? await client.storage.from("book-assets").exists(path)
          : { data: false };
        if (!result.data)
          for (const e of refs)
            issues.push({
              id: e.id,
              locale: e.locale,
              code: "broken-image",
              severity: "error",
              detail: path,
            });
      }),
    );
  return issues as ReviewIssue[];
}
