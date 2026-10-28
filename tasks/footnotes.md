# Footnotes — approved user request 28/10/2026

## Objective and boundaries
Render the existing book's `(n)` references as small blue superscript digits, without visible parentheses. Hover/focus previews the matching endnote; click/touch navigates to that endnote through Reader's existing fragment/history/page mechanism. VI/EN, scroll/single/double and keyboard access must work. Native TTS omits inline reference markers while retaining UTF-16 offsets and existing listening checkpoints. It may still read the note prose at the end when reading the entire chapter.

Assumptions: change the presentation, not stored book HTML/revisions. Only matched endnotes become references; years and unmatched numbers remain ordinary text. Existing DOM textContent must be byte-for-byte unchanged so annotations, search and progress anchors remain valid. PDF pages are unchanged. No dependency/schema/account changes or automatic translation.

## Plan and code boundaries
Reuse existing fragment navigation and global tooltip; enhance that tooltip only for long endnote previews with hover/focus/Escape support. Decorate sanitized Reader HTML using DOM nodes, never raw HTML from tooltip text. Identify numbered notes after VI/EN note headings, support a numbered tail without a heading, existing superscript links, and the known unnumbered chapter-3 VI legacy note labels (including the two-paragraph note 7). Keep continuation paragraphs in previews. Mask references with equal-length spaces in the speech copy, not in book text.

Implementation: `src/lib/footnotes.ts`, Reader, Tooltips, useSpeech, globals.css. Unit tests in `tests/footnotes.test.ts`; integration/browser tests in `e2e/footnotes.spec.ts`. Follow current TypeScript named exports, DOM APIs and existing theme tokens; blue links adapt for dark paper.

## Verification
Write red tests first. `npm test -- --maxWorkers 2`; `npm run typecheck`; `$env:CIRCLE_NODE_TOTAL='3'; npm run build`. `BASE_URL=... npx playwright test --workers 1` on production build, then affected hosted journeys. Check matching targets, hover/focus/Escape, safe/plain long preview, tap/click scroll and paged navigation + Back, TTS queue/boundary/resume, existing notes/search/font continuity. Survey all published editions without writing data. One local desktop/mobile visual batch and one final live confirmation; private GitHub push, Vercel alias/source check and source ZIP.

Source survey found 41 published editions and preserved each edition textContent/UTF-16 length. Chapter 2 EN contains endnotes but no inline numbered references, so nothing is invented. Chapter 14 VI also lost labels 31–43; exact known label prefixes restore those references and CSS labels without stored edits. The old single-text-node selection fixture was corrected to span the same exact character range across nodes. Tooltip previews also dismiss on page-arrow keys.
