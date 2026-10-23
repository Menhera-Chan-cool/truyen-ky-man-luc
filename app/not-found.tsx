"use client";
import { usePathname } from "next/navigation";
import { tx } from "../src/lib/content";
export default function NotFound() {
  const locale = usePathname().startsWith("/en") ? "en" : "vi";
  return (
    <main className="error-page">
      <h1>{tx(locale, "Không tìm thấy trang", "Page not found")}</h1>
      <a href={`/${locale}`}>
        {tx(locale, "Trở về sách", "Return to the book")}
      </a>
    </main>
  );
}
