# Local bilingual alignment upgrade

- Upgrade sentence/paragraph matching to pinned LaBSE, including its CLS/dense/Tanh/normalization pipeline. Keep mBERT for contextual word links: the bounded XLM-Align comparison did not improve this book's sample.
- Split by real Reader blocks, sentences/clauses and semantic roles before alignment. Recognize critique/notes/plain-text headings and original-title boundaries; pair note content without assuming equal note numbers. Support split/merged passages, omitted/reordered notes and shared translations of poem variants.
- Propagate repeated note-topic mentions within an already paired note/reference so a relocated caption is not aligned with unrelated opening words. Avoid fabricated lexical answers for reference-only notes.
- All models run in the background worker. Reader lookup consumes immutable version/hash-bound artifacts; no model call or added computation on mobile selection. Preserve source book text and stored reading positions.
- Use recipe `labse-context-mbert-1`; preserve current old artifacts until a complete current-pair replacement is atomically published. Private worker permissions and storage remain unchanged.
- Validate with small representative comparisons, unit/integration tests and browser smoke checks. No sentence-by-sentence or word-by-word corpus audit, and no claim of universal accuracy from a small sample.

The earlier LLM alignment experiment is parked under `work/llm-alignment-prototype-20261113`, outside the active project. Its provider settings and migrations are not selected for this upgrade.
