"use client";
import { useEffect, useState } from "react";
import {
  importFont,
  listFonts,
  removeFont,
  type PersonalFont,
} from "../lib/personal-fonts";
import type { Locale } from "../lib/types";
export default function PersonalFonts({
  locale,
  selected,
  onSelect,
}: {
  locale: Locale;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    [fonts, setFonts] = useState<PersonalFont[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    listFonts()
      .then(setFonts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <details className="personal-fonts">
      <summary>{L("Phông chữ cá nhân", "Personal fonts")}</summary>
      <p className="tiny muted">
        {L(
          "TTF, OTF, WOFF, WOFF2 · tối đa 3 MB/phông. Phông chỉ lưu trên thiết bị; cần nạp lại khi đổi máy.",
          "TTF, OTF, WOFF, WOFF2 · up to 3 MB/font. Fonts stay on this device; import them again on another device.",
        )}
      </p>
      <label className="field-group">
        {L("Nạp phông", "Import font")}
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const font = await importFont(file);
              await load();
              onSelect(font.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {fonts.map((font) => (
        <div className="button-row" key={font.id}>
          <button
            className="secondary-button"
            disabled={busy}
            aria-pressed={selected === font.id}
            onClick={() => onSelect(font.id)}
          >
            {font.name}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              if (selected === font.id) onSelect("Literata");
              await removeFont(font.id);
              await load();
            }}
          >
            {L("Xóa", "Remove")}
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
