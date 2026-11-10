"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  LogIn,
  Moon,
  Sun,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import type { Book, Locale } from "../lib/types";
import { tx, missingChapterTitle } from "../lib/content";
import { readProgress, readSettings, writeSettings } from "../lib/db";
import { contrastText, normalizeSettings, readerPalette } from "../lib/reader";
import { LanguageLinks, IconButton } from "./Ui";
export default function BookDetail({
  book,
  locale,
  initialDark = false,
}: {
  book: Book;
  locale: Locale;
  initialDark?: boolean;
}) {
  const [last, setLast] = useState<string>(),
    [dark, setDark] = useState(initialDark),
    [appearanceBusy, setAppearanceBusy] = useState(false),
    [storageMessage, setStorageMessage] = useState(""),
    [back, setBack] = useState(false),
    [menu, setMenu] = useState(false),
    [closing, setClosing] = useState(false),
    [lastBy, setLastBy] = useState<Partial<Record<Locale, string>>>({});
  const meta = book.meta[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
    readSettings()
      .then((saved) => {
        if (saved)
          setDark(
            contrastText(readerPalette(normalizeSettings(saved)).background) ===
              "#ffffff",
          );
      })
      .catch(() => {});
    for (const lang of ["vi", "en"] as const)
      readProgress(lang)
        .then((p) => {
          if (p && book.chapters.some((c) => c.id === p.chapterId)) {
            setLastBy((m) => ({ ...m, [lang]: p.chapterId }));
            if (lang === locale) setLast(p.chapterId);
          }
        })
        .catch(() => {});
  }, [locale, book.chapters]);
  const start =
    book.chapters.find((c) => c.id === "chapter-1" && c[locale]) ??
    book.chapters.find((c) => c[locale]);
  return (
    <div className={`book-site ${dark ? "site-dark" : ""}`}>
      <header className="site-header">
        <a className="wordmark" href={`/${locale}`}>
          <BookOpen size={23} strokeWidth={1.35} />
          <span>{meta.title}</span>
        </a>
        <div className="header-actions">
          <LanguageLinks locale={locale} />
          <IconButton
            icon={dark ? Sun : Moon}
            label={tx(locale, "Đổi sáng / tối", "Toggle light / dark")}
            disabled={appearanceBusy}
            onClick={async () => {
              setAppearanceBusy(true);
              const next = !dark;
              setDark(next);
              try {
                const saved = normalizeSettings((await readSettings()) ?? {});
                await writeSettings({
                  ...saved,
                  theme: next ? "dark" : "sepia",
                });
                setStorageMessage("");
              } catch {
                setStorageMessage(
                  tx(
                    locale,
                    "Không lưu được giao diện trên thiết bị này.",
                    "Appearance could not be saved on this device.",
                  ),
                );
              } finally {
                setAppearanceBusy(false);
              }
            }}
          />
          <a className="quiet-link login-link" href={`/admin?lang=${locale}`}>
            <LogIn size={16} />
            {tx(locale, "Đăng nhập", "Sign in")}
          </a>
        </div>
      </header>
      <main className="book-main">
        {storageMessage && <p role="status">{storageMessage}</p>}
        <section className="book-hero" aria-labelledby="book-title">
          <div className="cover-column">
            <div className="cover-display">
              {(back ? meta.backCover : meta.frontCover) ? (
                <img
                  className="book-cover"
                  src={back ? meta.backCover : meta.frontCover}
                  alt={tx(
                    locale,
                    back ? "Bìa sau" : "Bìa trước",
                    back ? "Back cover" : "Front cover",
                  )}
                />
              ) : (
                <div className="cover-placeholder">
                  <BookOpen size={64} />
                  <span>{meta.title}</span>
                </div>
              )}
            </div>
            {meta.backCover && (
              <button className="text-button" onClick={() => setBack(!back)}>
                <RotateCcw size={15} />
                {tx(
                  locale,
                  back ? "Xem bìa trước" : "Xem bìa sau",
                  back ? "View front cover" : "View back cover",
                )}
              </button>
            )}
          </div>
          <div className="book-introduction">
            <h1 id="book-title">
              {meta.title ||
                tx(locale, "Truyền kỳ mạn lục", "Records of Strange Tales")}
            </h1>
            <p className="author-line">{book.author}</p>
            <div className="title-rule" aria-hidden="true" />
            <p className="book-summary">{meta.summary}</p>
            {start ? (
              <div className="read-choice">
                <button
                  type="button"
                  className="primary-button read-button"
                  aria-expanded={menu && !closing}
                  aria-controls="read-options"
                  onClick={() => {
                    if (!menu) return setMenu(true);
                    if (closing) return;
                    setClosing(true);
                    setTimeout(() => {
                      setMenu(false);
                      setClosing(false);
                    }, 250);
                  }}
                >
                  <BookOpen size={19} />
                  {last
                    ? tx(locale, "Đọc tiếp", "Continue reading")
                    : tx(locale, "Bắt đầu đọc", "Start reading")}
                  <ArrowRight size={18} />
                </button>
                {menu && (
                  <div
                    className={`read-options ${closing ? "closing" : ""}`}
                    id="read-options"
                  >
                    {(
                      [
                        ["vi", "read", "Tiếng Việt"],
                        ["en", "read", "English"],
                        ["vi", "comic", "Truyện tranh"],
                        ["en", "comic", "Comic"],
                      ] as const
                    ).map(([lang, kind, label], index) => {
                      const first =
                        book.chapters.find((c) => c.id === "chapter-1" && c[lang]) ??
                        book.chapters.find((c) => c[lang]) ??
                        start;
                      return (
                        <a
                          key={label}
                          className="primary-button"
                          style={{ "--i": index } as React.CSSProperties}
                          href={`/${lang}/${kind}/${lastBy[lang] ?? first.id}`}
                        >
                          {label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p>
                {tx(
                  locale,
                  "Chưa có chương được xuất bản.",
                  "No chapters have been published yet.",
                )}
              </p>
            )}
            <p className="reading-invitation">
              {tx(
                locale,
                "Mở sách. Chọn một câu chuyện.",
                "Open the book. Find your story.",
              )}
            </p>
            <a
              className="guest-link"
              href={start ? `/${locale}/read/${last ?? start.id}` : "#contents"}
            >
              {tx(
                locale,
                "Tiếp tục với vai trò người đọc",
                "Continue as a reader",
              )}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
        <section className="contents-section" id="contents">
          <div className="section-heading">
            <h2>{tx(locale, "Mục lục", "Contents")}</h2>
            <span>
              {book.chapters.filter((c) => c.id.startsWith("chapter-")).length}{" "}
              {tx(locale, "câu chuyện", "tales")}
            </span>
          </div>
          <ol className="book-toc">
            {book.chapters.map((chapter, index) => {
              const edition = chapter[locale];
              return (
                <li key={chapter.id}>
                  <a href={`/${locale}/read/${chapter.id}`}>
                    <span className="toc-number">
                      {chapter.id === "preface"
                        ? "—"
                        : String(
                            book.chapters
                              .filter((c) => c.id !== "preface")
                              .findIndex((c) => c.id === chapter.id) + 1,
                          ).padStart(2, "0")}
                    </span>
                    <span>
                      {edition?.title ??
                        missingChapterTitle(chapter.id, locale)}
                    </span>
                    <ArrowUpRight size={17} />
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
      <footer className="site-footer">
        <span>
          {book.author} · {meta.title}
        </span>
        <span>
          {tx(
            locale,
            "Một quyển sách, hai ngôn ngữ.",
            "One book, two languages.",
          )}
        </span>
      </footer>
    </div>
  );
}
