"use client";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Component, Suspense, useEffect, useRef, type ReactNode } from "react";
export class ModuleBoundary extends Component<
  { locale: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const vi = this.props.locale === "vi";
    if (this.state.failed)
      return (
        <div role="alert" className="module-loading">
          <p>
            {vi
              ? "Không tải được công cụ. Hãy tải lại trang để thử lại."
              : "The tool could not load. Reload the page to retry."}
          </p>
          <button
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            {vi ? "Tải lại" : "Reload"}
          </button>
        </div>
      );
    return (
      <Suspense
        fallback={
          <div className="module-loading" role="status">
            {vi ? "Đang tải công cụ…" : "Loading tool…"}
          </div>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
export function IconButton({
  icon: Icon,
  label,
  active,
  children,
  ...props
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""}`}
      data-tooltip={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      <Icon size={19} strokeWidth={1.6} />
      {children}
    </button>
  );
}
export function Panel({
  title,
  onClose,
  children,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, [onClose]);
  return (
    <section className="reader-panel" aria-label={title}>
      <div ref={ref} tabIndex={-1} className="panel-heading">
        <h2>{title}</h2>
        <IconButton icon={X} label={closeLabel} onClick={onClose} />
      </div>
      {children}
    </section>
  );
}
export function LanguageLinks({
  locale,
  chapterId,
  admin = false,
  disabled = false,
}: {
  locale: string;
  chapterId?: string;
  admin?: boolean;
  disabled?: boolean;
}) {
  return (
    <nav
      className="language-switch"
      aria-label={locale === "vi" ? "Ngôn ngữ" : "Language"}
    >
      <a
        href={
          admin
            ? "/admin?lang=vi"
            : `/vi${chapterId ? "/read/" + chapterId : ""}`
        }
        hrefLang="vi"
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        lang="vi"
        aria-current={locale === "vi" ? "page" : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        }}
        aria-label="Tiếng Việt"
      >
        VI
      </a>
      <span aria-hidden="true" />
      <a
        href={
          admin
            ? "/admin?lang=en"
            : `/en${chapterId ? "/read/" + chapterId : ""}`
        }
        hrefLang="en"
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        lang="en"
        aria-current={locale === "en" ? "page" : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        }}
        aria-label="English"
      >
        EN
      </a>
    </nav>
  );
}
