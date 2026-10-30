# iOS pagination correction

- [x] Reviewed the user's 51.83s video and three screenshots. Book stayed at 1/1 and next page skipped the rest of a chapter; text was clipped vertically.
- [x] Reproduced on isolated WebKit 18.0 (Playwright 1.48.2), not on current 27.2. Article width 323px, scrollWidth 323px, height 451px, scrollHeight 22724px, one page. Height/flex experiments did not fix it; a definite column-width enabled horizontal fragmentation.
- [x] Regression verifier failed before production change. Explicit tiny preferred column width keeps column-count in control of single/double layout, while forcing old WebKit's multicol path. No content/offset/database changes.
- [x] Extended last-character assertion exposed fractional rounding: current WebKit's actual viewport was 999.265625px, clientWidth 999; 28 physical leaves were counted as 29, creating an empty spread. Reader and flip snapshot now use actual rectangle dimensions. The verifier failed on the old measurement and passes with the correction.
- [x] Local legacy/current WebKit: four VI/EN phone/desktop cases each pass, including final character, chapter edges, resize and Ebook single page. Production build and TypeScript pass.
- [x] Final Chromium regression, unit suite, production deployment and exact live WebKit verification.

Runtime browser dependencies are unchanged. Older Playwright/video decoding tools live only under work/, outside the app. User's attachments and book source files were not modified. No Supabase migration or content publication is needed.

Final local checks: 84 passed / 10 conditional skips / zero failed or flaky in the 94-case selected Chromium suite; 95 unit tests pass. Legacy WebKit 18.0 and current 27.2 each pass four VI/EN phone/desktop cases. Only cloud verification remains.

Released dpl_AXqrTzKeVX43dk98QwjxyVvAA9X3 / 5b08129e125350b771a62bdf4e9a1f3d2d5f137f. Exact cloud: Chromium 47 passed / 9 skipped / zero failures or flaky; WebKit 18.0 and 27.2 each pass 4 cases. Four phone visual/gesture/footnote combinations pass. Device hardware limitation remains explicit.
