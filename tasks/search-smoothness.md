# Search and reader layers — approved 26/10/2026

The user approved all three findings in OPTIMIZATION_REVIEW_5.md. Preserve current book content, device progress/notes/listening, design and private GitHub/production workflow. No dependency, service, schema or editor changes.

| Capability | Acceptance |
|---|---|
| reader-layers | At CSS overlay breakpoint <=900px, opening sidebar closes a panel and opening any panel closes sidebar. Resizing into overlay mode with both open keeps the panel accessible. Desktop >900px keeps both available. Playback is not stopped by switching tools. |
| search-preparation | Prepare lazily with main-thread yields and visible loading/error/retry. Retain the prepared index across tabs/chapter changes in the current Book/locale snapshot. Abort obsolete/unmounted builds and never publish partial/stale results. Keep exact accent-insensitive UTF-16 anchors and 100-result cap. |
| search-highlight | Changing/clearing query removes only search-result highlight. Opening a chosen result still highlights it, including cross-chapter/paged mode; saved-note highlights are preserved. |

Build order: failing Vitest/Playwright cases → helper and Reader → focused/full browser regression → unit/typecheck/build → bounded local/live UI and CPU4x benchmark → private GitHub push, production deploy/URL verification. Commands follow package.json, using `npm test -- --maxWorkers 2`, `npm run typecheck`, `CIRCLE_NODE_TOTAL=3 npm run build` and `BASE_URL=... npx playwright test --workers 1`. New logic stays in src/lib/book-search.ts and Reader; tests in tests/ and e2e/. Physical phone/audio testing is not available.

## Verified delivery

All three fixes shipped in `dpl_3QKCyPvofZHDpMRbtkPwga2K1Saj`, runtime source `d93f93bfb5f4ea629d0e67c29cc884280aaef35f`. Unit 73/73, typecheck/build, local full suite 101 pass / 7 configured skips. Production full suite 102 pass / 5 configured skips / 1 initial transport reset before application load; unchanged focused repeat passed, so 103 unique cases confirmed. No test retries or assertion changes to hide that failure. Four local and four live locale/viewport benchmark combinations verified non-overlap and index reuse. Mobile CPU4x tab paint 20–25 ms, warm return 28–29 ms; first complete index 669–764 ms with responsive loading. See VERIFICATION.md and verification/search-fix-*.json. Book data/schema/editor permissions unchanged, repo PRIVATE, physical phone/audio untested.
