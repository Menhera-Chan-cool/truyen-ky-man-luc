# Novel lookup progress — 12/11/2026

- Approved plan: novel-bilingual-lookup-plan.md; automatic words/phrases/sentences VI↔EN, uncertainty permitted. User chose hourly GitHub Actions, low cost.
- Canonical DOM/UTF-16 extractor, semantic DP + conservative retrieval fallback, mBERT token links and Underthesea compounds implemented. No source/spelling edits.
- Local runtime: D:/codex/2026-10-22/p/work/novel-alignment-runtime, model cache novel-alignment-models, prepared inputs novel-alignment-data, ready artifacts novel-alignment-ready. Models pinned, 20 artifacts ≈5.9MB, CPU batch429.81s/2threads.
- Pilot probes120: word39/40, phrase36/40, sentence38/40 at character-F1≥0.5; meanF1 .9604/.7321/.9218. These are development probes, not semantic accuracy or fresh holdout.
- Supabase project zoglmjnkmiwnbvmjfpts: migration 20261112043121 applied; 20 jobs/runs ready after local worker upload. Book hash e58da29549c53783b2f88ff5036c14aa, edition hash d3f3479acfac125f94e572e329f7e4d3, versions105 unchanged by migration.
- GH private repo Menhera-Chan-cool/truyen-ky-man-luc: worker variable/secret configured without printing credentials. Workflow source prepared, not yet verified on GitHub.
- Local dev server exec session54467 at127.0.0.1:3003 currently overrides NOVEL_ALIGNMENT_DIR to artifacts-v3 (two pilot chapters); restart without override to exercise all20 remote artifacts.
- Lookup Reader/Panel/Parallel focus and download endpoint exist in working tree, not deployed. Basic real-data VI/EN browser lookup passed. Runtime Google helper removed in working tree.
- Remaining: validate real GH run; complete editor status placement, offline artifacts/atomic cache update, request-race/mobile/Book browser cases, full regression/build, review + production deploy/live verify. Source migration filename is the hosted version; do not rerun migration.
