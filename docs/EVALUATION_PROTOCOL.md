# Evaluation protocol for EN↔VI lookup (frozen 2026-11-17)

Purpose: stop reporting numbers measured on the data the code was tuned on. Every change is judged on a set it was not tuned on, with the metric defined first.

## Sets

| Set | Size | Used for | Rule |
| --- | ---: | --- | --- |
| **Dev probes** (`scripts/align-novel/evaluation.json`) | 120 directional (40 word, 40 phrase, 40 sentence) | tuning and regression | Heavily tuned on. Never a basis for a claim. |
| **Dev pairs** (`heldout/gold.json`) | 60 sentence pairs, 120 directional cases, 14 chapters | reading failures while developing | Failure analysis allowed here only. |
| **Blind** (`heldout/blind.json`, stratum `fresh`) | 51 sentence pairs, 102 directional cases, same 14 chapters | judging a change | Not read or analysed while developing. Evaluated once before a change (baseline) and once after. |
| **Tuned-chapter stratum** (`blind.json`, stratum `tuned`) | 55 pairs, 110 cases, chapters 1, 2, 5, 14, 18 | context only | Independent gold, but the algorithm was tuned on these chapters. Reported apart, never as evidence. |

Gold is independent of every model in the pipeline: a sentence pair is accepted only when the same body note number set `(n)` appears once in each edition's body, outside poetry and the notes section. A few "interval" pairs (the k-th sentence between two matched notes when both editions have the same sentence count) are lower reliability and are not used for claims.

## Known limits of this gold

- **1↔n sentence splits.** The English often splits one Vietnamese sentence into several, so the note-bearing sentence on one side is a *part* of the other side's sentence. Eight of the first 18 "no answer, wrong context" dev cases were of this kind: the system returned the right clause but the gold span is the whole long sentence. Sentence-level gold therefore **under-reports** the system, most in the EN→VI direction.
- **Size.** 51 pairs give a Wilson 95% interval about ±8 points at 90% (±10 at 75%). A claim above 95% needs on the order of 400 independent cases, or a human-labelled set.
- **Model-built, not human-checked.** The note numbering is the independent signal, but nobody has read these pairs. A human spot-check of about 100 random cases is still required before quoting an accuracy.

## Metrics (per directional case)

Outcome classes, using character-span F1 of the highlights against the gold counterpart:

| Class | Definition |
| --- | --- |
| hit | answered, F1 ≥ 0.5 |
| partial | answered, 0 < F1 < 0.5 (right region, wrong extent) |
| wrong | answered, no overlap with the gold |
| abstain, context has gold | no highlight, but a returned passage contains the whole gold span |
| abstain, no context | no highlight and no passage contains the gold |

Reported: **coverage** (answered / all), **hit of all**, **hit of answered**, **not-wrong of answered** (hit + partial), **context has gold** (hit or context contains the gold span; the coverage target of step 1), each per direction, with Wilson 95% intervals. Always say which one a target refers to: ">98%" means very different things for "not wrong of answered" and for "hit of all".

## Baseline on the published data (`phr5`, source `af006e0`)

| | n | hit | partial | wrong | abstain+ctx | abstain no ctx | coverage | hit of all | hit of answered | not-wrong of answered | context has gold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dev pairs | 120 | 91 | 11 | 2 | 11 | 5 | 86.7% | 75.8% | 87.5% | 98.1% | 89.2% |
| Blind | 102 | 74 | 4 | 0 | 6 | 18 | 76.5% | 72.5% | 94.9% | 100% | 79.4% |
| ↳ VI→EN | 51 | 40 | 2 | 0 | 3 | 6 | 82.4% | 78.4% | 95.2% | 100% | 86.3% |
| ↳ EN→VI | 51 | 34 | 2 | 0 | 3 | 12 | 70.6% | 66.7% | 94.4% | 100% | 72.5% |
| Tuned-chapter stratum | 110 | 77 | 7 | 2 | 11 | 13 | 78.2% | 70.0% | 89.5% | 97.7% | 80.0% |

Reading: when the system answers it is right about 95% of the time on the blind set; the gap is **coverage**, mostly the English side (23.5% of blind EN→VI cases get neither an answer nor the right context).

## After step 1 (group coverage), same protocol, blind set evaluated once

Changes: skipped units are placed by unit-level evidence (`place_orphans`: across paragraph breaks, up to 6 units, joint gaps in both editions become small groups), the same repair now also runs in the commentary ("Lời bình") section, and the lookup returns the target text between the two neighbouring groups as context when part of the selection lies in no group.

| | n | hit | partial | wrong | abstain+ctx | abstain no ctx | coverage | hit of all | hit of answered | not-wrong of answered | context has gold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dev pairs | 120 | 94 | 11 | 2 | 10 | 3 | 89.2% | 78.3% | 87.9% | 98.1% | 90.8% |
| **Blind** | 102 | 76 | 4 | 0 | 8 | 14 | 78.4% | 74.5% | 95.0% | 100% | **83.3%** |
| ↳ VI→EN | 51 | 41 | 2 | 0 | 5 | 3 | 84.3% | 80.4% | 95.3% | 100% | 92.2% |
| ↳ EN→VI | 51 | 35 | 2 | 0 | 3 | 11 | 72.5% | 68.6% | 94.6% | 100% | 74.5% |
| Tuned-chapter stratum | 110 | 77 | 8 | 2 | 15 | 8 | 79.1% | 70.0% | 88.5% | 97.7% | 83.6% |

Dev probes (120): word 33/40, phrase 27/40, sentence 39/40 (unchanged). Chapter-2 regressions 8/8.

Reading: context-has-gold moved 79.4% → 83.3% on blind (+4 cases), 89.2% → 90.8% on dev, 80.0% → 83.6% on the tuned stratum, with no new wrong answers. The movement is consistent in direction but inside the intervals (±8 points) and **the ≥95% target is not met**. What is left on dev is mostly the 1↔n gold limit above (the returned clause is right, the gold span is the whole sentence). The blind EN→VI direction still loses 11 of 51 cases to "no answer, no context"; they were not read, per rule 1, so the cause of those is not known yet.

## After step 2 (sentence closure), blind set evaluated a second time

Change: when the other edition splits one sentence in two, the second half used to stay a free atom beside the pair (a longer window scores lower in LaBSE than its best half, and a long sentence scores low against one short atom). A free atom next to an accepted sentence pair now joins it when a clause of the pair's other side has this atom as its best partner in the whole group and prefers it to everything inside the pair (`_close` in `prose_alignment.py`, root level only). 45 pairs in 39 of 3,901 groups changed. Read in full, 44 of the 45 additions are the correct remainder of the sentence; one is doubtful.

New column, defined before looking at the blind result: **region-consistent** = answered, F1 < 0.5, and the highlight lies inside the gold (precision ≥ 0.9) or the gold lies inside the highlight (recall ≥ 0.9). On this gold that is the signature of a 1↔n sentence split, not an error: the answer is right, the gold span is a different size. It is reported next to hit, never added into it.

| | n | hit | partial | wrong | abstain+ctx | abstain no ctx | region-consistent | coverage | hit of all | context has gold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dev pairs, step 1 → 2 | 120 | 94 → 96 | 11 → 13 | 2 → **0** | 10 → 8 | 3 → 3 | 11 → 13 | 89.2% → 90.8% | 78.3% → 80.0% | 90.8% → 90.8% |
| **Blind**, step 1 → 2 | 102 | 76 → 76 | 4 → 4 | 0 → 0 | 8 → 8 | 14 → 14 | 3 → 3 | 78.4% | 74.5% | 83.3% → 83.3% |
| Tuned-chapter stratum | 110 | 77 → 77 | 8 → 8 | 2 → 2 | 15 → 15 | 8 → 8 | 7 → 7 | 79.1% | 70.0% | 83.6% |

Reading: on dev every answered case is now a hit or region-consistent (109 of 109), and the two wrong answers are gone. **On the blind set nothing moved**, so by rule 2 the blind result is no improvement; the blind sample contains almost none of the long split sentences this closes. Probes 33/27/39 and chapter-2 8/8 unchanged. The remaining shortfall is coverage: the cases with no answer (11 dev, 14 blind with no context), not wrong answers.

## Word and phrase sets, and step 3 (phrase table and arbitration)

The 120 dev probes cover chapters 1 and 18 only and were tuned on heavily, so two fresh lexical sets were labelled by hand from dev sentence pairs of the other chapters **before any system output was read**: 20 word pairs and 20 phrase pairs each, both directions (40 + 40 cases per set).

| Set | Role | Rule |
| --- | --- | --- |
| Lexical A (`heldout/lex-gold.json`) | dev | baseline taken once, then failures read and used |
| Lexical B (`heldout/lex-gold-b.json`) | blind | baseline taken once before the change, evaluated once after; no case read |

Measured on exact-window phrase pairs of the published data (set A and the dev probes, 65 lookups): every pair at score ≥ 0.65 was right (59 of 59); below that, 3 of 6 were right and 2 were wrong. Margins below 0.15 were half wrong. A lower second tier would add wrong answers, so the opposite was done.

Changes: the stored phrase pairs now keep score ≥ 0.65 and margin ≥ 0.15 (was 0.5 and 0.08), the windows run from one to eight words on both sides (English was two to six), a strong exact phrase pair replaces word links that miss it entirely (never links that overlap it: they are not widened), and the phrase fallback no longer treats punctuation beside the pair as unmatched content (a trailing comma on the clause unit used to block a 0.67 pair).

| Hits of 40 (wrong in brackets) | Before | After |
| --- | ---: | ---: |
| Set A words | 29 (6) | 30 (5) |
| Set A phrases | 25 (1) | 27 (0) |
| **Set B words (blind)** | 29 (2) | 29 (2) |
| **Set B phrases (blind)** | 30 (0) | 30 (0) |
| Dev probes words / phrases / sentences | 33 / 27 / 39 | 34 / 26 / 39 |

**On the blind sets nothing moved**, so no gain is claimed. Dev: "die" → "chết" is gained through the new one-word English window; one borderline pair below the new floor was lost ("their hearts were so entwined"). Sentence sets are unchanged (dev 96 of 120, blind 76 of 102, context has gold 83.3%).

What is left is mostly not the table: a gold pair sometimes scores below its rivals in LaBSE ("văn chương thông thái" ↔ "accomplished in letters" 0.36 against 0.57 for a wrong window), and mBERT links swap items in parallel lists ("gấu"/"thỏ" ↔ "bears"/"hares") where no strong phrase pair exists. Both are encoder limits, the subject of step 4. The only independent figures are set B's: words 29 of 40 (72.5%) and phrases 30 of 40 (75%) with 2 and 0 wrong, far from 95%; set A is dev, so its gain (words 29 → 30, phrases 25 → 27 of 40) is not evidence.

## Step 4 (encoder), locally cached models only: no gain, nothing changed in the product

Models already on disk: LaBSE (pinned), multilingual-e5-small, mBERT, awesome-align, xlm-align-base, XLM-R large. The word and phrase windows of the dev lexical sets (set A and the dev probes) were scored by each encoder, restricted to the finest pair that holds both gold spans, and the best counterpart window was checked against the gold (F1 ≥ 0.5). Set B was not used.

| Window scorer | Set A words | Set A phrases | All A (66 lookups) |
| --- | ---: | ---: | ---: |
| LaBSE | 26 / 33 | 31 / 33 | 57 |
| multilingual-e5-small | 14 / 33 | 19 / 33 | 33 |
| LaBSE + E5, equal weights | 26 / 33 | 31 / 33 | 57 |
| LaBSE 0.25 + E5 0.75 | 24 / 33 | 29 / 33 | 53 |

E5-small is much weaker on these short windows and fusing it adds nothing, so there is no encoder to adopt among the cached models. Over set A plus the dev probes (132 lookups) the LaBSE best window is right 114 times (86%); the current gate (score ≥ 0.65, margin ≥ 0.15, mutual best) emits 90 of them with 87 right (96.7%), while a looser gate (0.5 / 0.10) would emit 108 with 102 right (94.4%). Taking the largest window within 0.04 of the best one ("wine" → "Heavy with wine") helped the best-window check on dev (phrases 53 → 55 of 62) but changed no answered lookup on set A or the probes while rewriting 21,751 stored pairs, so it was dropped.

What would move the numbers is outside what is cached: a stronger multilingual sentence encoder (a new download), fine-tuning on in-book pairs split by chapter, or human-labelled pairs. Each needs explicit permission.

## Step 4b: one downloaded encoder (BAAI/bge-m3), not adopted

With the user's permission for one download: `BAAI/bge-m3` (MIT, not gated), revision `5617a9f61b028005a4858fdac845db406aefb181`, `pytorch_model.bin` 2,271,145,830 bytes plus tokenizer files, in `work/bge-m3-download` (outside the repository), loaded locally with the safe weights loader, dense CLS vectors, no instruction prefix. Same dev measurements as above; set B and the blind sentence set were not used because nothing was adopted.

| Window scorer, set A | Words | Phrases | All (66 lookups) |
| --- | ---: | ---: | ---: |
| LaBSE | 26 / 33 | 31 / 33 | 57 |
| bge-m3 | 22 / 33 | 28 / 33 | 50 |
| LaBSE 0.75 + bge-m3 0.25 | 26 / 33 | 31 / 33 | 57 |
| LaBSE 0.5 + bge-m3 0.5 | 26 / 33 | 30 / 33 | 56 |
| LaBSE 0.25 + bge-m3 0.75 | 24 / 33 | 30 / 33 | 54 |

| Dev sentence retrieval (60 pairs, whole chapter) | VI→EN top-1 / MRR | EN→VI top-1 / MRR |
| --- | ---: | ---: |
| LaBSE | 90.0% / 0.925 | 98.3% / 0.992 |
| bge-m3 | 86.7% / 0.920 | 96.7% / 0.978 |
| LaBSE 0.25 + bge-m3 0.75 | 91.7% / 0.951 | 98.3% / 0.992 |

A stronger general-purpose encoder is not better here: it loses on short windows, and the best fusion gains one case of 60 on dev sentences (inside the noise) for a second 2.3 GB model in the worker, the CI download and twice the encoding. LaBSE stays. The remaining paths are fine-tuning on in-book pairs split by chapter, or human-labelled pairs; both need explicit permission.

## Step 4c: fine-tuning LaBSE on in-book pairs (CPU), not adopted

Permission for fine-tuning was given by the user. Chapters **1, 4, 9, 11, 15, 16 were held out of all training** and every comparison below uses only the evaluation items of those chapters. Training data from the other 14 chapters: 3,386 phrase pairs (consistent under the mBERT word links, both windows start and end on a content word, LaBSE agreement ≥ 0.5; extracted from 28,983 candidates), 1,031 confident sentence pairs of the hierarchy, and 70 note-anchored sentence pairs weighted three times. Embeddings frozen, 86 M trainable parameters, symmetric InfoNCE with shifted-window hard negatives, CPU at about 4.2 s per step. Training and evaluation scripts live outside the repository (`work/labse-ft`).

| Held-out chapters, best-window hits (LaBSE → fine-tuned) | Run 1 (lr 1e-5, 300 steps) | Run 2 (lr 3e-5, 400 steps, loss 0.05) |
| --- | ---: | ---: |
| Lexical set A words (dev, of 20) | 15 → 15 | 15 → 16 |
| Lexical set A phrases (dev, of 22) | 20 → 20 | 20 → 19 |
| Dev probes, chapter 1 words (of 17) | 16 → 17 | 16 → 17 |
| Dev probes, chapter 1 phrases (of 12) | 9 → 10 | 9 → 12 |
| Dev sentence retrieval VI→EN (of 33) | 29 → 30 | 29 → 29 |
| Dev sentence retrieval EN→VI (of 33) | 33 → 33 | 33 → 32 |

Run 1 was chosen on dev (no regression anywhere) and taken to the blind sets once:

| Blind, held-out chapters (LaBSE → fine-tuned) | |
| --- | ---: |
| Lexical set B words (of 17) | 13 → 13 |
| Lexical set B phrases (of 17) | 15 → 15 |
| Blind sentence retrieval VI→EN (of 24) | 21 → 21 |
| Blind sentence retrieval EN→VI (of 24) | 23 → 23 |

**No measurable gain**: the dev differences are a case or two and run 2 trades one regression for another; the blind numbers are identical. Training loss fell from 0.5 to 0.16 (run 1), so the model learned the pairs, but the pairs are LaBSE-confident pairs and noisy link-derived phrases, which add little LaBSE did not already know. Not adopted, nothing published. What could still help is clean, independent data: human-labelled pairs, which would also give the accuracy figure that every number above lacks.

## Random audit of the published lookup (labelled by Claude, not by a human)

Because every number above is checked against gold that was built from note numbers or by hand for tuning, a seeded random audit was drawn that touches none of it: 20 chapters × (2 sentences, 2 phrases, 2 words), the language of the selection random, prose only (poetry and notes excluded), run on the published data (source `506c49f`). For each case the true counterpart was written **before the system's highlights were read**, then the highlights were scored (span F1 ≥ 0.5 is a hit) and every non-hit was read. Two cases were adjudicated by reading (48: the middle of the sentence is missing, 56: the negation is dropped). Cases, labels, outputs and verdicts: `docs/verification/audit-120-2026-11-15.json`.

**The labeller is a language model, not a person.** It is independent of LaBSE and mBERT but shares whatever blind spots a model has with archaic Vietnamese; the file is there so a human can overrule any line.

| 120 random lookups | n | answered | hit | incomplete | partial | wrong | abstain: right context | abstain: no context | hit of answered (95% CI) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 120 | 85 (71%) | 78 | 1 | 3 | 3 | 29 | 6 | 92% (84–96) |
| Words | 40 | 26 | 23 | 0 | 0 | 3 | 10 | 4 | 88% (71–96) |
| Phrases | 40 | 27 | 24 | 0 | 3 | 0 | 12 | 1 | 89% (72–96) |
| Sentences | 40 | 32 | 31 | 1 | 0 | 0 | 7 | 1 | 97% (84–99) |
| From Vietnamese | 60 | 45 | 43 | 0 | 1 | 1 | 13 | 2 | 96% (85–99) |
| From English | 60 | 40 | 35 | 1 | 2 | 2 | 16 | 4 | 88% (74–95) |

Reading: when the system answers it is right about 92% of the time and not wrong in 82 of 85 (96%); it answers 71% of the time and, when it abstains, 29 of 35 give the right context. The three wrong answers are word cases: "serpents" → "chim" (a swap inside the list "chim cắt … rắn độc"), "very" → "rất" (the wrong "very"), "chưa" → "had". Five of the six abstentions without context are words or phrases for which the lookup returned no passage at all, and one is a sentence whose passage holds only its first clause. **The targets of 95% for answers and 98% in both directions are not met**: words 88%, English→Vietnamese 88%, and a 95% claim needs about 400 independent cases.

## Fixing what the audit found: gap context and interior closure (lookup only, no new data)

Findings of the audit that this addresses: 35 of 120 lookups abstained, 5 of them with no passage at all, and the abstentions that sat in trusted groups were mostly sentences broken by an orphan clause that belonged to no group.

1. A selection that lies wholly in text no group holds now gets context: the unclaimed target text between the two neighbouring groups of the section, or, when their target texts touch, both of them (up to 1,500 characters). Out-of-order or huge gaps stay "unavailable".
2. A selection that runs over several groups whose only gaps are orphan clauses between two of those groups (every selected group matched whole, no unmatched content inside any group, a target gap of at most 120 characters or three times the orphan) is answered: the highlight runs across the orphan and the passage covers its source, so the coverage check accepts it. Status is "uncertain".

| | Before | After |
| --- | ---: | ---: |
| **Blind sentences (102), hit** | 76 | **84** |
| Blind sentences, coverage / hit of all | 78.4% / 74.5% | 86.3% / 82.4% |
| Blind sentences, hit of answered / wrong | 95.0% / 0 | 95.5% / 0 |
| Blind sentences, no answer and no context | 14 | 7 |
| Blind sentences, context has gold | 83.3% | **90.2%** |
| Tuned-chapter stratum, hit / context has gold | 77 / 83.6% | 81 / 85.5% |
| Dev sentence pairs, hit | 96 | 96 |
| Lexical sets A and B, dev probes, chapter 2 | unchanged | unchanged (words 29/40, phrases 30/40 on B; probes 34/26/39; 8/8) |
| Audit (dev now: its cases were read), hits of 120 | 78 | 80 |
| Audit, abstain with no context | 6 | 3 |

The blind sentence set was evaluated once for this change (its earlier runs belonged to earlier changes). Dev did not move because step 1 had already placed the orphans it contains; the blind and tuned sets gained because the lookup now closes what the data still leaves open.

**Not fixed, and why.** The three wrong words in the audit ("serpents" → "chim", "very" → "rất", "chưa" → "had") stay. A LaBSE check on single words cannot veto them: right answers scored 0.36–0.80 and wrong ones 0.55–0.99 against their selection; when mBERT and the LaBSE best window disagree, the mBERT answer is the right one in 10 of 12 cases. A looser phrase gate does not buy coverage either: over 201 labelled lookups the current gate emits 122 at 95% precision, the loosest gate 171 at 91%, and on the random audit alone the loosened gate is about 85%. A rule against scattered highlights rests on one case and was not added.

## Second random audit, after the gap-context and closure fix (labelled by Claude, not by a human)

A fresh seeded sample (seed 20261121, same design: 20 chapters × 2 sentences, 2 phrases, 2 words, language random, prose only), redrawn so that no sentence is shared with the first audit, was run on the deployed lookup (source `bc00536`). Same procedure: the true counterpart was written before the highlights were read, verdicts by span F1 ≥ 0.5, four cases adjudicated by reading (26 partial; 74, 88 and 117 right but incomplete). Cases and verdicts: `docs/verification/audit-120b-2026-11-15.json`. Same caveat: the labeller is a language model.

| 120 random lookups | answered | hit | incomplete | partial | wrong | abstain: right context | abstain: no context | hit of answered (95% CI) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Audit 1, before the fix | 85 (71%) | 78 | 1 | 3 | 3 | 29 | 6 | 92% (84–96) |
| Audit 1 rerun after the fix (dev: its cases were read) | 87 (73%) | 80 | 1 | 3 | 3 | 30 | 3 | 92% |
| **Audit 2, fresh, after the fix** | 85 (71%) | 79 | 3 | 1 | 2 | 32 | 3 | **93% (85–97)** |
| ↳ words | 25 | 22 | 1 | 0 | 2 | 12 | 3 | 88% (70–96) |
| ↳ phrases | 28 | 25 | 2 | 1 | 0 | 12 | 0 | 89% (73–96) |
| ↳ sentences | 32 | 32 | 0 | 0 | 0 | 8 | 0 | 100% (89–100) |
| ↳ from Vietnamese | 44 | 41 | 2 | 0 | 1 | 15 | 1 | 93% (82–98) |
| ↳ from English | 41 | 38 | 1 | 1 | 1 | 17 | 2 | 93% (81–97) |

Reading. Answered share and hit rate are the same as in audit 1 (71%, 92–93%); what moved is the context: abstentions with no or wrong context fell from 6 to 3 of 120, and the English-to-Vietnamese gap of the first audit (88% against 96%) did not reproduce (93% against 93%), so it was within noise. Not wrong of answered is 83 of 85 (98%, CI 92–99) here and 167 of 172 (97%, CI 93–99) over both audits after the fix; hit of answered is 159 of 172 (92%, CI 87–96) over both. Which of these two is the "98%" target is the user's call; the first is not met and the second is close to the lower end of its interval. The two wrong answers are words in lists or with several candidates ("leather" → "dùi" in the list "dây da … dùi lửa …", "phía" → "the"); the three abstentions without context are a classical-Chinese verse passage with no returned text, a word whose clause is not in the returned passage, and a passage unrelated to the selection. The sample of 120 per audit has intervals of about ±6 points; no claim of 95% or 98% is supportable without a human-checked sample of around 400.

## Human check of 100 audited lookups (one reviewer, no name given)

The review sheet (`docs/verification/human-check-sheet.html`) was filled in and returned (`docs/verification/human-check-result-2026-11-15.csv`, all 100 answered; the first version returned had one blank, case a1-107, later filled in as "the passage does not hold it" with the note "exists but the passage was not returned"). The 100 cases are every non-hit answered lookup (13), every abstention without context (6) and every case without a counterpart (3), plus 51 of my 159 hits and 27 of my right-context abstentions drawn at random. The reviewer saw each case without my verdict. Comparison: `python scripts/align-novel/human_check_compare.py`.

| My verdict (n) | Reviewer: right | partly | wrong | Agreement |
| --- | ---: | ---: | ---: | ---: |
| hit (51) | 36 | 15 | 0 | 36 right, none judged wrong |
| incomplete (4) | 2 | 2 | 0 | 4 of 4 |
| partial (4) | 0 | 3 | 1 | 4 of 4 |
| wrong (5) | 1 | 0 | 4 | 4 of 5 |

| Abstentions | Reviewer agrees |
| --- | ---: |
| My right-context abstentions (27) | 25 (93%): the other two were passages holding only the second half of the selection |
| My no-context abstentions (6) | 6 of 6 agree the passage lacks the counterpart (4 "not in the passage", 2 "no counterpart") |
| No counterpart exists (3) | 3 of 3 |

**What changed in the picture.** My "hit" was F1 ≥ 0.5 against my own label. The reviewer applies a stricter standard of completeness: 15 of my 51 hits are "right but missing or adding too much", 12 of them phrases highlighted in separated pieces ("cast myself into" … "river", not "cast myself into the river"). Re-estimated over the 172 answered lookups of both audits after the fix, with a bootstrap interval:

| Reviewer's standard | Estimate over 172 answered | 95% interval |
| --- | ---: | ---: |
| Right | 67% | 55–78 |
| Right but incomplete or too wide | 30% | 19–42 |
| Wrong | 3% | 1–5 |
| Not wrong (right or partly) | 97% | 95–99 |

So "93% accuracy" overstated what a person would call right; "not wrong" is the figure that survives (97%), and the strict figure is 67%. The two numbers answer different questions and the 95% and 98% targets must be tied to one of them. Single reviewer, 64 answered cases sampled; unspecified expertise.

**Offline estimate of a fix.** On my labels, joining separated pieces of a phrase highlight when the gap holds at most four words and no sentence punctuation raises strict phrase hits (F1 ≥ 0.8) from 21 to 35 of 55 answered phrases and F1 ≥ 0.5 from 49 to 52; one case gets worse by adding an extra word, and 9 of the 17 phrases the reviewer called "partly" become strict hits. Cases that need an end extended ("smiled", "cast") are not helped. This has not been built or deployed.

## Joining the pieces of a phrase highlight (after the human check; lookup only, no new data)

Change: when a multi-word selection is answered from word links in several separated pieces, the pieces are joined into one run if what lies between them is at most four words (and no more than the selection has), none of it claimed by the links of other source words, with no sentence punctuation, note marker or paragraph break. Sentence answers, exact phrase pairs, names and poetry are untouched. Two existing tests encoded the old behaviour and were adapted (a phrase pair wider than the joined links; a "red blue" case whose gap is longer than the selection stays apart); one new test fails without the join.

Strict hit means F1 ≥ 0.8 against the label, a proxy for the reviewer's "right"; hit is the old F1 ≥ 0.5.

| Phrases, hit / strict (before → after) | Hit | Strict (F1 ≥ 0.8) |
| --- | ---: | ---: |
| **Lexical set B (blind), 40** | 30 → 32 | 21 → **30** |
| Lexical set A (dev), 40 | 27 → 29 | 19 → 27 |
| Dev probes, 40 | 26 → 26 | 17 → 21 |
| Both audits (dev now), 55 answered | 49 → 51 | 21 → 30 |

Words are unchanged on B (29 hits, 25 strict, 2 wrong) and A (30, 28, 5 wrong); wrong answers do not rise anywhere. Sentence sets are unchanged (dev 96 of 120, tuned 81 of 110, blind 84 of 102), chapter 2 is 8 of 8, vitest 367, alignment e2e 60 of 60. Of the 20 cases the reviewer called "partly", 6 are strict hits before and 10 after: the fix joins pieces but does not extend an end ("smiled", "cast") and does not fix scattered pieces farther apart than the limit. One 2-word selection ("dị đoan") is now highlighted a little wider ("devote oneself to heterodox"), another ("ai ngờ") becomes the full phrase ("who could have guessed"). The reviewer has not seen the new highlights; the strict-hit figures are against my own labels.

## Edge extension, and how far the strict figure can go

A second step extends a phrase answer at an edge where selected words had no link, by as many unclaimed target words (up to three; the word right beside the selection may hold them). Effect on strict phrase hits: lexical A 27 → 28, probes 21 → 22, both audits 30 → 31, blind lexical B 30 → 30; no new wrong answers; sentence sets and chapter 2 unchanged.

On my labels the strict rate over the 172 answered audit lookups went from 123 (71.5%) before the join to 134 (77.9%) now (words 41 of 51, phrases 31 of 55, sentences 62 of 66). Most of what is still not strict is not mechanical: 17 of 24 non-strict phrases have no confident phrase pair for the exact window, a few labels of mine are wider than the selection, and 5 answers are wrong words in lists. Only 11 of the 100 cases the reviewer judged changed their output; if all 11 were judged right the reviewer-standard estimate would be about 83%, so a second, short check of those 11 plus controls decides whether the figure reached 80%.

## Provisional second check: my own re-judgement of the 20 changed or control cases (not independent)

The second sheet (`docs/verification/human-check-sheet-2.html`: the 11 cases whose highlight changed plus 9 unchanged controls) has not yet been returned by a person. Until it is, I judged the same 20 cases by the reviewer's standard (a complete, contiguous phrase, not missing or adding an important part), strictly: `docs/verification/claude-recheck-2-2026-11-15.csv`. **This is my own judgement of my own work, not a check.**

| The 11 changed cases | Before (reviewer) | Now (my re-judgement) |
| --- | ---: | ---: |
| Right | 0 | 5 (`a2-62`, `a2-69`, `a1-14`, `a1-89`, `a2-38`) |
| Partly | 10 | 5 (`a1-44` still adds "đương kêu cầu", `a1-51` lacks "and clear", `a2-117` lacks "escape being put", `a1-56` lacks "It is only that", `a1-9` still in two pieces) |
| Wrong | 1 | 1 (`a1-15`, a stray piece "cúng tế") |

The 9 controls stay right. Re-estimated over the 172 answered lookups with the first check's weights: right 76% (95% interval 65–86), partly 21%, wrong 3%, not wrong 97% — **below the 80% asked for**. Fixing the five remaining partly cases would give about 82% on this sample, but they are cases already seen, so that would show only that known cases were fixed; a figure to quote needs a fresh random sample checked by a person. `python scripts/align-novel/human_check_compare2.py SECOND.csv` recomputes the estimate from the person's answers.

## Second human check, returned (2026-11-15)

The reviewer filled in the second sheet through the hosted page (`docs/verification/human-check-result-2-2026-11-15.csv`; the same 20 answers are in the page's database). All 20 were answered: 17 right, 3 partly, 0 wrong.

| The 11 changed cases | Before (reviewer, sheet 1) | Now (reviewer, sheet 2) |
| --- | ---: | ---: |
| Right | 0 | 8 |
| Partly | 10 | 3 (`a1-51`, `a1-9`, `a2-62`) |
| Wrong | 1 | 0 (`a1-15` is right) |

All 9 unchanged controls stayed right. Against my own re-judgement the reviewer was more lenient in four cases (`a1-44`, `a2-117`, `a1-56`, `a1-15`) and stricter in one (`a2-62`, which I had judged right); my provisional figure was 76%.

Re-estimated over the 172 answered audit lookups, with the second sheet's answers replacing the first's: **right 77.8% (95% interval 67–87), partly 19.9%, wrong 2.3%, not wrong 97.7%** (first check: 67% right). The point estimate is below the 80% asked for, and the interval includes it. Two cautions: the 11 changed cases were picked because they changed, and the 9 controls and the other 80 first-check answers are re-used from the first check, so this is the first check corrected where the output changed, not a fresh sample. The 10 hits still judged partly are 8 phrases, 1 sentence and 1 word (`a1-51`, `a2-2`, `a2-62`, `a1-85`, `a1-111`, `a2-99`, `a1-63`, `a1-9`, `a2-87`, `a1-76`). A figure to quote for 80% needs a fresh random sample judged by a person, after those phrase cases are looked at.

## Rules

1. Change code against the dev sets; run the blind set once before and once after a step, never to choose between variants.
2. Report the blind numbers next to the dev numbers. If dev improves and blind does not, the blind number is the result.
3. Probes and pairs that were looked at while fixing a failure move to dev.
4. Never loosen a threshold to move one class without reporting the others (coverage ↔ not-wrong of answered).
