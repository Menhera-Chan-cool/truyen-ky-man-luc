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

## Rules

1. Change code against the dev sets; run the blind set once before and once after a step, never to choose between variants.
2. Report the blind numbers next to the dev numbers. If dev improves and blind does not, the blind number is the result.
3. Probes and pairs that were looked at while fixing a failure move to dev.
4. Never loosen a threshold to move one class without reporting the others (coverage ↔ not-wrong of answered).
