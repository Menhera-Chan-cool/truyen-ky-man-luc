"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Reader from "./Reader";
import OfflineDownloads from "./OfflineDownloads";
import { readOfflineBook } from "../lib/offline-client";
import type { OfflineBook } from "../lib/offline-book";
import { defaultSettings, isLocale } from "../lib/types";
import { readSettings } from "../lib/db";
import { normalizeSettings } from "../lib/reader";
export default function OfflineReader() {
  const params = useSearchParams(),
    locale = isLocale(params.get("locale") ?? "")
      ? (params.get("locale") as "vi" | "en")
      : "vi",
    chapterId = params.get("chapter");
  const [saved, setSaved] = useState<OfflineBook | null | undefined>(),
    [settings, setSettings] = useState(defaultSettings),
    [error, setError] = useState("");
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    let active = true;
    const load = () => {
      void Promise.all([readOfflineBook(), readSettings()])
        .then(([book, prefs]) => {
          if (active) {
            setSaved(book ?? null);
            setSettings(normalizeSettings(prefs ?? defaultSettings));
          }
        })
        .catch(() => {
          if (active) {
            setSaved(null);
            setError("Không đọc được bản tải / Unable to read the download");
          }
        });
    };
    load();
    window.addEventListener("offline-book-changed", load);
    return () => {
      active = false;
      window.removeEventListener("offline-book-changed", load);
    };
  }, []);
  if (saved === undefined)
    return (
      <main className="offline-home">
        <p role="status">Đang mở bản tải… / Opening download…</p>
      </main>
    );
  const chapter = saved?.book.chapters.find((c) => c.id === chapterId);
  if (saved && chapter)
    return (
      <Reader
        key={locale}
        book={saved.book}
        locale={locale}
        chapterId={chapter.id}
        initialSettings={settings}
        offline
      />
    );
  return (
    <main className="offline-home">
      <h1>
        {saved?.book.meta[locale].title ??
          (locale === "vi" ? "Sách ngoại tuyến" : "Offline book")}
      </h1>
      {error && <p role="alert">{error}</p>}
      {saved ? (
        <>
          <p>{saved.book.author}</p>
          <p>
            {locale === "vi" ? "Bản tải lúc" : "Downloaded"}{" "}
            {new Date(saved.downloadedAt).toLocaleString(
              locale === "vi" ? "vi-VN" : "en-US",
            )}
          </p>
          <nav className="button-row">
            <a className="secondary-button" href="/offline?locale=vi">
              Tiếng Việt
            </a>
            <a className="secondary-button" href="/offline?locale=en">
              English
            </a>
          </nav>
          <ol>
            {saved.book.chapters.map((c) => (
              <li key={c.id}>
                <a
                  href={
                    "/offline?locale=" +
                    locale +
                    "&chapter=" +
                    encodeURIComponent(c.id)
                  }
                >
                  {c[locale]?.title ??
                    (locale === "vi"
                      ? "Chưa có bản dịch"
                      : "Translation unavailable")}
                </a>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>
          {locale === "vi"
            ? "Chưa có bản sách được tải trên thiết bị này."
            : "No downloaded book is available on this device."}
        </p>
      )}
      <OfflineDownloads locale={locale} />
      <p>
        <a href={"/" + locale}>
          {locale === "vi" ? "Về sách trực tuyến" : "Open online book"}
        </a>
      </p>
    </main>
  );
}
