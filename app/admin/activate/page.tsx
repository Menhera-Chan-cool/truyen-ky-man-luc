import { configured } from "../../../src/lib/server";
import Activate from "../../../src/components/Activate";
import { tx } from "../../../src/lib/content";
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = (await searchParams).lang === "en" ? "en" : "vi";
  return configured() ? (
    <Activate locale={locale} />
  ) : (
    <main className="admin-locked">
      <h1>
        {tx(
          locale,
          "Supabase chưa được cấu hình.",
          "Supabase has not been configured.",
        )}
      </h1>
      <a href={`/${locale}`}>{tx(locale, "Đọc sách", "Read the book")}</a>
    </main>
  );
}
