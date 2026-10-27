# Auto-scroll safety — approved 27/10/2026

The user approved all three findings in OPTIMIZATION_REVIEW_6.md. Keep existing paper/ink UI, VI/EN, device reading/listening/notes, published book data and private GitHub/Vercel delivery. No new dependency, service or schema.

| Capability | Acceptance |
|---|---|
| lifecycle | Stop auto-scroll immediately on document hidden/freeze/pagehide; cancel the pending RAF, reset elapsed/travel and require an explicit restart. A large RAF gap also stops rather than catching up, including paged mode. Returning never skips unread text or auto-restarts. |
| manual-override | Wheel with actual vertical movement, touch movement and pointer interaction inside reading content stop auto. Keyboard page turns stop auto. Programmatic scroll/progress updates do not stop it; speed changes in its panel continue to work. |
| speed-accessibility | Range has the localized accessible name Scroll speed / Tốc độ cuộn, remains keyboard-adjustable and keeps the visible value. |

Build: failing browser regressions on the current deployment → minimal Reader changes → focused/full Vitest/Playwright, typecheck/build → one local and one live QA/measurement batch → private GitHub push, production deploy and final URL verification. Tests in e2e/; source in Reader.tsx; evidence in verification/. Commands: `npm test -- --maxWorkers 2`, `npm run typecheck`, `CIRCLE_NODE_TOTAL=3 npm run build`, `BASE_URL=... npx playwright test --workers 1`. Browser lifecycle/touch simulations are identified separately from physical-device/audio testing, which is unavailable.

## Verified delivery

Shipped `dpl_GR76YBjbPNzbftqbmtsaawbVhbbJ`, runtime source `c10b63d78f3a03fc7f97489ecea6aaae912ad102`. Unit 73/73, typecheck/build; full local 121 passed / 7 configured skips (128 cases), focused local 20/20. Production selected 66 relevant cases, 65 unique confirmed / 1 configured skip across initial/corrected/confirmation runs; all 20 latest auto-scroll cases covered. Initial pagination placeholder comparison was corrected; a later readiness wait timed out and its unchanged single-case confirmation passed. No runtime changes during these test corrections. Four local and four live QA combinations pass. CDP visible-headless freezing was calibrated as a no-op and the earlier 232px inference withdrawn; use DOM lifecycle and RAF timestamp boundary tests, not claims of native/physical freezing. See VERIFICATION.md and verification/auto-safety-*.json. No book/schema/member changes; repo PRIVATE.
