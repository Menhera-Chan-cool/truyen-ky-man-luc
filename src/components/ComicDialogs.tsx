"use client";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import {
  ArrowRightToLine,
  ArrowLeftToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  Minus,
  Plus,
  X,
  Ban,
  Circle,
  CircleDot,
  Square,
  CheckSquare,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { chapterNumber, type ComicSettings } from "../lib/comic";
import type { ComicSummary } from "../lib/comic-db";
import type { ComicBookIndex } from "./ComicReader";
export function ComicModal({
  title,
  onClose,
  children,
  className = "",
  closeLabel = "Đóng",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      old?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`cc-modal ${className}`}
      aria-labelledby={id}
      onCancel={(e) => {e.preventDefault();onClose();}}
      onClose={(e) => {
        if (!e.currentTarget.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          className="cc-modal-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Stepper({
  label,
  locale,
  value,
  min,
  max,
  step = 5,
  unit = "",
  reset,
  onChange,
}: {
  label: string;
  locale: "vi" | "en";
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  reset: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="cc-stepper-row">
      <div className="cc-stepper" role="group" aria-label={label}>
        <button
          aria-label={`${locale === "vi" ? "Giảm" : "Decrease"} ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus size={15} />
        </button>
        <output>
          {value}
          {unit}
        </output>
        <button
          aria-label={`${locale === "vi" ? "Tăng" : "Increase"} ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus size={15} />
        </button>
      </div>
      <button
        className="cc-reset"
        disabled={value === reset}
        onClick={() => onChange(reset)}
      >
        Reset
      </button>
    </div>
  );
}
function Radio({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="cc-choice" aria-pressed={active} onClick={onClick}>
      {active ? <CircleDot size={14} /> : <Circle size={14} />}
      <span>{children}</span>
    </button>
  );
}
export function ComicSettingsDialog({
  locale,
  settings: s,
  onChange,
  onClose,
}: {
  locale: "vi" | "en";
  settings: ComicSettings;
  onChange: (patch: Partial<ComicSettings>) => void;
  onClose: () => void;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  return (
    <ComicModal
      title={L("Cài đặt", "Settings")}
      onClose={onClose}
      closeLabel={L("Đóng", "Close")}
      className="cc-settings-modal"
    >
      <div className="cc-modal-body">
        <div className="cc-direction-buttons">
          <button
            aria-pressed={s.mode === "single" && s.direction === "ltr"}
            onClick={() => onChange({ mode: "single", direction: "ltr" })}
          >
            <ArrowRightToLine size={15} />
            {L("Trái → phải", "Left to right")}
          </button>
          <button
            aria-pressed={s.mode === "single" && s.direction === "rtl"}
            onClick={() => onChange({ mode: "single", direction: "rtl" })}
          >
            <ArrowLeftToLine size={15} />
            {L("Phải → trái", "Right to left")}
          </button>
          <button
            aria-pressed={s.mode === "vertical"}
            onClick={() => onChange({ mode: "vertical" })}
          >
            <ArrowDown size={15} />
            {L("Trên → dưới", "Top to bottom")}
          </button>
        </div>
        <section className="cc-setting-section">
          <h3>{L("Lề giữa trang", "Strip margin")}</h3>
          <Stepper
            locale={locale}
            label={L("lề giữa trang", "strip margin")}
            value={s.gap}
            min={0}
            max={100}
            reset={0}
            onChange={(gap) => onChange({ gap })}
          />
        </section>
        <section className="cc-setting-section">
          <h3>{L("Cuộn bằng bàn phím", "Keyboard scrolling")}</h3>
          <div className="cc-choice-row">
            <Radio
              active={s.keyboardMode === "fast"}
              onClick={() => onChange({ keyboardMode: "fast" })}
            >
              {L("Cuộn nhanh", "Scroll fast")}
            </Radio>
            <Radio
              active={s.keyboardMode === "smooth"}
              onClick={() => onChange({ keyboardMode: "smooth" })}
            >
              {L("Cuộn mượt", "Scroll smooth")}
            </Radio>
          </div>
          <Stepper
            locale={locale}
            label={L("bước cuộn bàn phím", "keyboard scroll step")}
            value={s.keyboardStep}
            min={10}
            max={200}
            step={10}
            reset={100}
            unit="%"
            onChange={(keyboardStep) => onChange({ keyboardStep })}
          />
          <p>
            {L(
              "Bước cuộn cho phím mũi tên / Space / W / S, tính theo % chiều cao khung đọc.",
              "Step size for Arrow / Space / W / S keys, as percent of the viewport height.",
            )}
          </p>
        </section>
        <section className="cc-setting-section">
          <h3>{L("Tốc độ tự cuộn", "Auto-scroll speed")}</h3>
          <label className="cc-range">
            <input
              aria-label={L("Tốc độ tự cuộn", "Auto-scroll speed")}
              type="range"
              min="20"
              max="600"
              step="10"
              value={s.autoSpeed}
              onChange={(e) => onChange({ autoSpeed: Number(e.target.value) })}
            />
            <output>{s.autoSpeed} px/s</output>
          </label>
          <p>
            {L(
              "Tốc độ của nút phát / tạm dừng tự cuộn trên thanh công cụ.",
              "Speed of the play / pause auto-scroll button in the reader controls.",
            )}
          </p>
        </section>
        <section className="cc-setting-section">
          <h3>{L("Thanh tiến độ", "Progress bar")}</h3>
          <div className="cc-progress-options">
            {[
              ["left", ArrowLeftToLine, L("bên trái", "left")],
              ["top", ArrowUpToLine, L("phía trên", "top")],
              ["bottom", ArrowDownToLine, L("phía dưới", "bottom")],
              ["right", ArrowRightToLine, L("bên phải", "right")],
              ["none", Ban, L("ẩn", "hidden")],
            ].map(([value, Icon, label]) => {
              const Glyph = Icon as typeof Ban;
              return (
                <button
                  key={value as string}
                  aria-label={`${L("Thanh tiến độ", "Progress bar")} ${label}`}
                  aria-pressed={s.progress === value}
                  onClick={() =>
                    onChange({ progress: value as ComicSettings["progress"] })
                  }
                >
                  <Glyph size={18} />
                </button>
              );
            })}
          </div>
        </section>
        <section className="cc-setting-section">
          <h3>{L("Nạp ảnh trước", "Preload images")}</h3>
          <div className="cc-choice-row">
            <Radio
              active={s.preload === "some"}
              onClick={() => onChange({ preload: "some" })}
            >
              {L("Nạp một phần", "Preload some")}
            </Radio>
            <Radio
              active={s.preload === "all"}
              onClick={() => onChange({ preload: "all" })}
            >
              {L("Nạp nhiều hơn", "Preload more")}
            </Radio>
          </div>
          <p>{L("Giới hạn 8 MB ảnh chờ; mạng yếu giảm còn tối đa 1 MB, Data Saver tắt nạp trước.","Up to 8 MB of pending images; slow connections use at most 1 MB. Data Saver disables preloading.")}</p>
        </section>
        <button
          className="cc-grayscale"
          aria-pressed={s.grayscale}
          onClick={() => onChange({ grayscale: !s.grayscale })}
        >
          {s.grayscale ? <CheckSquare size={15} /> : <Square size={15} />}
          <span>{L("Ảnh thang xám", "Greyscale pages")}</span>
        </button>
        <section className="cc-setting-section">
          <h3>{L("Làm tối ảnh", "Dim pages")}</h3>
          <label className="cc-range">
            <input
              aria-label={L("Làm tối ảnh", "Dim pages")}
              type="range"
              min="0"
              max="100"
              step="5"
              value={s.dim}
              onChange={(e) => onChange({ dim: Number(e.target.value) })}
            />
            <output>{s.dim}%</output>
          </label>
        </section>
      </div>
    </ComicModal>
  );
}
const fold = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d");
export function ComicChaptersDialog({
  locale,
  book,
  chapterId,
  summaries,
  onlyWithImages,
  onOnlyWithImages,
  onClose,
  onNavigate,
  onIntent,
}: {
  locale: "vi" | "en";
  book: ComicBookIndex;
  chapterId: string;
  summaries: ComicSummary[];
  onlyWithImages: boolean;
  onOnlyWithImages: (v: boolean) => void;
  onClose: () => void;
  onNavigate?: (id:string)=>void;
  onIntent?: (id:string)=>void;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    [query, setQuery] = useState(""),
    [source, setSource] = useState("all"),
    [sort, setSort] = useState<"chapter" | "title" | "date">("chapter"),
    [descending, setDescending] = useState(true),
    [page, setPage] = useState(0),
    perPage = 10;
  const list = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      book.chapters
        .map((c, n) => {
          const meta = summaries.find((s) => s.id === c.id);
          return { ...c, title: meta?.title ?? c.title, n, meta };
        })
        .filter(
          (c) =>
            (source === "all" ||
              (source === "missing"
                ? !c.meta?.pages
                : c.meta?.source === source)) &&
            (!onlyWithImages || (c.meta?.pages ?? 0) > 0) &&
            fold(c.title + " " + c.id).includes(fold(query)),
        )
        .sort((a, b) => {
          const sign = descending ? -1 : 1;
          return (
            sign *
            (sort === "chapter"
              ? a.n - b.n
              : sort === "date"
                ? (a.meta?.updatedAt ?? 0) - (b.meta?.updatedAt ?? 0)
                : a.title.localeCompare(b.title, "vi"))
          );
        }),
    [book, summaries, source, onlyWithImages, query, sort, descending],
  );
  useEffect(() => {
    const at = rows.findIndex((c) => c.id === chapterId);
    setPage(Math.max(0, Math.floor(at / perPage)));
  }, [rows, chapterId]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = list.current,
        active = container?.querySelector<HTMLElement>(
          'a[aria-current="page"]',
        );
      if (!container || !active) return;
      const a = active.getBoundingClientRect(),
        b = container.getBoundingClientRect();
      if (a.bottom > b.bottom) container.scrollTop += a.bottom - b.bottom + 8;
      else if (a.top < b.top) container.scrollTop += a.top - b.top - 8;
    });
    return () => cancelAnimationFrame(frame);
  }, [page, chapterId, rows]);
  const total = Math.max(1, Math.ceil(rows.length / perPage));
  function order(value: typeof sort) {
    if (sort === value) setDescending((v) => !v);
    else setSort(value);
  }
  return (
    <ComicModal
      title={L("Mục lục", "Chapters")}
      onClose={onClose}
      closeLabel={L("Đóng", "Close")}
      className="cc-chapters-modal"
    >
      <div className="cc-chapter-filters">
        <label className="cc-chapter-search">
          <Search size={15} />
          <input
            aria-label={L("Tìm chương", "Find chapter")}
            placeholder={L("Tìm chương…", "Search…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="cc-source-filter">
          <select
            aria-label={L("Nguồn trang truyện", "Page source")}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">{L("Tất cả nguồn", "All sources")}</option>
            {summaries.some(s=>s.source==="sample")&&<option value="sample">{L("Ảnh mẫu", "Samples")}</option>}
            {summaries.some(s=>s.source==="local")&&<option value="local">{L("Bản nháp local", "Local drafts")}</option>}
            {summaries.some(s=>s.source==="published")&&<option value="published">{L("Đã xuất bản", "Published")}</option>}
            <option value="missing">{L("Chưa có ảnh", "No pages")}</option>
          </select>
        </label>
        <div className="cc-chapter-sort">
          {[
            ["chapter", L("Chương", "Chapter")],
            ["title", L("Tên", "Title")],
            ["date", L("Cập nhật", "Updated")],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={sort === value}
              onClick={() => order(value as typeof sort)}
            >
              {sort === value &&
                (descending ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="cc-chapter-lock">
        <input
          type="checkbox"
          checked={onlyWithImages}
          onChange={(e) => onOnlyWithImages(e.target.checked)}
        />
        {L(
          "Chỉ chuyển giữa các chương có ảnh",
          "Navigate only chapters with comic pages",
        )}
      </label>
      <div className="cc-chapter-list" ref={list}>
        {rows.slice(page * perPage, (page + 1) * perPage).map((c) => (
          <Link
            key={c.id}
            prefetch={false}
            href={`/${locale}/comic/${c.id}`}
            onNavigate={onNavigate?e=>{e.preventDefault();onNavigate(c.id);}:undefined}
            onMouseEnter={()=>onIntent?.(c.id)} onFocus={()=>onIntent?.(c.id)}
            aria-current={c.id === chapterId ? "page" : undefined}
            title={c.title}
          >
            <span>
              {c.id === "preface"
                ? L("Lời tựa", "Preface")
                : `${L("Chương", "Chapter")} ${chapterNumber(book.chapters, c.id)}`}
            </span>
            <small>
              {c.title.replace(/^(?:Chương|Chapter)\s*\d+\s*:\s*/i, "")}
            </small>
            <em>
              {c.meta?.pages
                ? `${c.meta.pages} ${L("trang", "pages")}`
                : L("Chưa có ảnh", "No pages")}
            </em>
          </Link>
        ))}
        {!rows.length && (
          <p className="cc-no-results">
            {L("Không tìm thấy chương phù hợp.", "No matching chapters.")}
          </p>
        )}
      </div>
      <footer className="cc-chapter-pagination">
        <button
          aria-label={L("Trang mục lục trước", "Previous chapter-list page")}
          disabled={page <= 0}
          onClick={() => setPage((v) => v - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: total }, (_, n) => (
          <button
            key={n}
            aria-current={n === page ? "page" : undefined}
            onClick={() => setPage(n)}
          >
            {n + 1}
          </button>
        ))}
        <button
          aria-label={L("Trang mục lục sau", "Next chapter-list page")}
          disabled={page >= total - 1}
          onClick={() => setPage((v) => v + 1)}
        >
          <ChevronRight size={16} />
        </button>
        <button
          aria-label={L("Cuối mục lục", "Last chapter-list page")}
          disabled={page >= total - 1}
          onClick={() => setPage(total - 1)}
        >
          <ChevronsRight size={16} />
        </button>
      </footer>
    </ComicModal>
  );
}
