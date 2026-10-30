# comic-reader

Production extension: after local review the user authorized shared Supabase storage/publication and deployment. SPEC-comic-publication.md supersedes local-only persistence/release boundaries below; the isolated local worktree retains this original prototype contract.

Objective: TT sits beside VI/EN; TT opens the same chapter's image edition. VI/EN return to the corresponding text. TT is a mode, not a third locale. Missing comic chapters show an honest empty state.

Route: `/[locale]/comic/[chapterId]`. User's supplied Comix screenshots now govern this surface: graphite/teal compact right tool rail, centered settings and chapter dialogs, one-line chapter selector. No thumbnail drawer and no bottom page counter. Vertical strip, horizontal LTR/RTL, stretch + viewport-percent zoom, strip margin, fast/smooth keyboard scrolling with viewport-percent steps, auto-scroll speed/play/pause, progress bar edge selection, some/all preload, grayscale and dim. Settings and stable page-ID reading position persist separately from text. Broken images show recovery. Escape closes native dialogs. No image TTS/OCR or fake comments/group data.

Auto-hide: activity anywhere in the reader wakes tools; focus/pageshow/visible restores them after tab-away. Idle hides only when no modal, hovered controls or keyboard focus requires them. Click/touch in blank/center or a small wake target restores controls. Hidden/blur/freeze/pagehide stops auto-scroll; it never catches up or resumes by itself on return. Open dialogs pause automatic movement without losing its selected speed.

Chapter dialog mirrors screenshot structure, adapting data honestly to one book: search, source filter (sample/local/missing), order controls, optional image-only chapter navigation, selected chapter highlight and pagination. No invented scanlation groups/dates. Header shows only `Chương 1`, never the story subtitle below it.

Files: src/components/ComicReader.tsx, ComicDialogs.tsx, app/comic-reader.css; local route and LanguageLinks integration. Reuse book metadata/chapters from committed seed, no remote book fetch for this prototype. Controls use existing fonts/icons and native focus semantics. Test page changes, locale/text switching, missing sections, settings/progress persistence, tab-return UI recovery and network isolation via Playwright. Build with `npm run build`; test WebKit with `npx playwright test --config=playwright.comic.config.ts` (local base defaults to port 3002).

Never change the production site or text-edition reading data. Sample artwork stays local with provenance. Reader shows that this is a local preview.
