# Novel alignment worker

Aligns existing published VI/EN text; it does not generate translations. Model IDs/commits are pinned in models.json. Python dependencies are isolated from the Next.js deployment.

Recipe `labse-poetry-mbert-3` uses LaBSE for sentence and full-note context, then mBERT for word links inside the matched scopes. Published HTML supplies bounded poem/line/title hints, including couplets, blank paragraph gaps, br/italic spans, named series and flattened verse. Confirmed poem tracks retain one complete rendering for multi-line queries. Whole-poem metadata is separate from lexical groups; full-line lookup uses confirmed line correspondences, not raw word votes. Weak line mappings return context-only and cannot borrow prose or another poem line. Referenced notes add bounded same-language embedding context only (depth3, 2048 added characters), never a broader lexical scope. Raw and referenced semantic views preserve a clear short verse when a long note would otherwise dominate it. Structural preparation separates prose, critique, original-title metadata and notes before matching; note numbers are identifiers, not evidence that two notes correspond. LaBSE uses CLS pooling followed by its bundled Dense/Tanh layer and normalization. Long model inputs are windowed without changing Reader text or UTF16 coordinates.

`book_glossary.py` mines edition-bound observed names and terms. Only repeated, unambiguous full-name transliterations are applied automatically; model-derived terms remain provisional even when repeated. A `.glossary.json` sidecar preserves every candidate/evidence/source hash; the serving artifact contains only aggregate metadata plus scoped grounded links. Glossary creation precedes caption cleanup, and its application follows cleanup. The worker uploads only `chapter-N.json`, not the sidecar.

No LLM/provider call is used for lookup or background alignment. A small local comparison selected LaBSE over E5 for context retrieval; XLM-Align did not improve the word sample, so it was not selected. These representative checks are not a word-by-word review or a guarantee of full-book accuracy.

Local setup (from repository root):

```powershell
python -m venv ../../work/novel-alignment-runtime
../../work/novel-alignment-runtime/Scripts/python.exe -m pip install -r scripts/align-novel/requirements.txt
../../work/novel-alignment-runtime/Scripts/python.exe scripts/align-novel/download_models.py --cache ../../work/novel-alignment-models
npx tsx scripts/align-novel/prepare.ts ../../work/novel-alignment-data chapter-1 chapter-18
../../work/novel-alignment-runtime/Scripts/python.exe scripts/align-novel/run.py --cache ../../work/novel-alignment-models --input ../../work/novel-alignment-data --output ../../work/novel-alignment-ready
npx tsx scripts/align-novel/evaluate.ts ../../work/novel-alignment-ready ../../work/novel-alignment-evaluation.json
```

The evaluator reports character-span precision/recall/F1 on 120 directional probes; `hits` means F1≥0.5, **not human-verified semantic accuracy**. The probes used during development are not a new independent held-out test. Poetry, omissions and idioms can remain uncertain; UI must show context and automatic-suggestion labels.

Production: migration 20261112043121_novel_alignment.sql adds private jobs/runs/storage; 20261113082758_contextual_novel_alignment.sql selects LaBSE; 20261113131339_book_specific_novel_alignment.sql selects the book recipe; 20261114014446_poetry_novel_alignment.sql selects the poetry recipe. Prior ready results stay available until replacements exist. These migrations do not rewrite book content. `worker.ts` binds both immutable source versions and canonical hashes, verifies prepared results, uploads content-addressed JSON, then finishes with the job lease. An obsolete result cannot replace the active pair.

## Isolated adaptation

`adaptation_data.py --input ARTIFACT_DIR --output PARALLEL.json` exports conservative contiguous high-confidence story/critique pairs. Whole chapters1/2/3/14/19 are held out, chapter4 is development; normalized duplicate source or target text cannot cross splits. No glossary or evaluation answers enter training.

`train_word_model.py --model PINNED_MBERT_SNAPSHOT --data PARALLEL.json --output EMPTY_DIRECTORY --steps 300 --minutes 15` performs a real bounded CPU experiment with seed42. It trains encoder layers6/7, which affect serving hidden-state8, using frozen-teacher softmax alignment and bilingual masked LM. It saves safetensors and a training manifest outside Git. A held-out lexical comparison must improve F1 by at least .02, not reduce precision by more than .01, and not increase the negative nonempty indicator before promotion. Loss alone is never an acceptance criterion. The 2026-11-13 candidate failed this gate, so the serving mBERT pin stays unchanged; see the adaptation report. This is an offline training process for the online feature, not an offline-reader feature change.

GitHub Actions runs at minute17 each hour on the default branch, at most one chapter/run and fifteen minutes/run. Idle runs skip Python, npm install and model loading. GitHub can delay scheduled events. Usage counts against the account's Actions quota; the schedule does not guarantee zero charges or instant readiness. No billing plan is changed.

The trusted repository needs `NOVEL_ALIGNMENT_SUPABASE_URL` (variable) and `NOVEL_ALIGNMENT_SERVICE_ROLE_KEY` (secret). `node scripts/align-novel/configure-actions.mjs` configures these using existing local server credentials through stdin, never command arguments or source files. The workflow exposes the key only to claim/upload steps, not dependency installation or Python subprocesses. Do not enable this workflow for pull requests or untrusted branches. Keep model caches, training snapshots and work data out of Git, including when the repository is public.

Verification:

```powershell
npx vitest run tests/novel-alignment.test.ts tests/novel-alignment-db.test.ts tests/novel-worker-input.test.ts tests/novel-lookup.test.ts tests/novel-api.test.ts tests/novel-remote.test.ts tests/offline-alignment.test.ts --maxWorkers=2
../../work/novel-alignment-runtime/Scripts/python.exe -m unittest discover -s scripts/align-novel -p 'test_*.py'
npm run typecheck
```

Attribution: [LaBSE](https://huggingface.co/sentence-transformers/LaBSE) (Apache-2.0), multilingual BERT (Apache-2.0), Underthesea9.5/core3.3.2 (Apache-2.0). The earlier E5 baseline was MIT. Word-alignment methodology follows Dou and Neubig, [AWESOME-align](https://github.com/neulab/awesome-align) (BSD-3-Clause); see LICENSE.awesome-align.txt. Models remain outside the repo and browser bundle. Preserve the corresponding package/model licenses when redistributing them.

shortcut: the worker processes whole chapters for this short book; add resumable chapter chunks if inputs approach the runner timeout.
