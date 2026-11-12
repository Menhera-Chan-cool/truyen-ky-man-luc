"use client";
import { useEffect, useRef, useState } from "react";
import {
  readOfflineBook,
  downloadOfflineBook,
  removeOfflineBook,
} from "../lib/offline-client";
import type { OfflineBook } from "../lib/offline-book";
import type { Locale } from "../lib/types";
export default function OfflineDownloads({ locale }: { locale: Locale }) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    [saved, setSaved] = useState<OfflineBook>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<{done:number;total:number;bytes:number;phase?:'lookup'}>({ done: 0, total: 0, bytes: 0 }),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const load = () => {
      void readOfflineBook()
        .then(setSaved)
        .catch(() => {});
    };
    load();
    window.addEventListener("offline-book-changed", load);
    return () => {
      controller.current?.abort();
      window.removeEventListener("offline-book-changed", load);
    };
  }, []);
  return (
    <section className="offline-download">
      <h3>{L("Đọc ngoại tuyến", "Offline reading")}</h3>
      <p className="tiny muted">
        {L(
          "Tải cả bản VI/EN đã xuất bản và tài nguyên đọc. Khi mất mạng, mở mục Đọc bản đã tải. Nháp và trang quản trị không được tải. Tối đa 200 MB/gói.",
          "Download both published languages and reading resources. When offline, open the downloaded edition. Drafts and admin pages are excluded. Up to 200 MB/download.",
        )}
      </p>
      {saved && (
        <>
          <p role="status">
            {L("Đã tải", "Downloaded")}:{" "}
            {new Date(saved.downloadedAt).toLocaleString(
              locale === "vi" ? "vi-VN" : "en-US",
            )}{" "}
            · {(saved.bytes / 1024 / 1024).toFixed(1)} MB
            {saved.alignmentKeys&&<> · {L('Tra ngoại tuyến','Offline lookup')}: {Object.keys(saved.alignmentKeys).length} {L('chương','chapters')}</>}
          </p>
          <a className="secondary-button" href={"/offline?locale=" + locale}>
            {L("Đọc bản đã tải", "Read downloaded book")}
          </a>
        </>
      )}
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            const c = new AbortController();
            controller.current = c;
            setBusy(true);
            setError("");
            setProgress({ done: 0, total: 0, bytes: 0 });
            try {
              setSaved(await downloadOfflineBook(setProgress, c.signal));
            } catch (e) {
              setError(
                e instanceof Error && e.name === "AbortError"
                  ? L(
                      "Đã hủy tải. Bản tải trước vẫn được giữ.",
                      "Download cancelled. The previous download is preserved.",
                    )
                  : L(
                      "Chưa tải hoàn tất. Kiểm tra kết nối hoặc bộ nhớ và thử lại.",
                      "Download incomplete. Check the connection or storage and retry.",
                    ),
              );
            } finally {
              setBusy(false);
              controller.current = null;
            }
          }}
        >
          {saved
            ? L("Cập nhật bản tải", "Update download")
            : L(
                "Tải VI/EN để đọc ngoại tuyến",
                "Download VI/EN for offline reading",
              )}
        </button>
        {busy && (
          <button
            className="secondary-button"
            onClick={() => controller.current?.abort()}
          >
            {L("Hủy tải", "Cancel download")}
          </button>
        )}
        {saved && !busy && (
          <button
            className="text-button"
            onClick={async () => {
              setBusy(true);
              try {
                await removeOfflineBook();
                setSaved(undefined);
              } catch {
                setError(
                  L(
                    "Không xóa được bản tải.",
                    "Unable to remove the download.",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {L("Xóa bản tải", "Remove download")}
          </button>
        )}
      </div>
      {busy && (
        <p role="status">
          {progress.phase==='lookup'?L('Đang tải dữ liệu tra','Downloading lookup data'):L("Đang tải", "Downloading")} {progress.done}/{progress.total || "…"}{" "}
          · {(progress.bytes / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="tiny muted">
        {L(
          "Ghi chú và tiến độ vẫn giữ khi xóa bản tải. Trình duyệt có thể dọn dữ liệu nếu thiếu dung lượng. Giọng đọc online của thiết bị có thể cần mạng.",
          "Removing the download keeps notes and progress. The browser may clear data when storage is low. Device online voices may still require a connection.",
        )}
      </p>
    </section>
  );
}
