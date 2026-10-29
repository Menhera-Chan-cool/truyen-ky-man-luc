"use client";
import { useEffect, useState } from "react";
import {
  parsePronunciations,
  type PronunciationRule,
} from "../lib/reader-extras";
import type { Locale } from "../lib/types";
export default function PronunciationEditor({
  locale,
  rules,
  onSave,
}: {
  locale: Locale;
  rules: PronunciationRule[];
  onSave: (rules: PronunciationRule[]) => Promise<void>;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setValue(rules.map((r) => r.from + " = " + r.to).join("\n"));
    setError("");
  }, [rules, locale]);
  return (
    <details className="pronunciation-editor">
      <summary>
        {L("Từ điển phát âm tên riêng", "Name pronunciation dictionary")}
      </summary>
      <p className="tiny muted">
        {L(
          "Mỗi dòng: chữ gốc = cách đọc. Áp dụng riêng cho bản đang nghe; chữ trong sách giữ nguyên. Tối đa 50 tên.",
          "One entry per line: original name = spoken form. Applies to this language; book text stays unchanged. Up to 50 names.",
        )}
      </p>
      <textarea
        rows={5}
        aria-label={L("Quy tắc phát âm", "Pronunciation rules")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          locale === "vi" ? "Nguyễn Dữ = nguyễn dữ" : "Nguyen Du = ngwee-en zoo"
        }
      />
      <button
        className="secondary-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const rows = value
              .split(/\r?\n/)
              .filter((s) => s.trim())
              .map((line) => {
                const at = line.indexOf("=");
                if (at < 1)
                  throw Error(
                    L(
                      "Mỗi dòng cần dấu = giữa tên và cách đọc.",
                      "Each line needs = between name and spoken form.",
                    ),
                  );
                return {
                  from: line.slice(0, at).trim(),
                  to: line.slice(at + 1).trim(),
                };
              });
            await onSave(parsePronunciations(rows));
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {L("Lưu phát âm", "Save pronunciations")}
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
