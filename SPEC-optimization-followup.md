# Four scoped optimizations from the 31 October follow-up

User authorized all four audit items on 1 November; preserve the current UI and original book/assets. No new dependencies, schema, analytics or reader accounts.

1. Reading images: deterministic private lossless WebP at original oriented resolution, used only if smaller. Original authorization applies before signing; missing derivative falls back to original, infrastructure failures stay 503. Original is retained for desktop zoom above 100%. Idempotent backfill validates original checksum and never overwrites objects.
2. Preload: conserve data (0 on Save Data/2G, at most one page and 1 MiB on 3G, at most two pages/8 MiB normally; explicit All still capped at 8 MiB). Original byte sizes are a conservative upper bound. Skip the current/already rendered/loaded/in-flight URLs. Visible lazy images still load on demand. Chapter warming shares these limits.
3. Editor: bounded read/auth/upload/register/save/publication. Keep upload checkpoints after uncertain response; try registration before retransmission to the same immutable path. No automatic write retries. Lost save/publication response triggers a bounded head read and content/revision comparison; otherwise retain local changes and explain uncertainty. No blind overwrite.
4. CSS/fonts: root keeps only common identity fonts/base styles. Comic reader/editor and optional reader fonts belong to their components/routes. PDF CSS loads with PDF viewer. Preserve font readiness before measuring pages and existing heading font behavior.

Verify failing tests before implementation; Vitest, typecheck/build, route-level cold CSS sizes, real original/derived pixel equality and bytes, deadline/lost-response failures, Chromium desktop/mobile and WebKit reading/editor checks, then deployed URL. Physical iPhone/FPS and sustained multi-user load remain outside automated verification.
