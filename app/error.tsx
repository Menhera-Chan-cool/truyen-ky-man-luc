"use client";
import { usePathname } from "next/navigation";
import { tx } from "../src/lib/content";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const locale = usePathname().startsWith("/en") ? "en" : "vi";
  return (
    <main className="error-page">
      <h1>{tx(locale, "Không tải được trang", "Unable to load this page")}</h1>
      <p>{tx(locale, "Vui lòng thử lại.", "Please try again.")}</p>
      <button className="primary-button" onClick={reset}>
        {tx(locale, "Thử lại", "Retry")}
      </button>
    </main>
  );
}
