# Auto-scroll safety — approved 27/10/2026

The user approved all three findings in OPTIMIZATION_REVIEW_6.md. Keep existing paper/ink UI, VI/EN, device reading/listening/notes, published book data and private GitHub/Vercel delivery. No new dependency, service or schema.

| Capability | Acceptance |
|---|---|
| lifecycle | Stop auto-scroll immediately on document hidden/freeze/pagehide; cancel the pending RAF, reset elapsed/travel and require an explicit restart. A large RAF gap also stops rather than catching up, including paged mode. Returning never skips unread text or auto-restarts. |
| manual-override | Wheel with actual vertical movement, touch movement and pointer interaction inside reading content stop auto. Keyboard page turns stop auto. Programmatic scroll/progress updates do not stop it; speed changes in its panel continue to work. |
| speed-accessibility | Range has the localized accessible name Scroll speed / Tốc độ cuộn, remains keyboard-adjustable and keeps the visible value. |

Build: failing browser regressions on the current deployment → minimal Reader changes → focused/full Vitest/Playwright, typecheck/build → one local and one live QA/measurement batch → private GitHub push, production deploy and final URL verification. Tests in e2e/; source in Reader.tsx; evidence in verification/. Commands: `npm test -- --maxWorkers 2`, `npm run typecheck`, `CIRCLE_NODE_TOTAL=3 npm run build`, `BASE_URL=... npx playwright test --workers 1`. Browser lifecycle/touch simulations are identified separately from physical-device/audio testing, which is unavailable.
