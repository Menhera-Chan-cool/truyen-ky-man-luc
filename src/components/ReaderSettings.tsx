"use client";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sun,
  Moon,
  Palette,
  BookOpen,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Panel } from "./Ui";
import DeviceBackup from "./DeviceBackup";
import type { ReaderBackup } from "../lib/reader-backup";
import { tx } from "../lib/content";
import { readerFonts } from "../lib/reader";
import {
  defaultSettings,
  type Locale,
  type ReaderSettings,
} from "../lib/types";
export default function ReaderSettingsPanel({
  locale,
  settings,
  setSettings,
  onClose,
  isPdf,
  onRestore,
  onBeforeExport,
}: {
  locale: Locale;
  settings: ReaderSettings;
  setSettings: (s: ReaderSettings) => void;
  onClose: () => void;
  isPdf: boolean;
  onRestore: (
    backup: ReaderBackup,
    reading: boolean,
  ) => Promise<{ added: number }>;
  onBeforeExport: () => Promise<void>;
}) {
  const L = (vi: string, en: string) => tx(locale, vi, en);
  const update = (key: keyof ReaderSettings, value: string | number) =>
    setSettings({ ...settings, [key]: value });
  const choices = [
    ["light", "Sáng", "Light"],
    ["sepia", "Giấy ngà", "Sepia"],
    ["warm", "Ấm áp", "Warm"],
    ["coffee", "Cà phê", "Coffee"],
    ["dark", "Tối", "Dark"],
    ["dim", "Mờ", "Dim"],
    ["eink", "E-ink", "E-ink"],
    ["custom", "Tùy biến", "Custom"],
  ];
  return (
    <Panel
      title={L("Cài đặt trình đọc", "Reader settings")}
      onClose={onClose}
      closeLabel={L("Đóng", "Close")}
    >
      {!isPdf && (
        <div className="field-group">
          <h3>{L("Giao diện đọc", "Reader layout")}</h3>
          <div className="segmented">
            {(
              [
                ["ebook", "Ebook", FileText],
                ["book", L("Sách", "Book"), BookOpen],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                className={settings.layout === id ? "selected" : ""}
                aria-pressed={settings.layout === id}
                onClick={() => update("layout", id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          {settings.layout === "book" && (
            <p className="tiny muted">
              {L(
                "Lật trang bằng mũi tên hoặc vuốt ngang. Chương mới luôn bắt đầu trên trang sách mới.",
                "Turn pages with the arrows or a horizontal swipe. Each chapter starts on a new page.",
              )}
            </p>
          )}
        </div>
      )}
      <div className="field-group">
        <h3>{L("Chủ đề & nền", "Theme & background")}</h3>
        <div className="theme-grid">
          {choices.map(([id, vi, en]) => {
            const Icon =
              id === "dark" || id === "dim"
                ? Moon
                : id === "custom"
                  ? Palette
                  : Sun;
            return (
              <button
                key={id}
                className={settings.theme === id ? "selected" : ""}
                onClick={() => update("theme", id)}
                aria-pressed={settings.theme === id}
              >
                <Icon size={18} />
                {L(vi, en)}
              </button>
            );
          })}
        </div>
      </div>
      {settings.theme === "custom" && (
        <div className="custom-colors">
          {(["background", "foreground", "accent"] as const).map((key, i) => (
            <label key={key}>
              <span className="color-label">
                {
                  [
                    L("Màu nền", "Background"),
                    L("Màu chữ", "Text"),
                    L("Điểm nhấn", "Accent"),
                  ][i]
                }
              </span>
              <input
                aria-label={
                  [
                    L("Màu nền", "Background"),
                    L("Màu chữ", "Text"),
                    L("Điểm nhấn", "Accent"),
                  ][i]
                }
                type="color"
                value={settings[key]}
                onChange={(e) => update(key, e.target.value)}
              />
              <output>{settings[key].toUpperCase()}</output>
            </label>
          ))}
        </div>
      )}
      {isPdf ? (
        <p className="muted">
          {L(
            "PDF giữ phông và bố cục gốc. Dùng nút thu/phóng trên trang PDF.",
            "PDF preserves its original fonts and layout. Use the zoom controls above the page.",
          )}
        </p>
      ) : (
        <>
          <label className="field-group">
            {L("Phông chữ", "Font family")}
            <select
              value={settings.font}
              onChange={(e) => update("font", e.target.value)}
            >
              <optgroup
                label={L(
                  "Phông chữ hệ thống & chuẩn",
                  "Reading & system fonts",
                )}
              >
                {readerFonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="field-group range-label">
            {L("Cỡ chữ", "Font size")}
            <output>{settings.fontSize}px</output>
            <input
              aria-label={L("Cỡ chữ", "Font size")}
              type="range"
              min="14"
              max="36"
              value={settings.fontSize}
              onChange={(e) => update("fontSize", +e.target.value)}
            />
          </label>
          <label className="field-group range-label">
            {L("Giãn dòng", "Line height")}
            <output>{settings.lineHeight.toFixed(1)}</output>
            <input
              aria-label={L("Giãn dòng", "Line height")}
              type="range"
              min="1.2"
              max="2.6"
              step="0.1"
              value={settings.lineHeight}
              onChange={(e) => update("lineHeight", +e.target.value)}
            />
          </label>
          <label className="field-group range-label">
            {L("Chiều rộng nội dung", "Content width")}
            <output>{settings.width}px</output>
            <input
              aria-label={L("Chiều rộng nội dung", "Content width")}
              type="range"
              min="480"
              max="1200"
              step="20"
              value={settings.width}
              onChange={(e) => update("width", +e.target.value)}
            />
          </label>
          <div className="field-group">
            <h3>{L("Căn lề", "Alignment")}</h3>
            <div className="segmented wrap">
              {[
                ["original", L("Gốc", "Original"), BookOpen],
                ["left", L("Trái", "Left"), AlignLeft],
                ["center", L("Giữa", "Center"), AlignCenter],
                ["right", L("Phải", "Right"), AlignRight],
                ["justify", L("Đều", "Justify"), AlignJustify],
              ].map(([id, label, Icon]) => {
                const Glyph = Icon as typeof AlignLeft;
                return (
                  <button
                    key={id as string}
                    className={settings.align === id ? "selected" : ""}
                    onClick={() => update("align", id as string)}
                  >
                    <Glyph size={14} />
                    {label as string}
                  </button>
                );
              })}
            </div>
          </div>
          {settings.layout !== "book" ? (
            <div className="field-group">
              <h3>{L("Chế độ đọc", "Reading mode")}</h3>
              <div className="segmented">
                {[
                  ["scroll", L("Cuộn", "Scroll")],
                  ["single", L("Trang đơn", "Single page")],
                  ["double", L("Trang đôi", "Double page")],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={settings.mode === id ? "selected" : ""}
                    onClick={() => update("mode", id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="tiny muted">
                {L(
                  "Điện thoại tự chuyển trang đôi thành trang đơn.",
                  "Double-page mode becomes single-page on phones.",
                )}
              </p>
            </div>
          ) : (
            <p className="tiny muted">
              {L(
                "Sách mở hai trang khi đủ rộng và một trang trên điện thoại. Cài đặt Ebook được giữ riêng.",
                "Book shows two pages when space allows and one on phones. Your Ebook reading mode is preserved.",
              )}
            </p>
          )}
        </>
      )}
      <button
        className="secondary-button full-width"
        onClick={() => setSettings({ ...defaultSettings })}
      >
        <RotateCcw size={16} />
        {L("Đặt lại cài đặt", "Reset settings")}
      </button>
      <DeviceBackup
        locale={locale}
        onRestore={onRestore}
        onBeforeExport={onBeforeExport}
      />
    </Panel>
  );
}
