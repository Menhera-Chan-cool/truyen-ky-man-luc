"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "./Ui";
import { tx } from "../lib/content";
import type { Locale } from "../lib/types";
export default function PdfViewer({
  src,
  locale,
  onText,
}: {
  src: string;
  locale: Locale;
  onText: (text: string) => void;
}) {
  const [page, setPage] = useState(1),
    [count, setCount] = useState(0),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const documentRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    import("pdfjs-dist")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({ url: src });
        const doc = await task.promise;
        if (cancelled) {
          task.destroy();
          return;
        }
        documentRef.current = doc;
        setCount(doc.numPages);
        setPage(1);
      })
      .catch(() =>
        setError(
          tx(
            locale,
            "Không mở được PDF. Hãy thử tải lại.",
            "Unable to open this PDF. Please reload.",
          ),
        ),
      );
    return () => {
      cancelled = true;
      task?.destroy();
      documentRef.current = null;
    };
  }, [src, locale]);
  useEffect(() => {
    let cancelled = false;
    let rendering: import("pdfjs-dist").RenderTask | undefined;
    let textLayer: import("pdfjs-dist").TextLayer | undefined;
    const render = async () => {
      const doc = documentRef.current;
      if (!doc || !host.current) return;
      const pdfjs = await import("pdfjs-dist");
      const pdfPage = await doc.getPage(page);
      if (cancelled || !host.current) return;
      const normal = pdfPage.getViewport({ scale: 1 });
      const available =
        Math.min(host.current.parentElement?.clientWidth ?? 780, 1000) - 32;
      const scale = (available / normal.width) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const layer = document.createElement("div");
      layer.className = "textLayer";
      layer.style.setProperty("--scale-factor", String(scale));
      layer.style.setProperty("--total-scale-factor", String(scale));
      host.current.replaceChildren(canvas, layer);
      host.current.style.width = `${viewport.width}px`;
      host.current.style.height = `${viewport.height}px`;
      rendering = pdfPage.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      await rendering.promise;
      if (cancelled) return;
      const content = await pdfPage.getTextContent();
      onText(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
      textLayer = new pdfjs.TextLayer({
        textContentSource: content,
        container: layer,
        viewport,
      });
      await textLayer.render();
    };
    render().catch((e) => {
      if (!cancelled && e?.name !== "RenderingCancelledException")
        setError(
          tx(
            locale,
            "Không vẽ được trang PDF.",
            "Unable to render this PDF page.",
          ),
        );
    });
    return () => {
      cancelled = true;
      rendering?.cancel();
      textLayer?.cancel();
    };
  }, [page, count, zoom, locale, onText]);
  const L = (vi: string, en: string) => tx(locale, vi, en);
  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <IconButton
          icon={ChevronLeft}
          label={L("Trang PDF trước", "Previous PDF page")}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        />
        <label>
          {L("Trang", "Page")}{" "}
          <input
            aria-label={L("Trang PDF", "PDF page")}
            type="number"
            min="1"
            max={count || 1}
            value={page}
            onChange={(e) =>
              setPage(Math.min(count || 1, Math.max(1, +e.target.value)))
            }
          />{" "}
          / {count || "…"}
        </label>
        <IconButton
          icon={ChevronRight}
          label={L("Trang PDF sau", "Next PDF page")}
          disabled={page >= count}
          onClick={() => setPage(page + 1)}
        />
        <IconButton
          icon={ZoomOut}
          label={L("Thu nhỏ", "Zoom out")}
          disabled={zoom <= 0.5}
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
        />
        <span>{Math.round(zoom * 100)}%</span>
        <IconButton
          icon={ZoomIn}
          label={L("Phóng to", "Zoom in")}
          disabled={zoom >= 3}
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
        />
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !count ? (
        <p className="muted">{L("Đang mở PDF…", "Opening PDF…")}</p>
      ) : null}
      <div className="pdf-overflow">
        <div className="pdf-page" ref={host} />
      </div>
    </div>
  );
}
