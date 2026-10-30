# comic-data

Production extension: after local review the user authorized shared Supabase storage/publication and deployment. SPEC-comic-publication.md supersedes local-only persistence/release boundaries below; the isolated local worktree retains this original prototype contract.

Objective: one comic edition per existing chapter ID, independent of VI/EN text. Stable image IDs survive reordering; replacement gets a new ID. Drafts and image Blobs stay in a separate local IndexedDB database. Saving checks revision atomically and never mutates source book data.

Commands: `npm test -- --maxWorkers=1`; `npm run typecheck`; `npm run build`.
Files: src/lib/comic.ts, comic-import.ts, comic-db.ts; tests/comic.test.ts. TypeScript modules, explicit types and bounds, no new dependencies.

Import PNG/JPEG/WebP from multiple files or ZIP/CBZ. Natural-sort each new batch, retain manual existing order, skip exact duplicates explicitly. Validate signatures, decode dimensions, cap 20 MB/image, 50 MB/archive, 200 MB total, 300 images, 2500 archive entries and bounded streamed decompression. Reject unsafe archive paths, scripts/SVG and undecodable images. Failed import preserves previous pages.

Always: validate before saving, release object URLs, keep errors actionable. Never: use live credentials, upload to cloud, silently overwrite a stale draft. Tests cover order, reorder immutability, format/path/size limits, ZIP failure and local version conflicts. Two original generated sample pages are labelled illustrative, not a real adaptation.
