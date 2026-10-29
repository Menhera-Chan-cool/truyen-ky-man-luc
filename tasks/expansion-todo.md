# Expansion implementation plan

- [x] editor-review: compare saved draft/current form with published or historical revision; empty/missing note targets/duplicate titles/broken images are visible before publication; server checks published candidates too.
- [x] batch-replace: choose VI/EN, literal find/replacement, case option, review per chapter and changed text counts; replace text nodes only, preserve formatting/links/notes; one conflict rolls back the draft batch; explicit apply, never automatic publish.
- [x] collaboration: migration 004 adds private recent presence and append-only audit; authenticated/active editor checks at API and RLS; verified migration before asking owner to run; UI reports unavailable setup, never pretends connected.
- [x] reader-navigation: reopenable short help; page jump validates current chapter range; recent entries preserve locale/revision/anchor and refuse stale editions; no stored text mutation.
- [x] parallel-reader: published VI/EN same chapter side-by-side on wide screens and accessible stacked panels on phones; individual scrolling, clear missing translation/PDF handling; close returns same reading position.
- [x] speech-tools: local per-locale pronunciation rules map utterance boundaries back to source UTF-16; source/notes/checkpoints unchanged; natural completion optionally continues next available chapter, manual stop/error/locale change cancels; no autoplay on reload.
- [x] custom-fonts: validate signature/type/size and parse via browser before saving; local import/list/select/remove; selected font reaches Book snapshots and reflow; absent fonts fall back gracefully; no secret/raw blob in cookie.
- [x] offline: explicit download/remove/update of published snapshot and resources; dedicated offline shell with route state and preserved local reader data; all resources needed for offline opening cached before success; no admin/private source cache; interrupted updates keep last complete download.
- [ ] Verify unit/typecheck/build, editor/API integration, offline network-disabled flows, full browser regressions and exact live deployment; refresh private GitHub and source ZIP; report limits honestly.
## Implementation checkpoint (not completion)

- Collaboration migration 004 + PGlite tests pass; user SQL screenshot confirmed Success and live tables admin_audit/editor_presence were checked read-only via service client. Current 004 includes replacement active-chapter guard. API presence/audit and private UI implemented, live authenticated integration still pending.
- editor-tools helpers (literal cross-markup replacement, block diff, preflight) + tests pass. Admin comparison stale-context regression passes. Publish API runs server preflight; import/replace use tracked transactional RPC. Admin UI wired; integration/visual verification pending.
- Reader tools/help/page jump/recent positions/parallel VI–EN implemented. /api/book returns only published book. New browser tests were red on prior production; focused production-build tests pending.
- Local pronunciation dictionary + UTF-16 mapping + useSpeech completion integration implemented and unit-tested; opt-in autoNext state wired. Personal font validation/storage/loader/chooser implemented. Existing backup v1 accepts missing new settings and optionally carries rules/history; personal font binaries stay device-local. Browser font/speech checks pending.
- Offline download/service worker/offline shell NOT IMPLEMENTED yet. No final deploy has happened for this bundle. Current production remains mobile reliability release 7fb30b6.
- Keep desktop Book behavior, touch fixes, published-only data isolation, existing revision checks and notes. No new dependencies so far. All work stays in this checkout; do not touch source book files.
## Verification checkpoint

- Current source implements all 13 selected capabilities; migration 004 tables verified on live Supabase. No public book content intentionally changed.
- Typecheck/build pass; unit 93 passed before the latest added comparison loading regression (that targeted regression and editor-tools tests now pass too).
- Production-build reader expansion/help/history/parallel and old Book + speech continuity: 36/36 passed on desktop/mobile.
- Personal font import (including long name)/reload/Book and pronunciation/auto-next/no-autoplay: 4/4 passed.
- Offline hard reload, both locales, comparison without network and download removal passed; updated test for failed replacement retaining old download passed desktop and is being rerun mobile after scoping alert away from Next route announcer.
- Authenticated expansion verifier: initial 127.0.0.1 base hit expected strict Origin protection. Use http://localhost:3001 for editor tests (existing README rule). After correcting base, save works; comparison server fetch exceeded the verifier's default 5s so verifier now waits 30s and UI shows loading/hides stale diff. Source additionally cancels closed comparisons; unit regressions cover both context changes and close-during-request.
- scripts/verify-expansion-admin.mjs creates two temporary editor accounts/private chapters, never publishes fixtures, tests presence/revocation/audit/replacement/preflight/private offline exclusion, asserts public book hash and other real heads unchanged, and cleans actors/assets/audit. Still needs a successful full run. Earlier failed runs cleaned all fixtures; last run cleanup all true.
- scripts/verify-editor.mjs cleanup now handles new presence/audit dependencies. Needs rerun on final build.
- Local server 3001 was stopped for latest build; start it again after build completes. No deploy for this bundle yet. Existing production remains 7fb30b6 / dpl_2Kyz1NC9CXAVoCPCxKBQbPCpXCV4.
## Latest checkpoint — implementation complete, verification ongoing

- All requested capabilities are now implemented; no feature has been deployed yet. Latest local production build includes offline routes/SW and all reader/admin tools.
- Live authenticated `npm run verify:expansion` SUCCESS on http://localhost:3001: comparison UI, other-editor presence, revoked access denial, selected batch draft replacement, stale-batch rollback, broken-publication rejection, audit UI/immutability, and private-asset exclusion from offline cache. Public book hash unchanged and other real heads unchanged; all temporary actors/chapters/assets/audit cleaned. Report verification/expansion-admin-latest.json.
- Whole Playwright run on the prior local build: 204 cases, 187 pass/16 conditional skip/1 failure. Trace proves the first-time floating guide hint intercepted a footnote return link. Source now replaces that hint with a small noninteractive dot on More/Reading tools; no content overlay. Must rerun full after rebuild.
- Added red regression for Ebook double-page jump matching footer count (old code landed 3 when input 5). Source now uses Book physical-leaf counts/stride only for Book; Ebook uses its existing footer pages. New test increases total to 206 with one mobile skip. Needs final green/full run.
- Current build command session 28535 was launched after hint and jump fixes and ran unit/typecheck/build. Check completion. Start local port 3001 again afterward.
- New reader/help/parallel + old Book/speech focused set 36/36 passed before last hint/jump changes. New font/pronunciation/auto-next tests 4/4 pass. Offline + interrupted-update retention passed desktop/mobile 2/2; alert fixture correctly scoped away from Next route announcer.
- Need: old npm run verify:editor with BASE_URL=http://localhost:3001; final unit/typecheck/build/full Playwright; bounded UI review batch desktop/mobile VI/EN including comparison/guide/tools/fonts/admin; fixes as needed; private commit/push; Vercel production deploy via existing files API helper; exact live selected tests/UI; update docs, source ZIP, cleanup local server. Current production 7fb30b6 unchanged.

## Final source checkpoint — 30/10/2026

- Final source: 95 unit tests across 25 files passed; typecheck and production build passed. Cover publication now also checks the registered file exists before changing the public metadata.
- Authenticated Supabase integration succeeded for expansion and the original VI/EN paste/save/switch regression; all temporary users, chapters, assets, presence and audit fixtures were cleaned. The published book and real chapter heads were unchanged.
- Final comparison typography now inherits reader font/size; personal-font and pronunciation summaries have 44px targets. Offline home sets the selected document language; worker keeps only the cache index in memory.
- Full 206-case Playwright run is in progress against the final production build. Prior run: 189 passed / 17 conditional skips / zero unexpected or flaky cases. Do not treat the prior run as final-source proof.
- Private GitHub status verified, configured credentials absent from 282 source files. Final release, cloud tests, source ZIP and final handover remain pending.

## Final local verification

Full final-source production-build Playwright: **189 passed / 17 conditional skips / 0 failures / 0 flaky** (206 cases). See verification/expansion-local.json. Unit: 95/95, typecheck and build pass. Private-source release and exact Vercel checks are the remaining release steps.
