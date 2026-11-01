# Novel editor network bounds and comic scroll rendering

User authorized both findings from work/optimization-audit-2026-11-01-small-followup.md. No dependencies/schema/reader analytics.

- Shared deadline includes session lookup, fetch and JSON body; preserves caller abort. 15s default, 30s Novel import/batch publication, 45s TT asset registration, 120s Storage uploads. Reuse TT deadline code, do not stack incompatible timers.
- Novel save/import/restore, publish/withdraw/batch, reorder/archive and metadata writes never retry automatically. Lost transport/timeout/truncated JSON/5xx reads authenticated state to confirm the exact expected result. Save/import checks new revision and sanitized content; Novel publication keeps revision and uses the pre-write draft ID (different from TT). Metadata/order use book revision. A mismatch/failed read retains edits and reports uncertainty.
- Upload/source/inline-image network operations are bounded. Keep imported candidates and unsaved editor content on failure. Follow-up state reload failures must not claim publication rollback or discard unsaved changes.
- TT scroll updates only progress CSS/ARIA, without per-frame React state. Preserve rAF coalescing, save debounce/pagehide flushing, vertical/horizontal progress, chapter changes, orientation/resize, autoscroll and settings.

TDD: request auth/fetch/body hangs; caller cancellation; lost save/import/publication response and conflicting state. Browser: committed response lost, hung endpoint, latest editor content retained; 90-frame scroll commit count vs baseline 90 and valid progress/persistence. Unit/typecheck/build, Chromium and WebKit, then production. Physical iPhone FPS outside emulated evidence.
