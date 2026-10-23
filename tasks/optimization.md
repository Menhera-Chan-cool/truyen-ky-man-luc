# Optimization scope — 2026-10-23

Implement the five findings in OPTIMIZATION_REVIEW.md, preserving stable chapter IDs, edition revisions, published-only anonymous reads and editor conflict checks.

- Coalesce scroll progress every second; flush pending progress on chapter/locale change, pagehide, hidden visibility and unmount. Keep exact latest position even if percentage display is rounded.
- Reserve desktop sidebar geometry before hydration. Keep mobile sidebar closed. Keep login/loading geometry stable.
- Load rich editor and import panel only when rendered, with accessible loading/error recovery.
- Add a published metadata-only RPC with identical publication/archive boundaries; never fall back to bundled content on database errors. Admin state returns version summaries; fetch only selected version HTML with stale-response cancellation. Save refreshes summaries and selected HTML only.
- Mirror validated appearance preferences in a cookie for server rendering, retaining IndexedDB as device storage. Book dark mode follows reader background luminance; book light/dark toggle explicitly selects sepia/dark for the reader while preserving custom color values and other settings.
- Unit/integration tests, desktop/mobile Playwright, real temporary editor VI/EN test, typecheck, build, before/after measurements and live production verification.
- Publish source to a private GitHub repository. Exclude credentials, invitations, dependencies, build output and private backups; verify remote privacy and tracked files.

No content reseeding, account permission changes, offline cache or new TTS service. A metadata RPC migration must be applied before switching production to that call.

Checkpoint:
- Implemented all five source changes. Unit 49 pass, typecheck/build pass.
- Connected Supabase editor test passed VI/EN, including delayed stale requests and lazy import. Temporary test rows/account cleaned.
- Guest suite with bundled book: 45 pass / 5 intended skips; connected production-build progress subset: 5 pass / 3 intended skips.
- GitHub private repository created: https://github.com/Menhera-Chan-cool/truyen-ky-man-luc; source scan excludes configured keys and private files.
- Waiting for user to apply 003_public_book_index.sql (user said they will run it; completion not yet confirmed, anonymous RPC currently PGRST202). Keep existing production deployment active until verified. Then run full connected/local suite, deploy, hosted editor/guest tests and before/after audit; update DEPLOYMENT.json and this checkpoint.
