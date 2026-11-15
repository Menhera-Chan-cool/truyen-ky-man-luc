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

## Second pass: the limits listed above (source `c548718`, data only; web unchanged)

| Limit | What changed | Result |
| --- | --- | --- |
| Score floor drops correct pairs | A gap between two confident top-level pairs may pair by elimination at the flagged 0.4 floor (it already did inside an accepted parent). | +27 pairs; all 27 read as correct counterparts (model reading, not human). The 120 probes did not move because none falls on those pairs. |
| Cross-chapter name evidence | `merge_book_names` adds contexts across chapters for same-fold names; each promoted entry carries the source versions of every chapter it relies on, and `apply_glossary` drops it when any of them is no longer the published source. A name with another partner anywhere in the book abstains. | accepted 167 → 266 (99 book-scope entries, 51 distinct names); applied links 107 → 209; ambiguous candidates unchanged in kind. |
| Titles, honorifics | A lowercase Vietnamese word and a capitalized English word right before the same name in both editions are recorded as **title candidates** with their anchor names. They are never accepted or applied. | 30 candidates (núi/Mount, vua/Emperor, ông/Lord, đức/Majesty… plus some noise) for review. |
| Allusions | Not mined: no direct counterpart can be shown from the book, so they stay context only. | unchanged |
| Phrase recall (21/40) | Not fixed. Of 19 misses, about 9 already return the exact counterpart as the narrowed context but no highlight, and about 7 are cut by a group boundary (the other half of the phrase sits in the neighbouring group). Both need new machinery: phrase-level embedding inside trusted pairs (hundreds of thousands of encodes) or boundary repair across groups with a new word-link stage. | unchanged |
| LaBSE scores faithful archaic text near 0.5 | Cannot be changed without changing the pinned model. The residual rules recover only pairs that are anchored by confident neighbours. | partly mitigated |
| Audit is small and not independent | Cannot be fixed by code. 27 more pairs were read, still by the model. | open |

Local checks for this pass: vitest 349, Python 106, typecheck clean, probes unchanged (word 32/40, phrase 21/40, sentence 39/40), chapter-2 regression 8/8, poetry QA metrics identical to the released run, browser 60/60. The data was published again through the worker (all 20 chapters `ready`); the web deployment `dpl_AWeuSL8MMQAarWRFs2VXkaVyJvD5` is unchanged because no web code changed. Post-deploy verification was again skipped by instruction.

## Third pass: phrases, allusions, the score floor (source `2b75f11`, data and web)

| Limit | What changed | Result |
| --- | --- | --- |
| Phrase recall | `add_phrase_pairs` aligns word windows inside the finest trusted pair: EN 2–6 words, VI 1–6 words, windows may cross commas but never a sentence end, a break or a note marker. A window's best counterpart is kept only when score ≥ 0.5, it leads every disjoint window by ≥ 0.08 and the counterpart's own best window overlaps the query. The lookup uses a pair only for a selection that is exactly its source window and **only when word links give nothing** (empty or incomplete); it never narrows or widens good word links. | 75,329 phrase pairs in 1,767 groups, about 1 MB per artifact. Probes: word 33/40, phrase 23/40 (was 21), sentence 39/40; 16 probes better than 496602b, none worse. |
| Allusions | A selection right before a body note marker `(n)` that has no counterpart of its own also shows the confirmed paired note as context, never as a highlight. | Covered by tests; no probe measures it. |
| Score floor | A weak pair next to a confident one now pairs by elimination at the flagged 0.4 floor at the top level as well as inside a parent. A global lower DP floor was tried first and rejected: it changed 130 groups and dropped good pairs. | +58 pairs; all read as correct by the same model reading. 4,009 clause pairs, 275 flagged `residual`. |

What was **not** fixed: the pinned LaBSE model still scores faithful archaic text near 0.5 (the floor is mitigated only next to confident neighbours); about 7 of the remaining 17 phrase misses are cut by a group boundary (the other half sits in the neighbouring group) and need boundary repair with a new word-link stage; the spot reads are by the model, not a person. A 30-pair read of phrase pairs found about a third to be fragmentary windows, which is why the thresholds were tightened and why the lookup is fallback-only.

The worker now builds phrase pairs in its LaBSE stage, so a republished chapter keeps them; its Python timeout is 25 minutes and the workflow timeout 35. Local checks: vitest 356, Python 110, typecheck clean, production build passed, browser 60/60, chapter-2 regression 8/8, poetry metrics identical to the released run.

Release: data re-published through the worker (20 chapters `ready`, 19,411,300 bytes); web `dpl_EnyHCr5LdcB1AXXmv5HywkHSQycv` aliased to https://truyen-ky-man-luc.vercel.app (previous `dpl_AWeuSL8MMQAarWRFs2VXkaVyJvD5`). **Post-deploy verification was skipped by instruction.**

## Fourth pass: group boundaries (source `af006e0`) and the Supabase egress incident (source `049d163`)

**Group boundaries.** Two steps run after the parent repair, on prose only. `repair_boundaries` re-splits two groups that touch inside one paragraph when another cut of their units pairs both halves much better (total gain ≥ 0.10 and each half ≥ 0.5). `adopt_orphans` adds a unit the pairing had skipped between groups (one or two units, same paragraph) to the neighbour it completes when that lifts the group's own pairing by ≥ 0.04 to at least 0.5. Neighbour re-splitting alone fixed only 6 groups; the "thổi kèn" case was a skipped unit, which is why the second step exists. 51 groups in 16 chapters changed; 22 sampled were all improvements (model reading). Word links for changed groups come from the normal mBERT stage, so the worker path was run end to end on chapter 5 and its artifact validated.

| Measure | Before | After |
| --- | ---: | ---: |
| 120 old probes: word / phrase / sentence | 33 / 23 / 39 | 33 / 27 / 39 |
| Fresh held-out set, hits of 120 (see below) | 87 | 91 |

The held-out set is 60 sentence pairs from 14 chapters not used for tuning, two directions, gold taken from the same body note number `(n)` in both editions (independent of any model). Against 496602b it goes 74 → 87 → 91 hits, context-only 37 → 19 → 15; answered-but-not-hit rose 8 → 13 (2 disjoint, 11 partial overlaps). It is skewed toward sentences with notes.

**Model comparison, nothing swapped.** Models already cached locally only. Sentence layer, held-out retrieval in the whole chapter: LaBSE vs multilingual-e5-small, top-1 90.0% vs 90.0% (VI→EN) and 98.3% vs 95.0% (EN→VI). Word layer, 60 marker-adjacent anchors: pinned mBERT layer 8 and awesome-align-with-co both recall 41.7%, link precision 56.4% vs 47.1%. No evidence for a swap; the weaker direction is VI→EN span choice, not the encoder.

**Egress incident.** The Supabase project showed 9.99 GB of 5 GB (200%). Edge logs for 24 h: heading fonts 938 requests / 306 MB, book images 844 / 213 MB, the full book RPC 1,073 calls of 773 kB, artifacts about 30 MB. 97% of the signed-URL requests came from one residential IP: `.env.local` holds production credentials, so local dev and browser test runs fetched fonts, covers and the whole book from production (about 250 MB a run). Production inefficiency also mattered: fonts and images redirected to a fresh signed URL per view, so nothing was cacheable (cached egress 3%).

Fixes: published fonts and images stream through Vercel with `public, max-age=604800, s-maxage=604800, immutable` (unpublished files and PDFs keep the private redirect); `getBook` shares one sanitized copy per instance for two minutes; the main Playwright config blanks the Supabase variables for its own dev server; the alignment specs stub font and image requests. Measured afterwards with the Supabase logs: a 60-test alignment run made 3 database calls and 0 storage calls (earlier runs: hundreds of each). The monthly chart and the quota state cannot be changed from code and have not been re-read; the 200% already used stays for this billing period.


## Fifth pass: group coverage (source `1341e0d`)

Evaluation protocol and the blind set are in `docs/EVALUATION_PROTOCOL.md`. This pass changes three things: skipped units are placed by unit-level evidence across paragraph breaks (up to six units, a gap skipped in both editions becomes a small group), the same repair runs in the commentary ("Lời bình") section, and the lookup returns the target text between the two neighbouring groups as context when part of a selection lies in no group.

| Measure (context has gold) | Before | After |
| --- | ---: | ---: |
| Blind set, 102 cases | 79.4% | 83.3% |
| Dev pairs, 120 cases | 89.2% | 90.8% |
| Tuned-chapter stratum, 110 cases | 80.0% | 83.6% |

Blind hits 74 → 76 of 102, wrong answers 0 → 0. 120 probes unchanged (word 33, phrase 27, sentence 39 of 40), chapter-2 regressions 8/8. The 95% target is not met and the movement is inside the ±8-point interval; the blind EN→VI direction still has 11 of 51 cases with neither an answer nor the right context (not read, per the protocol).

Local checks: vitest 362, Python 119, typecheck clean (the e2e helper now exports `Page`; the earlier commit left a type error that a build would have hit), build passed, alignment e2e 60/60 on the new data. Release: data re-published through the worker (20 chapters `ready`, 19,574,740 bytes); web `dpl_Df58B4tHGc5nE66tvhkyVAAYMKZX` aliased to https://truyen-ky-man-luc.vercel.app. Deployed; post-deploy verification skipped by user.

## Sixth pass: sentence closure (source `f30ab15`)

A free atom next to an accepted sentence pair now joins it when a clause of the pair's other side has this atom as its best partner in the whole group and prefers it to everything inside the pair (the other edition had split one sentence in two). 45 pairs in 39 of 3,901 groups changed; read in full, 44 of the 45 additions are the correct remainder of the sentence. Dev wrong answers 2 → 0 and hits 94 → 96 of 120; the blind set is unchanged (hit 76 of 102, context has gold 83.3%, wrong 0), so no gain is claimed from it. Probes 33/27/39, chapter-2 8/8, vitest 362, Python 120, alignment e2e 60/60. One vitest test failed once in each of two runs made right after a build or e2e run and did not reproduce in the six later runs; it was not identified. Release: data only (20 chapters `ready`, 19670074 bytes); the web deployment is unchanged. Deployed; post-deploy verification skipped by user.
