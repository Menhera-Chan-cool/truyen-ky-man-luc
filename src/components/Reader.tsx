"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Bookmark,
  BookmarkPlus,
  Search,
  Settings,
  Maximize,
  Minimize,
  Play,
  Square,
  Volume2,
  ArrowDown,
  Headphones,
  X,
  Copy,
  Languages,
  Quote,
  Highlighter,
  Trash2,
  ImageIcon,
  Download,
  ExternalLink,
} from "lucide-react";
import type {
  Annotation,
  Book,
  Locale,
  Progress,
  ReaderSettings,
} from "../lib/types";
import { defaultSettings } from "../lib/types";
import {
  tx,
  resolveAnchor,
  translationUrl,
  missingChapterTitle,
} from "../lib/content";
import {
  readSettings,
  writeSettings,
  readProgress,
  writeProgress,
  readAnnotations,
  saveAnnotation,
  deleteAnnotation,
} from "../lib/db";
import {
  annotationColors,
  contrastText,
  countPages,
  normalizeSettings,
  rangeFromOffsets,
  selectionAnchor,
  readerPalette,
  readerFonts,
} from "../lib/reader";
import { IconButton, LanguageLinks, Panel } from "./Ui";
import ReaderSettingsPanel from "./ReaderSettings";
import { createProgressSaver } from "../lib/progress-saver";
import Soundscape from "./Soundscape";
import PdfViewer from "./PdfViewer";
import { useSpeech } from "./useSpeech";

type Selection = {
  start: number;
  end: number;
  text: string;
  left: number;
  top: number;
};
type HighlightWindow = Window & {
  Highlight?: new (...ranges: Range[]) => unknown;
};
type HighlightCSS = typeof CSS & { highlights?: Map<string, unknown> };
export default function Reader({
  book,
  locale,
  chapterId: initialChapterId,
  initialSettings = defaultSettings,
}: {
  book: Book;
  locale: Locale;
  chapterId: string;
  initialSettings?: ReaderSettings;
}) {
  const routeChapterId = usePathname()?.split("/").at(-1);
  const chapter =
    book.chapters.find((c) => c.id === routeChapterId) ??
    book.chapters.find((c) => c.id === initialChapterId)!;
  const chapterId = chapter.id;
  const edition = chapter[locale];
  const revision = edition?.revision ?? 0;
  const [settings, setSettings] = useState<ReaderSettings>({
      ...initialSettings,
    }),
    [ready, setReady] = useState(false),
    [sidebar, setSidebar] = useState<boolean | null>(null),
    [tab, setTab] = useState<"contents" | "notes">("contents");
  const [query, setQuery] = useState(""),
    [annotations, setAnnotations] = useState<Annotation[]>([]),
    [kind, setKind] = useState("all"),
    [color, setColor] = useState(""),
    [currentOnly, setCurrentOnly] = useState(true);
  const [panel, setPanel] = useState<
      "settings" | "voice" | "sound" | "scroll" | null
    >(null),
    [voiceQuery, setVoiceQuery] = useState(""),
    [auto, setAuto] = useState(false),
    [fullscreen, setFullscreen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null),
    [note, setNote] = useState(""),
    [quote, setQuote] = useState(""),
    [activeImage, setActiveImage] = useState<{
      src: string;
      alt: string;
    } | null>(null),
    [imageOpen, setImageOpen] = useState(false);
  const [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [viewportWidth, setViewportWidth] = useState(780),
    [mobile, setMobile] = useState(false),
    [ratio, setRatio] = useState(0),
    [message, setMessage] = useState(""),
    [pdfText, setPdfText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null),
    windowRef = useRef<HTMLDivElement>(null),
    contentRef = useRef<HTMLElement>(null),
    quoteDialog = useRef<HTMLDialogElement>(null),
    imageDialog = useRef<HTMLDialogElement>(null);
  const restored = useRef(false),
    initialProgress = useRef<Progress | undefined>(undefined),
    ratioRef = useRef(0),
    pageRef = useRef(0);
  const L = (vi: string, en: string) => tx(locale, vi, en);
  const notify = useCallback((text: string) => setMessage(text), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const progressSaver = useMemo(
    () => createProgressSaver((progress) => writeProgress(locale, progress)),
    [locale, chapterId, revision],
  );
  useEffect(() => {
    const flush = () => {
      void progressSaver.flush().catch(() => {});
    };
    const visibility = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [progressSaver]);
  const onPdfText = useCallback((text: string) => setPdfText(text), []);
  const speech = useSpeech(
    contentRef,
    locale,
    settings.rate,
    settings.voice,
    notify,
  );
  const availableVoices = speech.voices.filter((v) =>
    v.lang.toLowerCase().startsWith(locale),
  );
  const theme = readerPalette(settings);
  const isPdf = edition?.kind === "pdf";
  const paged = settings.mode !== "scroll" && !isPdf;
  const double = settings.mode === "double" && !mobile;
  const position = book.chapters.findIndex((c) => c.id === chapterId);
  const previous = book.chapters[position - 1],
    next = book.chapters[position + 1];
  const style = {
    "--reader-bg": theme.background,
    "--reader-fg": theme.foreground,
    "--reader-accent": theme.accent,
    "--button-ink": contrastText(theme.accent),
    colorScheme:
      contrastText(theme.background) === "#ffffff" ? "dark" : "light",
  } as CSSProperties;

  useEffect(() => {
    document.documentElement.lang = locale;
    setSidebar(window.innerWidth >= 1000);
    const resize = () => setMobile(window.innerWidth < 760);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [locale]);
  useEffect(() => {
    let cancelled = false;
    restored.current = false;
    setReady(false);
    setSelection(null);
    setActiveImage(null);
    setPdfText("");
    setAuto(false);
    setPage(0);
    speech.stop();
    Promise.all([
      readSettings(),
      readProgress(locale, chapterId),
      readAnnotations(),
    ])
      .then(([saved, progress, notes]) => {
        if (cancelled) return;
        setSettings(normalizeSettings(saved ?? initialSettings));
        initialProgress.current =
          progress?.revision === revision ? progress : undefined;
        setAnnotations(notes);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
          notify(
            L(
              "Không lưu được trên thiết bị. Hãy kiểm tra chế độ riêng tư của trình duyệt.",
              "Device storage is unavailable. Check your browser privacy settings.",
            ),
          );
        }
      });
    return () => {
      cancelled = true;
      speech.stop();
    };
    // Speech must stop on edition changes, not on every toolbar render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, locale, revision]);
  useEffect(() => {
    if (ready)
      writeSettings(settings).catch(() =>
        notify(L("Không lưu được cài đặt.", "Unable to save settings.")),
      );
  }, [settings, ready]);
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let cancelled = false;
    const restore = () => {
      if (cancelled) return;
      const viewport = windowRef.current;
      const content = contentRef.current;
      if (viewport && content) {
        const width = viewport.clientWidth;
        setViewportWidth(width);
        setPages(paged ? countPages(content.scrollWidth, width, 48) : 1);
      }
      if (!restored.current) {
        const progress = initialProgress.current;
        const r = progress?.ratio ?? 0;
        ratioRef.current = r;
        setRatio(r);
        if (paged) setPage(progress?.page ?? 0);
        else if (scrollRef.current)
          scrollRef.current.scrollTop =
            r *
            (scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
        restored.current = true;
        if (edition)
          writeProgress(locale, {
            chapterId,
            ratio: r,
            page: progress?.page ?? 0,
            revision,
          }).catch(() => {});
      }
    };
    document.fonts.ready.then(() => {
      if (!cancelled)
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(restore);
        });
    });
    const observer = new ResizeObserver(restore);
    if (windowRef.current) observer.observe(windowRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [
    ready,
    paged,
    double,
    settings.fontSize,
    settings.lineHeight,
    settings.width,
    settings.font,
    edition,
    chapterId,
    locale,
    revision,
  ]);
  useEffect(() => {
    pageRef.current = page;
    if (!ready || !restored.current || !paged || !edition) return;
    const r = pages > 1 ? page / (pages - 1) : 0;
    ratioRef.current = r;
    setRatio(r);
    writeProgress(locale, { chapterId, ratio: r, page, revision }).catch(
      () => {},
    );
  }, [page, pages, paged, ready, locale, chapterId, revision]);
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pages - 1)));
  }, [pages]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  useEffect(() => {
    if (!quote) return;
    quoteDialog.current?.showModal();
    return () => quoteDialog.current?.close();
  }, [quote]);
  useEffect(() => {
    if (imageOpen) imageDialog.current?.showModal();
    return () => imageDialog.current?.close();
  }, [imageOpen]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const capture = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!contentRef.current) return;
        const selected = selectionAnchor(contentRef.current);
        if (!selected || !selected.text.trim()) return;
        setNote("");
        setSelection({
          ...selected,
          left: Math.max(
            12,
            Math.min(window.innerWidth - 350, selected.rect.left),
          ),
          top: Math.max(
            75,
            Math.min(window.innerHeight - 220, selected.rect.bottom + 10),
          ),
        });
      }, 180);
    };
    document.addEventListener("selectionchange", capture);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", capture);
    };
  }, []);
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const highlights = (CSS as HighlightCSS).highlights;
    const Highlight = (window as HighlightWindow).Highlight;
    if (!highlights || !Highlight) return;
    annotationColors.forEach((color, i) => {
      const ranges = annotations
        .filter(
          (a) =>
            a.locale === locale &&
            a.chapterId === chapterId &&
            !a.image &&
            a.color === color,
        )
        .map((a) => resolveAnchor(a, revision, root.textContent ?? ""))
        .filter((x): x is [number, number] => !!x)
        .map(([s, e]) => rangeFromOffsets(root, s, e))
        .filter((x): x is Range => !!x);
      highlights.set(`note-${i}`, new Highlight(...ranges));
    });
    return () =>
      annotationColors.forEach((_, i) => highlights.delete(`note-${i}`));
  }, [annotations, chapterId, locale, revision, edition]);
  useEffect(() => {
    if (!auto || speech.playing) return;
    let frame = 0,
      last = 0,
      travel = 0;
    const run = (now: number) => {
      if (last) {
        const delta = ((now - last) / 1000) * settings.scrollSpeed;
        travel += delta;
        if (paged) {
          if (travel >= 180) {
            travel = 0;
            setPage((p) => Math.min(p + 1, pages - 1));
            if (pageRef.current >= pages - 1) setAuto(false);
          }
        } else if (scrollRef.current) {
          if (travel >= 1) {
            const pixels = Math.floor(travel);
            scrollRef.current.scrollTop += pixels;
            travel -= pixels;
          }
          if (
            scrollRef.current.scrollTop + scrollRef.current.clientHeight >=
            scrollRef.current.scrollHeight - 1
          )
            setAuto(false);
        }
      }
      last = now;
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [auto, paged, pages, settings.scrollSpeed, speech.playing]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true],dialog",
        )
      )
        return;
      if (e.key === "Escape") {
        closePanel();
        setSelection(null);
        setActiveImage(null);
        setSidebar(false);
      }
      if (e.key === "ArrowRight" && paged) {
        e.preventDefault();
        setPage((p) => Math.min(p + 1, pages - 1));
      }
      if (e.key === "ArrowLeft" && paged) {
        e.preventDefault();
        setPage((p) => Math.max(p - 1, 0));
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [paged, pages, closePanel]);
  function onScroll() {
    const node = scrollRef.current;
    if (!node || paged || !restored.current || !edition) return;
    const r =
      node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight);
    ratioRef.current = r;
    if (Math.round(ratio * 100) !== Math.round(r * 100)) setRatio(r);
    progressSaver.schedule({ chapterId, ratio: r, page: 0, revision });
  }
  function updateSettings(value: ReaderSettings) {
    if (value.mode !== settings.mode) {
      setPage(Math.round(ratioRef.current * Math.max(0, pages - 1)));
      speech.stop();
    }
    setSettings(normalizeSettings(value));
  }
  function togglePanel(value: typeof panel) {
    if (value === "voice") speech.refreshVoices();
    setPanel(panel === value ? null : value);
    setSelection(null);
  }
  function go(id: string) {
    if (id === chapterId || !book.chapters.some((c) => c.id === id)) return;
    void progressSaver.flush().catch(() => {});
    speech.stop();
    if (mobile) setSidebar(false);
    restored.current = false;
    setReady(false);
    // The published locale is already loaded; changing chapters needs no server round trip.
    window.history.pushState(null, "", `/${locale}/read/${id}`);
  }
  function onChapterClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    go(id);
  }
  async function addNote(
    colorValue: string,
    image?: { src: string; alt: string },
  ) {
    const anchor =
      selection ??
      (() => {
        const text = contentRef.current?.textContent ?? "";
        return {
          start: 0,
          end: Math.min(180, text.length),
          text: text.slice(0, 180),
        };
      })();
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      chapterId,
      locale,
      revision,
      start: image ? 0 : anchor.start,
      end: image ? 0 : anchor.end,
      text: image ? image.alt : anchor.text,
      image: image?.src,
      color: colorValue,
      note,
      createdAt: Date.now(),
    };
    try {
      await saveAnnotation(annotation);
      setAnnotations(await readAnnotations());
      setSelection(null);
      setActiveImage(null);
      setNote("");
      window.getSelection()?.removeAllRanges();
      notify(
        L("Đã lưu đánh dấu trên thiết bị.", "Bookmark saved on this device."),
      );
    } catch {
      notify(L("Không lưu được đánh dấu.", "Unable to save this bookmark."));
    }
  }
  async function removeNote(id: string) {
    try {
      await deleteAnnotation(id);
      setAnnotations(await readAnnotations());
    } catch {
      notify(L("Không xóa được ghi chú.", "Unable to delete this note."));
    }
  }
  function openNote(annotation: Annotation) {
    if (annotation.chapterId !== chapterId) {
      go(annotation.chapterId);
      return;
    }
    if (annotation.revision !== revision) {
      notify(
        L(
          "Ghi chú thuộc phiên bản cũ; vị trí không được tự gắn lại.",
          "This note belongs to an older edition and has not been reattached.",
        ),
      );
      return;
    }
    const root = contentRef.current;
    if (!root) return;
    if (annotation.image) {
      root.querySelectorAll("img").forEach((img) => {
        if (img.getAttribute("src") === annotation.image)
          img.scrollIntoView({ block: "center" });
      });
      return;
    }
    const offsets = resolveAnchor(annotation, revision, root.textContent ?? "");
    if (!offsets) return;
    const range = rangeFromOffsets(root, ...offsets);
    if (range) {
      if (paged) {
        const rect = range.getBoundingClientRect();
        const left = windowRef.current?.getBoundingClientRect().left ?? 0;
        setPage((p) =>
          Math.max(
            0,
            Math.min(
              pages - 1,
              p + Math.floor((rect.left - left) / (viewportWidth + 48)),
            ),
          ),
        );
      } else
        range.startContainer.parentElement?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(L("Đã sao chép.", "Copied."));
    } catch {
      notify(
        L(
          "Không sao chép được. Hãy dùng Ctrl+C.",
          "Copy failed. Please use Ctrl+C.",
        ),
      );
    }
  }
  async function downloadQuote() {
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx) return;
    await document.fonts.ready;
    canvas.width = 1080;
    canvas.height = 1350;
    ctx.fillStyle = "#f5f0e5";
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = "#8d342b";
    ctx.fillRect(80, 90, 920, 2);
    ctx.fillStyle = "#302b23";
    ctx.font = '34px "Literata Variable",Georgia,serif';
    const words = quote.slice(0, 1600).split(/\s+/);
    let line = "",
      y = 190;
    for (const word of words) {
      if (ctx.measureText(line + word).width > 900) {
        ctx.fillText(line, 90, y);
        line = "";
        y += 56;
        if (y > 1110) {
          ctx.fillText("…", 90, y);
          break;
        }
      }
      line += word + " ";
    }
    if (y <= 1110) ctx.fillText(line, 90, y);
    ctx.fillStyle = "#8d342b";
    ctx.font = '25px "Be Vietnam Pro",sans-serif';
    ctx.fillText(book.author, 90, 1220);
    ctx.font = '23px "Literata Variable",serif';
    ctx.fillText(book.meta[locale].title, 90, 1270);
    const a = document.createElement("a");
    a.download = `truyen-ky-man-luc-${chapterId}-quote.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }
  const filteredNotes = useMemo(
    () =>
      annotations.filter(
        (a) =>
          a.locale === locale &&
          (!currentOnly || a.chapterId === chapterId) &&
          (kind === "all" || (kind === "image" ? !!a.image : !a.image)) &&
          (!color || a.color === color) &&
          `${a.text} ${a.note}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [annotations, locale, chapterId, currentOnly, kind, color, query],
  );
  const fontFamily =
    readerFonts.find((font) => font.value === settings.font)?.family ??
    readerFonts[0].family;
  return (
    <div
      className={`reader-shell ${sidebar === null ? "sidebar-auto" : sidebar ? "sidebar-open" : ""} ${settings.theme === "eink" ? "eink" : ""}`}
      style={style}
      data-ready={ready}
      aria-busy={!ready}
    >
      <style>
        {annotationColors
          .map(
            (c, i) =>
              `::highlight(note-${i}){background-color:${c};color:#27231d;}`,
          )
          .join("")}
      </style>
      <header className="reader-topbar">
        <div className="reader-location">
          <IconButton
            icon={Menu}
            label={L("Mở mục lục", "Open contents")}
            active={!!sidebar}
            disabled={!ready}
            onClick={() => setSidebar(!sidebar)}
          />
          <span>
            {edition?.title ??
              L("Phần chưa có bản dịch", "Translation unavailable")}
          </span>
        </div>
        <div className="reader-toolbar toolbar">
          <IconButton
            icon={ChevronLeft}
            label={L("Chương trước", "Previous chapter")}
            disabled={!previous}
            onClick={() => previous && go(previous.id)}
          />
          <IconButton
            icon={ChevronRight}
            label={L("Chương sau", "Next chapter")}
            disabled={!next}
            onClick={() => next && go(next.id)}
          />
          <span className="toolbar-divider" />
          <IconButton
            icon={BookmarkPlus}
            label={L("Đánh dấu chương", "Bookmark chapter")}
            disabled={!edition}
            onClick={() => {
              setNote("");
              addNote(annotationColors[0]);
            }}
          />
          <IconButton
            icon={speech.playing ? Square : Play}
            label={
              speech.playing
                ? L("Dừng đọc", "Stop reading")
                : L("Đọc giọng nói", "Read aloud")
            }
            disabled={!edition}
            active={speech.playing}
            onClick={() => {
              setAuto(false);
              speech.playing
                ? speech.stop()
                : speech.speak(isPdf ? pdfText : undefined);
            }}
          />
          <IconButton
            icon={Volume2}
            label={L("Giọng đọc & tốc độ", "Voice & speed")}
            active={panel === "voice"}
            onClick={() => togglePanel("voice")}
          />
          <IconButton
            icon={ArrowDown}
            label={L("Tự cuộn", "Auto-scroll")}
            active={auto || panel === "scroll"}
            onClick={() => togglePanel("scroll")}
          />
          <IconButton
            icon={Headphones}
            label={L("Âm thanh môi trường", "Ambient sounds")}
            active={panel === "sound"}
            onClick={() => togglePanel("sound")}
          />
          <LanguageLinks locale={locale} chapterId={chapterId} />
          <IconButton
            icon={fullscreen ? Minimize : Maximize}
            label={L("Toàn màn hình", "Fullscreen")}
            onClick={async () => {
              try {
                document.fullscreenElement
                  ? await document.exitFullscreen()
                  : await document.documentElement.requestFullscreen();
              } catch {
                notify(
                  L(
                    "Trình duyệt này không hỗ trợ toàn màn hình.",
                    "Fullscreen is unavailable in this browser.",
                  ),
                );
              }
            }}
          />
          <IconButton
            icon={Settings}
            label={L("Cài đặt trình đọc", "Reader settings")}
            active={panel === "settings"}
            onClick={() => togglePanel("settings")}
          />
        </div>
      </header>
      {sidebar && (
        <button
          className="sidebar-backdrop"
          aria-label={L("Đóng mục lục", "Close contents")}
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        className="reader-sidebar"
        aria-label={L("Mục lục và ghi chú", "Contents and notes")}
      >
        <div className="sidebar-book">
          <img src={book.meta[locale].frontCover} alt="" />
          <div>
            <Link href={`/${locale}`}>{book.meta[locale].title}</Link>
            <p>{book.author}</p>
            <span>
              {book.chapters.filter((c) => c.id.startsWith("chapter-")).length}{" "}
              {L("câu chuyện", "tales")}
            </span>
          </div>
          <IconButton
            icon={X}
            label={L("Đóng mục lục", "Close contents")}
            onClick={() => setSidebar(false)}
          />
        </div>
        <div className="sidebar-tools">
          <div className="segmented">
            <button
              className={tab === "contents" ? "selected" : ""}
              onClick={() => {
                setTab("contents");
                setQuery("");
              }}
            >
              <BookOpen size={15} />
              {L("Mục lục", "Contents")}
            </button>
            <button
              className={tab === "notes" ? "selected" : ""}
              onClick={() => {
                setTab("notes");
                setQuery("");
              }}
            >
              <Bookmark size={15} />
              {L("Đánh dấu", "Bookmarks")}
            </button>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label={
                tab === "contents"
                  ? L("Tìm chương", "Find a chapter")
                  : L("Tìm đánh dấu, ghi chú", "Search bookmarks and notes")
              }
              placeholder={
                tab === "contents"
                  ? L("Tìm chương…", "Find a chapter…")
                  : L("Tìm đánh dấu, ghi chú…", "Search bookmarks and notes…")
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="sidebar-list">
          {tab === "contents" ? (
            <ol>
              {book.chapters
                .filter((c) =>
                  (c[locale]?.title ?? missingChapterTitle(c.id, locale))
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/${locale}/read/${c.id}`}
                      aria-current={c.id === chapterId ? "page" : undefined}
                      onClick={(event) => onChapterClick(event, c.id)}
                    >
                      <span className="chapter-number">
                        {c.id === "preface"
                          ? "—"
                          : String(
                              book.chapters
                                .filter((b) => b.id !== "preface")
                                .findIndex((b) => b.id === c.id) + 1,
                            ).padStart(2, "0")}
                      </span>
                      <span>
                        {c[locale]?.title ?? missingChapterTitle(c.id, locale)}
                      </span>
                      {c.id === chapterId && <BookOpen size={14} />}
                    </a>
                  </li>
                ))}
            </ol>
          ) : (
            <>
              <div className="notes-filters">
                <div className="segmented">
                  {[
                    ["all", L("Tất cả", "All")],
                    ["text", L("Văn bản", "Text")],
                    ["image", L("Hình ảnh", "Images")],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={kind === id ? "selected" : ""}
                      onClick={() => setKind(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="color-options">
                  <button
                    aria-label={L("Mọi màu", "All colors")}
                    className={!color ? "chosen" : ""}
                    onClick={() => setColor("")}
                  >
                    ×
                  </button>
                  {annotationColors.map((c) => (
                    <button
                      key={c}
                      aria-label={c}
                      style={{ background: c }}
                      className={color === c ? "chosen" : ""}
                      onClick={() => setColor(color === c ? "" : c)}
                    />
                  ))}
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={currentOnly}
                    onChange={(e) => setCurrentOnly(e.target.checked)}
                  />
                  {L("Chỉ chương đang đọc", "Current chapter only")}
                </label>
              </div>
              {!filteredNotes.length ? (
                <div className="empty-notes">
                  <Bookmark size={30} />
                  <p>
                    {L(
                      "Chưa có đánh dấu phù hợp.",
                      "No matching bookmarks yet.",
                    )}
                  </p>
                  <span>
                    {L(
                      "Bôi đen một đoạn hoặc chọn ảnh để ghi chú.",
                      "Select a passage or an image to add a note.",
                    )}
                  </span>
                </div>
              ) : (
                filteredNotes.map((a) => (
                  <div key={a.id} className="annotation">
                    <button
                      className="annotation-content"
                      onClick={() => openNote(a)}
                      style={{ backgroundColor: a.color, color: "#27231d" }}
                    >
                      {a.image ? (
                        <img src={a.image} alt={a.text} />
                      ) : (
                        <q>{a.text.slice(0, 200)}</q>
                      )}
                      {a.note && <p>{a.note}</p>}
                      <small>
                        {
                          book.chapters.find((c) => c.id === a.chapterId)?.[
                            locale
                          ]?.title
                        }
                      </small>
                      {a.revision !==
                        book.chapters.find((c) => c.id === a.chapterId)?.[
                          locale
                        ]?.revision && (
                        <small>
                          {L(
                            "Phiên bản cũ · giữ nguyên ghi chú",
                            "Older edition · note preserved",
                          )}
                        </small>
                      )}
                    </button>
                    <IconButton
                      icon={Trash2}
                      label={L("Xóa đánh dấu", "Delete bookmark")}
                      onClick={() => removeNote(a.id)}
                    />
                  </div>
                ))
              )}
            </>
          )}
        </div>
        <Link className="sidebar-footer" href={`/${locale}`}>
          <ChevronLeft size={16} />
          {L("Chi tiết sách", "Book details")}
          <BookOpen size={16} />
        </Link>
      </aside>
      <main className="reader-main">
        <div
          className={`reading-scroll ${paged ? "is-paged" : ""}`}
          ref={scrollRef}
          onScroll={onScroll}
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest("a,img"))
              setActiveImage(null);
          }}
        >
          <div
            className="reader-document"
            style={{
              maxWidth: double
                ? Math.min(settings.width * 1.6, 1280)
                : settings.width,
            }}
          >
            {edition ? (
              <>
                <h1 className="chapter-title">{edition.title}</h1>
                <div
                  ref={windowRef}
                  className={`reading-window ${paged ? "paged" : ""}`}
                >
                  <article
                    ref={contentRef}
                    className={`prose ${paged ? "paginated" : ""}`}
                    style={{
                      fontFamily,
                      fontSize: settings.fontSize,
                      lineHeight: settings.lineHeight,
                      textAlign:
                        settings.align === "original"
                          ? undefined
                          : (settings.align as CSSProperties["textAlign"]),
                      columnCount: paged ? (double ? 2 : 1) : undefined,
                      transform: paged
                        ? `translateX(-${page * (viewportWidth + 48)}px)`
                        : undefined,
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "IMG") {
                        setActiveImage({
                          src: target.getAttribute("src")!,
                          alt: target.getAttribute("alt") ?? "",
                        });
                        setSelection(null);
                        setNote("");
                      }
                    }}
                  >
                    {isPdf ? (
                      <PdfViewer
                        key={chapterId}
                        src={`/api/assets/${edition.pdfPath}`}
                        locale={locale}
                        onText={onPdfText}
                      />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: edition.html }} />
                    )}
                  </article>
                </div>
                {!paged && (
                  <div className="chapter-end">
                    <span aria-hidden="true">· · ·</span>
                    <div>
                      {previous && (
                        <a
                          href={`/${locale}/read/${previous.id}`}
                          onClick={(event) =>
                            onChapterClick(event, previous.id)
                          }
                        >
                          <ChevronLeft size={16} />
                          {L("Chương trước", "Previous chapter")}
                        </a>
                      )}
                      {next && (
                        <a
                          href={`/${locale}/read/${next.id}`}
                          onClick={(event) => onChapterClick(event, next.id)}
                        >
                          {L("Chương tiếp", "Next chapter")}
                          <ChevronRight size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="missing-translation">
                <BookOpen size={40} />
                <h1>
                  {L("Chưa có bản tiếng Việt", "Translation forthcoming")}
                </h1>
                <p>
                  {L(
                    "Phần này chưa có bản tiếng Việt.",
                    "This section is not available in English yet.",
                  )}
                </p>
                <Link
                  className="primary-button"
                  href={`/${locale === "vi" ? "en" : "vi"}/read/${chapterId}`}
                >
                  {L("Đọc bằng tiếng Anh", "Read in Vietnamese")}
                  <ArrowRightIcon />
                </Link>
              </div>
            )}
          </div>
        </div>
        <footer className="reading-progress">
          <span>{book.meta[locale].title}</span>
          {paged ? (
            <div className="page-controls">
              <IconButton
                icon={ChevronLeft}
                label={L("Trang trước", "Previous page")}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />
              <span>
                {page + 1} / {pages}
              </span>
              <IconButton
                icon={ChevronRight}
                label={L("Trang sau", "Next page")}
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              />
            </div>
          ) : (
            <span>{Math.round(ratio * 100)}%</span>
          )}
          <div className="progress-track">
            <i style={{ width: `${ratio * 100}%` }} />
          </div>
        </footer>
      </main>
      {panel === "settings" && (
        <ReaderSettingsPanel
          locale={locale}
          settings={settings}
          setSettings={updateSettings}
          onClose={closePanel}
          isPdf={!!isPdf}
        />
      )}
      {panel === "voice" && (
        <Panel
          title={L("Giọng đọc & tốc độ", "Voice & speed")}
          onClose={closePanel}
          closeLabel={L("Đóng", "Close")}
        >
          <p className="muted">
            {L(
              "Giọng đọc do trình duyệt và thiết bị cung cấp.",
              "Voices are supplied by your browser and device.",
            )}
          </p>
          {!speech.supported && (
            <p role="status">
              {L(
                "Trình duyệt này chưa hỗ trợ đọc giọng nói.",
                "Speech synthesis is unavailable in this browser.",
              )}
            </p>
          )}
          {speech.supported && (
            <>
              <p className="tiny muted" role="status">
                {availableVoices.length === 0
                  ? L(
                      "Trình duyệt chưa liệt kê giọng đọc tiếng Việt. Bạn vẫn có thể thử chế độ tự động.",
                      "The browser has not listed an English voice. You can still try automatic speech.",
                    )
                  : L(
                      `${availableVoices.length} giọng đọc tiếng Việt trên thiết bị.`,
                      `${availableVoices.length} ${availableVoices.length === 1 ? "voice" : "voices"} available for English.`,
                    )}
              </p>
              <button
                className="secondary-button"
                onClick={() => {
                  setVoiceQuery("");
                  speech.refreshVoices();
                }}
              >
                {L("Làm mới giọng đọc", "Refresh voices")}
              </button>
              {availableVoices.length <= 1 && (
                <details className="voice-help">
                  <summary>
                    {L("Cài giọng trên Android", "More voices on Android")}
                  </summary>
                  <p>
                    {L(
                      "Trong Cài đặt điện thoại, tìm “Chuyển văn bản thành giọng nói”, chọn công cụ và cài dữ liệu tiếng Việt hoặc tiếng Anh. Sau đó quay lại đây và bấm Làm mới giọng đọc. Tên mục có thể khác tùy máy.",
                      "In your phone settings, search for “Text-to-speech”, choose an engine and install Vietnamese or English voice data. Return here and refresh the voices. Setting names vary by device.",
                    )}
                  </p>
                  <p>
                    {L(
                      "Web chỉ dùng được những giọng trình duyệt cung cấp; cài thêm dữ liệu không bảo đảm trình duyệt sẽ liệt kê thêm lựa chọn.",
                      "This website can only use voices exposed by the browser; installing voice data may not add selectable browser voices.",
                    )}
                  </p>
                  <a
                    href={`https://support.google.com/accessibility/android/answer/6006983?hl=${locale}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {L(
                      "Hướng dẫn cài giọng trên Android",
                      "Android voice setup guide",
                    )}
                  </a>
                </details>
              )}
            </>
          )}
          {availableVoices.length > 1 && (
            <label className="search-field">
              <Search size={15} />
              <input
                aria-label={L("Tìm giọng đọc", "Search voices")}
                placeholder={L(
                  "Tìm giọng hoặc ngôn ngữ…",
                  "Find a voice or language…",
                )}
                value={voiceQuery}
                onChange={(e) => setVoiceQuery(e.target.value)}
              />
            </label>
          )}
          <label className="field-group">
            {L("Chọn giọng đọc", "Choose voice")}
            <select
              aria-label={L("Chọn giọng đọc", "Choose voice")}
              value={
                availableVoices.some((v) => v.name === settings.voice)
                  ? settings.voice
                  : ""
              }
              onChange={(e) => {
                speech.stop();
                updateSettings({ ...settings, voice: e.target.value });
              }}
            >
              <option value="">
                {L("Tự động theo VI / EN", "Automatic for VI / EN")}
              </option>
              {availableVoices
                .filter(
                  (v) =>
                    availableVoices.length <= 1 ||
                    `${v.name} ${v.lang}`
                      .toLowerCase()
                      .includes(voiceQuery.toLowerCase()),
                )
                .map((v) => (
                  <option
                    key={`${v.voiceURI}:${v.lang}:${v.name}`}
                    value={v.name}
                  >
                    {v.name} · {v.lang}
                  </option>
                ))}
            </select>
          </label>
          <label className="field-group range-label">
            {L("Tốc độ đọc", "Reading speed")}
            <output>{settings.rate.toFixed(1)}×</output>
            <input
              aria-label={L("Tốc độ đọc", "Reading speed")}
              type="range"
              min=".5"
              max="2"
              step=".1"
              value={settings.rate}
              onChange={(e) => {
                speech.stop();
                updateSettings({ ...settings, rate: +e.target.value });
              }}
            />
          </label>
          <button
            className="primary-button full-width"
            disabled={!speech.supported || !edition}
            onClick={() =>
              speech.playing
                ? speech.stop()
                : speech.speak(isPdf ? pdfText : undefined)
            }
          >
            {speech.playing ? <Square size={16} /> : <Play size={16} />}{" "}
            {speech.playing
              ? L("Dừng đọc", "Stop reading")
              : L("Đọc chương này", "Read this chapter")}
          </button>
        </Panel>
      )}
      {panel === "scroll" && (
        <Panel
          title={L("Tự cuộn", "Auto-scroll")}
          onClose={closePanel}
          closeLabel={L("Đóng", "Close")}
        >
          <label className="field-group range-label">
            {L("Tốc độ cuộn", "Scroll speed")}
            <output>{settings.scrollSpeed}</output>
            <input
              type="range"
              min="8"
              max="100"
              value={settings.scrollSpeed}
              onChange={(e) =>
                updateSettings({ ...settings, scrollSpeed: +e.target.value })
              }
            />
          </label>
          <button
            className="primary-button full-width"
            onClick={() => {
              speech.stop();
              setAuto(!auto);
            }}
          >
            {auto ? <Square size={16} /> : <Play size={16} />}{" "}
            {auto
              ? L("Dừng tự cuộn", "Stop auto-scroll")
              : L("Bắt đầu tự cuộn", "Start auto-scroll")}
          </button>
        </Panel>
      )}
      <Soundscape
        open={panel === "sound"}
        onClose={closePanel}
        locale={locale}
      />
      {selection && (
        <div
          className="selection-toolbar"
          style={{ left: selection.left, top: selection.top }}
          role="region"
          aria-label={L("Thao tác với đoạn chọn", "Selection actions")}
        >
          <div className="selection-summary">
            <q>{selection.text.slice(0, 90)}</q>
            <IconButton
              icon={X}
              label={L("Đóng", "Close")}
              onClick={() => {
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
            />
          </div>
          <div className="selection-actions">
            <button onClick={() => speech.speak(selection.text)}>
              <Volume2 size={15} />
              {L("Đọc đoạn chọn", "Read selection")}
            </button>
            <button
              onClick={() =>
                speech.speak(
                  (contentRef.current?.textContent ?? "").slice(
                    selection.start,
                  ),
                )
              }
            >
              <Play size={15} />
              {L("Đọc từ đây", "Read from here")}
            </button>
            <button onClick={() => copy(selection.text)}>
              <Copy size={15} />
              {L("Sao chép", "Copy")}
            </button>
            <a
              href={translationUrl(selection.text, locale)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Languages size={15} />
              {L("Dịch nghĩa", "Translate")}
            </a>
            <button onClick={() => setQuote(selection.text)}>
              <Quote size={15} />
              {L("Trích dẫn", "Quote")}
            </button>
          </div>
          <label className="note-field">
            <Highlighter size={15} />
            <input
              aria-label={L("Ghi chú cho đoạn chọn", "Note for this passage")}
              placeholder={L("Thêm ghi chú…", "Add a note…")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="color-options">
            {annotationColors.map((c) => (
              <button
                key={c}
                aria-label={`${L("Đánh dấu", "Highlight")} ${c}`}
                style={{ background: c }}
                onClick={() => addNote(c)}
              />
            ))}
          </div>
        </div>
      )}
      {activeImage && (
        <div className="image-toolbar">
          <ImageIcon size={18} />
          <button onClick={() => setImageOpen(true)}>
            <Maximize size={16} />
            {L("Xem ảnh", "View image")}
          </button>
          <button onClick={() => addNote(annotationColors[0], activeImage)}>
            <BookmarkPlus size={16} />
            {L("Đánh dấu ảnh", "Bookmark image")}
          </button>
          <input
            aria-label={L("Ghi chú ảnh", "Image note")}
            placeholder={L("Ghi chú…", "Note…")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <IconButton
            icon={X}
            label={L("Đóng", "Close")}
            onClick={() => setActiveImage(null)}
          />
        </div>
      )}
      <dialog
        className="quote-dialog"
        ref={quoteDialog}
        onClose={() => setQuote("")}
      >
        <div className="dialog-heading">
          <h2>{L("Trích dẫn", "Quote")}</h2>
          <IconButton
            icon={X}
            label={L("Đóng", "Close")}
            onClick={() => quoteDialog.current?.close()}
          />
        </div>
        <blockquote>{quote}</blockquote>
        <p>
          {book.author} · {book.meta[locale].title}
        </p>
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() =>
              copy(`“${quote}”\n— ${book.author}, ${edition?.title}`)
            }
          >
            <Copy size={16} />
            {L("Sao chép trích dẫn", "Copy quote")}
          </button>
          <button className="primary-button" onClick={downloadQuote}>
            <Download size={16} />
            {L("Tải ảnh trích dẫn", "Download quote image")}
          </button>
        </div>
        {quote.length > 1600 && (
          <p className="tiny muted">
            {L(
              "Ảnh dùng tối đa 1.600 ký tự đầu; sao chép giữ toàn bộ đoạn chọn.",
              "Images use up to the first 1,600 characters; copying keeps the entire selection.",
            )}
          </p>
        )}
      </dialog>
      <dialog
        className="image-dialog"
        ref={imageDialog}
        onClose={() => setImageOpen(false)}
      >
        <IconButton
          icon={X}
          label={L("Đóng", "Close")}
          onClick={() => imageDialog.current?.close()}
        />
        {activeImage && <img src={activeImage.src} alt={activeImage.alt} />}
      </dialog>
      {message && (
        <div className="toast" role="status">
          {message}
          <button
            aria-label={L("Đóng thông báo", "Dismiss notification")}
            onClick={() => setMessage("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function ArrowRightIcon() {
  return <ExternalLink size={16} />;
}
