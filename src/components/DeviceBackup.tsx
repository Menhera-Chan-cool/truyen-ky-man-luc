"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { readDeviceBackup } from "../lib/db";
import {
  MAX_BACKUP_BYTES,
  parseReaderBackup,
  type ReaderBackup,
} from "../lib/reader-backup";
import type { Locale } from "../lib/types";
import { tx } from "../lib/content";
export default function DeviceBackup({
  locale,
  onRestore,
  onBeforeExport,
}: {
  locale: Locale;
  onRestore: (
    backup: ReaderBackup,
    reading: boolean,
  ) => Promise<{ added: number }>;
  onBeforeExport: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReaderBackup | null>(null),
    [reading, setReading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const L = (vi: string, en: string) => tx(locale, vi, en);
  async function exportData() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await onBeforeExport();
      const data = await readDeviceBackup(),
        text = JSON.stringify(data, null, 2);
      parseReaderBackup(text);
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "truyen-ky-man-luc-reader-" +
        new Date().toISOString().slice(0, 10) +
        ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(
        L("Đã tạo bản sao dữ liệu đọc.", "Reading data backup created."),
      );
    } catch {
      setError(
        L(
          "Không tạo được bản sao. Hãy kiểm tra quyền lưu dữ liệu trên thiết bị hoặc giới hạn 10 MB.",
          "Unable to create a backup. Check device storage access or the 10 MB limit.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setStatus("");
    setPreview(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw Error("Too large");
      setPreview(parseReaderBackup(await file.text()));
    } catch {
      setError(
        L(
          "File không hợp lệ, không đúng sách/phiên bản hỗ trợ hoặc vượt 10 MB. Chưa thay đổi dữ liệu trên thiết bị.",
          "Invalid file, unsupported book/version or larger than 10 MB. Device data has not changed.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!preview) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await onRestore(preview, reading);
      setPreview(null);
      setStatus(
        L(
          `Đã khôi phục và thêm ${result.added} ghi chú. Ghi chú hiện có được giữ lại.`,
          `Restored backup and added ${result.added} notes. Existing notes were preserved.`,
        ),
      );
    } catch {
      setError(
        L(
          "Không khôi phục được bản sao. Hãy kiểm tra quyền lưu dữ liệu trên thiết bị.",
          "Unable to restore the backup. Check device storage access.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="device-backup">
      <summary>
        {L("Dữ liệu đọc trên thiết bị", "Reading data on this device")}
      </summary>
      <p className="tiny muted">
        {L(
          "Sao lưu ghi chú, đánh dấu, tiến độ và cài đặt bằng JSON. File được xử lý trên thiết bị, không gửi lên máy chủ. Tối đa 10 MB.",
          "Back up notes, bookmarks, progress and settings as JSON. Files stay on your device and are not uploaded. Up to 10 MB.",
        )}
      </p>
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={busy}
          onClick={exportData}
        >
          <Download size={15} />
          {L("Xuất bản sao JSON", "Export JSON backup")}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={15} />
          {L("Nhập bản sao JSON", "Import JSON backup")}
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".json,application/json"
          aria-label={L("File bản sao dữ liệu đọc", "Reading data backup file")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void readFile(file);
          }}
        />
      </div>
      {preview && (
        <div className="backup-preview">
          <p>
            {L("Xem trước bản sao", "Backup preview")}:{" "}
            {preview.annotations.length}{" "}
            {L("ghi chú/đánh dấu", "notes/bookmarks")} ·{" "}
            {preview.progress.length} {L("vị trí đọc", "reading positions")}
            {" · "}
            {preview.listening?.length ?? 0}{" "}
            {L("chỗ nghe", "listening positions")}
          </p>
          <p className="tiny muted">
            {new Date(preview.exportedAt).toLocaleString(
              locale === "vi" ? "vi-VN" : "en-US",
            )}
          </p>
          <p className="tiny muted">
            {L(
              "Gộp vào ghi chú hiện có; bản trùng giống nhau được bỏ qua, bản khác nội dung được giữ riêng.",
              "Merge with existing notes; identical duplicates are skipped and different versions are kept separately.",
            )}
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={reading}
              disabled={busy}
              onChange={(e) => setReading(e.target.checked)}
            />
            {L(
              "Khôi phục cài đặt và tiến độ từ file",
              "Restore settings and progress from the file",
            )}
          </label>
          {reading && (
            <p className="tiny muted">
              {L(
                "Cài đặt, vị trí đọc và chỗ nghe có trong file sẽ thay thế giá trị tương ứng trên thiết bị.",
                "Settings, reading and listening positions in the file replace their matching device values.",
              )}
            </p>
          )}
          <div className="button-row">
            <button
              className="primary-button"
              disabled={busy}
              onClick={restore}
            >
              {L("Khôi phục bản sao", "Restore backup")}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              {L("Hủy", "Cancel")}
            </button>
          </div>
        </div>
      )}
      {busy && (
        <p role="status">{L("Đang xử lý bản sao…", "Processing backup…")}</p>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
