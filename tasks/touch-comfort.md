# Touch page-turn comfort

- [x] Root cause: touch shared mouse's 64px distance and 2:1 horizontal ratio. Small slow/diagonal gestures failed; preview moved only the finger distance. Every move called the renderer synchronously, including bursts of 80 events in a single frame; startDrag also cloned/measured the same source twice.
- [x] Red tests on previous production build: 30px slow swipe stayed on page 1; 48px edge tap stayed on page 1; 80 moves performed 80 folds synchronously.
- [x] Touch uses 24px slow / 14px quick gesture, 1.35 horizontal ratio, 2x fold displacement. Mouse keeps existing thresholds. Explicit 48px paper-edge taps turn once; center blank/bottom wake controls, interactive content and selections remain protected.
- [x] Renderer coalesces held motion to one RAF, cancels queued work on release/reset/disposal, reuses the immutable snapshot for its preview copy.
- [x] Three new mobile browser regressions pass on rebuilt app. Existing center-text tap fixture now uses the middle of its line rather than the newly intentional edge zone.
- [ ] Final unit/browser/WebKit checks, private push, production release and exact live checks.

No book content, local progress offsets, Supabase data/schema or dependencies change. Physical iPhone FPS and native touch feel need user device feedback; automated WebKit old/current tests cover behavior.

Final local source: 50 pass / 12 conditional skips / zero failures or flaky in 62 selected Chromium cases; 95 unit tests and production build/typecheck pass. WebKit 18.0 and 27.2 each pass four VI/EN phone/desktop cases including gentle swipe and edge tap. Coarse-pointer click fallback was added after legacy WebKit emitted only click events for a tap; duplicate pointer compatibility clicks remain suppressed. Exact cloud verification remains.
