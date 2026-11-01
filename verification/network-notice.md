# Editor connection feedback and upload stability — 2026-11-01

## Scope

- Novel/import and shared comic editors announce browser offline events immediately. An active operation with no new progress for eight seconds gets a pending hint. These hints never confirm, cancel, or retry a write; existing busy guards and server reconciliation remain authoritative.
- Comic recovery flushes its existing IndexedDB queue on offline, alongside pagehide/visibilitychange. Storage failures retain the existing recovery warning.
- Full-resolution lossless WebP copies now require at least 5% byte savings. Otherwise the existing original-image fallback is used, avoiding another nearly full-size upload for negligible gain. Originals and existing published assets are untouched.
- No dependency, schema, authorization, publication, or reader animation changes.

## Checks

- RED/GREEN: four connection-state tests and a deterministic image fixture with negligible lossless savings. Full suite: 182 tests / 44 files; typecheck and production build pass.
- Local browser editor: VI and EN on Chromium desktop, Pixel 7 Chromium model, iPhone 13 WebKit model. Real eight-second pending timer, retained text after a deliberately rejected save, offline/online announcements outside the inert region, no automatic POST replay; no page errors. The save rejection is a browser boundary fixture, not a real database write.
- Animation regression: eight Chromium desktop/mobile and four WebKit phone cases, including consecutive turns, coalesced touch, chapter transitions, and same-page/spread no-op.
- Actual upload interruption uses a temporary editor and private chapter, a 6,493,356-byte random PNG, and a cut before its response. It verifies recovery after reload, a single immutable upload path, original SHA-256, a private unpublished draft, and unchanged public book. Test fixtures are removed afterward. Network emulation does not prove an exact number of bytes transmitted before the cut.
- During investigation the prior image gate took 43,643 ms to register the recovered noisy image locally, close to the existing 45-second request deadline. An earlier local loopback-host mismatch was rejected by the origin guard; the guard was preserved and the harness used localhost. Another interrupted-upload run hit the registration deadline while retaining recovery. These were not counted as passing runs.

## Limits

Browser online status is a hint, not a service health check ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)); it does not disable editing or override a server result. A slow service can still time out and require a deliberate retry. Physical-device FPS, native speech audio, and storage eviction cannot be inferred from browser models.

Detailed local/live JSON evidence is recorded beside this file after verification.
