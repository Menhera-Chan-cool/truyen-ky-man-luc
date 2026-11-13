# Book-specific alignment adaptation

User approved the first three improvements: poetry/reference structure, bilingual glossary, and word-model fine-tuning. Preserve public book content and its stable Reader UTF16 coordinates; keep the current model/artifacts serving until a verified replacement exists. No exhaustive manual word review and no invented 95% success claim.

| Module | Responsibility | Depends on |
|---|---|---|
| poetry-references | Keep alternate verse renderings on coherent tracks; embed bounded same-language referenced-note context | Existing published context input |
| book-glossary | Mine supported name/term correspondences from existing paired scopes, preserve provenance and abstain on ambiguous mappings | poetry-references |
| word-adaptation | Export clean parallel training data, split by chapter, actually fine-tune mBERT locally, compare a held-out candidate with the frozen baseline | First two modules |

Build order follows the table. The user approved these concrete module boundaries by asking to implement the three suggested items; routine implementation choices proceed within that scope.

## Contracts and safeguards

- Read published VI/EN snapshots only. Every output retains chapter/version/hash/structural-range binding. No source text, reader annotations or settings are modified.
- Poetry detection is structural and conservative, supports separate renderings of one poem, and must not classify ordinary short dialogue as parallel verse. Multi-line lookup keeps one corresponding rendering rather than switching tracks between lines. Uncertain contextual matches never fabricate lexical equivalents.
- Resolve note references locally with cycle/depth/length bounds. Equal note numbers across languages are not identity. Unresolved references preserve current safe behavior.
- Glossary entries are strings/spans observed in both editions, with independent support and ambiguity checks. No hand-coded book names or mappings derived from evaluation answers. Count/report candidates and accepted entries separately; apply only inside the appropriate currently paired scope.
- Training uses fixed seed/budgets and an isolated existing Python runtime. No API credentials or new hosted training service. Split whole chapters and remove duplicate text pairs across splits. Freeze a baseline; never select a candidate solely because training loss decreased.
- Keep held-out evaluation data out of training and glossary-derived training anchors. Evaluate both positive and absent/divergent counterparts. Promote weights only if the bounded held-out comparison improves without degrading rejection behavior; otherwise retain the baseline and report that outcome.
- Serialize weights as safetensors with base-model/license/provenance metadata. Keep large weights out of Git and the browser. Any selected custom checkpoint needs a private, checksum-verified worker download path before production rollout.

## Verification

Use TDD for structural/reference/glossary/training-data logic, isolated Python unit tests, Vitest/typecheck, production build and representative desktop/mobile browser checks. Verify the entire currently published source-pair binding when rebuilding artifacts. Recompute the same coverage/status report after release without lowering its existing thresholds to inflate percentages. Report corpus coverage separately from measured held-out semantic/lexical quality.

Commands: `npm run typecheck`; `npx vitest run --maxWorkers=2`; isolated `python -m unittest discover -s scripts/align-novel -p 'test_*.py'`; pinned local training/evaluation commands are recorded with their actual budgets and output files in the adaptation report.
