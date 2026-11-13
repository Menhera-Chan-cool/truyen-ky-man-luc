# Contextual alignment release — 2026-11-13

Selected `labse-context-mbert-1`: pinned LaBSE sentence/note contexts, existing mBERT word links inside those contexts. XLM-Align's tiny lexical comparison was worse, so it was not selected. No LLM/Vilao path and no per-word corpus audit remain in the active project.

Changes cover plain-text headings/original titles, shifted/merged notes, reference/caption aliases, missing-word abstention, Unicode offsets and excluded structural ranges. Book text/versions are preserved. Models stay outside Next.js and the browser.

Local evidence: 20 generated artifacts, 40 unchanged version/hash-bound editions, ~9.45MB total; 264 Vitest tests, 23 Python tests, typecheck, production build and 22 actual desktop/mobile production-build tests, including offline preservation, passed. These are contract and representative checks, not a full-book semantic accuracy certification. Some archaic/poetic expressions still return no direct counterpart; related context or chapter comparison remains available.

Migration `20261113082758_contextual_novel_alignment.sql` was applied to the intended project; current E5 runs remain serving until replacements are ready. Release procedure: pause the hourly workflow only during cutover, upload the 20 prepared artifacts, restore the workflow and verify production. Source repository remains private.

Experiment/reference files are outside the repository in `work/alignment-model-study`; the abandoned LLM experiment is in `work/llm-alignment-prototype-20261113`.
