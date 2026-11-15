import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import seed from "../data/book.json";
import { cleanHtml } from "./sanitize";
import type { Book, Locale } from "./types";
import { settingsFromCookie } from "./reader";
import {memoizeFor,publicRead,readFetch} from "./public-read";
export async function savedReaderSettings() {
  return settingsFromCookie((await cookies()).get("book-reader")?.value);
}
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
export function publicClient(fetcher?:typeof fetch) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false },global:{fetch:fetcher} },
  );
}
export function serviceClient(fetcher?:typeof fetch) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false },global:{fetch:fetcher} },
  );
}
export async function getBook(
  includeHtml = true,
  locale?: Locale,
): Promise<Book> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key && !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return includeHtml && !locale
      ? (seed as Book)
      : ({
          ...seed,
          chapters: seed.chapters.map((c) => ({
            ...c,
            vi: c.vi
              ? {
                  ...c.vi,
                  html: includeHtml && locale === "vi" ? c.vi.html : "",
                }
              : undefined,
            en: c.en
              ? {
                  ...c.en,
                  html: includeHtml && locale === "en" ? c.en.html : "",
                }
              : undefined,
          })),
        } as Book);
  if (!url || !key) throw new Error("Incomplete database configuration");
  const book = await (includeHtml ? publishedBook : publishedBookIndex)();
  if (!includeHtml) return book;
  // The shared copy keeps every language; each caller gets its own view without the other language's HTML.
  return {
    ...book,
    chapters: book.chapters.map((c) => {
      const copy = { ...c };
      for (const language of ["vi", "en"] as const)
        if (c[language])
          copy[language] = { ...c[language]!, html: locale && locale !== language ? "" : c[language]!.html };
      return copy;
    }),
  };
}
// Every reader page used to fetch the whole 773 kB book from the database; one shared copy per instance is fresh enough for readers.
const loadBook = (rpc: string, sanitize: boolean) => memoizeFor(120_000, async () => {
  const { data, error } = await publicRead(signal=>publicClient(readFetch(signal)).rpc(rpc));
  if (error || !data)
    throw new Error("Cannot load the published book. Please try again.");
  const book = data as Book;
  if (sanitize)
    for (const c of book.chapters)
      for (const language of ["vi", "en"] as const)
        if (c[language]) c[language]!.html = cleanHtml(c[language]!.html);
  return book;
});
const publishedBook = loadBook("get_public_book", true);
const publishedBookIndex = loadBook("get_public_book_index", false);
export const resetBookCache = () => { publishedBook.reset(); publishedBookIndex.reset(); };
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function requireEditor(request: Request, ownerOnly = false) {
  if (!configured()) throw new HttpError("Supabase is not configured", 503);
  const authorization = request.headers.get("authorization");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError("Invalid origin", 403);
  const cookieStore = await cookies();
  const client = authorization?.startsWith("Bearer ")
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      )
    : createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (values) => {
              values.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            },
          },
        },
      );
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
  const unavailable = (error: { status?: number } | null) =>
    !!error &&
    (error.status === 0 || error.status === 429 || (error.status ?? 0) >= 500);
  let verification = await client.auth.getUser(token);
  if (unavailable(verification.error)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    verification = await client.auth.getUser(token);
  }
  if (unavailable(verification.error))
    throw new HttpError(
      "Unable to verify your session right now. Please retry.",
      503,
    );
  const {
    data: { user },
    error,
  } = verification;
  if (error || !user)
    throw new HttpError("Session expired. Please sign in again.", 401);
  const { data: member, error: memberError } = await client
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();
  if (memberError && !["PGRST116", "42501"].includes(memberError.code))
    throw new HttpError(
      "Unable to check editor permissions right now. Please retry.",
      503,
    );
  if (!member || (ownerOnly && member.role !== "owner"))
    throw new HttpError("Forbidden", 403);
  return { client, user, member };
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    error instanceof HttpError
      ? error.status
      : /conflict/i.test(message)
        ? 409
        : 400;
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4_000_000)
    throw new HttpError("Request too large", 413);
  const text = await request.text();
  if (text.length > 4_000_000) throw new HttpError("Request too large", 413);
  return JSON.parse(text);
}
