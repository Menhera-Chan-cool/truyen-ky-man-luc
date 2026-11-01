"use client";
import { useState, useEffect } from "react";
import { Upload, FilePlus2, CheckSquare } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { importFile } from "../lib/importer";
import {novelRequest as adminRequest} from "../lib/novel-remote";
import { storeSource, uploadAsset, uploadInlineImages } from "../lib/uploads";
import { tx } from "../lib/content";
import type { ImportChapter, Locale } from "../lib/types";
import dynamic from "next/dynamic";
const PdfViewer=dynamic(()=>import("./PdfViewer"));
import { slicePdf } from "../lib/pdf";
type Candidate = ImportChapter & {
  key: string;
  selected: boolean;
  file: File;
  pages?: number;
  from: number;
  to: number;
};
export default function ImportPanel({
  locale,
  editionLocale,
  onEditionChange,
  chapters,
  onDone,
  onError,
  onBusyChange,
  onDirtyChange,
}: {
  locale: Locale;
  editionLocale: Locale;
  onEditionChange: (locale: Locale) => void;
  chapters: { id: string; title: string; revision: number }[];
  onDone: () => void | Promise<void>;
  onError: (error: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const language = editionLocale,
    setLanguage = onEditionChange;
  const [items, setItems] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [replace, setReplace] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const L = (vi: string, en: string) => tx(locale, vi, en);
  const selected = items.filter((c) => c.selected);
  useEffect(() => {
    onDirtyChange?.(items.length > 0);
  }, [items, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  function setWorking(value: boolean) {
    setBusy(value);
    onBusyChange?.(value);
  }
  const update = (key: string, changes: Partial<Candidate>) =>
    setItems((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...changes } : c)),
    );
  async function load(files: FileList | File[] | null) {
    if (!files?.length) return;
    setWorking(true);
    try {
      const result: Candidate[] = [];
      for (const file of Array.from(files)) {
        setStatus(L("Đang đọc ", "Reading ") + file.name);
        const parts = await importFile(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          language,
        );
        for (const part of parts) {
          let pages: number | undefined;
          if (part.pdfBytes)
            pages = (await PDFDocument.load(part.pdfBytes)).getPageCount();
          result.push({
            ...part,
            key: crypto.randomUUID(),
            selected: true,
            file,
            pages,
            from: 1,
            to: pages ?? 1,
          });
        }
      }
      setItems((prev) => [...prev, ...result]);
      setStatus("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setWorking(false);
    }
  }
  async function save() {
    if (!selected.length) return;
    setWorking(true);
    let committed=false;
    try {
      const sources = new Map<File, string>();
      const prepared = [];
      for (const item of selected) {
        setStatus(L("Chuẩn bị ", "Preparing ") + item.title);
        if (!sources.has(item.file))
          sources.set(item.file, await storeSource(item.file));
        let html = item.html,
          pdfPath: string | undefined,
          kind = item.kind;
        if (item.pdfBytes) {
          if (
            !Number.isInteger(item.from) ||
            !Number.isInteger(item.to) ||
            item.from < 1 ||
            item.to < item.from ||
            item.to > (item.pages ?? 0)
          )
            throw new Error(
              L("Khoảng trang PDF không hợp lệ.", "Invalid PDF page range."),
            );
          const bytes = await slicePdf(item.pdfBytes, item.from, item.to);
          const asset = await uploadAsset(
            new Blob([new Uint8Array(bytes).buffer], {
              type: "application/pdf",
            }),
            "chapter.pdf",
          );
          pdfPath = asset.path;
        }
        html = await uploadInlineImages(html);
        prepared.push({
          id: item.id,
          locale: language,
          title: item.title,
          html,
          kind,
          pdfPath,
          expectedRevision:
            chapters.find((c) => c.id === item.id)?.revision ?? 0,
        });
      }
      setStatus(L("Đang lưu bản nháp…", "Saving drafts…"));
      await adminRequest("chapters", {
        action: "import",
        items: prepared,
        confirmReplace: replace,
      });
      committed=true;
      await onDone();
      setItems([]);
      onDirtyChange?.(false);
      setStatus("");
    } catch (e) {
      onError(committed?L("Server đã xác nhận nhập nháp nhưng chưa tải lại được. Giữ danh sách và tải lại bản server trước khi nhập tiếp.","Draft import was confirmed, but refresh failed. Keep this list and reload server state before importing again."):e instanceof Error ? e.message : "Import failed");
    } finally {
      setStatus("");setWorking(false);
    }
  }
  async function extractForReview(item: Candidate) {
    if (!item.pdfBytes) return;
    if (
      !Number.isInteger(item.from) ||
      !Number.isInteger(item.to) ||
      item.from < 1 ||
      item.to < item.from ||
      item.to > (item.pages ?? 0)
    ) {
      onError(L("Khoảng trang PDF không hợp lệ.", "Invalid PDF page range."));
      return;
    }
    setWorking(true);
    setStatus(L("Đang trích lớp chữ…", "Extracting the text layer…"));
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ data: item.pdfBytes.slice() });
      try {
        const doc = await task.promise;
        const paragraphs: string[] = [];
        for (let p = item.from; p <= item.to; p++) {
          const page = await doc.getPage(p);
          const text = await page.getTextContent();
          paragraphs.push(
            text.items.map((i) => ("str" in i ? i.str : "")).join(" "),
          );
        }
        if (!paragraphs.join("").trim())
          throw new Error(
            L(
              "PDF không có lớp chữ; không có OCR trong bản này.",
              "This PDF has no text layer; OCR is not included.",
            ),
          );
        const html = paragraphs
          .map(
            (p) =>
              `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
          )
          .join("");
        update(item.key, {
          html,
          kind: "text",
          pdfBytes: undefined,
          pages: undefined,
        });
        setPreviewPdf(null);
      } finally {
        await task.destroy();
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setWorking(false);
      setStatus("");
    }
  }
  return (
    <section>
      <div className="import-intro">
        <h2>{L("Nhập nội dung sách", "Import book content")}</h2>
        <p>
          {L(
            "Nhập một chương, một nhóm chương hoặc cả quyển. Xem trước và ghép chương trước khi lưu. Nội dung được lưu thành bản nháp, chưa hiển thị cho người đọc.",
            "Import a chapter, a selection, or the whole book. Review and map chapters before saving. Imported content stays in drafts until published.",
          )}
        </p>
      </div>
      <label className="field-group" style={{ maxWidth: 280 }}>
        {L("Bản nội dung", "Content edition")}
        <select
          value={language}
          disabled={items.length > 0 || busy}
          onChange={(e) => setLanguage(e.target.value as Locale)}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) load(e.dataTransfer.files);
        }}
      >
        <Upload size={28} />
        <strong>
          {L("Chọn hoặc thả file vào đây", "Choose files or drop them here")}
        </strong>
        <span>
          EPUB · DOCX · TXT · HTML · PDF —{" "}
          {L("tối đa 50 MB/file", "up to 50 MB each")}
        </span>
        <input
          type="file"
          multiple
          disabled={busy}
          accept=".epub,.docx,.txt,.html,.htm,.pdf"
          onChange={(e) => {
            load(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {items.length > 0 && (
        <>
          <div className="button-row">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                setItems(items.map((c) => ({ ...c, selected: true })))
              }
            >
              <CheckSquare size={15} />
              {L("Chọn tất cả", "Select all")}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                setItems(items.map((c) => ({ ...c, selected: false })))
              }
            >
              {L("Bỏ chọn", "Deselect all")}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setItems([])}
            >
              {L("Xóa danh sách nhập", "Clear import list")}
            </button>
            <span className="tiny">
              {selected.length}/{items.length}{" "}
              {L("phần được chọn", "sections selected")}
            </span>
          </div>
          <div className="import-list">
            {items.map((item) => (
              <div className="import-row" key={item.key}>
                <div className="import-row-top">
                  <input
                    type="checkbox"
                    aria-label={`${L("Chọn", "Select")} ${item.title}`}
                    checked={item.selected}
                    onChange={(e) =>
                      update(item.key, { selected: e.target.checked })
                    }
                  />
                  <input
                    aria-label={L(
                      "Tiêu đề chương nhập",
                      "Imported chapter title",
                    )}
                    value={item.title}
                    onChange={(e) =>
                      update(item.key, { title: e.target.value })
                    }
                  />
                  <select
                    aria-label={L("Ghép chương", "Map chapter")}
                    value={
                      chapters.some((c) => c.id === item.id) ? item.id : "new"
                    }
                    onChange={(e) =>
                      update(item.key, {
                        id:
                          e.target.value === "new"
                            ? `section-${crypto.randomUUID()}`
                            : e.target.value,
                      })
                    }
                  >
                    <option value="new">
                      {L("Thêm phần mới", "Add a new section")}
                    </option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {L("Thay thế: ", "Replace: ")}
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                {chapters.some((c) => c.id === item.id) && (
                  <p className="tiny" style={{ color: "#8d342b" }}>
                    {L(
                      "Sẽ thay thế bản nháp của chương này. Bản công khai chỉ đổi khi bạn xuất bản.",
                      "This will replace this chapter’s draft. The published version changes only when you publish.",
                    )}
                  </p>
                )}
                {item.pages ? (
                  <>
                    <div className="pdf-range">
                      <span>
                        PDF · {item.pages} {L("trang", "pages")}
                      </span>
                      <label>
                        {L("Từ", "From")}{" "}
                        <input
                          type="number"
                          min="1"
                          max={item.pages}
                          value={item.from}
                          onChange={(e) =>
                            update(item.key, { from: +e.target.value })
                          }
                        />
                      </label>
                      <label>
                        {L("Đến", "To")}{" "}
                        <input
                          type="number"
                          min={item.from}
                          max={item.pages}
                          value={item.to}
                          onChange={(e) =>
                            update(item.key, { to: +e.target.value })
                          }
                        />
                      </label>
                      <button
                        className="text-button"
                        onClick={() =>
                          setItems((prev) => [
                            ...prev,
                            {
                              ...item,
                              key: crypto.randomUUID(),
                              id: `section-${crypto.randomUUID()}`,
                              title: item.title + " (2)",
                            },
                          ])
                        }
                      >
                        <FilePlus2 size={14} />
                        {L("Tách thêm chương", "Add another chapter range")}
                      </button>
                    </div>
                    <div className="button-row">
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() =>
                          setPreviewPdf(
                            previewPdf === item.key ? null : item.key,
                          )
                        }
                      >
                        {L("Xem PDF gốc", "Preview original PDF")}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => extractForReview(item)}
                      >
                        {L(
                          "Trích chữ để xem / sửa trước khi nhập",
                          "Extract text to review / edit before importing",
                        )}
                      </button>
                    </div>
                    {previewPdf === item.key && item.pdfBytes && (
                      <PdfImportPreview bytes={item.pdfBytes} locale={locale} />
                    )}
                  </>
                ) : (
                  <details>
                    <summary>
                      {L(
                        "Xem / sửa HTML trước khi nhập",
                        "Review / edit HTML before importing",
                      )}
                    </summary>
                    <textarea
                      aria-label={L(
                        "HTML trước khi nhập",
                        "HTML import preview",
                      )}
                      value={item.html}
                      onChange={(e) =>
                        update(item.key, { html: e.target.value })
                      }
                    />
                  </details>
                )}
              </div>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            {L(
              "Tôi xác nhận thay thế các chương được ghép vào nội dung hiện có.",
              "I confirm replacing selected chapters mapped to existing content.",
            )}
          </label>
          <button
            className="primary-button"
            disabled={busy || !selected.length}
            onClick={save}
          >
            <Upload size={16} />
            {busy
              ? L("Đang xử lý…", "Processing…")
              : L(
                  "Lưu các phần đã chọn thành bản nháp",
                  "Save selected sections as drafts",
                )}
          </button>
        </>
      )}
      {status && (
        <p role="status" className="field-group">
          {status}
        </p>
      )}
    </section>
  );
}
const ignoreText = () => {};
function PdfImportPreview({
  bytes,
  locale,
}: {
  bytes: Uint8Array;
  locale: Locale;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }),
    );
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [bytes]);
  return url ? (
    <div style={{ marginTop: 20, maxHeight: 600, overflow: "auto" }}>
      <PdfViewer src={url} locale={locale} onText={ignoreText} />
    </div>
  ) : null;
}
