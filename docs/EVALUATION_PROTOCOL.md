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

## Fixes for the ten hits the reviewer still judged partly (2026-11-15)

Two consumer-only rules in `src/lib/novel-lookup.ts`, no data change:

1. **Join through neighbour-held words.** The piece join no longer stops at a gap word that another source word's link holds when that source word sits at most one word beside the selection ("không" for the "not" before "dare", "you" for "mình" two words after "thả"): it lies inside the phrase's translation. Farther holders still block.
2. **Coordinated pair.** A weak link (≥ .03) from a kept source word to a content word that no outside link claims, sitting beside the kept target across "and"/"or"/a comma, is kept ("sáng sủa" = "bright and clear"). Adjacent words without a connector are not ("black cloud" was the first draft's regression, found on the audits and dropped before measuring the blind sets).

A third line (links between punctuation marks do not claim words) was tried and removed: it changed no output on any set.

Of the ten, three are fixed: `a1-51` ("…bright and clear"), `a1-9` ("They may let you win at first"), `a2-99` ("làm ác cũng không dám", still without the final "làm"). Seven are not: `a1-63` (stray light verb "đem"), `a2-2` (title plus name: "Thừa chỉ" is not part of the name answer), `a1-85` (the clause map gives one English sentence the three clauses of a Vietnamese sentence that covers two), `a2-87` (the "cast" of "have a hexagram cast" is linked to another word), `a1-111` ("ngồi" is not linked), and `a2-62` and `a1-76`, where the highlight looks right to me and the reviewer left no note.

| Set | Before | After |
| --- | --- | --- |
| Both audits, phrase strict (F1 ≥ .8) | 31 of 55 | 37 of 55 |
| Both audits, word strict | 41 of 51 | 42 of 51 |
| Both audits, sentences, hits, wrong answers | 62 strict, 65 hits, 0 wrong | unchanged |
| Lexical A (dev), hits word / phrase | 30 / 29 | 30 / 29 (word strict 28 → 27: "hào hiệp" now "bold and chivalrous" against my "chivalrous") |
| 120 probes, hits word / phrase / sentence | 34 / 26 / 39 | 34 / 26 / 39 |
| Dev and tuned sentences, chapter 2 | 96 and 81 hits, 8 of 8 | unchanged |
| Blind lexical B (run once), word / phrase hits, phrase strict | 29 / 32, 30 | 29 / 32, 30 (one more answer reaches F1 1) |
| Blind sentences (run once), hits, context has gold | 84, 90.2% | 84, 90.2% |

Unit tests 370, typecheck clean, alignment e2e 60 of 60. These are dev numbers for the audits, because those cases were looked at; the figure for the new rules comes from the third human sheet, drawn from a fresh sample (seed 20261123, 20 chapters × 2 sentences, 2 phrases, 2 words, none of the earlier sentences).

## Third human check: a fresh sample (2026-11-15)

Fixing the cases a person had flagged only shows that those cases were fixed, so the next figure comes from lookups nobody has looked at. A third seeded audit (seed 20261123, 20 chapters × 2 sentences, 2 phrases, 2 words, direction random, prose only, none of the sentences of the first two audits) was run on the deployed code (`docs/verification/audit-120c-2026-11-15.json`): 98 of the 120 lookups were answered (29 words, 32 phrases, 37 sentences). The sheet holds 20 answered lookups of each kind, drawn at random and shuffled, so a person who stops half way has still judged a random sample. I did not label this sample: the person is the only judge.

The page is a private hosted page (https://claude.ai/artifact/QGThac8xVS7kGMkvZq6fwc) that saves each answer to its own database (`answers/a3-<id>`); `docs/verification/human-check-artifact-template-3.html` is its template and `docs/verification/human-check-key-3.json` the key (population counts per kind, kind and chapter of each card). `python scripts/align-novel/human_check_compare3.py ANSWERS.csv` weights each kind's right/partly/wrong rate by the kind's share of the 98 answered lookups and bootstraps the interval. With 60 answers the 95% interval is about ±10 points, so I report the interval and not only the point: 80% counts as reached only if the interval does not make it doubtful.

### Result of the third human check

The reviewer judged all 60 cards (`docs/verification/human-check-result-3-2026-11-15.csv`, the page's database holds the same answers; card 30, "Phong Châu" → "Phong Chau", was first left blank and answered "right" a few minutes later). By the reviewer's standard on lookups where the system highlights:

| Kind | Right | Partly | Wrong |
| --- | ---: | ---: | ---: |
| Sentences (37 answered in the audit) | 20 of 20 | 0 | 0 |
| Phrases (32) | 16 of 20 | 2 | 2 |
| Words (29) | 19 of 20 | 1 | 0 |

Weighted by the audit's answered counts: **right 92.0% (95% interval 85–98), partly 4.7%, wrong 3.3%, not wrong 96.7%**. The 80% asked for is reached, and the interval's lower end is above it. What this covers: lookups the system answers (98 of 120, 82%; the first two audits answered 71%), on a seeded random sample no one had looked at when the rules were written; it says nothing about the 18% of lookups where the system shows context only, and four of the five non-right answers are phrases.

The five non-right answers: `a3-116` "gone beyond" → "ước sự … làm" (two stray pieces, wrong; the reviewer's note: "làm điều quá đáng"), `a3-8` "returned just" → "lại đâu đóng đấy" (marked wrong although the highlight is the idiom the reviewer's note names; the selection cuts the English phrase in the middle, so I count it as the reviewer's call), `a3-41` "together" → "nhau" (the reviewer: "cùng nhau"), `a3-32` "Minh Tong of the Tran" → "Minh Tông nhà" (missing "Trần"), `a3-45` "told everyone" → "cho mọi" (missing "người"). The last three each miss one word at an edge of the answer (the first for `a3-41`, the last for `a3-32` and `a3-45`), the kind of case the edge extension was built for; they are the next candidates if more is wanted.

## Edge cases from the third check (2026-11-15)

Three more consumer-only rules in `src/lib/novel-lookup.ts`, for `a3-32` ("Minh Tong of the Tran" gave "Minh Tông nhà") and `a3-45` ("told everyone" gave "cho mọi"):

1. **Pair completes a link answer.** When a phrase inside one sentence is mostly anchored but a selected content word has no link, the exact phrase pair of the selection replaces the link highlight if it contains every piece of it and takes no word that another source word's link holds, unless that word sits right beside the selection ("Trần" is held by "dynasty", which follows "Tran"). Result: "Minh Tông nhà Trần".
2. **One-word pair widens its link target.** The phrase pair of a single selected word (score ≥ .65, margin ≥ .15, asked direction) widens that word's link target when it contains it, by at most two target words that are not function words only and that no other link claims ("everyone" = "mọi người": "cho mọi" became "cho mọi người").
3. **Punctuation links claim nothing.** A link between punctuation marks no longer holds the word beside it (the second attempt at this line; it now changes one probe: "nhà trọ" gets an answer, "the inn").

Not fixed: `a3-41` "together" → "nhau" (the reviewer: "cùng nhau"): the data has no phrase pair for "together" and "cùng" has no link; a rule for "cùng nhau" would be a vocabulary rule, so I made none.

| Set | Before | After |
| --- | --- | --- |
| Lexical A (dev), strict word / phrase | 27 / 28 | 28 / 29 ("ông già" = "old man"; "Văn tài của nàng"); hits 30 / 29 and wrong answers unchanged |
| Both audits, phrase hits / strict | 52 / 37 of 55 | 53 / 37 (a1-3 F1 .49 → .65); words, sentences, wrong answers unchanged |
| 120 probes, word hits | 34 | 35 |
| Dev and tuned sentences, chapter 2, blind sentences | 96 / 81 / 8 of 8 / 84 hits | unchanged |
| Blind lexical B, phrase strict, hits | 30, 32 | **29, 32**; word strict 25 and hits 29 unchanged; no wrong answer |

The blind lexical set was run twice for this step, so the second figure is not a clean one-shot: the first run, on a version that lacked the claimed-word restriction in rule 1 (an existing unit test forced that restriction, which I would not have added otherwise), gave 28; the final code gives 29. The one case that lost strictness is "a man surnamed Ho" → "có người họ Hồ tên" (F1 .85 → .76, still a hit): the pair adds "có". Hits and wrong answers did not change, so the blind result for this step is: no gain, one answer a little wider. The reason to keep the rules is the human check (two of the three flagged cases are fixed), and a fresh sheet is needed to show it.

Unit tests 372, typecheck clean, alignment e2e 60 of 60.

## Fourth human check: a fresh sample after the edge rules (2026-11-15)

Same design as the third (`docs/verification/audit-120d-2026-11-15.json`): seeded audit 20261125, no sentence of the first three audits, run on the deployed code (source `dc9f6e1`); 89 of the 120 lookups were answered (28 words, 27 phrases, 34 sentences); the sheet holds 20 answered lookups per kind in shuffled order. Page: https://claude.ai/artifact/6RPmM18WETrmpMjgqvw3r9, template `docs/verification/human-check-artifact-template-4.html`, key `docs/verification/human-check-key-4.json`; evaluate with `python scripts/align-novel/human_check_compare3.py ANSWERS.csv docs/verification/human-check-key-4.json`. The third check gave 92.0% (85–98) on its sample; the two intervals are the comparison, a difference of a few points between them is noise.

### Result of the fourth human check

All 60 cards were judged (`docs/verification/human-check-result-4-2026-11-15.csv`; the page's database holds the same 60 answers).

| Kind | Right | Partly | Wrong |
| --- | ---: | ---: | ---: |
| Sentences (34 answered in the audit) | 20 of 20 | 0 | 0 |
| Phrases (27) | 16 of 20 | 4 | 0 |
| Words (28) | 17 of 20 | 1 | 2 |

Weighted by the audit's answered counts: **right 89.2% (95% interval 82–95), partly 7.6%, wrong 3.1%, not wrong 96.9%**. The third check gave 92.0% (85–98); the two intervals overlap almost entirely, so the edge rules neither helped nor hurt measurably, as the blind lexical set (no gain) also said. Pooling the two fresh samples (120 judged cards, answered counts 71 sentences, 59 phrases, 57 words): **right 90.6% (85–95), partly 6.3%, wrong 3.1%**; the 80% asked for is reached with the whole interval above it.

The seven non-right answers: `a4-77` "still" → "chưa" (the reviewer: "still had no"), `a4-46` "character" → "phương" (wrong; "cương phương" is the compound, the link reached its second syllable only), `a4-14` "lỏm lấy làm mừng" → "Overhearing this" (the selection starts inside "nghe lỏm", the answer misses "delighted"), `a4-88` "muốn" → "for" (wrong), `a4-9` "been given to dissipation" → "thân phóng lãng … chơi bời" (two pieces), `a4-116` "oak live long only because" → "cây … sống lâu chỉ" (two pieces; the reviewer: "cây thông"), `a4-87` "Whoever you see" → "thấy người" (the reviewer: "thấy người nào"). Four are phrases cut into pieces or missing an edge word, the same family as before; the two wrong ones are single words.

A limit on this figure: the whole sheet was answered in 4 minutes 16 seconds (the first ten cards in 11 seconds; the third sheet took about 7 minutes), about 4 seconds a card. The seven notes show close reading where it mattered, and many cards are short; but if some cards were judged at a glance, the right rate would be a little high.

## Crossed word links (2026-11-15)

Why lexical set A has five wrong word answers: three come from one list ("săn **gấu** bắt **thỏ**" against "hunting **bears** and chasing **hares**": "thỏ" is linked to "bears" at 1.0, which also takes the word "gấu" needs, so "gấu" got "hares"), two from one split verb phrase ("bỏ dở … thơ" against "leave my poem unfinished": "bỏ" reaches "leave", nothing reaches "unfinished", and "unfinished" lands on the particle "mất"). The data does hold the right evidence in a larger window: the pair "hunting bears" ↔ "săn gấu" (0.88).

One more consumer-only rule in `src/lib/novel-lookup.ts`, for a selection of exactly one word: when its link target lies wholly outside the target of a small strong phrase pair (score ≥ .65, margin ≥ .15, at most three words, either direction) that holds the word and goes beyond the selection, the answer is the content words of the pair's target that no other word of its window takes (one or two adjacent words). Applied to a multi-word selection it widened "city walls toward the" to "out beyond the city walls toward the", so it is limited to one word.

| Set | Before | After |
| --- | --- | --- |
| Lexical A (dev), word hits / wrong / strict | 30 / 5 / 28 | 31 / 4 / 29 ("gấu" = "bears") |
| Both audits, word hits / wrong / strict | 45 / 5 / 42 of 51 | 46 / 4 / 43 ("chim" → "rắn", a wrong answer since the first audit) |
| Phrases, sentences, 120 probes, dev and tuned sentences, chapter 2 | | unchanged |
| Blind lexical B and blind sentences (third use of the lexical one in this session) | word 29 hits / 2 wrong / 25 strict; phrase 32 / 0 / 29; sentences 84 hits | unchanged |

Not fixed: "thỏ" (no small pair holds it), "bears" (the Vietnamese word "săn gấu" is one word for the segmenter, so the pair's other word already covers all of it) and the two of "bỏ dở"/"unfinished". Tests: 373, typecheck clean, alignment e2e 60 of 60. The font test `heading-fonts.test.ts` failed once in two full runs at 5.2 s, the same PGlite startup cost as `rpc-grants`; it now has the same 30 s timeout.

### Follow-up: "bears" (2026-11-15)

The rule above left "bears" → "bắt thỏ" because the segmenter reads "săn gấu" as one word, so the link of "hunting" took the whole word, "gấu" included, and nothing was left of the pair. When the whole words leave nothing, the raw link pieces ("săn") now decide. Using the pieces first made two correct answers wider ("trà" → "trà lắm", "rắn" → "rắn độc"), so they are only the fallback and no earlier answer changes.

| Set | Before | After |
| --- | --- | --- |
| Lexical A (dev), word hits / wrong / strict | 31 / 4 / 29 | 32 / 3 / 30 ("bears" = "gấu") |
| Both audits, probes, dev and tuned sentences, chapter 2, blind lexical B, blind sentences | | identical outputs |

Left in lexical A: "thỏ" (no small pair holds it; the possible fix, dropping a link whose target another word holds by a strong pair, would make it an abstention rather than "hares"), and "bỏ dở" / "unfinished" (no phrase pair and no link for "dở"; it needs the chapter re-aligned). Tests 374, typecheck clean, e2e 60 of 60.

### Follow-up: "thỏ" becomes an abstention with the right context (2026-11-15)

"thỏ" was linked to "bears" at 1.0, which belongs to the pair "săn gấu" ↔ "hunting bears" (0.88). A lone word whose link target lies inside a small strong pair (score ≥ .8, margin ≥ .15, at most three words) that does not hold it, while a written word of that pair has its best link (≥ .1) outside the pair, now gets no highlight. The test for "outside" is made per written word of the pair's window, because the segmenter's word "săn gấu" would otherwise hide the escape of "gấu" behind the inside link of "săn". "thỏ" is now a context-only answer whose context contains "hares"; the link would have been a wrong answer, so this trades one wrong answer for one abstention with the right context.

| Set | Before | After |
| --- | --- | --- |
| Lexical A (dev), word answered / wrong / hits | 36 / 3 / 32 | 35 / 2 / 32 |
| Both audits, probes, dev and tuned sentences, chapter 2, blind lexical B, blind sentences | | identical outputs |

Left in lexical A: "bỏ dở" / "unfinished" (no phrase pair and no link for "dở"; it needs the chapter re-aligned). Tests 375, typecheck clean, e2e 60 of 60.

## Step 5: footnote anchors, the measure fixed and what it shows (2026-11-15)

**The old figure.** "Anchors 41.7% / link accuracy 56.4%" (mBERT layer 8, `heldout/models.py words`) took the 60 gold sentence pairs that carry a footnote marker "(n)" on both sides, the last *syllable* before the marker in Vietnamese (`\w+` splits at spaces: "Phong Bái" became "Bái") and the last word before the marker in English, and counted a hit when any raw token link of that syllable reached that English word; precision was the share of those links that did. It measured the raw model links only, on 60 cases, and a two-syllable name against a one-word name could not reach full marks by construction.

**The fixed measure** (`scripts/align-novel/anchor-eval.ts`): every footnote marker of the prose that occurs once in each edition (the same number n marks the same term), 303 anchors, looked up in both directions through the real lookup on the published data (606 lookups). The selection is the last whole word before the marker; a hit is a highlight that overlaps one of the last three words before the other edition's marker (the "window"; the last word alone gives a hit rate of about 40%, because a term often ends on a different word in the two editions). The gold is the marker position, not a labelled counterpart, so it is exact for names and noisy for common words ("thấy" before "(13)" against "under the Jin").

| Kind of anchor | n | Answered | Hit of all | Hit of answered |
| --- | ---: | ---: | ---: | ---: |
| Name with the same letters ignoring accents ("Hàm Tử" / "Ham Tu") | 120 | 93.3% | **92.5%** | **99.1%** |
| Name spelled differently ("Hoài Âm" / "Huaiyin", "Mẫn" / "Min") | 225 | 72.0% | 52.4% | 72.8% |
| Common word | 261 | 60.5% | 42.5% | 70.3% |
| All | 606 | 71.3% | 56.1% | 78.7% |

By status (answered only): "match" 42 answers, 97.6% hits; "uncertain" 390 answers, 76.7% hits.

**What changed in the product.** One rule: a capitalised name the system left without a highlight is highlighted when the same name ignoring accents stands exactly once, capitalised, in the context it returned. It answered 6 more anchors (all hits: "Lãng"/"Lang", "Hán"/"Han", "Đường"/"Duong", "Hồ"/"Ho", "Lư"/"Lu"), changed no output on lexical A, the probes, the dev and tuned sentences, chapter 2, both audits, nor on the blind lexical and sentence sets; tests 376, e2e 60 of 60. Before the rule the same-letters names stood at 109 of 125 hits.

**Reading.** The >95% asked for is met where identity can decide it: names with the same letters are answered right 99.1% of the time they are answered, and the 7.5% left are abstentions inside poem chapters or with two candidate spellings in the context. It is not met, and cannot be by rules of this kind, for names spelled differently (a Sino-Vietnamese reading against a pinyin spelling needs a dictionary; the book glossary only keeps edition-bound names and holds the model-only pairs back as provisional) and it cannot be judged for common words, where the marker position is a poor gold. Pairs learnt from the notes themselves (the headword of note n in each edition) are the next source of a name dictionary; that is a data change, tested by learning names on some chapters and judging them on others, and was not done.

### Name dictionary from the footnotes (2026-11-15)

**Source.** Note n of each edition reads "(n) Headword: explanation" (`notePairs` of the artifact pairs note n with note n). Of 372 notes in the 20 chapters, the English one always has a headword, the Vietnamese one in 214 (the others open with the explanation). A pair of headwords is kept when each stands right before the marker "(n)" of its own prose, which occurs once in the text: 73 pairs have the same letters ignoring accents (handled by the rule above), 76 more pass the gate, 70 after dropping list headwords. A list headword split by position was wrong ("Dương Thành, Hạ Sái" against "Xiacai and Yangcheng" paired the items crosswise), so lists are kept whole. Entries are read from the artifact at lookup time (memoised per artifact), not stored: no new data, no build step, edits of a chapter keep them current.

**Why per chapter and not book-wide.** Learned from other chapters the pairs do not carry over: of 98 occurrences in other chapters of a Vietnamese headword, the English form stood in the returned context in 6 (4 of them already highlighted), because the same word is rendered differently or is a common word. The use is in the chapter that holds the footnote.

**Rule.** When the selection is a headword term (a one-word capitalised headword needs a capitalised selection), the other edition's headword is highlighted in the returned context if it stands there exactly once and the lookup did not already highlight it; it replaces a highlight elsewhere in the passage.

| Measure | Before | After |
| --- | --- | --- |
| Occurrences of a headword term in its own chapter, Vietnamese → English: highlight on the English form, of those whose context holds it | 50 of 64 (78.1%) | 63 of 64 (98.4%) |
| Same, English → Vietnamese | 50 of 62 (80.6%) | 60 of 62 (96.8%) |
| Other chapters, both directions | 7 of 11 | 7 of 11 |
| Footnote anchors (606), name spelled differently: answered / hit of all | 72.0% / 52.4% | 74.2% / 55.1% (6 more hits, among them "Đâu Suất" = "Tushita", "Quân thiều" = "Junshao", and "Đường" was "Sweetly" and is "crabapple blossom") |
| Lexical A, probes, dev and tuned sentences, chapter 2, both audits, blind lexical B, blind sentences | | identical outputs |

The same-chapter figures are in-sample by construction (the pair comes from that chapter's own note); what they show is that the highlight now lands on the term the book itself names. Caveats: a headword can name a term that the prose uses elsewhere in another sense ("Đường" as the Tang dynasty): the exactly-once rule in the returned context is the only guard, and a one-word capitalised headword is not matched by a lowercase selection. Tests 377, typecheck clean. The alignment e2e passed 60 of 60 on six of eight runs of this code; the other two runs had 2 and 1 desktop tests fail at the first lookup panel (not found within 5 s), and the same tests passed on the rerun; the previous code passed 3 of 3 the same day. The lookup output is deterministic and identical on every measured set, and a lookup costs 15–33 ms with and without the rule, so I treat them as cold-start flakes of the dev server.

#### Stress set for the footnote terms: where the term is used elsewhere (2026-11-15)

The risk named above is a headword term used at another place with another sense, where "the other headword stands once in the context" could still be the wrong word. `scripts/align-novel/note-term-eval.ts` lists every story occurrence of every headword term of a chapter's own notes, both directions (137 occurrences: 113 right before the footnote marker, 24 elsewhere), and looks each up before (source `7d10f05`) and after the rule (`59529ec`). The occurrences the rule changed were labelled from the source sentence and the returned context only, before the highlights were read: is the other headword the counterpart of the term at this place? The labels are mine, not a human's (`docs/verification/note-term-stress-2026-11-15.json`).

| | n | Result |
| --- | ---: | --- |
| Changed by the rule | 23 | right 20, partly 3, wrong 0 |
| of which at the footnote marker | 19 | all were abstentions before |
| of which elsewhere in the story | 4 | before: 3 no answer, 1 partial ("celestial" for "quân thiều"); after: 4 right ("Trần Hy" = "Chen Xi", "Thiên Thai" = "Tiantai", "quân thiều" = "Junshao", "Kiều Sơn" = "Mount Qiao") |
| Elsewhere, left unchanged | 20 | 10 already highlighted the counterpart, 7 had no counterpart in the context, 3 had it twice |

The three "partly" are about the shape of the pair, not a wrong word: "Lưng thắt ve vàng" (waist-tied golden cicada) against "Golden cicada" in both directions, and "fine steed of Pang Tong" answered with the name "Bàng Thống" alone. The guard worked where the terms really are common words: "đường" (way, road) three times and "kỷ" (era) twice are not matched, because their counterpart ("Crabapple blossom", "Twelve-year cycle") is not in the context, and "Đường" as a capitalised headword is not matched by a lowercase "đường".

Limits. Nothing wrong among 23 changed occurrences bounds the wrong rate at about 13% at 95% confidence (rule of three), which is a weak bound; the set is the whole dictionary of this book, not a sample, and it holds few terms with a second sense. A highlight that already overlaps the counterpart is left as it is, so partial answers stay partial ("Kim tiên" → "Immortal" for "Golden Immortal", "Ban Cơ" → "Ban Ji" for "Ban Ji and Lady Cai"); widening them to the whole counterpart is an open improvement, not made. The only change to the product in this step is that `noteTermsOf` is exported for the script; behaviour is unchanged, so nothing was deployed.

### Chinese names through Unihan: Sino-Vietnamese against pinyin (2026-11-15)

**Source** (downloaded with the user's permission): `Unihan.zip` (8.3 MB, unicode.org, Unicode 18.0.0), file `Unihan_Readings.txt`; the Vietnamese reading (`kVietnamese`) and the Mandarin reading (`kMandarin`) of the same character give a map from each Sino-Vietnamese syllable to its pinyin syllables: 3,114 readings, 54 KB (14 KB gzipped), `src/data/sino-pinyin.json`, built by `scripts/align-novel/build_sino_pinyin.py`; notice and licence in `docs/UNIHAN-NOTICE.md`. Unihan's `kVietnamese` is partial: of the book's 70 headword pairs, 11 match through the map (of about 20 Chinese-name pairs); readings such as "hoành", "dị", "hy", and "Bái" for 沛 (Fengpei) are absent. Against 1,384 mismatched pairs it gave 0 false matches.

**Rule.** A capitalised name the lookup left without a highlight is highlighted when exactly one capitalised name of the context fits every syllable through the map: Vietnamese to English ("Chương Hàm" = "Zhang Han": the candidate's letters equal the concatenation of one pinyin reading per syllable) and English to Vietnamese ("Zhang Han" segmented into pinyin syllables, each read as one of the Vietnamese syllables). Not applied in a note or a caption paired with one (the paired note is shown as it is; an e2e test protects that, and it failed on all three runs until this was added), and, like the two rules before it, only when nothing is highlighted yet.

**Anchors (606).** Name spelled differently: answered 74.2% → 83.1%, hit of all 55.1% → 63.1% by the marker-position gold; the 20 anchors newly answered are all correct names by eye ("Bành Thành" = "Pengcheng", "Xiaoman" = "Tiểu Man", "Bối Khâu" = "Beiqiu"), the gold mislabels five of them.

**Stress set** (`scripts/align-novel/name-rule-eval.ts`): every capitalised name of the story text, not at the start of a sentence, first occurrence per chapter, both directions: 2,162 selections, 1,673 answered before the rule and 1,725 after; the rule changed 52, all abstentions before. I wrote down the counterpart I expected from the source sentence and the returned context alone for 38 of them before reading the highlight: 37 agree exactly. The other 14 were not visible in the shortened context and were checked after the highlight was shown: all 14 are right (for example "Dự" = "Yu" in "lưu Dự" / "Liu Yu"). One of the 52 is wrong: "Jiang" in "a Jiang of Qi" got "Giang" (of "Giang Nam"), because the right name, "Khương", is not in the Unihan map and "Giang" fits "jiang" as well. 51 of 52 right (98.1%); about 32 of the 52 are single-syllable names, the riskier kind, and 31 of them are right. The labels are mine, not a human's.

| Set | Before | After |
| --- | --- | --- |
| Lexical A, probes, dev and tuned sentences, chapter 2, both audits, blind lexical B, blind sentences | | identical outputs |
| Anchors 606, hit of all | 56.1% (name, other spelling 55.1%) | 60.1% (63.1%) |
| Capitalised names answered, 2,162 | 1,673 | 1,725 |

Tests 378, typecheck clean. The alignment e2e: 60 of 60 on the final code in 4 of 5 runs; the fifth failed the first two desktop tests at `data-ready` of the reader shell (the same pair that flaked before, a page-load wait unrelated to lookups). `admin-scripts.test.ts` (child processes) failed once at 5.1 s under load and now has the 30 s timeout the other load-sensitive tests have. The data adds 54 KB to the lookup module.

## Goal list, part 1: Unihan test, two-way phrase pairs at a lower floor, projection from outside anchors (2026-11-15)

**1. Unihan.** Already shipped (above). New test: "Hoài Âm" reads as *huai yin* and matches "Huaiyin" in both directions.

**2. Two-way phrase pairs below the 0.65 floor: tried, not adopted.** The stored pairs already require the other direction to agree (its best window must overlap the query and score within 0.03), so "two-way agreement" means lowering the floor and the margin. I rebuilt the phrase table from the cached vectors at floor 0.45 / margin 0, at floor 0.55 / margin 0.10 with per-pair caps of 400 instead of 60 (data 21 MB against 19 MB), and swept the consumer thresholds (floor 0.65 to 0.45, margin 0.15 to 0):

| Floor / margin | Probes phrase hits | Lexical A hits (word / phrase) | Lexical B hits (word / phrase) |
| --- | ---: | --- | --- |
| 0.65 / 0.15 (now) | 26 | 32 / 29 | 29 / 32 |
| 0.60 / 0.10 | 26 | 32 / 29 | |
| 0.55 / 0.10 | 27 | 32 / 29 | 29 / 32 |
| 0.50 / 0.10 and lower | 27 | 32 / 29 | 29 / 32 |

One more probe phrase at best, nothing on lexical A or B, so a data republish is not worth it. The reason is visible on "đánh úp" / "a surprise attack": the pair is missing because the encoder does not rank that window above its neighbours ("attack and win Le Nuong back" scores higher), not because a threshold cuts it. Of the 13 abstained probe phrases, the debug trace shows two kinds: no selected word has any link at all (7 cases), or only function words and one word do.

**3. Projection from outside anchors: adopted** (`novel-lookup.ts`, no data change). Inside the selection there is nothing to run a dynamic programme on in those cases, so the counterpart is projected from the words beside the phrase: when a multi-word phrase of one sentence has too few linked words to answer, its counterpart is the stretch of the other edition between the targets of the nearest linked word on each side, minus the words another word's link claims and minus the function and discourse words at the ends ("then", "so", "rồi"...). Conditions: only function words between each anchor and the phrase (an unlinked content word there makes the nearest anchor blocking), no sentence punctuation, anchor link score ≥ .5, the whole gap at most max(6, 3 × content words + 2) words, at most 2 × content + 2 words in the answer, no exact phrase pair (that one has priority), not a name, poem or sentence selection, a missing negation needs a negation in the projected words, and existing highlights must lie inside it. A first version without the adjacency and gap limits answered 11 more lexical and probe cases with 3 wrong ones ("hay chữ" = "former ages", "kẻ tửu lại" = "upon His Majesty", "satire and mockery" = "Quan Thừa"); the limits removed all three.

| Set | Before | After |
| --- | --- | --- |
| Lexical A (dev), word hits / phrase hits | 32 / 29 | 33 / 29 ("làm mê" = "bewitched"); answered-not-hit 3 / 3 unchanged |
| Probes (dev), word / phrase / sentence hits | 35 / 26 / 39 | 35 / 27 / 39 ("a surprise attack" = "đánh úp") |
| Both audits (dev) | three abstentions | three right answers: "vớt thây" = "recover" (of "recover her body"), "Chả ngờ đâu sấm chớp bỗng chốc" = "No one could have foreseen the thunder and lightning that suddenly" (of "...broke out"), "hãy thử" = "let Us" (of "let Us see"); no other answer changed |
| Lexical B and blind sentences (second and repeated use, only to check for harm) | | identical outputs |
| Dev and tuned sentences, chapter 2 | | identical outputs |

Five more correct answers on the dev sets, no wrong answer added. Tests 380 (new: projection and its negative case; "Hoài Âm"), e2e 60 of 60 on three runs.

## Goal list, part 2: cross-encoder, position prior, the cases without context, the partial cases (2026-11-16)

**4. Cross-encoder rerank of LaBSE's top five: tried, not adopted.** `BAAI/bge-reranker-v2-m3` (2.27 GB, downloaded with the user's permission, revision `953dc6f`, in the local model cache) reranked LaBSE's five best sentences on the 60 dev pairs per direction (`work/.../heldout/rerank_eval.py`):

| Dev sentence retrieval, 60 pairs per direction | Vietnamese → English top-1 / MRR | English → Vietnamese top-1 / MRR |
| --- | ---: | ---: |
| LaBSE (now) | 90.0% / 0.925 | 98.3% / 0.992 |
| Reranker alone on LaBSE's top five | 88.3% / 0.921 | 100% / 1.000 |
| LaBSE score + reranker, z-scored and summed | 90.0% / 0.925 | 98.3% / 0.992 |
| LaBSE + position prior (below) | 90.0% / 0.940 | 100% / 1.000 |
| Reranker after the position prior | 86.7% / 0.922 | 100% / 1.000 |

It is worse in the direction that matters (88.3% against 90.0%) and gains one case in the other, which the position prior gains without a 2.27 GB model; not adopted. Why the Vietnamese → English figure sits near 90%: all but one of its six misses are not retrieval errors. The gold is one English sentence while the Vietnamese sentence is long and its translation is split into several English sentences; the encoder picks a neighbouring piece of the same translation ("After they had sat and talked a while…" for the sentence whose gold is "Your mansions stand on vast estates…"), at relative positions 0.412 and 0.418. Only one miss is a real error (a note that repeats the sentence, 0.804 against 0.385) and one in the other direction ("Vén áo đi vào cửa này", 0.037 against 0.435).

**5. Position prior: measured; a gain in the diagnostic, none in the product.** Scoring a candidate as cosine minus 0.5 × |relative position in the chapter of the query − of the candidate|, with raw top-1 as above and a "region-consistent" top-1 in which the retrieved sentence is the gold one or lies within two sentences of it:

| LaBSE | Vietnamese → English raw / region-consistent | English → Vietnamese raw / region-consistent |
| --- | ---: | ---: |
| No prior | 90.0% / 98.3% | 98.3% / 98.3% |
| Position prior 0.5 | 90.0% / **100%** | **100%** / **100%** |

On the encoder row of the table the >98% is met by the region-consistent figure (and by the English → Vietnamese raw one). The product's group-forming step already is a global monotone dynamic programme over sentences (`align_sequences`), so the prior changes nothing there: it is built in. The raw Vietnamese → English 90.0% stays, and it is a property of the gold (1↔n sentences), not of the encoder.

**6. The cases without context: looked at one by one; two rules.** Of the 10 blind rows without context, the debug trace gives: 2 rows (ch6, both directions) where the group's passage stops in the middle of the sentence with the rest of that sentence in no group ("Thus," and "he was entirely right to petition…" for "Cho nên Địch Nhân Kiệt … phải lắm."); 1 row (ch12) whose two passages leave a stretch of the sentence between them; 1 row (ch10) with a wrong middle group ("Dương Trạm" for "Wang Pang"), not fixed; and 6 rows where the gold is narrower or wider than the sentence the system pairs ("Lời bình: Than ôi," is its own group, "Alas!"; the Vietnamese sentence continues after the English one): the passage is right by the reviewer's standard, the context metric is not. So "mostly places no group covers" was wrong: the groups cover them. Two consumer rules, no data change:

- *Sentence completion.* A whole-sentence selection whose single counterpart passage ends or starts in the middle of its own sentence takes the rest of that sentence, up to its boundaries (an extension only over text no group claims, at most 2.5 times the selection, never across a line break).
- *Gap closure between two passages.* Two passages whose sources touch and whose targets leave a short stretch (at most max(160, 2 × the second source's length) characters, no sentence break, no other group) join across it, highlight included.

**7. The partial cases.** The four partial blind rows: two (ch11, ch15) have precision 1 with the highlight the right part of a long Vietnamese sentence whose gold is wider; one (ch16) is the reverse, the Vietnamese sentence translated by three English sentences and the gold naming one ("Du Nhuan Chi … poetry." followed by "His songs especially enjoyed great fame…", both right); one (ch12) is the real gap, fixed by the gap closure. The extension rule asked for is therefore the gap closure above, and it would be wrong to widen the other three.

| Set | Before | After |
| --- | --- | --- |
| Tuned sentences (dev): hits / partial / context has gold / mean F1 | 81 / 8 / 94 / 0.658 | **82 / 7 / 95 / 0.665** (case 58 F1 .24 → .74; four cases lose 0.02–0.08 of F1, none stops being a hit) |
| Dev sentences | 96 hits, 13 partial, mean F1 0.782 | identical |
| Blind sentences (the cases above were read from it, so this is not independent evidence) | 84 hits / 4 partial / 92 context / mean F1 0.735 | 85 / 3 / 95 / 0.742 |
| Sentence probes (dev) | mean F1 0.9730 | 0.9737 ("Now, as for the Han achieving ten thousand chariots (8), We too achieved ten thousand chariots." F1 .97 → 1) |
| Both audits (dev) | | two highlights joined across a gap (a2-42 F1 .72 → 1.00, a1-1), one completed ("Why, then, in the debate at the Da River, did a man lose to animals?", my gold narrower); no loss of a hit |
| Lexical A and B, word and phrase probes, chapter 2 | | identical outputs |

The two rules fire in about 1% of the sentence lookups of these sets, and every change I read is an improvement. Tests 382, e2e 60 of 60 on three runs. The unit test of the sentence completion fails on the old code; the one of the gap closure passes on the old code in its fixture (the fixture's sentence mapping already joins the passages), so it documents the behaviour and does not guard it; the measured sets are the evidence. Neither rule has been checked by a human: a fresh sheet would show whether the sentence figure of the reviewer moves.

## Goal list, part 3: the items implemented as options and measured at phrase level (2026-11-16)

The goal list asked for each of the seven items to be done. Items 1, 3, 6 and 7 are in the product (above). Items 2, 4 and 5 are implemented and measured and stay off because they do not improve the product; what is in the repository:

- **Item 2 and 5 in the phrase table builder** (`prose_alignment.py`, `add_phrase_pairs`): the floor, margin, per-pair and per-group caps are now parameters (`PHRASE_FLOOR`, `PHRASE_MARGIN`, `PHRASE_PER_PAIR`, `PHRASE_PER_GROUP`, defaults unchanged at .65 / .15 / 60 / 512), and a **positional prior** `PHRASE_POS` (default 0 = off): the best counterpart window is chosen on the cosine minus `PHRASE_POS` times the distance of the two windows' relative places in their clause pair (the stored score stays the cosine). Python tests 120 pass at the defaults.
- **Item 4 and 5 for sentences**: `scripts/align-novel/retrieval_rerank_eval.py` (LaBSE top five reranked by `bge-reranker-v2-m3`, with and without the position prior) and `retrieval_prior_eval.py` (raw and region-consistent top-1); results in part 2.

Phrase-level measurement of 2 and 5 together (tables rebuilt from the cached vectors at floor 0.55, margin 0.10, caps 300 / 1500; consumer thresholds .65/.15 or .55/.10; baseline = the current product on the current data, lexical A and B counted as hits / strict / answered-but-not-hit):

| Configuration | Lexical A word | Lexical A phrase | Lexical B word | Lexical B phrase | Probes word / phrase / sentence |
| --- | --- | --- | --- | --- | --- |
| Baseline (floor .65, no prior) | 33 / 31 / 3 | 29 / 29 / 3 | 29 / 25 / 6 | 32 / 29 / 1 | 35 / 27 / 39 |
| Prior 0.2, thresholds .65 or .55 | 33 / 30 / 3 | 29 / 29 / 3 | 29 / 25 / 6 | 32 / 30 / 1 | 35 / 27 / 39 |
| Prior 0.5, thresholds .65 or .55 | **32** / 29 / **4** | 29 / 29 / 3 | 29 / 26 / 6 | **31** / 28 / **2** | 35 / **28** / 39 |

Prior 0.2 moves one strict hit up and one down; prior 0.5 gains one probe phrase and loses a lexical A word hit and a lexical B phrase hit, with one more answered-but-wrong in each: no net gain, so the default stays off. Together with the floor sweep of part 1 (one probe phrase, nothing else) the phrase table is not the lever for the abstained phrases.

**A learned lexicon for the abstained words: not built.** `scripts/align-novel/lexicon_probe.py` collects the word pairs of the confident links (score ≥ .9) of the other 19 chapters. The probe words the system still misses ("nhà trọ", "quan hầu", "Thiên hạ", "entire realm") are two-syllable terms with no entry at all, and the words that do have entries are ambiguous ("thơ" → poem 9, poetry 8, poems 7, verse 4; "chết" → death 20, died 14, dead 6, die 3), so a lexicon would not choose between them either. Consistent with the name-dictionary finding that terms do not carry over between chapters.

**Where the remaining targets stand.** The anchor figure (>95%) is met for names with the same letters (99.1% of answered) and not for other names (63.1% of all) or common words (noisy gold); the probes (>38) stand at 35 / 27 / 39; the blind-sentence hit rate (>98%) at 83.3% of all cases and 96.6% of answered (85 of 88), with context 93.1%; the encoder row (>98%) at 100% / 100% region-consistent with the prior. The abstentions that remain are words and phrases whose links the model never made, and sentences the gold splits differently from the pairing; the rules that fill them from the evidence around them are in the product, and nothing further tried (lower floors, prior, reranker, lexicon) moved them.

## Fifth human check: a fresh sample after the goal-list changes (2026-11-16)

Same design as the third and fourth (`docs/verification/audit-120e-2026-11-16.json`): seeded audit 20261127, no sentence of the first four audits, run on source `0c8df52` (Unihan names, projection from outside anchors, sentence completion and gap closure); 100 of the 120 lookups were answered (33 words, 31 phrases, 36 sentences; the fourth audit answered 89 and the third 98: the projection and the name rules answer more); the sheet holds 20 answered lookups per kind in shuffled order. Page: https://claude.ai/artifact/CJRkDCcndGhiCnd9mtJUN1, template `docs/verification/human-check-artifact-template-5.html`, key `docs/verification/human-check-key-5.json`; evaluate with `python scripts/align-novel/human_check_compare3.py ANSWERS.csv docs/verification/human-check-key-5.json`. Reference figures: third check 92.0% (85–98), fourth 89.2% (82–95), pooled 90.6% (85–95) of answered lookups. The new rules answer lookups the system used to leave empty, so a similar right rate with a larger answered share is an improvement; a lower rate would be the price of the extra answers and would be reported as such.

### Result of the fifth human check (2026-11-16)

Returned complete: 60 of 60 cards answered (`docs/verification/human-check-result-5-2026-11-16.csv`), scored with `human_check_compare3.py` against `human-check-key-5.json`; the same script re-run on the third and fourth CSVs gives 92.0% and 89.2% again, so the scoring is the one used before.

| Kind | Right | Partly | Wrong |
| --- | --- | --- | --- |
| Sentences (20) | 20 | 0 | 0 |
| Phrases (20) | 19 | 1 | 0 |
| Words (20) | 18 | 2 | 0 |

Estimate over the audit's answered lookups, weighted by kind: **right 95.2% (95% interval 89–100), partly 4.9% (0–11), wrong 0.0%**. For comparison, third check 92.0% (85–98, 2 wrong), fourth 89.2% (82–95, 2 wrong); pooled third and fourth 90.6% (85–95), reproduced by the same pooling (summed populations, answers concatenated); pooled third, fourth and fifth (180 cards) **92.2% (89–95), partly 5.7%, wrong 2.1% (1–4)**; fourth and fifth alone 92.1% (87–96).

What this does and does not show. The point estimate is the highest of the three and no card was judged wrong, with a larger answered share of the audit (100 of 120, against 98 and 89), so more lookups are answered and the answered ones are not worse. It is not a proven gain over the third check: the intervals overlap (89–100 against 85–98 and 82–95), the samples are different random draws, and it is one reviewer who finished the three sheets in a few minutes each. The sheet was run on source `0c8df52`, so it measures the Unihan names, the projection from outside anchors, the sentence completion and the gap closure, and not the interior-gap rule of part 4 (which changed no highlight of audits 1 and 2). The reviewer's target set earlier (strict right at least 80%) holds in all three sheets.

The three cards judged "partly" (the reviewer left no notes; what the audit file shows, `audit-120e-2026-11-16.json`): a5-74 phrase "clots of fresh", a fragment of "clots of fresh blood" in the sentence, highlighted as "hòn máu tươi"; a5-106 word "bút" in "ham nghề nghiên bút", highlighted as "brush" (the English reads "the brush and the inkstone"); a5-119 word "shelter" in "we have nowhere to shelter", highlighted as "cấp dưỡng" while the passage's "lui không có chốn nào tựa nương" is the nearer counterpart. All three carry the `uncertain` status. I do not know why the reviewer chose "partly" for each; the first two look like selections that are only part of a larger unit, the third like a neighbouring phrase, which are the classes of the earlier checks.

## Goal list, part 4: unlinked words between linked ones no longer block a phrase (2026-11-16)

**What the gap was.** A selected phrase is abstained ("uncertain") when too many of its content words have no link. The test counted every unlinked content word, including those that stand *between* two linked ones. A phrase whose pieces join into one highlight (the projection and join rules of part 1 and the 2026-11-15 joining step) does not lose those interior words: the highlight covers them. Counting them made the lookup abstain on phrases whose counterpart it had in fact found.

**The rule.** The abstention test now counts `edgeMissing`, the unlinked content words at the *ends* of the phrase, when the phrase has one highlight (`highlights.length === 1`); several highlights keep the old count. When the edge count is smaller than the full count, the span projection (`project()`, now a function so both branches share it) extends the highlight over the interior; if it finds nothing, the old highlight stays and the lookup still answers "uncertain". The projection itself is unchanged: it stays blocked when a content word stands between an anchor and the phrase, when the gap is larger than max(6, 3 × content words + 2), and when the span would need a negation it does not have.

**Measured on the same data (`phr10`), before → after.**

| Set | Before | After |
| --- | --- | --- |
| Sentences: dev 120, tuned 110, blind 102 | 96 / 82 / 85 hits | identical rows (0 changed) |
| Lexical A phrases (dev) | 29 hits, 3 answered-but-not-hit | **31** hits, 4 answered-but-not-hit |
| Lexical B phrases (blind, used repeatedly) | 32 hits, 1 | **34** hits, 1 |
| Lexical A and B words | 33 / 29 | 33 / 29 (unchanged) |
| Probes word / phrase / sentence | 35 / 27 / 39 | 35 / **28** / 39 |
| Audits 1 and 2 (seeded, 40 sentences, 40 phrases, 40 words each) | | no highlight changed |
| Chapter-2 regression list | | identical |

Net: five more phrase hits over the three phrase sets and one new wrong answer. The three lexical A rows that changed, read one by one: "train men in the arts of war" → "giảng võ" (hit), "burn incense and pay homage to the Buddha" → "dâng hương lễ Phật" (hit), and **"lovely waters and wondrous peaks" → "núi rất đẹp" (wrong: the gold is "nước tú non kỳ")**; the wrong one carries the `uncertain` status, as every answer of this rule does, and it was an empty `context-only` answer before. That is the price of the rule: of the three phrases it newly answers in lexical A, two are right and one is not. Words and sentences do not move, which is the expected footprint of a rule that only touches phrases with interior gaps. Lexical B is not independent (it has been used repeatedly); the lexical A, probe and B gains agree in direction and size, and the lexical A figure is the dev one. The 100 answered lookups of the fifth sheet were run on source `0c8df52`, before this rule, so that sheet does not measure it; the audits above show no changed highlight, so the rule is not expected to move that sheet either.

**Tests.** New unit test (`tests/novel-clause-lookup.test.ts`, 48 in that file): "does not count unlinked words between two linked ones against a phrase whose pieces join into one highlight, but still abstains when they stand at its ends"; it fails on the previous `novel-lookup.ts` and passes on the new one. Full suite 383 of 383 twice, `tsc` clean. e2e (alignment config, 60 tests): 60 of 60 in four of five runs; the fifth failed one test, the first desktop `en` lookup, at `expect(.reader-shell).toHaveAttribute('data-ready','true')` (5 s), before any selection or lookup, which is the cold-start flake already noted for the first desktop tests, not the lookup rule.

## Rules

1. Change code against the dev sets; run the blind set once before and once after a step, never to choose between variants.
2. Report the blind numbers next to the dev numbers. If dev improves and blind does not, the blind number is the result.
3. Probes and pairs that were looked at while fixing a failure move to dev.
4. Never loosen a threshold to move one class without reporting the others (coverage ↔ not-wrong of answered).
