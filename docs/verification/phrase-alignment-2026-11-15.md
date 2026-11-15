# Sentence/clause alignment: hierarchy, tie settling, grounded fallback (2026-11-15)

Scope: the published Vietnamese and English chapters, not new translation. Recipe `labse-poetry-mbert-3`, codec `reader-dom-1`, artifact schema 1 are unchanged. Models, weights and the poetry guards are unchanged.

## What changed

| Area | Change |
| --- | --- |
| `prose_alignment.py` | `add_clause_pairs` builds pairs top-down: whole sentences first (windows of up to three sentences or clauses on either side), then only an accepted pair is split into strictly nested finer pairs. Sentence atoms are formed on both languages, not only English. |
| Competition | A pair competes only with alignments it could really be swapped for: any disjoint window, or an overlapping window that adds atoms no other pair holds. Nested and extending windows that borrow a neighbour's sentence no longer count as rivals. |
| Ties | When a pair is tied with such an overlapping window, the window whose atoms all find their own partner inside it (and leaves no free atom that prefers it) is kept, the largest when valid windows nest; otherwise it abstains. |
| Residual pairs | Inside an accepted parent, atoms left between confident pairs may pair by elimination at score ≥ 0.4 with margin ≥ 0.03. They are flagged `residual: true` and trusted by the consumer only at that floor. |
| `novel-lookup.ts` | Partial sentence coverage keeps resolved sentences apart from unresolved ones; the fallback context is the narrowest stretch between trusted pairs, not the whole paragraph. A phrase inside one sentence whose content is mostly anchored keeps an uncertain highlight when one unlinked word is missing; negation and numbers still force the fallback. |
| `book_glossary.py` | A same-fold name may count one confirmed note caption (structure label inside a note pair with score ≥ 0.5 and margin ≥ 0.03) as an extra context beside at least one body context. Non-name terms still require semantic validation; ambiguity still abstains. |

## Measured locally (no production checks)

120 directional probes (`evaluate.ts`, F1 ≥ 0.5). These probes were used during development, so this is not an independent held-out set, and a hit is not human-verified meaning.

| Kind | cbb0610 | 496602b | now | false-precise (cbb / 496 / now) | context-only (cbb / 496 / now) |
| --- | ---: | ---: | ---: | --- | --- |
| word | 32/40 | 32/40 | 32/40 | 1 / 1 / 1 | 5 / 5 / 5 |
| phrase | 18/40 | 15/40 | 21/40 | 1 / 1 / 1 | 20 / 23 / 17 |
| sentence | 38/40 | 32/40 | 39/40 | 0 / 0 / 0 | 2 / 8 / 1 |

Against 496602b: 13 probes improve, none worsen. One phrase and one sentence probe that cbb0610 answered still return context only (the sentence miss is a quoted passage handled by the note/poem scope path, unchanged by this work).

| Check | Result |
| --- | --- |
| Chapter-2 regressions (`chapter2-regressions.ts`, 4 cases × 2 directions) | 8/8 now; 2/8 on 496602b |
| Poetry regression (87 cases, 12 poetry chapters) | identical to the recorded run: 86 correct poem contexts, 72 highlights all inside the correct poem, 0 outside |
| Pair churn vs 496602b | 1,021 of 1,189 old pairs unchanged; 108 changed within the same target region; 60 dropped; 0 contradict (same source, disjoint target) |
| Pair count | 1,189 → 3,924 (214 flagged residual) over 797 groups |
| Spot audit | 26 randomly drawn new pairs (12 residual, 14 other) read by the same model that wrote them: 25 correct counterparts, 1 over-covers the English side. Not human-verified. |
| Vitest | 346 passed (341 before + 5 new) |
| Python unittest | 101 passed (92 before + 9 new) |
| Typecheck | clean |
| Browser (local, `CONTEXTUAL_PREVIEW=1`, downloaded-lookup cases excluded) | 60 passed (desktop, android-phone, webkit-phone projects; 2 workers) |
| Production build | `npm run build` passed |

Glossary (all 20 chapters, same artifacts): accepted 117 → 167 (+50, all same-fold names with body plus caption evidence, none ambiguous); candidates 14,193 → 14,142; ambiguous candidates unchanged at 8,243. 107 additional score-1 links are applied to exact single occurrences inside their own group.

## Known limits

- LaBSE scores faithful but archaic or compressed translations near 0.48–0.55, so the 0.5 floor still drops some correct pairs; the residual rule recovers only those sandwiched between confident pairs inside an accepted parent.
- Phrase lookup is 21/40 by F1; some phrases keep a context-only answer even when the exact counterpart is now the narrowed context.
- Cross-chapter evidence is not used: 30 names appear once in each of ≥ 2 chapters, and 283 names occur once in the whole book. They stay candidates because the per-chapter worker has no book-level binding. Titles, honorifics and allusions were not mined.
- The 26-pair audit is small and not independent.

## Release state

- Source commit `d4d33381ab51c8d6a048d56f40b4ff91a0183a09` pushed to `main`.
- Data: the 20 prepared artifacts (9,424,596 bytes) were queued and published through the alignment worker; it reported all 20 chapters `ready`. Source bindings matched the claimed published pairs, so no chapter was recomputed in CI.
- Web: Vercel production deployment `dpl_AWeuSL8MMQAarWRFs2VXkaVyJvD5` (READY) aliased to https://truyen-ky-man-luc.vercel.app.
- **Post-deploy verification was skipped by instruction.** No production API, browser or download check was run, and the local numbers above are not production verification.
- Previous release: `dpl_CiM32z9puvhqnDPk891st6tsaWS9` on `496602b`.
