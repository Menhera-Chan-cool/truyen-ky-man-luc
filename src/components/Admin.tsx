"use client";
import { lazy, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BookOpen,
  LogIn,
  LogOut,
  Upload,
  FileText,
  ImageIcon,
  Users,
  Plus,
  Save,
  Globe,
  History,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  Copy,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";
import { browserClient, adminRequest } from "../lib/supabase";
import { uploadAsset, uploadInlineImages } from "../lib/uploads";
import { cleanHtml } from "../lib/sanitize";
import { tx } from "../lib/content";
import type { BookMeta, Locale, Member } from "../lib/types";
import { IconButton, LanguageLinks, ModuleBoundary } from "./Ui";
const RichEditor = lazy(() => import("./RichEditor"));
const ImportPanel = lazy(() => import("./ImportPanel"));
const ComicEditor = lazy(() => import("./ComicEditor"));
import PdfViewer from "./PdfViewer";
import {
  DraftReview,
  BatchReplace,
  EditingPresence,
  AuditLog,
  ReviewIssues,
} from "./AdminTools";
import type { ReviewIssue } from "../lib/editor-tools";
type Version = {
  id: string;
  chapter_id: string;
  locale: Locale;
  title: string;
  html: string;
  kind: "text" | "illustration" | "pdf";
  pdf_path: string | null;
  revision: number;
  created_at: string;
};
type Head = {
  chapter_id: string;
  locale: Locale;
  draft_id: string;
  published_id: string | null;
  revision: number;
};
type VersionSummary = Omit<Version, "html">;
type State = {
  book: {
    draft: Record<Locale, BookMeta>;
    published: Record<Locale, BookMeta>;
    revision: number;
  };
  chapters: { id: string; sort_order: number }[];
  editions: Head[];
  versions: VersionSummary[];
  member: Member;
};
const blankMeta: Record<Locale, BookMeta> = {
  vi: {
    title: "Truyền kỳ mạn lục",
    summary: "",
    frontCover: "/book/cover.jpg",
  },
  en: {
    title: "Records of Strange Tales",
    summary: "",
    frontCover: "/book/cover.jpg",
  },
};
export default function Admin({ locale, comicChapter }: { locale: Locale; comicChapter?: string }) {
  const L = useCallback(
    (vi: string, en: string) => tx(locale, vi, en),
    [locale],
  );
  const [session, setSession] = useState<Session | null | undefined>(),
    [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [operationBusy, setBusy] = useState(false);
  const [childBusy, setChildBusy] = useState(false),
    [importDirty, setImportDirty] = useState(false);
  const busy = operationBusy || childBusy;
  const [tab, setTab] = useState("chapters"),
    [editLocale, setEditLocale] = useState<Locale>(locale),
    [selected, setSelected] = useState(""),
    [dirty, setDirty] = useState(false),
    [metaDirty, setMetaDirty] = useState(false),
    [newKind, setNewKind] = useState<"text" | "illustration">("text");
  const [form, setForm] = useState({
      context: "",
      title: "",
      html: "",
      kind: "text" as Version["kind"],
      pdfPath: "",
    }),
    [meta, setMeta] = useState(blankMeta),
    [history, setHistory] = useState<VersionSummary[] | null>(null),
    [preview, setPreview] = useState<Version | null>(null);
  const [historyNext, setHistoryNext] = useState<number | null>(null);
  const [contentError, setContentError] = useState("");
  const [contentAttempt, setContentAttempt] = useState(0);
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]),
    [invite, setInvite] = useState(""),
    [inviteLink, setInviteLink] = useState("");
  const load = useCallback(async () => {
    const result = (await adminRequest("state", undefined, "GET")) as State;
    setState(result);
    setMeta({
      vi: { ...blankMeta.vi, ...result.book.draft.vi },
      en: { ...blankMeta.en, ...result.book.draft.en },
    });
    setMetaDirty(false);
    setDirty(false);
    setSelected((id) =>
      result.chapters.some((c) => c.id === id)
        ? id
        : (result.chapters[0]?.id ?? ""),
    );
    return result;
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    const client = browserClient();
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, [locale]);
  useEffect(() => {
    if (session) load().catch((e) => setError(e.message));
    else setState(null);
  }, [session?.user.id, load]);
  const head = state?.editions.find(
    (e) => e.chapter_id === selected && e.locale === editLocale,
  );
  const editorContext = `${selected}:${editLocale}:${head?.draft_id ?? "new"}:${newKind}`;
  const formReady = form.context === editorContext;
  useEffect(() => {
    if(comicChapter)return;
    const controller = new AbortController();
    let cancelled = false;
    setContentError("");
    setReviewIssues(null);
    const apply = (version?: Version) => {
      if (cancelled) return;
      setForm({
        context: editorContext,
        title: version?.title ?? "",
        html: version?.html ?? "<p></p>",
        kind: version?.kind ?? newKind,
        pdfPath: version?.pdf_path ?? "",
      });
    };
    if (head?.draft_id)
      adminRequest(
        `chapters?id=${selected}&locale=${editLocale}&version=${head.draft_id}`,
        undefined,
        "GET",
        controller.signal,
      )
        .then((version: Version) => apply(version))
        .catch((e: Error) => {
          if (!cancelled) setContentError(e.message);
        });
    else apply();
    setDirty(false);
    setHistory(null);
    setHistoryNext(null);
    setPreview(null);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [editorContext, contentAttempt,comicChapter]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || metaDirty || importDirty || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, metaDirty, importDirty, busy]);
  function report(e: unknown) {
    setError(
      e instanceof Error
        ? e.message
        : L("Thao tác thất bại.", "The operation failed."),
    );
    setMessage("");
  }
  async function operation(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function confirmUnsaved() {
    if (busy) return false;
    return (
      !(dirty || metaDirty || importDirty) ||
      window.confirm(
        L(
          "Bạn có thay đổi chưa lưu. Bỏ các thay đổi này?",
          "You have unsaved changes. Discard them?",
        ),
      )
    );
  }
  async function loadHistory(before?: number) {
    await operation(async () => {
      const result = await adminRequest(
        `chapters?id=${selected}&locale=${editLocale}${before ? "&before=" + before : ""}`,
        undefined,
        "GET",
      );
      setHistory((previous) =>
        before ? [...(previous ?? []), ...result.items] : result.items,
      );
      setHistoryNext(result.next);
    });
  }
  function select(id: string) {
    if (!confirmUnsaved()) return;
    setSelected(id);
    setTab("chapters");
  }
  function switchTab(value: string) {
    if (value !== tab && !confirmUnsaved()) return;
    setTab(value);
    if (value === "members")
      operation(async () =>
        setMembers(await adminRequest("members", undefined, "GET")),
      );
  }
  function updateForm(changes: Partial<typeof form>) {
    if (busy || !formReady) return;
    setForm((prev) =>
      prev.context === editorContext ? { ...prev, ...changes } : prev,
    );
    setDirty(true);
  }
  async function save() {
    if (!formReady || busy) return;
    await operation(async () => {
      const html = await uploadInlineImages(form.html);
      await adminRequest("chapters", {
        id: selected,
        locale: editLocale,
        title: form.title,
        html,
        kind: form.kind,
        pdfPath: form.pdfPath || null,
        expectedRevision: head?.revision ?? 0,
      });
      await load();
      setMessage(
        L(
          "Đã lưu bản nháp. Người đọc vẫn thấy bản đã xuất bản.",
          "Draft saved. Readers still see the published edition.",
        ),
      );
    });
  }
  async function checkPublication(
    items: { id: string; locale: string; expectedRevision: number }[],
  ) {
    const result = (await adminRequest("review", { items })) as {
      issues: ReviewIssue[];
    };
    setReviewIssues(result.issues);
    if (result.issues.some((i) => i.severity === "error")) {
      setError(
        L(
          "Kiểm tra chưa đạt. Xem danh sách lỗi trước khi xuất bản.",
          "Publication checks failed. Review the listed errors.",
        ),
      );
      return false;
    }
    return (
      !result.issues.length ||
      window.confirm(
        L(
          `Có ${result.issues.length} cảnh báo. Bạn đã xem và vẫn muốn xuất bản?`,
          `There are ${result.issues.length} warnings. Have you reviewed them and want to publish?`,
        ),
      )
    );
  }
  async function publish(withdraw = false) {
    await operation(async () => {
      if (
        !withdraw &&
        !(await checkPublication([
          {
            id: selected,
            locale: editLocale,
            expectedRevision: head?.revision ?? 0,
          },
        ]))
      )
        return;
      await adminRequest("chapters", {
        action: withdraw ? "withdraw" : "publish",
        id: selected,
        locale: editLocale,
        expectedRevision: head?.revision ?? 0,
      });
      await load();
      setMessage(
        withdraw
          ? L(
              "Đã thu hồi bản công khai của chương này.",
              "This chapter edition is no longer public.",
            )
          : L("Đã xuất bản chương.", "Chapter published."),
      );
    });
  }
  function create(kind: "text" | "illustration") {
    if (!confirmUnsaved()) return;
    setNewKind(kind);
    setSelected(`section-${crypto.randomUUID()}`);
    setTab("chapters");
  }
  async function reorder(id: string, delta: number) {
    if (!state || !confirmUnsaved()) return;
    const ids = state.chapters.map((c) => c.id);
    const at = ids.indexOf(id),
      to = at + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    await operation(async () => {
      await adminRequest("chapters", {
        action: "reorder",
        ids,
        expectedRevision: state.book.revision,
      });
      await load();
    });
  }
  async function saveMeta(publish: boolean) {
    await operation(async () => {
      await adminRequest("book", {
        meta,
        expectedRevision: state?.book.revision,
        publish,
      });
      await load();
      setMessage(
        publish
          ? L(
              "Đã xuất bản giới thiệu và bìa.",
              "Book details and covers published.",
            )
          : L(
              "Đã lưu bản nháp giới thiệu và bìa.",
              "Book details and covers saved as a draft.",
            ),
      );
    });
  }
  async function cover(
    language: Locale,
    key: "frontCover" | "backCover",
    file?: File,
  ) {
    if (!file) return;
    await operation(async () => {
      const result = await uploadAsset(file, file.name);
      setMeta((prev) => ({
        ...prev,
        [language]: { ...prev[language], [key]: result.url },
      }));
      setMetaDirty(true);
    });
  }
  async function inviteMember() {
    await operation(async () => {
      const result = await adminRequest("members", { email: invite, locale });
      setInviteLink(result.link);
      setMembers(await adminRequest("members", undefined, "GET"));
      setInvite("");
    });
  }
  async function publishAll() {
    if (!state) return;
    const editions = state.editions.filter(
      (e) => e.locale === editLocale && e.draft_id !== e.published_id,
    );
    if (!editions.length) {
      setMessage(
        L(
          "Không có bản nháp mới để xuất bản.",
          "There are no new drafts to publish.",
        ),
      );
      return;
    }
    if (
      !confirmUnsaved() ||
      !window.confirm(
        L(
          `Xuất bản ${editions.length} bản nháp tiếng ${editLocale === "vi" ? "Việt" : "Anh"}?`,
          `Publish ${editions.length} ${editLocale.toUpperCase()} drafts?`,
        ),
      )
    )
      return;
    await operation(async () => {
      if (
        !(await checkPublication(
          editions.map((e) => ({
            id: e.chapter_id,
            locale: e.locale,
            expectedRevision: e.revision,
          })),
        ))
      )
        return;
      await adminRequest("chapters", {
        action: "publish-batch",
        items: editions.map((e) => ({
          id: e.chapter_id,
          locale: e.locale,
          expectedRevision: e.revision,
        })),
      });
      await load();
      setMessage(
        L(
          "Đã xuất bản tất cả bản nháp đã chọn.",
          "All selected drafts have been published.",
        ),
      );
    });
  }
  const returnLink = (
    <a className="guest-link" href={`/${locale}`}>
      <BookOpen size={15} />
      {L("Tiếp tục với vai trò người đọc", "Continue as a reader")}
    </a>
  );
  if (session === undefined)
    return (
      <main className="admin-loading">
        {L("Đang kiểm tra phiên đăng nhập…", "Checking your session…")}
      </main>
    );
  if (!session)
    return (
      <main className="auth-page">
        <LanguageLinks locale={locale} admin />
        <BookOpen size={35} />
        <h1>{L("Đăng nhập", "Sign in")}</h1>
        <p className="muted">
          {L(
            "Dành cho owner và editor được mời.",
            "For invited owners and editors.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            operation(async () => {
              const { error } = await browserClient().auth.signInWithPassword({
                email: String(data.get("email")).trim(),
                password: String(data.get("password")),
              });
              if (error)
                throw new Error(
                  L(
                    "Email hoặc mật khẩu không đúng.",
                    "The email or password is incorrect.",
                  ),
                );
            });
          }}
        >
          <label className="field-group">
            E-mail
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="field-group">
            {L("Mật khẩu", "Password")}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>
            <LogIn size={17} />
            {busy
              ? L("Đang đăng nhập…", "Signing in…")
              : L("Đăng nhập", "Sign in")}
          </button>
        </form>
        <p className="tiny muted" style={{ marginTop: 20 }}>
          {L(
            "Quên mật khẩu? Nhờ owner tạo lại liên kết kích hoạt.",
            "Forgot your password? Ask the owner for a new activation link.",
          )}
        </p>
        {returnLink}
      </main>
    );
  if (comicChapter && state) {
    const chapterId=state.chapters.some(c=>c.id===comicChapter)?comicChapter:state.chapters[0]?.id;
    if(chapterId) return <ModuleBoundary locale={locale}><ComicEditor key={`${locale}:${chapterId}`} shared locale={locale} chapterId={chapterId} book={{
      title:state.book.draft[locale].title,author:"Nguyễn Dữ",chapters:state.chapters.map(c=>({id:c.id,title:state.versions.find(v=>v.chapter_id===c.id&&v.locale===locale)?.title??c.id}))
    }}/></ModuleBoundary>;
  }
  return (
    <div className="admin-site">
      <header className="admin-header">
        <h1>
          <BookOpen size={21} /> {L("Biên tập sách", "Book editor")}
        </h1>
        <div className="button-row">
          <LanguageLinks locale={locale} admin disabled={busy} />
          <a href={`/admin/comic?lang=${locale}&chapter=${selected||"chapter-1"}`} onClick={e=>{if(busy||!confirmUnsaved())e.preventDefault();}}>{L("Biên tập TT","Comic editor")}</a>
          <a href={`/${locale}`} target="_blank" rel="noopener noreferrer">
            {L("Xem sách", "View book")}
          </a>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              if (confirmUnsaved()) browserClient().auth.signOut();
            }}
          >
            <LogOut size={14} />
            {L("Đăng xuất", "Sign out")}
          </button>
        </div>
      </header>
      {state && (
        <nav className="admin-tabs">
          {[
            [
              "chapters",
              L("Chương & minh họa", "Chapters & illustrations"),
              FileText,
            ],
            ["import", L("Nhập file", "Import files"), Upload],
            ["book", L("Giới thiệu & bìa", "Details & covers"), ImageIcon],
            ["replace", L("Tìm–thay thế", "Find and replace"), FileText],
            ["audit", L("Nhật ký", "Activity log"), History],
            ...(state.member.role === "owner"
              ? [["members", L("Người biên tập", "Editors"), Users]]
              : []),
          ].map(([id, label, Icon]) => {
            const Glyph = Icon as typeof FileText;
            return (
              <button
                key={id as string}
                disabled={busy}
                className={tab === id ? "selected" : ""}
                onClick={() => switchTab(id as string)}
              >
                <Glyph size={16} />
                {label as string}
              </button>
            );
          })}
        </nav>
      )}
      <main className="admin-content" inert={busy} aria-busy={busy}>
        {(error || message) && (
          <div
            role={error ? "alert" : "status"}
            className={`admin-message ${error ? "error" : ""}`}
          >
            <span>
              {/conflict/i.test(error)
                ? L(
                    "Có người đã sửa bản này. Hãy sao chép nội dung đang soạn rồi tải lại trước khi lưu; bản hiện tại chưa bị ghi đè.",
                    "Someone has edited this version. Copy your changes and reload before saving; the current version has not been overwritten.",
                  )
                : error || message}
            </span>
            {/conflict/i.test(error) && (
              <button onClick={() => window.location.reload()}>
                {L("Tải lại", "Reload")}
              </button>
            )}
            <button
              aria-label={L("Đóng", "Close")}
              onClick={() => {
                setError("");
                setMessage("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!state ? (
          <div className="empty-admin">
            <LockKeyhole size={30} />
            <p>
              {error
                ? L(
                    "Tài khoản chưa có quyền biên tập hoặc cấu hình dữ liệu chưa hoàn tất.",
                    "This account does not have editor access, or database setup is incomplete.",
                  )
                : L("Đang tải nội dung…", "Loading content…")}
            </p>
            {returnLink}
          </div>
        ) : (
          <>
            {tab === "chapters" && (
              <div className="editor-workspace">
                <aside className="editor-chapters">
                  <div className="button-row" style={{ marginBottom: 12 }}>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => create("text")}
                    >
                      <Plus size={14} />
                      {L("Chương", "Chapter")}
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => create("illustration")}
                    >
                      <ImageIcon size={14} />
                      {L("Minh họa", "Illustration")}
                    </button>
                  </div>
                  {state.chapters.map((c, index) => {
                    const edition = state.editions.find(
                      (e) => e.chapter_id === c.id && e.locale === editLocale,
                    );
                    const v = state.versions.find(
                      (v) => v.id === edition?.draft_id,
                    );
                    return (
                      <div
                        className={`editor-chapter ${selected === c.id ? "current" : ""}`}
                        key={c.id}
                      >
                        <button disabled={busy} onClick={() => select(c.id)}>
                          {v?.title ??
                            L("Chưa có bản này", "No translation yet")}
                          <small style={{ display: "block", opacity: 0.6 }}>
                            {c.id} ·{" "}
                            {edition?.published_id
                              ? L("Công khai", "Public")
                              : L("Bản nháp", "Draft")}
                          </small>
                        </button>
                        <div>
                          <IconButton
                            icon={ArrowUp}
                            label={L("Đưa lên", "Move up")}
                            disabled={busy || index === 0}
                            onClick={() => reorder(c.id, -1)}
                          />
                          <IconButton
                            icon={ArrowDown}
                            label={L("Đưa xuống", "Move down")}
                            disabled={
                              busy || index === state.chapters.length - 1
                            }
                            onClick={() => reorder(c.id, 1)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </aside>
                <section className="editor-surface">
                  {selected && head && (
                    <EditingPresence
                      locale={locale}
                      chapterId={selected}
                      editionLocale={editLocale}
                      userId={state.member.user_id}
                    />
                  )}
                  <div className="editor-heading">
                    <h2>{L("Nội dung chương", "Chapter content")}</h2>
                    <div className="button-row">
                      <select
                        aria-label={L("Bản đang sửa", "Editing edition")}
                        value={editLocale}
                        onChange={(e) => {
                          if (confirmUnsaved())
                            setEditLocale(e.target.value as Locale);
                        }}
                      >
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                      </select>
                      <span
                        className={`status-label ${head?.published_id === head?.draft_id && head?.published_id ? "published" : ""}`}
                      >
                        {head?.published_id === head?.draft_id &&
                        head?.published_id
                          ? L("Đã xuất bản", "Published")
                          : L("Bản nháp", "Draft")}{" "}
                        · v{head?.revision ?? 0}
                      </span>
                    </div>
                  </div>
                  {selected && formReady ? (
                    <>
                      <label className="field-group">
                        {L("Tiêu đề chương", "Chapter title")}
                        <input
                          value={form.title}
                          maxLength={300}
                          onChange={(e) =>
                            updateForm({ title: e.target.value })
                          }
                        />
                      </label>
                      <div className="button-row" style={{ marginBottom: 18 }}>
                        <label className="tiny">
                          {L("Loại nội dung", "Content type")}{" "}
                          <select
                            value={form.kind}
                            onChange={(e) =>
                              updateForm({
                                kind: e.target.value as Version["kind"],
                              })
                            }
                          >
                            <option value="text">{L("Văn bản", "Text")}</option>
                            <option value="illustration">
                              {L("Trang minh họa", "Illustration page")}
                            </option>
                            {form.pdfPath && <option value="pdf">PDF</option>}
                          </select>
                        </label>
                        <span className="tiny muted">ID: {selected}</span>
                      </div>
                      {form.kind === "pdf" ? (
                        <div className="editor-preview">
                          <PdfViewer
                            src={`/api/assets/${form.pdfPath}`}
                            locale={locale}
                            onText={() => {}}
                          />
                          <p className="tiny">
                            {L(
                              "Thay nội dung PDF bằng luồng Nhập file.",
                              "Replace PDF content using Import files.",
                            )}
                          </p>
                        </div>
                      ) : (
                        <ModuleBoundary locale={locale} key={editorContext}>
                          <RichEditor
                            key={editorContext}
                            html={form.html}
                            onChange={(html) => updateForm({ html })}
                            locale={locale}
                            onError={(e) => setError(e)}
                            onBusyChange={setChildBusy}
                          />
                        </ModuleBoundary>
                      )}
                      <div className="editor-footer">
                        <button
                          className="secondary-button"
                          disabled={busy || !form.title.trim()}
                          onClick={save}
                        >
                          <Save size={15} />
                          {L("Lưu bản nháp", "Save draft")}
                        </button>
                        <button
                          className="primary-button"
                          disabled={busy || dirty || !head}
                          onClick={() => publish()}
                        >
                          <Globe size={15} />
                          {L("Xuất bản", "Publish")}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={busy || !head?.published_id}
                          onClick={() => {
                            if (
                              window.confirm(
                                L(
                                  "Thu hồi bản công khai của chương này?",
                                  "Withdraw the public version of this chapter?",
                                ),
                              )
                            )
                              publish(true);
                          }}
                        >
                          {L("Thu hồi", "Withdraw")}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={busy || !head}
                          onClick={() => loadHistory()}
                        >
                          <History size={15} />
                          {L("Lịch sử", "History")}
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                L(
                                  "Ẩn chương này ở cả VI và EN? Lịch sử vẫn được giữ trong cơ sở dữ liệu.",
                                  "Hide this section in both VI and EN? Its history will remain in the database.",
                                ),
                              )
                            )
                              operation(async () => {
                                await adminRequest("chapters", {
                                  action: "archive",
                                  id: selected,
                                });
                                await load();
                              });
                          }}
                        >
                          <Trash2 size={14} />
                          {L("Xóa chương", "Delete chapter")}
                        </button>
                      </div>
                      {dirty && (
                        <p className="tiny muted">
                          {L(
                            "Hãy lưu bản nháp trước khi xuất bản.",
                            "Save your draft before publishing.",
                          )}
                        </p>
                      )}
                      <DraftReview
                        locale={locale}
                        id={selected}
                        editionLocale={editLocale}
                        head={head}
                        form={form}
                        issues={reviewIssues}
                        onIssues={setReviewIssues}
                        onError={report}
                      />
                      {history && (
                        <div className="history-list">
                          <h3>{L("Lịch sử nội dung", "Content history")}</h3>
                          {history.map((v) => (
                            <div className="history-entry" key={v.id}>
                              <div>
                                <strong>
                                  v{v.revision} · {v.title}
                                </strong>
                                <p>
                                  {new Date(v.created_at).toLocaleString(
                                    locale === "vi" ? "vi-VN" : "en-US",
                                  )}
                                </p>
                              </div>
                              <button
                                className="secondary-button"
                                disabled={busy}
                                onClick={() =>
                                  operation(async () => {
                                    setPreview(
                                      await adminRequest(
                                        `chapters?id=${selected}&locale=${editLocale}&version=${v.id}`,
                                        undefined,
                                        "GET",
                                      ),
                                    );
                                  })
                                }
                              >
                                {L("Xem", "View")}
                              </button>
                              <button
                                className="secondary-button"
                                disabled={busy}
                                onClick={() => {
                                  if (!confirmUnsaved()) return;
                                  operation(async () => {
                                    const saved = (await adminRequest(
                                      `chapters?id=${selected}&locale=${editLocale}&version=${v.id}`,
                                      undefined,
                                      "GET",
                                    )) as Version;
                                    await adminRequest("chapters", {
                                      id: selected,
                                      locale: editLocale,
                                      title: saved.title,
                                      html: saved.html,
                                      kind: saved.kind,
                                      pdfPath: saved.pdf_path,
                                      expectedRevision: head?.revision ?? 0,
                                    });
                                    await load();
                                    setMessage(
                                      L(
                                        "Đã khôi phục thành bản nháp mới.",
                                        "Restored as a new draft.",
                                      ),
                                    );
                                  });
                                }}
                              >
                                <RotateCcw size={13} />
                                {L("Khôi phục", "Restore")}
                              </button>
                            </div>
                          ))}
                          {historyNext !== null && (
                            <button
                              className="secondary-button"
                              disabled={busy}
                              onClick={() => loadHistory(historyNext)}
                            >
                              {L(
                                "Tải các phiên bản cũ hơn",
                                "Load older revisions",
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      {preview?.kind === "pdf" && preview.pdf_path ? (
                        <div className="history-preview">
                          <PdfViewer
                            src={`/api/assets/${preview.pdf_path}`}
                            locale={locale}
                            onText={() => {}}
                          />
                        </div>
                      ) : (
                        preview && (
                          <div
                            className="history-preview"
                            dangerouslySetInnerHTML={{
                              __html: cleanHtml(preview.html),
                            }}
                          />
                        )
                      )}
                    </>
                  ) : (
                    <div className="empty-admin">
                      {contentError ? (
                        <div role="alert">
                          <p>{contentError}</p>
                          <button
                            className="secondary-button"
                            onClick={() => setContentAttempt((n) => n + 1)}
                          >
                            {L("Thử lại", "Retry")}
                          </button>
                        </div>
                      ) : (
                        <>
                          {selected
                            ? L("Đang tải chương…", "Loading chapter…")
                            : L(
                                "Thêm chương hoặc nhập sách để bắt đầu.",
                                "Add a chapter or import a book to begin.",
                              )}
                        </>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 30,
                      borderTop: "1px solid #cfc4b2",
                      paddingTop: 20,
                    }}
                  >
                    <button
                      className="secondary-button"
                      disabled={busy || dirty}
                      onClick={publishAll}
                    >
                      <Globe size={15} />
                      {L(
                        "Xuất bản tất cả bản nháp của bản đang chọn",
                        "Publish all drafts in the selected edition",
                      )}
                    </button>
                  </div>
                </section>
              </div>
            )}
            {tab === "import" && (
              <ModuleBoundary locale={locale}>
                <ImportPanel
                  locale={locale}
                  editionLocale={editLocale}
                  onEditionChange={setEditLocale}
                  chapters={state.chapters.map((c) => {
                    const h = state.editions.find(
                      (e) => e.chapter_id === c.id && e.locale === editLocale,
                    );
                    return {
                      id: c.id,
                      title:
                        state.versions.find((v) => v.id === h?.draft_id)
                          ?.title ?? c.id,
                      revision: h?.revision ?? 0,
                    };
                  })}
                  onBusyChange={setChildBusy}
                  onDirtyChange={setImportDirty}
                  onDone={async () => {
                    await load();
                    setMessage(
                      L(
                        "Đã nhập bản nháp. Mở Chương & minh họa để kiểm tra và xuất bản.",
                        "Drafts imported. Open Chapters & illustrations to review and publish.",
                      ),
                    );
                  }}
                  onError={(e) => setError(e)}
                />
              </ModuleBoundary>
            )}
            {tab === "replace" && (
              <BatchReplace
                locale={locale}
                editionLocale={editLocale}
                heads={state.editions.filter((h) =>
                  state.chapters.some((c) => c.id === h.chapter_id),
                )}
                onLocale={setEditLocale}
                onBusy={setChildBusy}
                onDone={async () => {
                  await load();
                  setMessage(
                    L(
                      "Đã tạo bản nháp thay thế. Hãy kiểm tra trước khi xuất bản.",
                      "Replacement drafts created. Review them before publishing.",
                    ),
                  );
                }}
                onError={report}
              />
            )}
            {tab === "audit" && <AuditLog locale={locale} />}
            {tab === "book" && (
              <div className="admin-meta">
                {(["vi", "en"] as Locale[]).map((language) => (
                  <section key={language}>
                    <h2>{language === "vi" ? "Tiếng Việt" : "English"}</h2>
                    <label className="field-group">
                      {L("Tên sách", "Book title")}
                      <input
                        value={meta[language].title}
                        maxLength={300}
                        onChange={(e) => {
                          setMeta({
                            ...meta,
                            [language]: {
                              ...meta[language],
                              title: e.target.value,
                            },
                          });
                          setMetaDirty(true);
                        }}
                      />
                    </label>
                    <label className="field-group">
                      {L("Giới thiệu", "Introduction")}
                      <textarea
                        rows={6}
                        value={meta[language].summary}
                        onChange={(e) => {
                          setMeta({
                            ...meta,
                            [language]: {
                              ...meta[language],
                              summary: e.target.value,
                            },
                          });
                          setMetaDirty(true);
                        }}
                      />
                    </label>
                    {(["frontCover", "backCover"] as const).map((key) => (
                      <div key={key}>
                        <label className="file-button">
                          <Upload size={15} />
                          {key === "frontCover"
                            ? L("Tải bìa trước", "Upload front cover")
                            : L("Tải bìa sau", "Upload back cover")}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={busy}
                            onChange={(e) => {
                              cover(language, key, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {meta[language][key] && (
                          <>
                            <img
                              className="cover-mini"
                              src={meta[language][key]}
                              alt={
                                key === "frontCover"
                                  ? L("Bìa trước", "Front cover")
                                  : L("Bìa sau", "Back cover")
                              }
                            />
                            <button
                              className="text-button"
                              onClick={() => {
                                setMeta({
                                  ...meta,
                                  [language]: {
                                    ...meta[language],
                                    [key]:
                                      key === "frontCover"
                                        ? "/book/cover.jpg"
                                        : "",
                                  },
                                });
                                setMetaDirty(true);
                              }}
                            >
                              {L("Đặt lại", "Reset")}
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    <button
                      className="text-button"
                      onClick={() => {
                        const other = language === "vi" ? "en" : "vi";
                        setMeta({
                          ...meta,
                          [language]: {
                            ...meta[language],
                            frontCover: meta[other].frontCover,
                            backCover: meta[other].backCover,
                          },
                        });
                        setMetaDirty(true);
                      }}
                    >
                      <Copy size={14} />
                      {L(
                        "Dùng chung bìa với bản còn lại",
                        "Use the other edition’s covers",
                      )}
                    </button>
                  </section>
                ))}
                <div className="metadata-actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => saveMeta(false)}
                  >
                    <Save size={15} />
                    {L("Lưu bản nháp", "Save draft")}
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => saveMeta(true)}
                  >
                    <Globe size={15} />
                    {L("Xuất bản giới thiệu & bìa", "Publish details & covers")}
                  </button>
                </div>
              </div>
            )}
            {tab === "members" && state.member.role === "owner" && (
              <section>
                <h2>{L("Người biên tập được chọn", "Invited editors")}</h2>
                <p className="muted">
                  {L(
                    "Owner và editor đều được xuất bản. Chỉ owner quản lý danh sách này.",
                    "Owners and editors can publish. Only owners manage this list.",
                  )}
                </p>
                <form
                  className="invite-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    inviteMember();
                  }}
                >
                  <input
                    type="email"
                    required
                    aria-label={L("Email editor", "Editor email")}
                    placeholder="editor@example.com"
                    value={invite}
                    onChange={(e) => setInvite(e.target.value)}
                  />
                  <button className="primary-button" disabled={busy}>
                    <Plus size={16} />
                    {L("Tạo liên kết mời", "Create invitation link")}
                  </button>
                </form>
                {inviteLink && (
                  <div className="invite-link">
                    <strong>
                      {L(
                        "Liên kết dùng một lần — bạn tự chia sẻ cho người được mời.",
                        "One-time link — share it directly with the invited editor.",
                      )}
                    </strong>
                    <span>
                      {L(
                        "Web không gửi email. Giữ kín liên kết này và xóa sau khi chia sẻ.",
                        "The website does not send email. Keep this link private and clear it after sharing.",
                      )}
                    </span>
                    <textarea
                      readOnly
                      value={inviteLink}
                      aria-label={L("Liên kết kích hoạt", "Activation link")}
                    />
                    <div className="button-row">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          navigator.clipboard.writeText(inviteLink)
                        }
                      >
                        <Copy size={14} />
                        {L("Sao chép", "Copy")}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setInviteLink("")}
                      >
                        {L("Ẩn liên kết", "Clear link")}
                      </button>
                    </div>
                  </div>
                )}
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>{L("Vai trò", "Role")}</th>
                      <th>{L("Trạng thái", "Status")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.user_id}>
                        <td>{m.email}</td>
                        <td>{m.role}</td>
                        <td>
                          {m.active
                            ? L("Đang hoạt động", "Active")
                            : L("Đã thu hồi", "Revoked")}
                        </td>
                        <td>
                          {m.active && m.role !== "owner" && (
                            <button
                              className="secondary-button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    L(
                                      `Thu hồi quyền của ${m.email}?`,
                                      `Revoke access for ${m.email}?`,
                                    ),
                                  )
                                )
                                  operation(async () => {
                                    await adminRequest("members", {
                                      action: "revoke",
                                      userId: m.user_id,
                                    });
                                    setMembers(
                                      await adminRequest(
                                        "members",
                                        undefined,
                                        "GET",
                                      ),
                                    );
                                  });
                              }}
                            >
                              {L("Thu hồi", "Revoke")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
        {busy && (
          <p role="status" className="tiny" style={{ marginTop: 20 }}>
            {L("Đang xử lý…", "Working…")}
          </p>
        )}
      </main>
    </div>
  );
}
