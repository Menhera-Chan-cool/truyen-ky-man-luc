"use client";
import { useEffect, useState } from "react";
import { browserClient } from "../lib/supabase";
import { tx } from "../lib/content";
import type { Locale } from "../lib/types";
import { LockKeyhole } from "lucide-react";
export default function Activate({ locale }: { locale: Locale }) {
  const L = (vi: string, en: string) => tx(locale, vi, en);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.lang = locale;
    browserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setReady(true);
        else
          setError(
            L(
              "Liên kết đã hết hạn. Nhờ owner tạo lại liên kết.",
              "This link has expired. Ask the owner for a new link.",
            ),
          );
      });
  }, [locale]);
  return (
    <main className="auth-page">
      <LockKeyhole size={35} />
      <h1>{L("Đặt mật khẩu", "Set password")}</h1>
      <p className="muted">
        {L("Dành cho tài khoản được mời.", "For invited accounts.")}
      </p>
      {error && <p role="alert">{error}</p>}
      {ready && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const password = String(data.get("password"));
            if (password !== data.get("confirm")) {
              setError(L("Hai mật khẩu chưa khớp.", "Passwords do not match."));
              return;
            }
            setBusy(true);
            const { error } = await browserClient().auth.updateUser({
              password,
            });
            setBusy(false);
            if (error) setError(error.message);
            else window.location.assign(`/admin?lang=${locale}`);
          }}
        >
          <label className="field-group">
            {L("Mật khẩu mới", "New password")}
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <label className="field-group">
            {L("Nhập lại mật khẩu", "Confirm password")}
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {L("Lưu mật khẩu", "Save password")}
          </button>
        </form>
      )}
      <a className="guest-link" href={`/${locale}`}>
        {L("Đọc sách", "Read the book")}
      </a>
    </main>
  );
}
