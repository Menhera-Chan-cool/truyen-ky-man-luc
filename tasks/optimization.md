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
- 003 applied and verified via anonymous RPC: 5,053 bytes metadata, no HTML; same published metadata as the 894,637-byte full RPC.
- Connected full local suite: 45 pass / 5 intended skips. Final hosted suite on dpl_CdhxWFAa9xD4J2bXZ64k7Fa9q5jv: 47 pass / 3 intended skips / no retries or failures.
- Hosted VI/EN editor test passed on first optimized deployment dpl_F2a8efPLvKNaqKJeCBFpAGG1U14W; all temporary records/account cleaned. Final patch only fixes tooltip width at viewport edges, verified by regression test and final full suite.
- Production alias https://truyen-ky-man-luc.vercel.app points to final READY deployment; runtime commit ad38c75fa3f0a1f12fc67dfd1230b8c9a7c370f3. Desktop/mobile QA and hosted performance evidence saved in verification/.
- No remaining implementation or deployment work. Physical Android/iOS audio remains untested; voice availability depends on the device.
