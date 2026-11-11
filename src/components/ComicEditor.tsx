"use client";
import "../../app/comic-preview.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BookImage,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileArchive,
  GripVertical,
  ImagePlus,
  Images,
  LoaderCircle,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Globe,
  EyeOff,
} from "lucide-react";
import { IconButton,LanguageLinks } from "./Ui";
import NetworkNotice from "./NetworkNotice";
import {
  sampleComic,
  chapterNumber,
  naturalComicOrder,
  moveComicPage,
  type ComicDraft,
  type ComicPage,
} from "../lib/comic";
import { readComicDraft, saveComicDraft, useComicUrls } from "../lib/comic-db";
import type { ComicBookIndex } from "./ComicReader";
import {readSharedComic,saveSharedComic,publishSharedComic} from "../lib/comic-remote";
import {writeRecovery,listRecoveries,readRecovery,discardRecovery,recoveryKey,clearUploadCheckpoints,type RecoveryCandidate,type UploadCheckpoint} from "../lib/comic-recovery";
const bytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
export default function ComicEditor({
  book,
  chapterId,
  locale,
  shared=false,
  accountId,
}: {
  book: ComicBookIndex;
  chapterId: string;
  locale: "vi" | "en";
  shared?:boolean;
  accountId?:string;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    chapter = book.chapters.find((c) => c.id === chapterId)!;
  const [draft, setDraft] = useState<ComicDraft>(),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [progress, setProgress] = useState(""),
    [query, setQuery] = useState(""),
    [active, setActive] = useState<string>(),
    [selected, setSelected] = useState(new Set<string>()),
    [dragged, setDragged] = useState<string>(),
    [dragOver, setDragOver] = useState(false),
    [rail, setRail] = useState(false),
    [inspector, setInspector] = useState(false),
    [lightbox, setLightbox] = useState(false),
    [reload, setReload] = useState(0),
    [undo, setUndo] = useState<ComicPage[]>(),
    [publishedRevision,setPublishedRevision]=useState<number|null>(null),
    [localDraft,setLocalDraft]=useState<ComicDraft|null>(null),
    [recoveries,setRecoveries]=useState<RecoveryCandidate[]>([]),
    [recoveryState,setRecoveryState]=useState(""),
    [recoveryWarning,setRecoveryWarning]=useState("");
  const file = useRef<HTMLInputElement>(null),
    replace = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    allowLeave = useRef(false),
    lastImport = useRef(0),
    uploaded=useRef(new Map<string,UploadCheckpoint>()),
    recoverySession=useRef(""),recoverySequence=useRef(0),
    recoveryQueue=useRef<Promise<unknown>>(Promise.resolve()),
    recoveryTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),
    recoverySnapshot=useRef<ComicDraft|undefined>(undefined),
    recovered=useRef<RecoveryCandidate|undefined>(undefined);
  const scope=shared&&accountId?{accountId,chapterId,locale}:undefined;
  const warnRecovery=()=>setRecoveryWarning(L("Không giữ được bản khôi phục trên thiết bị. Hãy lưu nháp chung trước khi rời trang.","Device recovery is unavailable. Save the shared draft before leaving."));
  function persistRecovery(){
    const snapshot=recoverySnapshot.current;if(!scope||!snapshot)return;
    recoverySession.current ||= crypto.randomUUID();
    const sequence=++recoverySequence.current,session=recoverySession.current;
    recoveryQueue.current=recoveryQueue.current.catch(()=>{}).then(()=>writeRecovery(scope,session,sequence,snapshot)).then(()=>{
      if(sequence===recoverySequence.current&&recoverySnapshot.current){setRecoveryState(L("Đã giữ bản khôi phục trên thiết bị","Recovery copy kept on this device"));setRecoveryWarning("");}
    }).catch(warnRecovery);
  }
  async function clearRecovery(){
    clearTimeout(recoveryTimer.current);recoverySnapshot.current=undefined;
    if(!scope)return;
    const sequence=++recoverySequence.current;
    recoveryQueue.current=recoveryQueue.current.catch(()=>{}).then(async()=>{
      if(recoverySession.current)await discardRecovery(scope,recoveryKey(scope,recoverySession.current),sequence);
      if(recovered.current){const r=recovered.current;await discardRecovery(scope,r.key,r.sequence,r.sequence);recovered.current=undefined;}
      setRecoveries(await listRecoveries(scope));setRecoveryState("");
    }).catch(warnRecovery);
    await recoveryQueue.current;
  }
  async function leave(href:string){
    if(busy)return;
    if(dirty&&!window.confirm(L("Bỏ thay đổi chưa lưu và chuyển bản?","Discard unsaved changes and switch editions?")))return;
    setBusy(true);await clearRecovery();allowLeave.current=true;location.assign(href);
  }
  const pages = draft?.pages ?? [],
    urls = useComicUrls(pages),
    activePage = pages.find((p) => p.id === active),
    activeIndex = pages.findIndex((p) => p.id === active),
    total = pages.reduce((sum, p) => sum + p.bytes, 0);
  useEffect(() => {
    let active = true;
    setReady(false);
    setDraft(undefined);
    setError("");
    setDirty(false);
    setSelected(new Set());
    uploaded.current.clear();
    (shared?readSharedComic(chapterId,locale):readComicDraft(chapterId,locale).then(draft=>({draft:draft??null,publishedRevision:null,revision:draft?.revision??0})))
      .then((head) => {
        if (!active) return;
        const stored=head.draft,next=stored??{...sampleComic(chapterId,chapter.title),pages:shared||locale==="en"?[]:sampleComic(chapterId,chapter.title).pages,revision:head.revision};
        setPublishedRevision(head.publishedRevision);
        setDraft(next);
        setInspector(window.matchMedia("(min-width: 1001px)").matches);
        setActive(next.pages[0]?.id);
        setStatus(
          stored
            ? (shared?L("Đã mở bản nháp chung", "Shared draft opened"):L("Đã mở bản nháp trên máy", "Local draft opened"))
            : L(
                shared?"Chưa có bản nháp TT. Thêm ảnh để bắt đầu.":"Ảnh mẫu để xem giao diện",
                shared?"No comic draft yet. Add images to start.":"Sample images for interface review",
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
      lastImport.current++;
    };
  }, [chapterId, chapter.title, reload,shared,locale]);
  useEffect(()=>{
    let active=true;
    if(shared) readComicDraft(chapterId,locale).then(d=>{if(active)setLocalDraft(d??null);}).catch(()=>{});
    return()=>{active=false;};
  },[shared,chapterId,locale]);
  useEffect(()=>{
    if(!shared||!accountId)return;
    const context={accountId,chapterId,locale};let active=true;
    listRecoveries(context).then(rows=>{if(active)setRecoveries(rows);}).catch(()=>{if(active)warnRecovery();});
    const flush=()=>{clearTimeout(recoveryTimer.current);persistRecovery();};
    const hidden=()=>{if(document.hidden)flush();};
    window.addEventListener("pagehide",flush);window.addEventListener("offline",flush);document.addEventListener("visibilitychange",hidden);
    return()=>{active=false;flush();window.removeEventListener("pagehide",flush);window.removeEventListener("offline",flush);document.removeEventListener("visibilitychange",hidden);};
  },[shared,accountId,chapterId,locale]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !allowLeave.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (lightbox && activePage && !dialog.current?.open)
      dialog.current?.showModal();
    else if (!lightbox && dialog.current?.open) dialog.current.close();
  }, [lightbox, activePage]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing && !lightbox) {
        setInspector(false);
        setRail(false);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [lightbox]);
  function change(next: ComicDraft) {
    setDraft(next);
    setDirty(true);
    setStatus(L("Có thay đổi chưa lưu", "Unsaved changes"));
    if(scope){recoverySnapshot.current=next;setRecoveryState(L("Đang giữ bản khôi phục…","Keeping a recovery copy…"));clearTimeout(recoveryTimer.current);recoveryTimer.current=setTimeout(persistRecovery,650);}
  }
  function switchChapter(id: string) {
    if (busy || id === chapterId) return;
    if (
      dirty &&
      !window.confirm(
        L(
          "Chuyển chương và bỏ các thay đổi chưa lưu?",
          "Switch chapters and discard unsaved changes?",
        ),
      )
    )
      return;
    setBusy(true);void clearRecovery().then(()=>{allowLeave.current = true;location.href = `/${shared?"admin/comic":"local/comic-editor"}?chapter=${id}&lang=${locale}`;});
  }
  async function upload(files: File[], replacement = false) {
    if (!draft || busy || !files.length) return;
    const token = ++lastImport.current;
    setBusy(true);
    setError("");
    setProgress(L("Đang kiểm tra ảnh…", "Checking images…"));
    try {
      const { importComicPages } = await import("../lib/comic-import");
      const old = replacement
        ? draft.pages.filter((p) => p.id !== active)
        : draft.pages;
      const result = await importComicPages(files, old, (done, total) =>
        setProgress(`${L("Đang đọc ảnh", "Reading images")} ${done}/${total}`),
      );
      if (token !== lastImport.current) return;
      if (replacement && result.pages.length !== 1)
        throw Error(
          L(
            "Chọn một ảnh mới, khác các trang đang có.",
            "Choose one new image, different from existing pages.",
          ),
        );
      const next = replacement
        ? draft.pages.map((p) => (p.id === active ? result.pages[0] : p))
        : [...draft.pages, ...result.pages];
      setUndo(draft.pages);
      change({ ...draft, pages: next });
      setActive(result.pages[0]?.id ?? active);
      setStatus(
        result.duplicates
          ? L(
              `Đã thêm ${result.pages.length} ảnh · bỏ qua ${result.duplicates} ảnh trùng.`,
              `Added ${result.pages.length} images · skipped ${result.duplicates} duplicates.`,
            )
          : L(
              `Đã thêm ${result.pages.length} ảnh. Chưa lưu nháp.`,
              `Added ${result.pages.length} images. Draft not saved yet.`,
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message || e.name : String(e));
    } finally {
      if (token === lastImport.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const head=shared?await saveSharedComic(draft,locale,uploaded.current,s=>setProgress(L("Đang tải ảnh lên Supabase ","Uploading images to Supabase ")+s),warnRecovery):null;
      if(shared&&!head?.draft)throw Error(L("Chưa xác nhận được bản nháp trên server. Hãy tải lại để kiểm tra.","Could not confirm the server draft. Reload to check."));
      const saved = head?.draft??await saveComicDraft(draft, draft.revision,locale);
      if(head)setPublishedRevision(head.publishedRevision);
      setDraft(saved);
      setDirty(false);
      await clearRecovery();
      if(scope)try{await clearUploadCheckpoints(scope,draft.pages);}catch{warnRecovery();}
      setStatus(shared?L("Đã lưu nháp chung. Chưa thay bản công khai.","Shared draft saved. Public edition unchanged."):L("Đã lưu bản nháp trên máy", "Draft saved on this device"));
      return saved;
    } catch (e) {
      setError(e instanceof Error&&/conflict/i.test(e.message)?L("Bản này đã thay đổi. Sao chép các thay đổi cần giữ rồi tải lại; bản trên server chưa bị ghi đè.","This version changed. Keep a copy of your changes and reload; the server draft was not overwritten."):e instanceof Error ? e.message || e.name : String(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function publication(withdraw=false) {
    if(!shared||!draft||busy||dirty) return;
    if(!window.confirm(withdraw?L("Thu hồi TT chương này khỏi trang công khai?","Withdraw this comic chapter from public reading?"):L("Xuất bản bản nháp TT này cho mọi người đọc?","Publish this comic draft for everyone?")))return;
    setBusy(true);setError("");
    try {
      const head=await publishSharedComic(chapterId,locale,draft.revision,withdraw);
      if(head.draft)setDraft(head.draft);
      setPublishedRevision(head.publishedRevision);
      setStatus(withdraw?L("Đã thu hồi TT. Bản nháp được giữ lại.","Comic withdrawn. Draft preserved."):L("Đã xuất bản TT.","Comic published."));
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  function remove(ids: Set<string>) {
    if (!draft || !ids.size) return;
    if (
      !window.confirm(
        L(
          `Xóa ${ids.size} trang khỏi bản nháp?`,
          `Remove ${ids.size} pages from this draft?`,
        ),
      )
    )
      return;
    setUndo(draft.pages);
    const next = draft.pages.filter((p) => !ids.has(p.id));
    change({ ...draft, pages: next });
    setSelected(new Set());
    if (ids.has(active ?? "")) setActive(next[0]?.id);
  }
  function move(from: number, to: number) {
    if (!draft || busy || from === to) return;
    change({ ...draft, pages: moveComicPage(draft.pages, from, to) });
  }
  const preview = `/${locale}/comic/${chapterId}${shared?"?preview=draft":""}`;
  return (
    <div className="comic-editor" data-ready={ready} data-pages={pages.length}>
      <header className="ce-topbar">
        <button
          className="ce-menu"
          aria-label={L("Danh sách chương", "Chapter list")}
          onClick={() => setRail(!rail)}
        >
          <Menu size={20} />
        </button>
        <a className="ce-book" href={`/${locale}`} onClick={e=>{e.preventDefault();void leave(`/${locale}`);}}>
          <BookImage size={24} />
          <span>
            {book.title}
            <small>{L("Biên tập truyện tranh", "Comic editor")}</small>
          </span>
        </a>
        <span className="ce-local-badge">
          {shared?L("Biên tập chung", "Shared editor"):L("Bản thử local", "Local preview")}
        </span>
        <div className="ce-save-actions">
          <a
            className="ce-preview"
            aria-label={L("Xem bản đọc", "Read preview")}
            href={preview}
            aria-disabled={busy || undefined}
            onClick={async (e) => {
              if (busy) {
                e.preventDefault();
                return;
              }
              if (dirty) {
                e.preventDefault();
                const saved = await save();
                if (saved) {
                  allowLeave.current = true;
                  location.href = preview;
                }
              }
            }}
          >
            <Eye size={17} />
            <span>{L("Xem bản đọc", "Read preview")}</span>
          </a>
          <button
            className="ce-primary"
            aria-label={shared?L("Lưu nháp chung", "Save shared draft"):L("Lưu nháp trên máy", "Save local draft")}
            disabled={!draft || busy}
            onClick={save}
          >
            {busy ? (
              <LoaderCircle className="cc-spin" size={17} />
            ) : (
              <Save size={17} />
            )}
            <span>{shared?L("Lưu nháp", "Save draft"):L("Lưu nháp trên máy", "Save local draft")}</span>
          </button>
        </div>
      </header>
      <div className="ce-local-notice">
        <span>
          {shared?L("Bản nháp riêng cho owner/editor; chỉ Xuất bản mới hiện với khách.","Drafts are private to editors; Publish makes them public."):L(
            "Thay đổi chỉ lưu trong trình duyệt trên máy này.",
            "Changes stay in this browser on this device.",
          )}
        </span>
        <span>{shared?(publishedRevision===null?L("Chưa xuất bản", "Unpublished"):L(`Đã xuất bản · bản ${publishedRevision}`,`Published · version ${publishedRevision}`)):L("Chưa xuất bản lên web", "Not published online")}</span>
      </div>
      {rail && (
        <button
          className="ce-rail-backdrop"
          aria-label={L("Đóng danh sách chương", "Close chapter list")}
          onClick={() => setRail(false)}
        />
      )}
      <aside className={`ce-chapters ${rail ? "is-open" : ""}`}>
        <div className="ce-rail-title">
          <h2>{L("Các chương", "Chapters")}</h2>
          <small>{book.chapters.length}</small>
        </div>
        <label className="ce-search">
          <Search size={16} />
          <input
            aria-label={L("Tìm chương biên tập", "Find editor chapter")}
            placeholder={L("Tìm chương…", "Find chapter…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <nav>
          {book.chapters
            .filter((c) =>
              c.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((c, n) => (
              <button
                key={c.id}
                disabled={busy}
                aria-current={c.id === chapterId ? "page" : undefined}
                onClick={() => switchChapter(c.id)}
              >
                <span>
                  {c.id === "preface"
                    ? "—"
                    : String(chapterNumber(book.chapters, c.id)).padStart(2, "0")}
                </span>
                <span>{c.title}</span>
                {c.id === chapterId && <BookImage size={15} />}
              </button>
            ))}
        </nav>
        <a className="ce-back" href={`/${locale}`}>
          <ArrowLeft size={16} />
          {L("Trang sách", "Book page")}
        </a>
      </aside>
      <main className="ce-workspace">
        <div className="ce-workspace-heading">
          <div>
            <h1>{L("Biên tập truyện tranh", "Comic editor")}</h1>
            <p>
              {L(
                "Tải trang ảnh, kiểm tra thứ tự rồi mở bản đọc để xem.",
                "Add page images, check their order, then open the reader preview.",
              )}
            </p>
          </div>
          <IconButton
            icon={Images}
            label={L("Ẩn hoặc hiện thông tin trang", "Toggle page inspector")}
            active={inspector}
            onClick={() => setInspector(!inspector)}
          />
        </div>
        {shared && <NetworkNotice locale={locale} active={busy} activity={progress} className="ce-error"/>}
        {error && (
          <div className="ce-error" role="alert">
            <AlertTriangle size={20} />
            <div>
              <p>{error}</p>
              {(shared||error.includes("cửa sổ khác")) && (
                <button
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm(
                        L(
                          "Bỏ thay đổi và mở lại bản đã lưu?",
                          "Discard changes and reload the saved draft?",
                        ),
                      )
                    )
                      void clearRecovery().then(()=>setReload((n) => n + 1));
                  }}
                >
                  {L("Tải lại bản đã lưu", "Reload saved draft")}
                </button>
              )}
            </div>
            <button
              aria-label={L("Đóng lỗi", "Dismiss error")}
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {!ready ? (
          <div className="ce-loading">
            <LoaderCircle className="cc-spin" />
            {L("Đang mở bản nháp…", "Opening draft…")}
          </div>
        ) : draft ? (
          <>
            <div className="ce-edition-tabs">
              <LanguageLinks locale={locale} chapterId={chapterId} admin comic disabled={busy} onNavigate={href=>{void leave(href);return false;}}/>
              <span>{L("Đang biên tập: VI · TT","Editing: EN · Comic")}</span>
            </div>
            {shared&&<section className="ce-publication" aria-label={L("Xuất bản TT","Comic publication")}>
              <a href={`/admin?lang=${locale}&chapter=${chapterId}`} onClick={e=>{e.preventDefault();void leave(e.currentTarget.href);}}>{L("Biên tập sách", "Book editor")}</a>
              <span>{dirty?L("Lưu nháp trước khi xuất bản","Save draft before publishing"):L(`Bản nháp · phiên bản ${draft.revision}`,`Draft · revision ${draft.revision}`)}</span>
              <button className="ce-primary" disabled={busy||dirty||!pages.length||draft.revision===0} onClick={()=>publication()}><Globe size={16}/>{L("Xuất bản TT","Publish comic")}</button>
              <button className="ce-secondary" disabled={busy||dirty||publishedRevision===null} onClick={()=>publication(true)}><EyeOff size={16}/>{L("Thu hồi TT","Withdraw comic")}</button>
              {localDraft&&<button className="ce-secondary" disabled={busy} onClick={()=>{if(window.confirm(L("Đưa nháp trên thiết bị vào vùng soạn? Bạn vẫn cần lưu nháp chung; bản server chưa bị thay đổi.","Load this device's draft into the editor? You must save it to update the shared draft.")))change({...localDraft,revision:draft.revision});}}>{L("Mở nháp trên thiết bị","Open device draft")}</button>}
            </section>}
            {shared&&<div className="ce-recovery-state" role="status">{recoveryState}</div>}
            {recoveryWarning&&<p className="ce-error" role="alert">{recoveryWarning}</p>}
            {!!recoveries.length&&<section className="ce-recoveries" aria-label={L("Thay đổi có thể khôi phục","Recoverable changes")}>
              <h2>{L("Có thay đổi chưa lưu trên thiết bị này","Unsaved changes on this device")}</h2>
              <p>{L("Khôi phục để xem lại; bản server và bản công khai chưa thay đổi.","Restore to review. The server draft and public edition stay unchanged.")}</p>
              {recoveries.map(r=><div key={r.key}><span><strong>{r.title||L("Chưa có tiêu đề","Untitled")}</strong><small>{L(`Bản ${r.revision} · ${r.pages} trang`,`Revision ${r.revision} · ${r.pages} pages`)} · {new Date(r.savedAt).toLocaleString(locale)}</small></span>
                <button className="ce-secondary" disabled={busy||dirty} onClick={async()=>{if(!scope)return;try{const copy=await readRecovery(scope,r.key);recovered.current=r;change(copy);setActive(copy.pages[0]?.id);}catch{warnRecovery();}}}>{L("Khôi phục thay đổi","Restore changes")}</button>
                <button className="ce-secondary" disabled={busy} onClick={async()=>{if(!scope||!window.confirm(L("Xóa bản khôi phục này?","Delete this recovery copy?")))return;try{await discardRecovery(scope,r.key,r.sequence,r.sequence);setRecoveries(await listRecoveries(scope));}catch{warnRecovery();}}}>{L("Xóa bản khôi phục","Delete recovery copy")}</button></div>)}
            </section>}
            <div className="ce-metadata">
              <label>
                {L("Tiêu đề chương", "Chapter title")}
                <input
                  aria-label={L("Tiêu đề chương", "Chapter title")}
                  maxLength={300}
                  value={draft.title}
                  disabled={busy}
                  onChange={(e) => change({ ...draft, title: e.target.value })}
                />
              </label>
            </div>
            <section
              className={`ce-dropzone ${dragOver ? "is-dragover" : ""}`}
              aria-label={L(
                "Vùng tải trang truyện tranh",
                "Comic page upload area",
              )}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files") && !busy) {
                  e.preventDefault();
                  setDragOver(true);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!busy) void upload([...e.dataTransfer.files]);
              }}
            >
              <div className="ce-upload-symbol">
                <Upload size={28} />
              </div>
              <div className="ce-upload-copy">
                <h2>
                  {L("Thả trang truyện vào đây", "Drop your comic pages here")}
                </h2>
                <p>
                  {L(
                    "Chọn nhiều ảnh hoặc một tệp ZIP/CBZ. Bạn có thể sắp lại sau.",
                    "Choose multiple images or a ZIP/CBZ archive. Reorder them afterward.",
                  )}
                </p>
                <small>
                  JPG · PNG · WebP{" "}
                  <span>20 MB/{L("ảnh", "image")} · 50 MB/ZIP</span>
                </small>
              </div>
              <button
                className="ce-secondary"
                disabled={busy}
                onClick={() => file.current?.click()}
              >
                <ImagePlus size={18} />
                {L("Chọn tệp", "Choose files")}
              </button>
              <input
                ref={file}
                className="ce-file-input"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.zip,.cbz"
                aria-label={L("Thêm ảnh hoặc ZIP", "Add images or ZIP")}
                disabled={busy}
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  void upload(files);
                }}
              />
            </section>
            <div className="ce-page-heading">
              <div>
                <h2>
                  {L("Trang truyện", "Comic pages")} <span>{pages.length}</span>
                </h2>
                <p>
                  {L(
                    "Kéo để đổi thứ tự. Thứ tự dưới đây là thứ tự người đọc sẽ thấy.",
                    "Drag to reorder. This is the order your reader will see.",
                  )}
                </p>
              </div>
              <div className="ce-order-actions">
                <button
                  disabled={busy || pages.length < 2}
                  onClick={() =>
                    change({ ...draft, pages: naturalComicOrder(pages) })
                  }
                >
                  {L("Xếp theo tên", "Sort by filename")}
                </button>
                <button
                  disabled={busy || chapterId !== "chapter-1"}
                  onClick={() => {
                    if (
                      !window.confirm(
                        L(
                          "Thay danh sách hiện tại bằng 2 ảnh mẫu? Chưa ghi đè bản đã lưu.",
                          "Replace this list with the two sample pages? The saved draft is unchanged until you save.",
                        ),
                      )
                    )
                      return;
                    setUndo(pages);
                    const sample = sampleComic(chapterId, draft.title);
                    change({ ...draft, pages: sample.pages });
                    setActive(sample.pages[0]?.id);
                    setSelected(new Set());
                  }}
                >
                  <RotateCcw size={15} />
                  {L("Ảnh mẫu", "Sample pages")}
                </button>
              </div>
            </div>
            <div className="ce-page-toolbar">
              <label>
                <input
                  type="checkbox"
                  disabled={busy || !pages.length}
                  checked={!!pages.length && selected.size === pages.length}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? new Set(pages.map((p) => p.id))
                        : new Set(),
                    )
                  }
                />
                {selected.size
                  ? L(
                      `Đã chọn ${selected.size} trang`,
                      `${selected.size} pages selected`,
                    )
                  : L("Chọn tất cả", "Select all")}
              </label>
              <span>
                {bytes(total)} · {L("giữ ảnh gốc", "original images kept")}
              </span>
              {selected.size > 0 && (
                <button disabled={busy} onClick={() => remove(selected)}>
                  <Trash2 size={15} />
                  {L("Xóa đã chọn", "Remove selected")}
                </button>
              )}
              {undo && (
                <button
                  disabled={busy}
                  onClick={() => {
                    change({ ...draft, pages: undo });
                    setUndo(undefined);
                    setSelected(new Set());
                    setActive(undo[0]?.id);
                  }}
                >
                  <RotateCcw size={15} />
                  {L("Hoàn tác", "Undo")}
                </button>
              )}
            </div>
            {pages.length ? (
              <ol className="ce-page-grid">
                {pages.map((p, n) => (
                  <li
                    key={p.id}
                    className={`ce-page-card ${active === p.id ? "is-active" : ""} ${selected.has(p.id) ? "is-selected" : ""}`}
                    draggable={!busy}
                    onDragStart={(e) => {
                      setDragged(p.id);
                      e.dataTransfer.setData("application/x-tkml-page", p.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragged(undefined)}
                    onDragOver={(e) => {
                      if (dragged && !busy) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!dragged || busy) return;
                      e.preventDefault();
                      e.stopPropagation();
                      move(
                        pages.findIndex((p) => p.id === dragged),
                        n,
                      );
                      setDragged(undefined);
                    }}
                  >
                    <div className="ce-card-top">
                      <label>
                        <input
                          type="checkbox"
                          aria-label={L(
                            `Chọn trang ${n + 1}`,
                            `Select page ${n + 1}`,
                          )}
                          disabled={busy}
                          checked={selected.has(p.id)}
                          onChange={(e) =>
                            setSelected((old) => {
                              const next = new Set(old);
                              e.target.checked
                                ? next.add(p.id)
                                : next.delete(p.id);
                              return next;
                            })
                          }
                        />
                        <span>{String(n + 1).padStart(2, "0")}</span>
                      </label>
                      <GripVertical size={17} aria-hidden="true" />
                    </div>
                    <button
                      className="ce-thumb"
                      aria-label={L(
                        `Xem trang ${n + 1}`,
                        `Inspect page ${n + 1}`,
                      )}
                      onClick={() => {
                        setActive(p.id);
                        setInspector(true);
                      }}
                    >
                      <img
                        src={p.path?.startsWith("/api/comic/assets/")?p.path+"?view=thumb":urls[p.id] ?? p.path}
                        loading="lazy" decoding="async"
                        onError={e=>{if(p.path&&e.currentTarget.src.includes("view=thumb"))e.currentTarget.src=p.path;}}
                        alt={p.name}
                        width={p.width}
                        height={p.height}
                        draggable={false}
                      />
                    </button>
                    <div className="ce-card-info">
                      <strong title={p.name}>{p.name}</strong>
                      <span>
                        {p.width} × {p.height} <i>·</i> {bytes(p.bytes)}
                      </span>
                    </div>
                    <div className="ce-card-actions">
                      <button
                        aria-label={L(
                          `Đưa trang ${n + 1} lên`,
                          `Move page ${n + 1} up`,
                        )}
                        disabled={busy || n === 0}
                        onClick={() => move(n, n - 1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        aria-label={L(
                          `Đưa trang ${n + 1} xuống`,
                          `Move page ${n + 1} down`,
                        )}
                        disabled={busy || n === pages.length - 1}
                        onClick={() => move(n, n + 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        aria-label={L(
                          `Xóa trang ${n + 1}`,
                          `Remove page ${n + 1}`,
                        )}
                        disabled={busy}
                        onClick={() => remove(new Set([p.id]))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="ce-empty-pages">
                <Images size={38} />
                <h3>
                  {L(
                    "Chương này đang chờ những trang đầu tiên",
                    "This chapter is waiting for its first pages",
                  )}
                </h3>
                <p>
                  {L(
                    "Tải ảnh ở phía trên để bắt đầu biên tập.",
                    "Upload images above to start editing.",
                  )}
                </p>
              </div>
            )}
          </>
        ) : null}
        <div className="ce-status" role="status">
          {busy ? (
            <>
              <LoaderCircle className="cc-spin" size={16} />
              {progress || L("Đang lưu bản nháp…", "Saving draft…")}
            </>
          ) : (
            <>
              <span className={dirty ? "ce-unsaved" : "ce-saved"}>
                {dirty ? <span /> : <CheckCircle2 size={16} />}
              </span>
              {status}
              {draft?.updatedAt ? (
                <time>
                  {new Date(draft.updatedAt).toLocaleTimeString(
                    locale === "vi" ? "vi-VN" : "en-US",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </time>
              ) : null}
            </>
          )}
        </div>
      </main>
      {inspector && (
        <aside className="ce-inspector">
          <div className="ce-inspector-heading">
            <h2>{L("Thông tin trang", "Page inspector")}</h2>
            <IconButton
              icon={X}
              label={L("Đóng thông tin trang", "Close inspector")}
              onClick={() => setInspector(false)}
            />
          </div>
          {activePage ? (
            <>
              <button
                className="ce-inspector-image"
                onClick={() => setLightbox(true)}
                aria-label={L("Xem ảnh lớn", "Enlarge image")}
              >
                <img
                  src={urls[activePage.id] ?? activePage.path}
                  alt={activePage.name}
                  width={activePage.width}
                  height={activePage.height}
                />
                <span>
                  <Eye size={16} />
                  {L("Xem ảnh lớn", "Enlarge image")}
                </span>
              </button>
              <div className="ce-inspector-count">
                {L("Trang", "Page")} {activeIndex + 1} / {pages.length}
              </div>
              <dl>
                <dt>{L("Tên tệp", "Filename")}</dt>
                <dd>{activePage.name}</dd>
                <dt>{L("Kích thước", "Dimensions")}</dt>
                <dd>
                  {activePage.width} × {activePage.height} px
                </dd>
                <dt>{L("Dung lượng", "File size")}</dt>
                <dd>{bytes(activePage.bytes)}</dd>
              </dl>
              {activePage.width < 600 && (
                <p className="ce-quality-note">
                  <AlertTriangle size={16} />
                  {L(
                    "Ảnh nhỏ có thể bị mờ khi đọc trên PC.",
                    "Small images may appear soft on desktop.",
                  )}
                </p>
              )}
              <button
                className="ce-secondary"
                disabled={busy}
                onClick={() => replace.current?.click()}
              >
                <ImagePlus size={17} />
                {L("Thay ảnh này", "Replace this image")}
              </button>
              <input
                ref={replace}
                className="ce-file-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                aria-label={L("Thay ảnh trang", "Replace page image")}
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload([f], true);
                }}
              />
              <div className="ce-inspector-tip">
                <CheckCircle2 size={18} />
                <p>
                  {L(
                    "Ảnh được giữ nguyên. Thứ tự có thể thay đổi trước khi lưu.",
                    "Original images are kept. Reorder them before saving.",
                  )}
                </p>
              </div>
            </>
          ) : (
            <div className="ce-inspector-empty">
              <Images size={32} />
              <p>
                {L(
                  "Chọn một trang để xem thông tin và ảnh lớn.",
                  "Select a page to inspect its details and enlarged image.",
                )}
              </p>
            </div>
          )}
          <div className="ce-local-summary">
            <h3>{shared?L("Bản nháp chung", "Shared draft"):L("Bản nháp local", "Local draft")}</h3>
            <p>
              {pages.length} {L("trang", "pages")} · {bytes(total)}
            </p>
            <small>
              {shared?L("Lưu nháp chỉ chia sẻ với owner/editor. Bấm Xuất bản TT để mọi người đọc; Thu hồi TT giữ lại nháp.","Saved drafts are private to editors. Publish comic makes them public; Withdraw preserves the draft."):L(
                "Chỉ bạn trên trình duyệt này thấy thay đổi. Không tải lên Supabase hay xuất bản.",
                "Only this browser sees these changes. Nothing is uploaded to Supabase or published.",
              )}
            </small>
          </div>
        </aside>
      )}
      <dialog
        className="ce-lightbox"
        ref={dialog}
        onClose={() => setLightbox(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLightbox(false);
        }}
      >
        <div>
          <IconButton
            icon={X}
            label={L("Đóng ảnh lớn", "Close enlarged image")}
            onClick={() => setLightbox(false)}
          />
          {activePage && (
            <img
              src={urls[activePage.id] ?? activePage.path}
              alt={activePage.name}
            />
          )}
          <footer>
            <IconButton
              icon={ChevronLeft}
              label={L("Ảnh trước", "Previous image")}
              disabled={activeIndex <= 0}
              onClick={() => setActive(pages[activeIndex - 1]?.id)}
            />
            <span>
              {activeIndex + 1} / {pages.length}
            </span>
            <IconButton
              icon={ChevronRight}
              label={L("Ảnh sau", "Next image")}
              disabled={activeIndex >= pages.length - 1}
              onClick={() => setActive(pages[activeIndex + 1]?.id)}
            />
          </footer>
        </div>
      </dialog>
    </div>
  );
}
