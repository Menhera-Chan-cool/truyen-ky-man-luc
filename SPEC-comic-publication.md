# TT shared publication

User authorization: publish the approved TT reader/editor and enable shared Supabase storage/publication. The subsequent SPEC-edition-switch.md splits image editions, draft revisions and publication by stable chapter plus VI/EN. Existing records become VI; text editions remain untouched.

## Contract and build order

1. Migration 005 adds private comic asset registry, immutable versions and revision-checked draft/published heads. Existing member roles govern writes. Only published versions of non-archived chapters are public, through narrow functions. Anonymous/revoked users cannot mutate; editor cannot grant roles.
2. Images upload directly to a new private `comic-assets` bucket, never through a Vercel upload body. Server registration verifies signature, decoded dimensions, byte count and SHA256. Immutable object names; no authenticated overwrite/delete. PNG/JPEG/WebP only, 20 MB each, 300 pages / 200 MB per chapter. ZIP expansion remains browser-side and bounded.
3. Admin API uses existing requireEditor plus authenticated RPC/RLS. Save/publish/withdraw all check expected revision; failed upload/save leaves published content intact. Publication swaps one pointer atomically. Audit records are transactional. Signed image access lasts 60 seconds after issue, including after withdrawal.
4. `/admin/comic?chapter=...&lang=vi|en` uses existing login, verified member access and approved editor. Save draft, preview private draft, publish and withdraw are explicit. Public reader never reads browser-local drafts. Existing local worktree remains usable; shared editor offers explicit import of its own browser draft when present, without overwriting silently.
5. Public TT loads current book index and published image metadata; missing chapters show an empty state. Reader settings/position stay on device. UI design and auto-hide remain approved.

## Files / conventions

`supabase/migrations/005_comics.sql`, `src/lib/comic-{publication,remote}.ts`, `app/api/{admin/comic,comic}/`, `app/admin/comic/`, existing ComicReader/ComicEditor/Admin. Reuse private Storage and API helpers; do not change text schema or seed existing text content. Example mutation: `client.rpc('publish_comic', {p_id, p_expected_revision, p_withdraw})`.

## Checks

Vitest/PGlite verifies actual SQL grants, RLS, stale writes, asset validation, draft isolation, publication/withdrawal and rollback. API tests verify auth-before-body handling. Playwright verifies shared upload/save/preview/publish/public-read/reload/withdraw with temporary editor/chapter fixtures; browser activity/autohide and VI/EN smoke tests remain. Commands: `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run build`, `npx playwright test --config=playwright.comic.config.ts` and targeted live integration script.

## Release

Apply tested migration before runtime deployment; if only service_role exists, ask user to execute exact prepared migration in SQL Editor (it cannot issue DDL). Verify target Vercel project/team, preserve rollback deployment, deploy tested runtime, inspect ready state and test live URL before claiming completion. Push source only to the existing private repository. Never disclose credentials, invitations or test sessions; never reset 001–004 or overwrite current book.
