import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { configured } from "../../../src/lib/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  if (
    !configured() ||
    !token_hash ||
    (type !== "invite" && type !== "recovery")
  )
    return NextResponse.redirect(new URL("/admin?activation=invalid", url));
  const response = NextResponse.redirect(
    new URL(
      `/admin/activate?lang=${url.searchParams.get("lang") === "en" ? "en" : "vi"}`,
      url,
    ),
  );
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );
  const { error } = await client.auth.verifyOtp({ token_hash, type });
  if (error)
    return NextResponse.redirect(new URL("/admin?activation=expired", url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
