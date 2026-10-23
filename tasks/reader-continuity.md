# Reader continuity and device backup

User approved all findings in OPTIMIZATION_REVIEW_2.md, including the optional JSON backup. Existing app layout, one-book VI/EN scope and current Supabase schema stay unchanged. Approval covers implementation, tests, private GitHub synchronization and production release.

| Module | Responsibility | Depends on |
|---|---|---|
| reading-anchor | Preserve text position through reflow; one navigation path for TTS and bookmarks, including cross-chapter notes | Existing revision/locale progress |
| speech-session | Keep current segment/boundary when rate/voice changes; cancel stale callbacks | reading-anchor callback |
| ambient-lifecycle | Cancel pending preset/track starts; stop/disconnect obsolete sources | — |
| editor-import-lock | Lock navigation/mutations while import/image upload runs; warn about unsaved import preview; await refresh | Existing editor revision/context guards |
| pdf-position | Remember page/zoom; rerender on container resize; stop previous-page TTS | Extended device progress |
| device-backup | Export/preview/restore a versioned JSON snapshot atomically; validate untrusted files and preserve conflicting notes | Progress/annotation types |

Build order: tests and backward-compatible types → anchor/speech → ambient/editor/PDF → backup UI → integrated verification/release.

Acceptance:
- Font, line height, width, reading mode and viewport changes keep the same text location visible. Exact anchors are used only for the same chapter/locale/revision. Scroll persistence stays coalesced.
- TTS in paged mode updates the Reader page counter and progress instead of independently scrolling a clipped container. Changing rate/voice during playback continues the current chunk (word boundary when available); edition changes stop old speech. Read-from-selection keeps DOM offsets.
- A stop or newer preset invalidates every earlier async start; delayed callbacks cannot create hidden sources. Closing the sound panel still permits ambient playback as before; leaving Reader cleans up.
- Import/inline image upload makes parent busy before awaiting. Tab/locale/chapter changes and save/publication are blocked until completion/error. Import preview changes prompt on discard. No user content is replaced by test data.
- PDF page/zoom survive reload/chapter return; stale revisions reset safely. Resizing redraws the same page. Existing component callers can omit persistence props.
- Backup format v1 identifies this book, has bounded fields/counts/size and rejects malformed records/script URLs. UI previews counts before explicit restore. Notes merge without dropping either side of a conflicting ID; repeat restore is idempotent. Progress/settings restoration is explicit; commits across stores are atomic, and settings cookie mirrors only after success. No server upload or new account sync.

Commands: `npm test`, `npm run typecheck`, `npm run build`, `BASE_URL=... npx playwright test --workers 2`, `npm run verify:editor`, isolated PDF/component harness.

Verification: unit tests for backup boundaries/merging and anchor boundary behavior; browser regressions for the audited failures, PDF persistence/resizing, import race and JSON round trip. Check actual Vercel URL before completion. Never commit env keys, invitations, backups containing user secrets or build/dependency output.

Limits: Web Speech boundary support/quality varies. With no boundary events, continuing from the start of the current short segment is intentional. Physical device testing remains separately reported.

Implementation checkpoint: all six modules implemented. Fresh local production build, typecheck and 58 unit tests pass. Complete Chromium desktop/mobile regression suite: 59 passed, 5 intentional skips, no retries. Isolated real-PDF Reader fixture passes reload/chapter-return page and zoom restoration plus canvas resize on both viewports. Batched visual QA includes JSON preview and no horizontal overflow. Release URL verification is recorded separately in DEPLOYMENT.json after deployment.

Release verified on production dpl_H7d6bNkA8DYPcw4Z59d6ZUA5evm9: 61 distinct browser cases verified across the full run (60 pass, 3 skip, 1 transport ECONNRESET) and an unchanged focused repeat (1 pass). Real editor VI/EN and cleanup pass. Auth now distinguishes transient verification outages from expired sessions, retries only the idempotent Auth check once, and keeps role/revocation checks strict. Verification details and limits are in VERIFICATION.md.

