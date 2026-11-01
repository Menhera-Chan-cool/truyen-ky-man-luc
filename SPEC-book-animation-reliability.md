# Reliable PC/mobile book animation

User reports page animation appearing only occasionally. Reproduced: consecutive turns while the disposable animation iframe reloads, and coalesced touch input without a rendered drag preview. Keep page-flip 2.0.7 and iframe isolation; do not leave its uncancellable RAF running idle.

Prewarm one spare idle frame during each active fold, then dispose the used frame and promote the prepared one. Current same-origin body/UI/heading font bytes are cached as Blob URLs for the Reader lifetime, bounded per file and released on unmount; fonts are not fetched through private redirects again on each frame. Idle remains one frame, active at most two; snapshots exclude both hosts. Resize/hidden/reduced motion/dispose invalidate frames as needed. Remove unrelated document-font loading as a global blocker; the iframe still explicitly warms body and heading faces.

Touch fallback animates when preview was unavailable; existing successful drag preview commits once. Queued rapid touch turns coalesce visually at the final ready turn while preserving every logical step/chapter edge. Reduced motion/e-ink keep their intentional non-animated behavior. Preserve selection, footnotes, layout, original content, reader position and desktop drag behavior.

Verify delayed frame-startup consecutive buttons/edge taps; coalesced swipe; existing PC drag/cancel, fast mobile swipes and chapter boundaries; disposal/one idle frame; typography after font/viewport changes; Chromium desktop/phone and WebKit phone. No claim of physical device FPS.
