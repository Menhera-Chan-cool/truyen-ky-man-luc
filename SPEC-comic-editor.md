# comic-editor

Production extension: after local review the user authorized shared Supabase storage/publication and deployment. SPEC-comic-publication.md supersedes local-only persistence/release boundaries below; the isolated local worktree retains this original prototype contract.

Objective: usable local upload/edit preview for the same single book. `/local/comic-editor?chapter=chapter-1`; prominent local-only status, no pretend login or cloud publication. Metadata, drop zone/file picker, ordered thumbnails, dimensions/bytes and a selected-page inspector. Drag reorder and accessible move buttons, natural sorting, delete/replace, select/clear selection, sample reset and save draft. Preview opens the actual local TT reader after saving. Chapter change/discard confirms unsaved work; no mixed async chapter state.

Files: ComicEditor.tsx, app/comic-preview.css, route. State keyed by stable chapter ID; chapter controls disabled during import/save. Per-image validation and atomic local save; failure leaves old saved reader edition intact. UI is an authored upload workspace, not an asserted clone of inaccessible private upload screens.

Commands: `npm run typecheck`, `npm test -- --maxWorkers=1`, `npm run build`, Playwright comic-preview flow.
Always: label local persistence and sample images, provide empty/error/loading/disabled states and keyboard sorting. Never: send emails, require production auth, call Supabase or offer a real Publish action. Acceptance: import → reorder → save → read → reload works on desktop/mobile; bad files, duplicates, chapter switching and conflict preserve data. Use original art, not downloaded reference chapter pages.
