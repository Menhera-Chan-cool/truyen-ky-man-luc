# Late fonts and browser shortcuts — approved 27/10/2026

The user approved the two findings in OPTIMIZATION_REVIEW_7.md. Preserve current book data, VI/EN, progress/listening/notes, paper/ink UI and private GitHub/Vercel workflow. No dependency, schema, service or editor change.

| Capability | Acceptance |
|---|---|
| fallback-layout | Measure and restore using available fallback fonts immediately; do not gate reader readiness on fonts.load/fonts.ready. When fonts settle, explicitly reflow using the latest tracked visible text anchor, even when total dimensions do not change. Keep paging/scrolling while a font request is delayed/failed; no late callback can affect a new chapter/locale. Disable only page actions until initial layout is restored. |
| browser-keys | Alt/Ctrl/Meta/Shift/IME arrow events are left to the browser/text selection. Plain arrows still turn pages and stop auto; inputs/dialogs and existing Escape behavior remain protected. Alt+Left/Right use browser Back/Forward correctly. |

Order: failing Playwright regressions → minimal Reader changes → focused tests and full local suite → unit/typecheck/production build → bounded local/live font-network QA and affected live journeys → private GitHub push/deploy/URL verification. New tests in e2e/; source in Reader.tsx; evidence in verification/. Commands: `npm test -- --maxWorkers 2`, `npm run typecheck`, `CIRCLE_NODE_TOTAL=3 npm run build`, `BASE_URL=... npx playwright test --workers 1`. Check exact DOM text offsets/visibility, not fixed page totals. Network/font and device viewport tests are simulations, not physical-device guarantees.

Implementation: fallback layout runs immediately (two animation frames, no font timeout). Late fonts reflow to the latest tracked semantic offset. A reflow marker preserves explicitly revealed offsets while layout effects capture manual turns before paint; scrolling tracks every event while fonts settle. Old callbacks are cancelled. Modifier/IME events are left uncancelled; plain arrows keep existing behavior. Full local suite: 135 passed, 7 conditional skips; 73 unit, typecheck and production build passed.
