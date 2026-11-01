# Reliable PC/mobile book animation

Reproduced ordinary consecutive turns failing while the iframe/selected fonts reload, plus touch releases without a drag preview falling back to a non-animated turn. A spare-frame experiment still had WebKit startup gaps; use one warmed isolated iframe instead.

Destroy each completed/cancelled PageFlip instance, cancel all its frame-local RAF work and remove the resize listeners left by page-flip 2.0.7 when useMouseEvents is false. Clear its DOM but retain the iframe document and loaded fonts for the next turn. One iframe, no idle renderer loop, no repeated private font redirects. Resize resets renderer geometry; hidden/reduced-motion/dispose remove the frame. No vendor edits or new dependencies.

Touch fallback animates; a rendered drag preview commits once. Rapid queued gestures preserve logical steps and animate the last ready turn. Keep source IDs isolated, front/back faces, selection/footnotes, chapter edges, page counts and saved positions. E-ink/reduced motion intentionally remain non-animated.

Verify delayed startup repeated buttons/edge taps, coalesced swipe, existing PC drag/cancel, native Chromium touch, WebKit pointer/tap, rapid chapter boundaries, iframe DOM/RAF cleanup and typography. Physical phone FPS not inferred from emulation.
