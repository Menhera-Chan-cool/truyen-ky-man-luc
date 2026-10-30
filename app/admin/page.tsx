import { configured } from "../../src/lib/server";
import Admin from "../../src/components/Admin";
import { isLocale } from "../../src/lib/types";
import { tx } from "../../src/lib/content";
import { LockKeyhole, BookOpen } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; activation?: string;chapter?:string }>;
}) {
  const { lang, activation,chapter } = await searchParams;
  const locale = lang && isLocale(lang) ? lang : "vi";
  const L = (vi: string, en: string) => tx(locale, vi, en);
  if (activation)
    return (
      <main className="auth-page">
        <LockKeyhole size={35} />
        <h1>
          {L("Liên kết không còn hiệu lực", "This link is no longer valid")}
        </h1>
        <p>
          {L(
            "Nhờ owner tạo liên kết mới. Nếu bạn đã đặt mật khẩu, hãy đăng nhập.",
            "Ask the owner for a new link. If you have already set a password, sign in.",
          )}
        </p>
        <a className="primary-button" href={`/admin?lang=${locale}`}>
          {L("Đăng nhập", "Sign in")}
        </a>
      </main>
    );
  if (!configured())
    return (
      <main className="admin-locked">
        <LockKeyhole size={36} />
        <h1>{L("Khu biên tập đang khóa", "The editor is locked")}</h1>
        <p>
          {L(
            "Supabase chưa được cấu hình.",
            "Supabase has not been configured.",
          )}
        </p>
        <p>
          {L(
            "Bạn vẫn có thể đọc đầy đủ sách song ngữ. Để bật chỉnh sửa dùng chung:",
            "You can still read the complete bilingual book. To enable shared editing:",
          )}
        </p>
        <ol>
          <li>
            {L("Tạo project Supabase miễn phí.", "Create a Supabase project.")}
          </li>
          <li>
            {L(
              "Chạy migration trong thư mục supabase/migrations.",
              "Run the migration in supabase/migrations.",
            )}
          </li>
          <li>
            {L(
              "Cấu hình biến môi trường theo .env.example.",
              "Configure environment variables using .env.example.",
            )}
          </li>
          <li>
            {L(
              "Chạy npm run setup:owner -- email-cua-ban và npm run seed:remote.",
              "Run npm run setup:owner -- your-email and npm run seed:remote.",
            )}
          </li>
        </ol>
        <p className="tiny muted">
          {L(
            "Hướng dẫn chi tiết có trong SUPABASE_SETUP.md của project. Không có tài khoản mặc định hay cửa đăng ký công khai.",
            "See SUPABASE_SETUP.md in the project. There are no default accounts or public registration.",
          )}
        </p>
        <a className="primary-button" href={`/${locale}`}>
          <BookOpen size={17} />
          {L("Tiếp tục với vai trò người đọc", "Continue as a reader")}
        </a>
      </main>
    );
  return <Admin locale={locale} initialChapter={chapter&&/^[a-z0-9-]{1,80}$/.test(chapter)?chapter:undefined}/>;
}
