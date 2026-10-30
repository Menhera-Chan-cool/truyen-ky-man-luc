import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.split("/")[1];
  const locale =
    path === "en" ||
    (["admin", "local"].includes(path) &&
      request.nextUrl.searchParams.get("lang") === "en")
      ? "en"
      : "vi";
  const headers = new Headers(request.headers);
  headers.set("x-book-locale", locale);
  headers.set(
    "x-book-surface",
    ["admin", "local"].includes(path) ? "admin" : "public",
  );
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: ["/vi/:path*", "/en/:path*", "/admin/:path*", "/local/:path*"],
};
