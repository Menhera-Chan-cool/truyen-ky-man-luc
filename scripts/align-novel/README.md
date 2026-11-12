# Novel alignment worker

Aligns existing published VI/EN text; it does not generate translations. Model IDs/commits are pinned in models.json. Python dependencies are isolated from the Next.js deployment.

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

Production: migration 20261112043121_novel_alignment.sql adds private jobs/runs/storage, publication-triggered enqueue, leased service-only worker RPCs and a public-current-pair metadata RPC. It does not rewrite source content. `worker.ts` binds both immutable source versions and canonical hashes, verifies cached results, uploads content-addressed JSON, then finishes with the job lease. An obsolete result cannot replace the active pair.

GitHub Actions runs at minute17 each hour on the default branch, at most three chapters/run and fifteen minutes/run. Idle runs skip Python, npm install and model loading. GitHub can delay scheduled events. Usage counts against the account's Actions quota; the schedule does not guarantee zero charges or instant readiness. No billing plan is changed.

The trusted private repository needs `NOVEL_ALIGNMENT_SUPABASE_URL` (variable) and `NOVEL_ALIGNMENT_SERVICE_ROLE_KEY` (secret). `node scripts/align-novel/configure-actions.mjs` configures these using existing local server credentials through stdin, never command arguments or source files. The workflow exposes the key only to claim/upload steps, not dependency installation or Python subprocesses. Do not enable this workflow for pull requests or untrusted branches. Keep model caches and work data out of Git.

Verification:

```powershell
npx vitest run tests/novel --maxWorkers=2
../../work/novel-alignment-runtime/Scripts/python.exe -m unittest discover -s scripts/align-novel -p 'test_*.py'
npm run typecheck
```

Attribution: E5-small (MIT), multilingual BERT (Apache-2.0), Underthesea9.5/core3.3.2 (Apache-2.0). Word-alignment methodology follows Dou and Neubig, [AWESOME-align](https://github.com/neulab/awesome-align) (BSD-3-Clause); see LICENSE.awesome-align.txt. Models remain outside the repo and browser bundle. Preserve the corresponding package/model licenses when redistributing them.

shortcut: the worker processes whole chapters for this short book; add resumable chapter chunks if inputs approach the runner timeout.
