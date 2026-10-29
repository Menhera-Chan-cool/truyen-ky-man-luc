# Capability map: reader and editor expansion — 29/10/2026

User selected 13 distinct capabilities (publish preflight appeared twice). Reuse the existing single-book data, locale/chapter/revision identities, local reader storage, guarded admin APIs and SQL transactions.

| Module | Responsibility | Depends on |
|---|---|---|
| editor-review | Draft/published comparison and publish preflight | existing version API |
| batch-replace | Literal whole-book preview and atomic draft replacement | editor-review, existing optimistic revisions |
| collaboration | Recent editor presence and immutable admin audit | additive migration 004, existing member RLS |
| reader-navigation | Help, page jump, recent semantic positions | existing Reader anchors/pagination |
| parallel-reader | Same-chapter VI/EN comparison, no guessed sentence alignment | published-book endpoint |
| speech-tools | Local pronunciation mapping and opt-in natural-end next chapter | existing speech generation/checkpoints |
| custom-fonts | Validated local font import/load/remove | existing local preferences/font reflow |
| offline | Explicit published snapshot/assets and offline reader shell | public book endpoint, reader navigation/fonts |

Build order: pure editor/speech helpers and SQL tests -> collaboration migration/API -> admin tools -> reader navigation/parallel/speech/fonts -> offline shell -> full verification/private source/production release.

Defaults: pronunciation rules are per locale and device; custom font files stay on device. Recent history stores semantic anchors/revisions, not unstable page numbers alone. Offline stores only explicitly downloaded published VI/EN and approved public assets; admin/auth/source/draft routes never enter its cache. Replace only creates drafts after preview, with all expected revisions checked in one transaction. Existing content is never automatically published by these tools. Existing backups remain compatible. Desktop/touch Book behavior and text offsets remain intact.

Verification: Vitest for HTML validation/diff/replace/offset mapping/font/snapshot contracts; PGlite for migration/audit/presence/RLS and atomic revision conflicts; Playwright production build for all new UI and existing regressions, then selected live checks on exact deployment. Source and ZIP exclude secrets. A server migration may need the owner to run SQL Editor after concrete tests, because service_role cannot alter schema.
