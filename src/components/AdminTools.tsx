"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminRequest } from "../lib/supabase";
import {
  diffBlocks,
  inspectEditions,
  replaceHtmlText,
  replaceLiteral,
  type ReviewIssue,
} from "../lib/editor-tools";
import type { Locale } from "../lib/types";
type Head = {
  chapter_id: string;
  locale: Locale;
  draft_id: string;
  published_id: string | null;
  revision: number;
};
type Version = {
  id: string;
  chapter_id: string;
  locale: Locale;
  title: string;
  html: string;
  kind: string;
  pdf_path?: string | null;
  revision: number;
};
export function ReviewIssues({
  issues,
  locale,
}: {
  issues: ReviewIssue[] | null;
  locale: Locale;
}) {
  if (!issues) return null;
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const labels: Record<string, string> = {
    "empty-chapter": L("Chương trống", "Empty chapter"),
    "duplicate-title": L("Tiêu đề trùng", "Duplicate title"),
    "missing-target": L(
      "Liên kết chú thích thiếu đích",
      "Missing reference target",
    ),
    "missing-note": L(
      "Số dẫn chưa có chú thích tương ứng",
      "Unmatched note number",
    ),
    "missing-image": L("Ảnh thiếu đường dẫn", "Missing image URL"),
    "broken-image": L("Không tìm thấy file ảnh/PDF", "Missing image/PDF file"),
    "unmanaged-image": L(
      "Cần lưu ảnh vào kho sách",
      "Upload this image to book storage",
    ),
  };
  return (
    <div className="review-issues" role="status">
      <h3>{L("Kết quả kiểm tra", "Review results")}</h3>
      {!issues.length ? (
        <p>
          {L(
            "Không phát hiện lỗi trong các kiểm tra này.",
            "No issues found by these checks.",
          )}
        </p>
      ) : (
        <ul>
          {issues.map((i, n) => (
            <li key={n} className={i.severity}>
              <strong>
                {i.severity === "error"
                  ? L("Lỗi", "Error")
                  : L("Cảnh báo", "Warning")}
              </strong>{" "}
              · {i.id} / {i.locale.toUpperCase()} · {labels[i.code] ?? i.code}
              <p>{i.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function DraftReview({
  locale,
  id,
  editionLocale,
  head,
  form,
  issues,
  onIssues,
  onError,
}: {
  locale: Locale;
  id: string;
  editionLocale: Locale;
  head?: Head;
  form: { title: string; html: string; kind: string; pdfPath: string };
  issues: ReviewIssue[] | null;
  onIssues: (i: ReviewIssue[]) => void;
  onError: (e: unknown) => void;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const [open, setOpen] = useState(false),
    [baseline, setBaseline] = useState<Version | null>(null),
    [choices, setChoices] = useState<Version[]>([]),
    [chosen, setChosen] = useState(""),
    [loading, setLoading] = useState(false),
    [changesOnly, setChangesOnly] = useState(true),
    [limit, setLimit] = useState(200);
  const request = useRef(0);
  useEffect(() => {
    request.current++;
    setLoading(false);
    setOpen(false);
    setBaseline(null);
    setChosen(head?.published_id ?? "");
    setChoices([]);
    setLimit(200);
    return () => {
      request.current++;
    };
  }, [id, editionLocale, head?.published_id]);
  async function compare(versionId = chosen) {
    const current = ++request.current;
    setLoading(true);
    try {
      const history = await adminRequest(
        `chapters?id=${id}&locale=${editionLocale}`,
        undefined,
        "GET",
      );
      if (current !== request.current) return;
      const baseline = versionId
        ? await adminRequest(
            `chapters?id=${id}&locale=${editionLocale}&version=${versionId}`,
            undefined,
            "GET",
          )
        : ({ title: "", html: "" } as Version);
      if (current !== request.current) return;
      setChoices(history.items);
      setBaseline(baseline);
      setOpen(true);
      setLimit(200);
    } catch (e) {
      if (current === request.current) onError(e);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  const parts = useMemo(
    () => (baseline ? diffBlocks(baseline.html, form.html) : []),
    [baseline, form.html],
  );
  const visible = parts.filter((p) => !changesOnly || p.kind !== "same");
  return (
    <section className="draft-review">
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => compare()}
        >
          {L("So sánh phiên bản", "Compare versions")}
        </button>
        <button
          className="secondary-button"
          disabled={loading}
          onClick={async () => {
            const current = ++request.current;
            setLoading(true);
            try {
              const local = inspectEditions([
                {
                  id,
                  locale: editionLocale,
                  title: form.title,
                  html: form.html,
                  kind: form.kind,
                  pdfPath: form.pdfPath,
                },
              ]);
              const remote = head
                ? await adminRequest("review", {
                    items: [
                      {
                        id,
                        locale: editionLocale,
                        expectedRevision: head.revision,
                      },
                    ],
                  })
                : { issues: [] };
              const merged = [...local, ...remote.issues];
              if (current !== request.current) return;
              onIssues(
                merged.filter(
                  (i, n) =>
                    merged.findIndex(
                      (v) =>
                        v.id === i.id &&
                        v.locale === i.locale &&
                        v.code === i.code &&
                        v.detail === i.detail,
                    ) === n,
                ),
              );
            } catch (e) {
              if (current === request.current) onError(e);
            } finally {
              if (current === request.current) setLoading(false);
            }
          }}
        >
          {L("Kiểm tra trước xuất bản", "Check before publishing")}
        </button>
      </div>
      <ReviewIssues issues={issues} locale={locale} />
      {open && baseline && (
        <div className="version-diff">
          <div className="button-row">
            <label>
              {L("So với", "Compare with")}{" "}
              <select
                value={chosen}
                onChange={(e) => {
                  setChosen(e.target.value);
                  void compare(e.target.value);
                }}
              >
                <option value="">{L("Bản trống", "Empty edition")}</option>
                {head?.published_id && (
                  <option value={head.published_id}>
                    {L("Bản đang công khai", "Currently published")}
                  </option>
                )}
                {choices
                  .filter((v) => v.id !== head?.published_id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.revision} · {v.title}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                request.current++;
                setLoading(false);
                setOpen(false);
              }}
            >
              {L("Đóng so sánh", "Close comparison")}
            </button>
          </div>
          {loading ? (
            <p role="status">
              {L("Đang tải bản so sánh…", "Loading comparison…")}
            </p>
          ) : (
            <>
              <p>
                {L("Tiêu đề trước / sau", "Title before / after")}:{" "}
                <del>{baseline.title}</del> → <ins>{form.title}</ins>
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={changesOnly}
                  onChange={(e) => setChangesOnly(e.target.checked)}
                />
                {L("Chỉ hiện phần thay đổi", "Changes only")}
              </label>
              {!visible.length ? (
                <p>
                  {L(
                    "Không có thay đổi ở phần đang xem.",
                    "No changes in this view.",
                  )}
                </p>
              ) : (
                visible.slice(0, limit).map((p, n) => (
                  <p key={n} className={"diff-" + p.kind}>
                    <strong>
                      {
                        {
                          added: L("Thêm", "Added"),
                          removed: L("Xóa", "Removed"),
                          format: L("Định dạng", "Formatting"),
                          same: L("Giữ nguyên", "Unchanged"),
                        }[p.kind]
                      }
                    </strong>
                    <span>{p.text}</span>
                  </p>
                ))
              )}
              {visible.length > limit && (
                <button
                  className="secondary-button"
                  onClick={() => setLimit((n) => n + 200)}
                >
                  {L("Xem thêm", "Show more")}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
export function BatchReplace({
  locale,
  editionLocale,
  heads,
  onLocale,
  onBusy,
  onDone,
  onError,
}: {
  locale: Locale;
  editionLocale: Locale;
  heads: Head[];
  onLocale: (l: Locale) => void;
  onBusy: (v: boolean) => void;
  onDone: () => Promise<unknown>;
  onError: (e: unknown) => void;
}) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const [find, setFind] = useState(""),
    [replacement, setReplacement] = useState(""),
    [sensitive, setSensitive] = useState(false),
    [titles, setTitles] = useState(false),
    [rows, setRows] = useState<
      | {
          version: Version;
          revision: number;
          html: string;
          title: string;
          count: number;
          selected: boolean;
        }[]
      | null
    >(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    setRows(null);
    setExpanded(null);
  }, [find, replacement, sensitive, titles, editionLocale]);
  async function preview() {
    setBusy(true);
    onBusy(true);
    setRows(null);
    try {
      const selected = heads.filter(
          (h) => h.locale === editionLocale && h.draft_id,
        ),
        loaded: Version[] = [];
      for (let at = 0; at < selected.length; at += 4) {
        const batch = await Promise.all(
          selected
            .slice(at, at + 4)
            .map((h) =>
              adminRequest(
                `chapters?id=${h.chapter_id}&locale=${editionLocale}&version=${h.draft_id}`,
                undefined,
                "GET",
              ),
            ),
        );
        loaded.push(...batch);
        setProgress(`${loaded.length}/${selected.length}`);
      }
      const changed = loaded
        .map((v) => {
          const result = replaceHtmlText(v.html, find, replacement, sensitive),
            title = titles
              ? replaceLiteral(v.title, find, replacement, sensitive)
              : { text: v.title, count: 0 };
          return {
            version: v,
            revision: selected.find((h) => h.chapter_id === v.chapter_id)!
              .revision,
            html: result.html,
            title: title.text,
            count: result.count + title.count,
            selected: true,
          };
        })
        .filter((r) => r.count > 0);
      setRows(changed);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
      onBusy(false);
      setProgress("");
    }
  }
  const selected = rows?.filter((r) => r.selected) ?? [];
  return (
    <section className="batch-replace">
      <h2>{L("Tìm–thay thế toàn sách", "Find and replace across the book")}</h2>
      <p>
        {L(
          "Chỉ thay chữ trong bản nháp, giữ đường dẫn và thẻ định dạng. Xem trước rồi chọn chương cần áp dụng.",
          "Replace draft text while preserving URLs and markup. Preview, then choose chapters to apply.",
        )}
      </p>
      <div className="form-grid">
        <label>
          {L("Bản nội dung", "Edition")}
          <select
            disabled={busy}
            value={editionLocale}
            onChange={(e) => onLocale(e.target.value as Locale)}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {L("Tìm", "Find")}
          <input
            disabled={busy}
            maxLength={300}
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        </label>
        <label>
          {L("Thay bằng", "Replace with")}
          <input
            disabled={busy}
            maxLength={2000}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={sensitive}
          disabled={busy}
          onChange={(e) => setSensitive(e.target.checked)}
        />
        {L("Phân biệt hoa thường", "Case sensitive")}
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={titles}
          disabled={busy}
          onChange={(e) => setTitles(e.target.checked)}
        />
        {L("Thay cả tiêu đề", "Include titles")}
      </label>
      <button
        className="secondary-button"
        disabled={busy || !find}
        onClick={preview}
      >
        {busy
          ? L("Đang chuẩn bị", "Preparing") + " " + progress
          : L("Xem trước thay thế", "Preview replacements")}
      </button>
      {rows && (
        <div className="replacement-results">
          <p role="status">
            {rows.length} {L("chương có kết quả", "chapters with matches")}
          </p>
          {!!rows.length && (
            <div className="button-row">
              <button
                className="text-button"
                onClick={() =>
                  setRows(rows.map((r) => ({ ...r, selected: true })))
                }
              >
                {L("Chọn tất cả", "Select all")}
              </button>
              <button
                className="text-button"
                onClick={() =>
                  setRows(rows.map((r) => ({ ...r, selected: false })))
                }
              >
                {L("Bỏ chọn tất cả", "Clear selection")}
              </button>
            </div>
          )}
          {rows.map((r, index) => (
            <div className="replacement-entry" key={r.version.id}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) =>
                    setRows(
                      rows.map((item, n) =>
                        n === index
                          ? { ...item, selected: e.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                {r.version.title} · {r.count} {L("lần", "matches")}
              </label>
              <button
                className="text-button"
                onClick={() =>
                  setExpanded(expanded === r.version.id ? null : r.version.id)
                }
              >
                {L("Xem thay đổi", "View changes")}
              </button>
              {expanded === r.version.id && (
                <div className="version-diff">
                  {diffBlocks(r.version.html, r.html)
                    .filter((p) => p.kind !== "same")
                    .slice(0, 200)
                    .map((p, n) => (
                      <p key={n} className={"diff-" + p.kind}>
                        {p.text}
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
          <button
            className="primary-button"
            disabled={busy || !selected.length}
            onClick={async () => {
              if (
                !window.confirm(
                  L(
                    `Tạo bản nháp mới cho ${selected.length} chương? Chưa xuất bản nội dung.`,
                    `Create new drafts for ${selected.length} chapters? This does not publish them.`,
                  ),
                )
              )
                return;
              setBusy(true);
              onBusy(true);
              try {
                await adminRequest("replace", {
                  locale: editionLocale,
                  find,
                  replacement,
                  caseSensitive: sensitive,
                  includeTitles: titles,
                  items: selected.map((r) => ({
                    id: r.version.chapter_id,
                    expectedRevision: r.revision,
                  })),
                });
                setRows(null);
                await onDone();
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
                onBusy(false);
              }
            }}
          >
            {L("Áp dụng thành bản nháp", "Apply as drafts")}
          </button>
        </div>
      )}
    </section>
  );
}
export function EditingPresence({
  locale,
  chapterId,
  editionLocale,
  userId,
}: {
  locale: Locale;
  chapterId: string;
  editionLocale: Locale;
  userId: string;
}) {
  const [people, setPeople] = useState<
      { user_id: string; email: string; chapter_id: string; locale: string }[]
    >([]),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const lease = crypto.randomUUID();
    let active = true;
    async function update() {
      try {
        if (!document.hidden && document.hasFocus())
          await adminRequest("presence", {
            lease,
            chapterId,
            locale: editionLocale,
            leave: false,
          });
        const rows = await adminRequest("presence", undefined, "GET");
        if (active) {
          setPeople(rows);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    }
    void update();
    const timer = setInterval(update, 25000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      void adminRequest("presence", { lease, leave: true }).catch(() => {});
    };
  }, [chapterId, editionLocale, userId]);
  const others = people.filter((p) => p.user_id !== userId);
  return (
    <div className="editing-presence" role="status">
      {failed ? (
        locale === "vi" ? (
          "Chưa đọc được trạng thái cộng tác. Kiểm tra kết nối hoặc migration 004."
        ) : (
          "Editing presence unavailable. Check the connection or migration 004."
        )
      ) : (
        <>
          <strong>
            {locale === "vi" ? "Đang biên tập gần đây" : "Recently editing"}
          </strong>
          :{" "}
          {others.length
            ? others
                .map(
                  (p) =>
                    `${p.email} · ${p.chapter_id} / ${p.locale.toUpperCase()}`,
                )
                .join("; ")
            : locale === "vi"
              ? "Chưa có editor khác hoạt động."
              : "No other editors recently active."}
        </>
      )}
    </div>
  );
}
export function AuditLog({ locale }: { locale: Locale }) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const [items, setItems] = useState<
      {
        id: string;
        actor_email: string;
        action: string;
        entity_id: string;
        locale: string | null;
        created_at: string;
        revision: number | null;
      }[]
    >([]),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(before?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await adminRequest(
        "audit" + (before ? "?before=" + encodeURIComponent(before) : ""),
        undefined,
        "GET",
      );
      setItems((old) => (before ? [...old, ...r.items] : r.items));
      setNext(r.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const names: Record<string, string> = {
    save_draft: L("Lưu nháp", "Save draft"),
    import: L("Nhập nội dung", "Import"),
    replace: L("Thay thế hàng loạt", "Batch replacement"),
    publish: L("Xuất bản", "Publish"),
    withdraw: L("Thu hồi", "Withdraw"),
    archive: L("Ẩn chương", "Archive"),
    restore_chapter: L("Mở lại chương", "Restore chapter"),
    reorder: L("Sắp xếp", "Reorder"),
    save_book: L("Lưu giới thiệu", "Save details"),
    publish_book: L("Xuất bản giới thiệu", "Publish details"),
    upload: L("Tải tài nguyên", "Upload asset"),
    member_changed: L("Đổi quyền/tài khoản", "Change membership"),
  };
  return (
    <section className="audit-log">
      <h2>{L("Nhật ký quản trị", "Admin activity")}</h2>
      <p>
        {L(
          "Ghi nhận từ khi bật nhật ký. Chỉ tài khoản biên tập đang có quyền được xem.",
          "Recorded since activity logging was enabled. Only active editors can view it.",
        )}
      </p>
      <button
        className="secondary-button"
        disabled={busy}
        onClick={() => load()}
      >
        {L("Làm mới", "Refresh")}
      </button>
      {error && (
        <p role="alert">
          {error} · {L("Kiểm tra migration 004.", "Check migration 004.")}
        </p>
      )}
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{names[item.action] ?? item.action}</strong> ·{" "}
            {item.entity_id}
            {item.locale ? " / " + item.locale.toUpperCase() : ""}
            {item.revision ? " · v" + item.revision : ""}
            <p>
              {item.actor_email} ·{" "}
              {new Date(item.created_at).toLocaleString(
                locale === "vi" ? "vi-VN" : "en-US",
              )}
            </p>
          </li>
        ))}
      </ol>
      {!busy && !error && !items.length && (
        <p>{L("Chưa có hoạt động.", "No recorded activity.")}</p>
      )}
      {next && (
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => load(next)}
        >
          {L("Xem hoạt động cũ hơn", "Load older activity")}
        </button>
      )}
    </section>
  );
}
