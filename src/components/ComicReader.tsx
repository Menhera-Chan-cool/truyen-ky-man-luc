"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Home,
  List,
  Settings,
  Maximize,
  Minimize,
  Play,
  Pause,
  HelpCircle,
  Pencil,
  Minus,
  Plus,
  X,
  LoaderCircle,
  FileImage,
  MoreHorizontal,
} from "lucide-react";
import { IconButton, LanguageLinks } from "./Ui";
import {preloadComicImages} from "../lib/comic-preload";
import {
  ComicModal,
  ComicSettingsDialog,
  ComicChaptersDialog,
} from "./ComicDialogs";
import {
  defaultComicSettings,
  normalizeComicSettings,
  sampleComic,
  type ComicPage,
  type ComicDraft,
  type ComicSettings,
} from "../lib/comic";
import {
  readComicDraft,
  comicPreference,
  saveComicPreference,
  useComicUrls,
  localComicSummaries,
  type ComicSummary,
} from "../lib/comic-db";
export type ComicBookIndex = {
  title: string;
  author: string;
  chapters: { id: string; title: string }[];
};
type Position = { pageId: string; ratio: number };
function ComicImage({
  page,
  index,
  src,
  width,
  filter,
  locale,
  eager,
  onClick,
}: {
  page: ComicPage;
  index: number;
  src?: string;
  width: number;
  filter: string;
  locale: "vi" | "en";
  eager: boolean;
  onClick: (e: MouseEvent<HTMLImageElement>) => void;
}) {
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => setError(false), [src]);
  if (error)
    return (
      <div className="cc-image-error" style={{ width }} role="alert">
        <FileImage size={28} />
        <p>
          {locale === "vi" ? "Không tải được trang" : "Unable to load page"}{" "}
          {index + 1}.
        </p>
        <button
          onClick={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        >
          {locale === "vi" ? "Thử lại" : "Retry"}
        </button>
      </div>
    );
  if (!src)
    return (
      <div
        className="cc-image-loading"
        style={{ width, height: (width * page.height) / page.width }}
      >
        <LoaderCircle className="cc-spin" />
      </div>
    );
  return (
    <img
      key={src + attempt}
      src={src}
      alt={`${locale === "vi" ? "Trang" : "Page"} ${index + 1}`}
      width={page.width}
      height={page.height}
      style={{ width, height: "auto", filter }}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setError(true)}
      onClick={onClick}
    />
  );
}
const PREFS = "settings:comix-v2";
export default function ComicReader({
  book,
  locale,
  chapterId,
  shared,
  preview=false,
}: {
  book: ComicBookIndex;
  locale: "vi" | "en";
  chapterId: string;
  shared?: {edition:ComicDraft|null;summaries:ComicSummary[]};
  preview?:boolean;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    at = book.chapters.findIndex((c) => c.id === chapterId),
    title = book.chapters[at].title;
  const [draft, setDraft] = useState<ComicDraft>(),
    [prefs, setPrefs] = useState(defaultComicSettings),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [page, setPage] = useState(0),
    [panel, setPanel] = useState<"settings" | "chapters" | "help" | null>(null),
    [chrome, setChrome] = useState(true),
    [auto, setAuto] = useState(false),
    [ratio, setRatio] = useState(0),
    [summaries, setSummaries] = useState<ComicSummary[]>([]),
    [message, setMessage] = useState(""),
    [size, setSize] = useState({ width: 1440, height: 900 }),
    [full, setFull] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    figures = useRef(new Map<number, HTMLElement>()),
    current = useRef(0),
    restored = useRef(false),
    initial = useRef<Position | undefined>(undefined),
    prefsRef = useRef(prefs),
    panelRef = useRef(panel),
    chromeRef = useRef(true),
    autoRef = useRef(false),
    saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    activity = useRef(0),
    scrollFrame = useRef(0),
    pendingLayout = useRef(0),
    gesture = useRef<{ id: number; x: number; y: number; time: number } | null>(
      null,
    ),
    ignoreClick = useRef(0);
  const pages = draft?.pages ?? [],
    urls = useComicUrls(pages);
  current.current = page;
  prefsRef.current = prefs;
  panelRef.current = panel;
  const stopAuto = useCallback(() => {
    autoRef.current = false;
    setAuto(false);
  }, []);
  const wake = useCallback(() => {
    const generation = ++activity.current;
    chromeRef.current = true;
    setChrome(true);
    clearTimeout(idle.current);
    if (document.hidden) return;
    idle.current = setTimeout(() => {
      if (generation !== activity.current) return;
      if (
        panelRef.current ||
        root.current?.querySelector(
          '.cc-chrome:hover,.cc-chrome :focus-visible,[data-edition-open="true"]',
        )
      )
        return;
      chromeRef.current = false;
      setChrome(false);
    }, 3000);
  }, []);
  useEffect(() => {
    let active = true;
    restored.current = false;
    setReady(false);
    setError("");
    Promise.all([
      shared ? Promise.resolve(shared.edition) : readComicDraft(chapterId,locale),
      comicPreference<ComicSettings>(PREFS).catch(()=>undefined),
      comicPreference<Position>(`position:${locale}:${chapterId}`).then(p=>p??(locale==="vi"?comicPreference<Position>("position:"+chapterId):undefined)).catch(()=>undefined),
      shared ? Promise.resolve(shared.summaries) : localComicSummaries(locale),
    ])
      .then(([stored, settings, position, local]) => {
        if (!active) return;
        const d = stored ?? (shared||locale==="en"?{...sampleComic(chapterId,title),pages:[]}:sampleComic(chapterId, title)),
          p = normalizeComicSettings(
            settings ?? {
              ...defaultComicSettings,
              zoom: innerWidth < 760 ? 100 : 50,
              direction: d.direction,
            },
          );
        setDraft(d);
        prefsRef.current = p;
        setPrefs(p);
        initial.current = position;
        setPage(
          Math.max(
            0,
            d.pages.findIndex((p) => p.id === position?.pageId),
          ),
        );
        setSummaries(
          book.chapters.map(
            (c) =>
              local.find((v) => v.id === c.id) ?? {
                id: c.id,
                title: c.title,
                pages: !shared&&locale==="vi"&&c.id === "chapter-1" ? 2 : 0,
                updatedAt: 0,
                source: !shared&&locale==="vi"&&c.id === "chapter-1" ? "sample" : "missing",
              },
          ),
        );
        setReady(true);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setReady(true);
        }
      });
    return () => {
      active = false;
      clearTimeout(saveTimer.current);
      clearTimeout(idle.current);
      cancelAnimationFrame(scrollFrame.current);
      cancelAnimationFrame(pendingLayout.current);
    };
  }, [chapterId, title, book, retry,shared,locale]);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const capture = useCallback((): Position | undefined => {
    const p = pages[current.current],
      el = figures.current.get(current.current),
      s = stage.current;
    if (!p) return;
    return {
      pageId: p.id,
      ratio:
        el && s
          ? Math.max(
              0,
              Math.min(
                1,
                (s.getBoundingClientRect().top -
                  el.getBoundingClientRect().top) /
                  Math.max(1, el.getBoundingClientRect().height),
              ),
            )
          : 0,
    };
  }, [pages]);
  const persist = useCallback(() => {
    if (!restored.current) return;
    const p = capture();
    if (p)
      void saveComicPreference(`position:${locale}:${chapterId}`, p).catch(() =>
        setMessage(
          L(
            "Chưa lưu được vị trí đọc trên máy. Hãy thử tải lại.",
            "Reading position could not be saved. Try reloading.",
          ),
        ),
      );
  }, [capture, chapterId,locale]);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  function place(position: Position | undefined) {
    const s = stage.current;
    if (!s) return;
    const n = position
      ? pages.findIndex((p) => p.id === position.pageId)
      : current.current;
    const el = figures.current.get(Math.max(0, n));
    if (el)
      s.scrollTop +=
        el.getBoundingClientRect().top -
        s.getBoundingClientRect().top +
        (position?.ratio ?? 0) * el.getBoundingClientRect().height;
  }
  useLayoutEffect(() => {
    if (!ready || !draft || restored.current) return;
    const id = requestAnimationFrame(() => {
      place(initial.current);
      restored.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [ready, draft, prefs.mode, size.width]);
  useEffect(() => {
    if (!ready || prefs.mode !== "vertical") return;
    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.index);
          if (e.isIntersecting) visible.set(n, e.intersectionRect.height);
          else visible.delete(n);
        }
        if (restored.current && visible.size)
          setPage([...visible].sort((a, b) => b[1] - a[1])[0][0]);
      },
      { root: stage.current, rootMargin: "-15% 0px -55% 0px", threshold: 0 },
    );
    for (const f of figures.current.values()) observer.observe(f);
    return () => observer.disconnect();
  }, [ready, pages, prefs.mode, prefs.zoom, prefs.stretch, prefs.gap]);
  useEffect(() => {
    if (ready) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(persist, 200);
    }
  }, [ready, page, persist]);
  useEffect(() => {
    const visible = () => {
      if (document.hidden) {
        stopAuto();
        persistRef.current();
        clearTimeout(idle.current);
      } else wake();
    };
    const blur = () => {
      stopAuto();
      persistRef.current();
      clearTimeout(idle.current);
    };
    const resume = () => wake();
    const full = () => setFull(!!document.fullscreenElement);
    document.addEventListener("visibilitychange", visible);
    document.addEventListener("freeze", blur);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", resume);
    window.addEventListener("pagehide", blur);
    window.addEventListener("pageshow", resume);
    document.addEventListener("fullscreenchange", full);
    wake();
    return () => {
      persistRef.current();
      document.removeEventListener("visibilitychange", visible);
      document.removeEventListener("freeze", blur);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pagehide", blur);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("fullscreenchange", full);
      clearTimeout(idle.current);
    };
  }, [stopAuto, wake]);
  useEffect(() => {
    wake();
  }, [panel, wake]);
  useEffect(() => {
    if (!auto || prefs.mode !== "vertical" || panel) return;
    let frame = 0,
      last: number | undefined,
      desiredTop = stage.current?.scrollTop ?? 0;
    const step = (now: number) => {
      if (!autoRef.current || document.hidden) return;
      const el = stage.current;
      if (!el) return;
      if (last !== undefined) {
        const elapsed = now - last;
        if (elapsed > 250) {
          stopAuto();
          return;
        }
        desiredTop += (prefs.autoSpeed * elapsed) / 1000;
        el.scrollTop = desiredTop;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          stopAuto();
          return;
        }
      }
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [auto, prefs.autoSpeed, prefs.mode, panel, stopAuto]);
  useEffect(() => {
    if (!ready || !pages.length) return;
    const indices =
        prefs.preload === "all" ? pages.map((_, n) => n) : [page + 1, page + 2];
    const queue = indices
      .map((n) => pages[n])
      .filter(Boolean)
      .map((p) => urls[p.id] ?? p.path)
      .filter((u): u is string => !!u && !u.startsWith("blob:"));
    return preloadComicImages(queue);
  }, [ready, pages, page, prefs.preload, urls]);
  function go(n: number) {
    if (!pages.length) return;
    const next = Math.max(0, Math.min(pages.length - 1, n));
    current.current = next;
    setPage(next);
    wake();
    const s = stage.current;
    if (!s) return;
    if (prefs.mode === "vertical") {
      const f = figures.current.get(next);
      if (f)
        s.scrollTop +=
          f.getBoundingClientRect().top - s.getBoundingClientRect().top;
    } else {
      s.scrollTop = 0;
      s.scrollLeft = 0;
    }
  }
  function update(patch: Partial<ComicSettings>) {
    const before = prefsRef.current,
      next = normalizeComicSettings({ ...before, ...patch });
    const anchor = capture();
    const layout =
      next.mode !== before.mode ||
      next.zoom !== before.zoom ||
      next.stretch !== before.stretch ||
      next.gap !== before.gap;
    if (layout) stopAuto();
    prefsRef.current = next;
    setPrefs(next);
    void saveComicPreference(PREFS, next).catch(() =>
      setMessage(
        L("Chưa lưu được cài đặt trên máy.", "Unable to save reader settings."),
      ),
    );
    if (layout) {
      cancelAnimationFrame(pendingLayout.current);
      pendingLayout.current = requestAnimationFrame(() => {
        pendingLayout.current = requestAnimationFrame(() =>
          place(
            next.mode === before.mode
              ? anchor
              : anchor
                ? { ...anchor, ratio: 0 }
                : undefined,
          ),
        );
      });
    }
  }
  function open(value: typeof panel) {
    wake();
    panelRef.current = value;
    setPanel(value);
  }
  function toggleAuto() {
    wake();
    if (autoRef.current) {
      stopAuto();
      return;
    }
    if (prefs.mode === "vertical" && pages.length) {
      autoRef.current = true;
      setAuto(true);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      wake();
      if (panelRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.code === "Space" && target.closest("button,a")) return;
      const k = e.key.toLowerCase();
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        stopAuto();
        go(e.key === "Home" ? 0 : pages.length - 1);
        return;
      }
      if (
        prefs.mode === "single" &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        stopAuto();
        go(
          current.current +
            (e.key === "ArrowRight" ? 1 : -1) *
              (prefs.direction === "rtl" ? -1 : 1),
        );
        return;
      }
      const down =
          ["ArrowDown", "ArrowRight"].includes(e.key) ||
          k === "s" ||
          (e.code === "Space" && !e.shiftKey),
        up =
          ["ArrowUp", "ArrowLeft"].includes(e.key) ||
          k === "w" ||
          (e.code === "Space" && e.shiftKey);
      if (!down && !up) return;
      e.preventDefault();
      stopAuto();
      const s = stage.current;
      if (s)
        s.scrollBy({
          top: ((down ? 1 : -1) * s.clientHeight * prefs.keyboardStep) / 100,
          behavior:
            prefs.keyboardMode === "smooth" &&
            !matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "smooth"
              : "auto",
        });
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  const previous = book.chapters
      .slice(0, at)
      .reverse()
      .find(
        (c) =>
          !prefs.onlyWithImages ||
          (summaries.find((s) => s.id === c.id)?.pages ?? 0) > 0,
      ),
    next = book.chapters
      .slice(at + 1)
      .find(
        (c) =>
          !prefs.onlyWithImages ||
          (summaries.find((s) => s.id === c.id)?.pages ?? 0) > 0,
      );
  const label =
    chapterId === "preface"
      ? L("Lời tựa", "Preface")
      : `${L("Chương", "Chapter")} ${chapterId.replace("chapter-", "")}`;
  const shown =
    prefs.mode === "vertical"
      ? pages.map((p, n) => ({ p, n }))
      : pages[page]
        ? [{ p: pages[page], n: page }]
        : [];
  const filter = `grayscale(${prefs.grayscale ? 1 : 0}) brightness(${1 - prefs.dim / 100})`;
  function imageClick(e: MouseEvent<HTMLImageElement>) {
    if (panel || performance.now() < ignoreClick.current) return;
    wake();
    if (prefs.mode !== "single" || prefs.zoom > 100) return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - r.left;
    if (x < r.width * 0.28)
      go(current.current + (prefs.direction === "rtl" ? 1 : -1));
    else if (x > r.width * 0.72)
      go(current.current + (prefs.direction === "rtl" ? -1 : 1));
  }
  async function fullscreen() {
    wake();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else
        setMessage(
          L(
            "Trình duyệt này chưa hỗ trợ toàn màn hình.",
            "Full screen is not supported by this browser.",
          ),
        );
    } catch {
      setMessage(
        L("Chưa mở được toàn màn hình.", "Unable to enter full screen."),
      );
    }
  }
  return (
    <div
      ref={root}
      className="comic-reader cc-comix"
      data-ready={ready}
      data-page={page + 1}
      data-pages={pages.length}
      data-effective-mode={prefs.mode}
      data-chrome={chrome || !!panel}
      data-auto={auto}
      data-grayscale={prefs.grayscale}
      onPointerMove={(e) => {
        if (e.pointerType !== "touch") wake();
      }}
      onMouseMove={wake}
      onFocusCapture={wake}
    >
      <header className="cc-topbar cc-chrome">
        <LanguageLinks locale={locale} chapterId={chapterId} comic onOpen={stopAuto}/>
        {(!shared||preview)&&<span className="cc-local">{preview?L("Bản nháp riêng tư","Private draft"):"Local"}</span>}
      </header>
      <div
        ref={stage}
        className="cc-stage"
        style={{
          touchAction:
            prefs.zoom > 100 ? "pan-x pan-y pinch-zoom" : "pan-y pinch-zoom",
        }}
        onScroll={() => {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(persist, 200);
          if (!scrollFrame.current)
            scrollFrame.current = requestAnimationFrame(() => {
              scrollFrame.current = 0;
              const s = stage.current;
              if (s)
                setRatio(
                  prefs.mode === "vertical"
                    ? s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)
                    : pages.length > 1
                      ? current.current / (pages.length - 1)
                      : 0,
                );
            });
        }}
        onWheel={() => {
          stopAuto();
          wake();
        }}
        onTouchStart={() => {
          stopAuto();
          wake();
        }}
        onPointerDown={(e) => {
          stopAuto();
          wake();
          if (!e.isPrimary) {
            gesture.current = null;
            return;
          }
          if (
            prefs.mode === "single" &&
            e.pointerType === "touch" &&
            !panel &&
            prefs.zoom <= 100
          )
            gesture.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              time: e.timeStamp,
            };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (
            g &&
            Math.abs(e.clientX - g.x) > 8 &&
            Math.abs(e.clientX - g.x) > Math.abs(e.clientY - g.y) * 1.35
          )
            e.preventDefault();
        }}
        onPointerCancel={() => {
          gesture.current = null;
          ignoreClick.current = performance.now() + 500;
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          gesture.current = null;
          if (!g || g.id !== e.pointerId) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y,
            ms = Math.max(1, e.timeStamp - g.time);
          if (
            (Math.abs(dx) >= 24 ||
              (Math.abs(dx) >= 14 && Math.abs(dx) / ms > 0.25)) &&
            Math.abs(dx) > Math.abs(dy) * 1.35
          ) {
            e.preventDefault();
            ignoreClick.current = performance.now() + 500;
            go(
              current.current +
                (dx < 0 ? 1 : -1) * (prefs.direction === "rtl" ? -1 : 1),
            );
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) wake();
        }}
        onContextMenu={stopAuto}
      >
        {!ready ? (
          <div className="cc-empty" role="status">
            <LoaderCircle className="cc-spin" />
            <p>{L("Đang mở truyện tranh…", "Opening comic…")}</p>
          </div>
        ) : error ? (
          <div className="cc-empty" role="alert">
            <FileImage size={36} />
            <h1>
              {L("Chưa mở được truyện tranh", "Unable to open comic")}
            </h1>
            <p>{error}</p>
            <button onClick={() => setRetry((n) => n + 1)}>
              {L("Thử lại", "Retry")}
            </button>
          </div>
        ) : !pages.length ? (
          <div className="cc-empty">
            <BookOpen size={40} />
            <h1>{draft?.title ?? title}</h1>
            <p>
              {L(
                "Chương này chưa có trang TT tiếng Việt.",
                "This chapter has no English comic pages yet.",
              )}
            </p>
            <a
              className="cc-primary"
              href={`/${shared?"admin/comic":"local/comic-editor"}?chapter=${chapterId}&lang=${locale}`}
            >
              {L("Mở khu biên tập TT", "Open comic editor")}
            </a>
            <a href={`/${locale}/read/${chapterId}`}>
              {L("Đọc bản chữ", "Read text edition")}
            </a>
          </div>
        ) : (
          <>
            <div
              className={`cc-pages cc-${prefs.mode}`}
              style={{ gap: prefs.gap }}
            >
              {shown.map(({ p, n }) => (
                <figure
                  key={p.id}
                  className="cc-page"
                  data-index={n}
                  ref={(el) => {
                    if (el) figures.current.set(n, el);
                    else figures.current.delete(n);
                  }}
                >
                  <ComicImage
                    page={p}
                    index={n}
                    src={urls[p.id] ?? p.path}
                    width={
                      prefs.stretch
                        ? (size.width * prefs.zoom) / 100
                        : Math.min(p.width, (size.width * prefs.zoom) / 100)
                    }
                    filter={filter}
                    locale={locale}
                    eager={prefs.preload === "all" || Math.abs(page - n) < 2}
                    onClick={imageClick}
                  />
                </figure>
              ))}
            </div>
            {prefs.mode === "vertical" && (
              <div className="cc-end">
                <p>
                  {L("Hết chương", "End of chapter")} · {label}
                </p>
                <div>
                  {previous && (
                    <a href={`/${locale}/comic/${previous.id}`}>
                      <ChevronLeft size={16} />
                      {L("Chương trước", "Previous chapter")}
                    </a>
                  )}
                  {next && (
                    <a href={`/${locale}/comic/${next.id}`}>
                      {L("Chương sau", "Next chapter")}
                      <ChevronRight size={16} />
                    </a>
                  )}
                </div>
                <small>
                  {L(
                    "Ảnh mẫu minh họa giao diện, chưa phải bản chuyển thể hoàn chỉnh.",
                    "Sample artwork for the interface, not a complete adaptation.",
                  )}
                </small>
              </div>
            )}
          </>
        )}
      </div>
      {prefs.progress !== "none" && (
        <div
          className={`cc-reading-progress cc-progress-${prefs.progress}`}
          role="progressbar"
          aria-label={L("Tiến độ đọc truyện tranh", "Comic reading progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(
            (prefs.mode === "single"
              ? pages.length > 1
                ? page / (pages.length - 1)
                : 0
              : ratio) * 100,
          )}
        >
          <i
            style={
              prefs.progress === "left" || prefs.progress === "right"
                ? {
                    height: `${(prefs.mode === "single" ? (pages.length > 1 ? page / (pages.length - 1) : 0) : ratio) * 100}%`,
                  }
                : {
                    width: `${(prefs.mode === "single" ? (pages.length > 1 ? page / (pages.length - 1) : 0) : ratio) * 100}%`,
                  }
            }
          />
        </div>
      )}
      <div className="cc-chapter-widget cc-chrome">
        <IconButton
          icon={ChevronLeft}
          label={L("Chương trước", "Previous chapter")}
          disabled={!previous}
          onClick={() => {
            if (previous) location.href = `/${locale}/comic/${previous.id}`;
          }}
        />
        <button
          className="cc-chapter-label"
          onClick={() => open("chapters")}
          data-tooltip={L("Mở mục lục", "Open chapters")}
        >
          {label}
        </button>
        <IconButton
          icon={ChevronRight}
          label={L("Chương sau", "Next chapter")}
          disabled={!next}
          onClick={() => {
            if (next) location.href = `/${locale}/comic/${next.id}`;
          }}
        />
      </div>
      <nav
        className="cc-tools cc-chrome"
        aria-label={L("Công cụ đọc", "Reader controls")}
      >
        <IconButton
          icon={Home}
          label={L("Trang sách", "Book page")}
          onClick={() => (location.href = `/${locale}`)}
        />
        <IconButton
          icon={BookOpen}
          label={L("Đọc bản chữ", "Read text edition")}
          onClick={() => (location.href = `/${locale}/read/${chapterId}`)}
        />
        <IconButton
          icon={Pencil}
          label={L("Biên tập TT", "Edit comic")}
          onClick={() =>
            (location.href = `/${shared?"admin/comic":"local/comic-editor"}?chapter=${chapterId}&lang=${locale}`)
          }
        />
        <IconButton
          icon={List}
          label={L("Mục lục truyện tranh", "Comic chapters")}
          onClick={() => open("chapters")}
        />
        <IconButton
          icon={full ? Minimize : Maximize}
          label={
            full
              ? L("Thoát toàn màn hình", "Exit full screen")
              : L("Toàn màn hình", "Full screen")
          }
          onClick={fullscreen}
        />
        <IconButton
          icon={auto ? Pause : Play}
          label={
            auto
              ? L("Tạm dừng tự cuộn", "Pause auto scroll")
              : L("Bắt đầu tự cuộn", "Start auto scroll")
          }
          disabled={!pages.length || prefs.mode !== "vertical"}
          active={auto}
          onClick={toggleAuto}
        />
        <IconButton
          icon={Settings}
          label={L("Cài đặt truyện tranh", "Comic settings")}
          onClick={() => open("settings")}
        />
        <IconButton
          icon={HelpCircle}
          label={L("Trợ giúp đọc TT", "Comic reader help")}
          onClick={() => open("help")}
        />
      </nav>
      <div className="cc-zoom cc-chrome">
        <IconButton
          icon={ArrowLeftRight}
          label={`Stretch: ${prefs.stretch ? L("bật", "on") : L("tắt", "off")}`}
          active={prefs.stretch}
          onClick={() => update({ stretch: !prefs.stretch })}
        />
        <div className="cc-zoom-group">
          <IconButton
            icon={Minus}
            label={L("Thu nhỏ", "Zoom out")}
            disabled={prefs.zoom <= 10}
            onClick={() => update({ zoom: prefs.zoom - 5 })}
          />
          <button
            className="cc-zoom-number"
            aria-label={L("Đặt lại zoom", "Reset zoom")}
            onClick={() => update({ zoom: innerWidth < 760 ? 100 : 50 })}
          >
            {prefs.zoom}%
          </button>
          <IconButton
            icon={Plus}
            label={L("Phóng to", "Zoom in")}
            disabled={prefs.zoom >= 200}
            onClick={() => update({ zoom: prefs.zoom + 5 })}
          />
        </div>
      </div>
      {!chrome && !panel && (
        <button
          className="cc-wake"
          aria-label={L("Hiện công cụ đọc", "Show reader controls")}
          onClick={wake}
          onFocus={wake}
        >
          <MoreHorizontal size={18} />
        </button>
      )}
      {panel === "settings" && (
        <ComicSettingsDialog
          locale={locale}
          settings={prefs}
          onChange={update}
          onClose={() => open(null)}
        />
      )}
      {panel === "chapters" && (
        <ComicChaptersDialog
          locale={locale}
          book={book}
          chapterId={chapterId}
          summaries={summaries}
          onlyWithImages={prefs.onlyWithImages}
          onOnlyWithImages={(onlyWithImages) => update({ onlyWithImages })}
          onClose={() => open(null)}
        />
      )}
      {panel === "help" && (
        <ComicModal
          title={L("Trợ giúp", "Reader help")}
          closeLabel={L("Đóng", "Close")}
          onClose={() => open(null)}
          className="cc-help-modal"
        >
          <div className="cc-modal-body">
            <p>
              {L(
                "Di chuột hoặc chạm giữa ảnh/vùng trống để hiện công cụ. Công cụ tự ẩn khi bạn ngừng thao tác; quay lại tab sẽ hiện lại.",
                "Move the pointer or tap the image center/blank area to reveal controls. Idle controls hide; returning to the tab reveals them.",
              )}
            </p>
            <p>
              {L(
                "Cuộn dọc: dùng mũi tên, Space, W/S. Chọn cuộn nhanh hoặc mượt và độ dài bước trong Cài đặt.",
                "Vertical reading: use arrows, Space or W/S. Choose fast/smooth scrolling and the step length in Settings.",
              )}
            </p>
            <p>
              {L(
                "Chế độ ngang: vuốt nhẹ hoặc chạm hai mép ảnh để chuyển trang. Phóng to hơn 100% thì vuốt để dịch ảnh.",
                "Horizontal reading: swipe gently or tap image edges to turn pages. Above 100% zoom, swipe to pan the image.",
              )}
            </p>
            <p>
              {L(
                "Stretch cho phép ảnh phóng lớn hơn kích thước gốc. Tự cuộn dừng khi rời tab hoặc khi bạn cuộn/chạm vùng đọc.",
                "Stretch allows images to exceed their original size. Auto scroll stops when you leave the tab or manually scroll/touch the reading area.",
              )}
            </p>
            <p className="cc-help-local">
              {shared?L("Khách chỉ xem bản đã xuất bản. Cài đặt và vị trí đọc lưu trên thiết bị.","Visitors see published editions only. Settings and reading position stay on this device."):L(
                "Đây là bản thử local. Ảnh và nháp chỉ lưu trên trình duyệt, chưa xuất bản lên web.",
                "This is a local preview. Images and drafts stay in this browser; nothing is published online.",
              )}
            </p>
          </div>
        </ComicModal>
      )}
      {message && (
        <div className="cc-toast" role="status">
          {message}
          <button
            aria-label={L("Đóng thông báo", "Dismiss message")}
            onClick={() => setMessage("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
