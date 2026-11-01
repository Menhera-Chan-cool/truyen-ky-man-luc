"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function browserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return (client ??= createBrowserClient(url, key));
}
export async function adminRequest(
  path: string,
  body?: unknown,
  method = "POST",
  signal?: AbortSignal,
) {
  const { data } = await browserClient().auth.getSession();
  if (!data.session) throw new Error("Please sign in again");
  signal?.throwIfAborted();
  const response = await fetch(`/api/admin/${path}`, {
    signal,
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error ?? "Request failed"),{status:response.status});
  return result;
}
