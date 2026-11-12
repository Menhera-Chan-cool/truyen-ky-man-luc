"use client";
import { useEffect, useRef, useState } from "react";
import { Panel } from "./Ui";
import { cleanHtml } from "../lib/sanitize";
import { decorateFootnotes } from "../lib/footnotes";
import dynamic from "next/dynamic";
const PdfViewer=dynamic(()=>import("./PdfViewer"));
import type { Book, Chapter, Locale, ReaderSettings } from "../lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import HeadingFontFaces,{headingFontStyle} from "./HeadingFontFaces";
import {headingFontId} from "../lib/heading-fonts";
function EditionView({
  chapter,
  language,
  settings,
  fontFamily,
  headingFont,
}: {
  chapter: Chapter;
  language: Locale;
  settings: ReaderSettings;
  fontFamily: string;
  headingFont?: string;
}) {
  const root = useRef<HTMLElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    edition = chapter[language];
  const context = `${chapter.id}:${language}:${edition?.revision}`;
  const [noteReturn, setNoteReturn] = useState<{context:string;top:number;left:number;source:HTMLAnchorElement}|null>(null);
  useEffect(() => {
    setNoteReturn(null);
    if (!root.current || !edition) return;
    decorateFootnotes(root.current, language, chapter.id);
    const prefix = `parallel-${language}-${chapter.id}-`,
      ids = new Map<string, string>();
    for (const el of root.current.querySelectorAll<HTMLElement>("[id]")) {
      ids.set(el.id, prefix + el.id);
      el.id = prefix + el.id;
    }
    for (const link of root.current.querySelectorAll<HTMLAnchorElement>(
      'a[href^="#"]',
    )) {
      try {
        const id = decodeURIComponent(link.hash.slice(1));
        if (ids.has(id)) link.href = "#" + encodeURIComponent(ids.get(id)!);
      } catch {
        /* Invalid fragment is left inert below. */
      }
    }
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [chapter.id, edition, language]);
  return (
    <section className="parallel-edition" lang={language}>
      <h3>{language === "vi" ? "Tiếng Việt" : "English"}</h3>
      {!edition ? (
        <p className="missing-translation">
          {language === "vi"
            ? "Chưa có bản tiếng Việt cho phần này."
            : "This section has not been translated into English."}
        </p>
      ) : edition.kind === "pdf" && edition.pdfPath ? (
        <PdfViewer
          src={"/api/assets/" + edition.pdfPath}
          locale={language}
          onText={() => {}}
        />
      ) : (
        <div className="parallel-scroll" ref={scroll} data-heading-font={headingFontId(headingFont)} style={headingFontStyle(headingFont)}>
          <HeadingFontFaces ids={[headingFont]}/>
          <h4>{edition.title}</h4>
          <article
            className="prose"
            ref={root}
            style={{
              fontFamily,
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
            }}
            onClick={(e) => {
              const link = (e.target as Element).closest<HTMLAnchorElement>(
                'a[href^="#"]',
              );
              if (!link) return;
              e.preventDefault();
              e.stopPropagation();
              try {
                const target = root.current?.querySelector<HTMLElement>(
                  "#" + CSS.escape(decodeURIComponent(link.hash.slice(1))),
                );
                if (target && scroll.current) {
                  if (link.matches('.footnote-ref')) setNoteReturn({context,top:scroll.current.scrollTop,left:scroll.current.scrollLeft,source:link});
                  scroll.current.scrollTop +=
                    target.getBoundingClientRect().top -
                    scroll.current.getBoundingClientRect().top -
                    8;
                }
              } catch {
                /* Do not navigate the main reader for a broken comparison fragment. */
              }
            }}
            dangerouslySetInnerHTML={{ __html: cleanHtml(edition.html) }}
          />
        </div>
      )}
      {noteReturn?.context === context && (
        <button className="footnote-return" onClick={() => {
          scroll.current?.scrollTo({top:noteReturn.top,left:noteReturn.left,behavior:"instant"});
          noteReturn.source.focus({preventScroll:true});
          setNoteReturn(null);
        }}>
          <ChevronLeft size={18} aria-hidden="true" />
          {language === "vi" ? "Quay lại chỗ đang đọc" : "Back to reading"}
        </button>
      )}
    </section>
  );
}
export default function ParallelReader({
  locale,
  chapterId,
  settings,
  onClose,
  onRead,
  offlineBook,
  fontFamily = '"Literata Variable", Georgia, serif',
}: {
  locale: Locale;
  chapterId: string;
  settings: ReaderSettings;
  onClose: () => void;
  onRead: (l: Locale, id: string) => void;
  offlineBook?: Book;
  fontFamily?: string;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    [book, setBook] = useState<Book | null>(offlineBook ?? null),
    [selected, setSelected] = useState(chapterId),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (offlineBook) {
      setBook(offlineBook);
      return;
    }
    const c = new AbortController();
    setError("");
    void fetch("/api/book", { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            L(
              "Chưa tải được hai bản công khai.",
              "Unable to load both published editions.",
            ),
          );
        return r.json();
      })
      .then((data) => {
        if (!c.signal.aborted) setBook(data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [offlineBook, attempt]);
  const at = book?.chapters.findIndex((c) => c.id === selected) ?? -1,
    chapter = book?.chapters[at];
  return (
    <div className="parallel-reader">
      <Panel
        title={L("Đọc đối chiếu VI–EN", "Compare VI–EN")}
        onClose={onClose}
        closeLabel={L("Đóng", "Close")}
      >
        <p className="tiny muted">
          {L(
            "Hai bản cùng chương, cuộn độc lập. Chưa tự ghép từng câu dịch. Đóng bảng để trở về chỗ đang đọc.",
            "Same chapter, independent scrolling. Sentences are not automatically aligned. Close to return to your reading position.",
          )}
        </p>
        {error ? (
          <p role="alert">
            {error}
            <button
              className="secondary-button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              {L("Thử lại", "Retry")}
            </button>
          </p>
        ) : !book ? (
          <p role="status">
            {L("Đang tải hai bản…", "Loading both editions…")}
          </p>
        ) : (
          <>
            <div className="button-row">
              <button
                className="secondary-button"
                aria-label={L(
                  "Chương đối chiếu trước",
                  "Previous comparison chapter",
                )}
                disabled={at <= 0}
                onClick={() => setSelected(book.chapters[at - 1].id)}
              >
                <ChevronLeft size={18} />
              </button>
              <label className="comparison-picker">
                {L("Chương đối chiếu", "Comparison chapter")}
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {book.chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c[locale]?.title ?? c.id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                aria-label={L("Chương đối chiếu kế", "Next comparison chapter")}
                disabled={at < 0 || at >= book.chapters.length - 1}
                onClick={() => setSelected(book.chapters[at + 1].id)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {chapter && (
              <>
                <div className="parallel-columns">
                  {(["vi", "en"] as const).map((language) => (
                    <EditionView
                      key={language + selected}
                      chapter={chapter}
                      language={language}
                      settings={settings}
                      fontFamily={fontFamily}
                      headingFont={book.meta[language].headingFont}
                    />
                  ))}
                </div>
                <div className="button-row">
                  {(["vi", "en"] as const).map((l) => (
                    <button
                      className="secondary-button"
                      disabled={!chapter[l]}
                      key={l}
                      onClick={() => onRead(l, chapter.id)}
                    >
                      {L("Đọc bản", "Read in")} {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
