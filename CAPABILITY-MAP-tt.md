# TT

| Module | Responsibility | Dependencies |
|---|---|---|
| comic-data | Image/ZIP validation, stable page IDs, isolated local drafts | Existing idb/JSZip |
| comic-reader | TT edition link, vertical strip/single-image modes, chapter/page navigation | comic-data |
| comic-editor | Upload, ordered thumbnails, replace/delete, draft and reader preview | comic-data, comic-reader |
| comic-publication | Authenticated direct Storage uploads, verified assets, private drafts, revision-checked publication/withdrawal and public access | existing member roles, comic-data, comic-reader, comic-editor |

Build: data → reader → editor → Vitest/Playwright → bounded visual review → local handover.
The first phase was local-only. After review the user explicitly authorized shared Supabase storage/publication and deployment; `SPEC-comic-publication.md` supersedes local-only boundaries for this release. Text editions remain untouched.
