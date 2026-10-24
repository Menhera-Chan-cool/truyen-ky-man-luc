# Reader reliability — approved 24/10/2026

The user approved all five findings in OPTIMIZATION_REVIEW_3.md, including testing, private GitHub synchronization and production verification under the established workflow.

| Module | Contract / acceptance |
|---|---|
| speech-session | Active native interrupted/canceled events become a resumable pause. Toolbar pauses/resumes with no extra toolbar width; voice panel retains explicit Stop. Preserve chunk/boundary, apply new rate/voice on resume, ignore stale callbacks, clear sessions on chapter/locale/PDF-page changes. No automatic background playback guarantee. |
| internal-anchors | Same-chapter fragment links use Reader page/reveal state in paged mode; support return links, progress and history without native horizontal scroll. External and modified/new-tab clicks retain browser behavior. |
| selection-dismissal | Outside pointer actions dismiss the selection popup. Interacting with popup actions/note input keeps it and the draft note. Keyboard Escape remains supported. |
| published-read-retry | Retry the read-only public RPC at most once on connection/429/5xx, never on auth/schema/other 4xx. Still fail closed if both attempts fail; no seed/cache resurrection or mutation retries. |
| locale-preparation | Reader requests a locale-specific prepared Book. Sanitize only displayed HTML, return empty other-locale HTML with metadata intact. Default callers still receive both sanitized editions; offline source is never mutated. |

Build order: failing unit/browser regressions → server loader → speech controls → fragment/selection handling → typecheck/unit/build → desktop/mobile integration/visual verification → private GitHub and production URL checks. Preserve all book data, roles, keys, device notes and existing settings. No Supabase migration or dependency needed.
