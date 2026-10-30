---
name: "Truyền kỳ mạn lục"
description: "An annotated Vietnamese and English reading edition on warm paper."
colors:
  paper: "#f5f0e5"
  panel: "#ebe4d5"
  ink: "#302b23"
  secondary: "#6b6051"
  accent: "#8d342b"
  rule: "#cfc4b2"
  button-ink: "#fffaf0"
  reader-light-paper: "#fffdf8"
  reader-light-ink: "#28251f"
  reader-warm-paper: "#f6e6ca"
  reader-warm-ink: "#382c20"
  reader-warm-accent: "#803d23"
  reader-coffee-paper: "#362e27"
  reader-coffee-ink: "#f0dcc0"
  reader-coffee-accent: "#e7b87c"
  reader-dark-paper: "#171923"
  reader-dark-ink: "#ede7d9"
  reader-dark-accent: "#d5ac79"
  reader-dim-paper: "#282a30"
  reader-dim-ink: "#d9d5cc"
  reader-dim-accent: "#deba8e"
  eink-paper: "#ffffff"
  eink-ink: "#000000"
  book-dark-paper: "#191b22"
  book-dark-ink: "#ede7da"
  book-dark-accent: "#e2b080"
  book-dark-secondary: "#c6baa9"
  book-dark-rule: "#45413b"
  custom-colors-paper: "#181b2c"
  custom-colors-rule: "#34394d"
  custom-colors-ink: "#aeb7cf"
  footnote-link-light: "#3366cc"
  footnote-link-dark: "#8ab4f8"
  tooltip-paper: "#22242e"
  tooltip-rule: "#454955"
  tooltip-ink: "#f1f2f6"
  comic-ground: "#222a2c"
  comic-panel: "#293235"
  comic-control: "#323c40"
  comic-ink: "#bfcccf"
  comic-muted: "#9cabb0"
  comic-accent: "#5de4f4"
  comic-selected: "#30484d"
  comic-hover: "#364448"
  comic-rule: "#384347"
  comic-range: "#465155"
  comic-backdrop: "#000b"
  editor-inset: "#eee8db"
  editor-field: "#faf7ef"
  editor-upload: "#efe9dc"
  editor-upload-rule: "#aa9981"
  editor-rule: "#d8d0c1"
  editor-selected: "#dfcfc0"
  editor-primary-hover: "#742a23"
typography:
  display:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "clamp(44px, 5.4vw, 74px)"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "32px"
    fontWeight: 500
  chapter-title:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "clamp(23px, 2.5vw, 31px)"
    fontWeight: 500
    lineHeight: 1.5
  reading-default:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.9
  summary:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.95
  body:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "12px"
    fontWeight: 500
  byline:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    letterSpacing: "normal"
  comic-body:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  comic-dialog-title:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  comic-section-label:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "0.16em"
  comic-chapter-label:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
  comic-chapter-title:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  comic-chapter-subtitle:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  editor-heading:
    fontFamily: '"Literata Variable", Georgia, serif'
    fontSize: "29px"
    fontWeight: 500
    lineHeight: 1.3
  editor-body:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  editor-action:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "12px"
    fontWeight: 500
  editor-field:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "12px"
    fontWeight: 400
rounded:
  language: "4px"
  segment: "5px"
  control: "6px"
  group: "8px"
  panel: "12px"
  comic-icon: "3px"
  comic-control: "4px"
  comic-dialog-phone: "10px"
  editor-control: "5px"
  editor-page: "7px"
spacing:
  tight: "3px"
  compact: "6px"
  control-gap: "10px"
  section: "20px"
  reading-gutter-phone: "20px"
  page-gutter-phone: "24px"
  page-gutter-desktop: "46px"
  comic-step-gap: "8px"
  comic-overlay-inset: "12px"
  comic-dialog-gutter: "16px"
  editor-grid-gap: "18px"
  editor-grid-gap-phone: "13px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-icon:
    backgroundColor: "transparent"
    rounded: "{rounded.control}"
    size: "38px"
  field:
    rounded: "{rounded.control}"
    padding: "11px 10px"
    height: "42px"
  language-link:
    rounded: "{rounded.language}"
    padding: "9px 8px"
    width: "34px"
  segment:
    rounded: "{rounded.segment}"
    padding: "6px 8px"
    height: "34px"
  reader-panel:
    rounded: "{rounded.panel}"
    padding: "16px 20px 22px"
    width: "min(425px, calc(100vw - 24px))"
  comic-icon:
    textColor: "{colors.comic-muted}"
    rounded: "{rounded.comic-icon}"
    size: "36px"
  comic-icon-active:
    backgroundColor: "{colors.comic-selected}"
    textColor: "{colors.comic-accent}"
    rounded: "{rounded.comic-icon}"
    size: "36px"
  comic-settings:
    backgroundColor: "{colors.comic-panel}"
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.panel}"
    width: "480px"
  comic-chapters:
    backgroundColor: "{colors.comic-panel}"
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.panel}"
    width: "560px"
  comic-choice:
    backgroundColor: "{colors.comic-control}"
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.comic-control}"
    padding: "9px 7px"
    height: "40px"
  comic-choice-selected:
    backgroundColor: "{colors.comic-selected}"
    textColor: "{colors.comic-accent}"
    rounded: "{rounded.comic-control}"
    padding: "9px 7px"
    height: "40px"
  comic-chapter-row:
    textColor: "{colors.comic-ink}"
    rounded: "{rounded.comic-control}"
    padding: "7px 74px 7px 10px"
    height: "52px"
  editor-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.editor-control}"
    typography: "{typography.editor-action}"
    padding: "11px 17px"
    height: "44px"
  editor-field:
    backgroundColor: "{colors.editor-field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.editor-control}"
    typography: "{typography.editor-field}"
    padding: "10px 12px"
    height: "44px"
  editor-upload:
    backgroundColor: "{colors.editor-upload}"
    textColor: "{colors.ink}"
    rounded: "{rounded.group}"
    padding: "27px 24px"
  editor-page:
    backgroundColor: "{colors.editor-field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.editor-page}"
---

# Design System: Truyền kỳ mạn lục

## Overview

**Creative North Star: "An annotated reading edition"**

The visitor comes to read an old Vietnamese work on a modern screen, in daylight or evening lamplight. Warm ivory paper, brown ink, vermilion controls, restrained rules, and generous margins carry the approved antique-book world. The supplied blue book cover remains the central visual artifact; its blue is image content rather than a new interface accent.

Literata gives the title and text their literary character; Be Vietnam Pro keeps controls compact and legible. Novel-Hub's familiar reading structure informs the collapsible contents rail and control bar. The edition is public, bilingual, and readable without an account; sign-in belongs to editors.

**Key Characteristics:**

- Ivory paper, brown ink, and restrained vermilion.
- Supplied blue cover; no synthetic replacement imagery.
- Literata for reading and display; Be Vietnam Pro for controls.
- Ruled contents, adjustable reading width, and a quiet reading column.

This refresh merges the approved incumbent world with code evidence from `app/globals.css`, `app/layout.tsx`, `src/lib/reader.ts`, `src/lib/types.ts`, and book, reader, settings, and UI components. Existing review evidence covers desktop/mobile book and reader, light/dark reading, settings, and locked admin. No comp, FORM, or quality-board provenance exists to attribute. Hosted Supabase is unavailable; the locked admin is intentional. This record makes no external authentication or storage verification claim.

Frontmatter records base values. Component height and width tokens represent the source's minimum or constrained dimensions where noted below, not fixed replacements for responsive CSS. Reader values are defaults, not limits on reader customization. The sidecar's synthesized tonal ramps are preview metadata, not additional shipped color choices.

### TT extension — 30/10/2026

The comic reader is an explicitly scoped graphite/teal and cyan exception, pinned to the user's Comix screenshots. The existing book and VI/EN text system above remains authoritative. Its warm paper, ink, vermilion and self-hosted fonts also govern the custom comic upload editor. TT is an image-reading mode alongside VI/EN, not a third locale. Surface strategy and reference-led direction live in `.impeccable/comic-surface.md`.

The earlier refresh's evidence/provenance paragraph describes the incumbent book record. TT has its own contract, three `SPEC-comic-*.md` files and two original generated demonstration pages. They are labelled illustrative samples, not original book pages or a complete adaptation. Exact prompts/source are in `docs/assets/comic-demo-prompts.json`, `public/comic-demo/PROVENANCE.md` and embedded PNG Description metadata. Preserve their original pixels.

This addition documents finished code and all fifteen final captures in `.impeccable/review/tt-verdict/`, at 1876×1004 desktop and 390×844 mobile. `verification/tt-ui-verdict.json` supplies geometry and tab-return measurements. The **ship** in `finish-verdict.md` scores only removal of the misleading default-direction editor control and corrected muted/control contrast; it is not a new whole-surface approval or production authorization. That initial review covered only browser-local drafts; its verdict does not authorize or verify the subsequent shared release.

### Shared TT publication — 30/10/2026

After local review, the user authorized shared Supabase storage/publication and deployment. The authenticated `/admin/comic` reuses existing sign-in/member checks. Saved drafts and immutable image objects stay private; public reading uses only published metadata and a separate authenticated draft preview. Device settings/positions remain local. The warm workbench adds a wrapping row above metadata: book-editor return, draft revision, explicit Publish/Withdraw with confirmation, and disabled publication until changes are saved. Actions retain 44px minimum height; phone login inputs are 16px. The status strip distinguishes private draft and published version. Preserve the approved Comix geometry, palette and auto-hide behavior. `SPEC-comic-publication.md`, `COMIC_PUBLISHING.md` and fresh `verification/comic-shared-*.json` govern this extension; earlier locked-admin/local-only evidence is historical.

## Colors

Warm neutrals carry the page; vermilion marks actions and active states. Preset triplets accommodate different reading light.

### Primary

- **Vermilion** (`accent`): default primary actions, active language, selected controls, links, and the short title rule.
- **Warm Button Ink** (`button-ink`): default text on filled actions. The reader computes black or white action text from its selected accent through `contrastText`; do not hard-code this default across custom themes.

### Neutral

- **Ivory Paper**, **Inset Paper**, **Brown Ink**, **Secondary Ink**, and **Paper Rule** correspond to `paper`, `panel`, `ink`, `secondary`, and `rule`.
- Reader presets are light, sepia, warm, coffee, dark, dim, and eink. Sepia uses the default paper/ink/accent. Light shares the default accent. Eink uses black for both ink and accent. Other triplets use their matching frontmatter names. Custom palettes remain reader choices.
- The book page has separate book-dark paper, ink, accent, secondary, and rule values. These intentionally differ from the reader-dark triplet.
- Reader rules use translucent ink mixes (12–22% by context). Selected controls use translucent accent mixes; filled segmented/theme selections use the full accent.
- Eight annotation presets remain source-defined by `annotationColors` in `src/lib/reader.ts`; they are note colors, not replacement theme accents.

**The Paper and Ink Rule.** Reader surfaces, text, rules, and controls follow the active reader palette. Preserve the separate book-page dark palette.

### LOCAL TT palette and warm editor extension

- **Graphite Ground**, **Teal Panel** and **Control Slate** are `comic-ground`, `comic-panel` and `comic-control`: image stage, perimeter panels and settings controls, separated by tone.
- **Pale Slate Ink** and **Readable Muted Slate** are `comic-ink` and `comic-muted`. **Cyan** (`comic-accent`) marks selection, focus, range thumbs and progress. `comic-selected` and `comic-hover` hold selected/hover fills; `comic-rule`, `comic-range` and `comic-backdrop` hold dividers, slider tracks and the native modal backdrop.
- The final muted token on Control Slate measures **4.776763:1**, as recorded by the fix verdict. Preserve this enabled-text/placeholder pair. Disabled controls retain opacity 0.38. This measurement does not certify every incidental color pair.
- Editor actions reuse `accent`, `button-ink`, `ink`, `secondary`, `paper` and `rule`. `editor-inset` separates rails/inspector, `editor-field` holds fields/cards, and `editor-upload` / `editor-upload-rule` mark the dashed upload target. `editor-rule` separates rows, `editor-selected` identifies the chapter and `editor-primary-hover` supplies darker vermilion.

These scoped values are not new VI/EN theme presets. Translucent phone panels remain source-defined overlays. No invented tonal ramps were added.

## Typography

**Display and Reading Font:** Literata Variable, with Georgia and serif fallbacks.  
**Control Font:** Be Vietnam Pro, with sans-serif fallback.

Both families are self-hosted through packages imported by the root layout. Literata supplies literary texture and Vietnamese legibility; controls use a quieter sans serif.

### Hierarchy

- **Display:** book title; base clamp in frontmatter, then explicit sizes at the 1100px and 900px breakpoints; 43px/1.2 on phones.
- **Headline:** table-of-contents heading; 27px on phones.
- **Chapter title:** centered; 23px/1.65 on phones. Paged mode uses 21px on desktop and 19px on phones; the phone paged heading truncates to one line.
- **Reading default:** 20px, 1.9 line height, preferred width 780px, supplied through inline settings. The phone stylesheet's 19px fallback does not override an explicit reader preference. Font size is constrained to 14–36px, line height to 1.2–2.6, and preferred width to 480–1200px.
- **Summary:** serif introduction; 15px/1.9 on phones.
- **Body and label:** 14px interface base; 12px language/field labels, with local 10–13px panel labels. These are interface text, not reading-text defaults.
- **Byline:** normal spacing immediately below the title; 12px on phones. Preserve the author metadata rather than adding a decorative label.

**The Title Then Author Rule.** Keep the author immediately below the book title in normal letter spacing. Do not turn it into an eyebrow or tracked kicker.

### LOCAL TT typography

Reader controls use self-hosted Be Vietnam Pro (`comic-body`); native dialog h2 headings retain the global Literata family (`comic-dialog-title`), visible in both language captures. Uppercase settings labels use `comic-section-label`; this scoped reference-led tracking does not alter the book byline rule. The one-line chapter widget uses `comic-chapter-label` (10px on phones). Chapter-list titles/subtitles use the final `comic-chapter-title` / `comic-chapter-subtitle` roles. Ancillary numeric values are 10px; choice controls are 11px, 10px on phones. Readouts use tabular figures.

The editor h1 uses `editor-heading` (26px on phones); its book title is Literata at 20px, 15px on phones. Upload/page-list/inspector/chapter-rail h2 headings retain Literata. Other UI uses `editor-body`, `editor-action` and `editor-field`. At 759px and below, editor text inputs/selects and comic chapter search/source select use 16px text to avoid focus zoom. This final override supersedes their compact desktop sizes.

## Layout

The desktop book uses a centered main container (maximum 1192px including padding), with a 340px maximum cover track, flexible introduction, and 98px gap. Header/footer cap at 1360px. Ruled contents use two columns with a 55px gap. At 1100px and 900px, cover width, title, and gap step down.

At 600px and below, the book stacks vertically: centered cover (60% width, capped at 220px), centered introduction, one-column contents, and 24px main gutters. The author stays below the h1. The header ellipsizes a long wordmark while preserving the action group.

The reader fills the dynamic viewport. Its desktop top bar is 60px high, with an optional 310px rail (280px at the intermediate breakpoint), a centered reading column, and 35px progress row. The column combines preferred width with responsive gutters. Double-page reading uses up to 1280px; phones resolve double-page mode to a single page.

At 900px and below, the chapter rail becomes a dismissible overlay drawer, up to 340px or 86vw wide. At 600px and below, the top bar is 92px high: the action area is a six-column grid with two rows and 40px minimum columns, and VI/EN occupies a two-column group. Drawer and backdrop begin below the bar. The phone progress row is 44px high.

Settings are independently scrollable and constrained to viewport width/height. On phones the panel begins at 98px, below the toolbar, with maximum height equal to the dynamic viewport minus 110px. Preserve the later mobile overrides rather than copying superseded declarations.

Spacing is contextual, not a universal four-pixel grid: compact controls use 3–10px gaps, page and reading gutters differ, and book margins deliberately exceed control spacing.

### LOCAL TT viewports and density

The image stage fills 100dvh, begins at the viewport top and scrolls independently with contained overscroll. Fresh defaults are vertical, stretch on, and 50% viewport-width images on desktop / 100% below 760px. Saved preferences win. Stretch off caps at intrinsic width; zoom is bounded to 10–200% in 5-point steps. The adjustable strip gap is 0–100px, default zero.

Desktop language navigation begins 14px left / 12px top. The one-line chapter box is 176×34px at 12px top/right. The rail begins 56px top / 12px right, with 36px icons, 17px SVGs and 2px padding. Chapter arrows and zoom use 34px desktop controls; 36px describes the base rail button, not every control. Stretch/zoom sits bottom-right with 12px insets. The reader has no thumbnail drawer or bottom image-page counter. Chapter-list availability totals and editor counts retain their contextual purpose.

Centered native settings/help dialogs are 480px wide; chapters is 560px. Desktop max-width is viewport minus 28px, max-height the lesser of 720px and viewport minus 48px, header 54px; the body scrolls internally. At 759px and below, dialogs fit viewport minus 24px horizontally / 32px vertically, with a 52px header and 14px body gutters. Final phone rules give language links, rail icons, chapter-widget height, zoom, close, settings choices/steppers/ranges and chapter filters/sort/pagination 44px targets or heights. Chapter arrows remain 36px wide in a 44px-high widget; this is not a universal 44px-square claim.

Final measured settings rectangles are 480×720px at x 698/y 142 on desktop 1876×1004 and 366×812px at x 12/y 16 on phone 390×844. Rail size is 40×292px desktop / 46×354px phone. Chapter filters wrap on phones, list rows scroll and the active chapter stays visible. Ten chapter records appear per list page; this pagination is independent of image progress.

The editor has a 76px top bar, 35px local-status strip and remaining workspace height. Desktop columns are 218px / flexible / 284px with inspector, two columns without it. At 1200px the open-inspector grid becomes 190px / flexible / 240px. At 1000px the inspector floats over two columns. At 759px the layout is one column, header 70px, chapter drawer below the combined 105px header/status rows and inspector at the bottom. Workspace padding moves from 30px 32px to 26px 24px at 1200px and 24px 16px on phones.

Page cards use auto-fill 148px minimum tracks /18px gap, minimum 140px at 1200px, then two equal phone columns /13px gap. The final metadata grid contains one full-width chapter-title field; default-direction was removed. The final phone upload target is a 46px-symbol/flexible-copy grid, with file action below copy. Status stays sticky at workspace bottom. Only the TT-enabled text reader gets a separate phone language row (132px toolbar,138px panel top); this does not replace the baseline VI/EN rules.

## Elevation & Depth

The reading page is flat; quiet rules and tinted paper separate content. The cover suggests a physical object. Temporary overlays rise above the page.

### Shadow Vocabulary

- **Book cover:** `9px 13px 28px #40372a30`.
- **Reader panel:** `0 14px 50px #0003`.
- **Mobile drawer:** `15px 0 40px #0002`.
- **Toast:** `0 6px 24px #0003`.
- **Secondary action outline:** inset `0 0 0 1px` at 25% current color; this is an outline, not ambient elevation.

**The Quiet Surface Rule.** Keep the reading page flat. Reserve shadows for the physical cover and temporary overlays.

### LOCAL TT overlay depth

The image stage/tools remain flat tonal surfaces. The native comic dialog uses `0 18px 60px #0008`; the toast `0 10px 32px #0005`. The editor's floating inspector uses `0 16px 45px #302b2333` at 1000px and below, and its phone chapter drawer `12px 0 34px #302b2330`. These local overlays extend the quiet-surface rule without lifting page-grid cards.

## Shapes

Controls are gently rounded; language, segment, control, group, and panel radii are in frontmatter. The cover has asymmetric book-like corners (`2px 5px 5px 2px`). Contents divisions use thin rules rather than enclosing every item in a card.

### LOCAL TT shapes

Rail icons use `comic-icon`; tool groups, chapter widget/rows and settings controls use `comic-control`. Dialogs reuse the 12px panel radius, changing to `comic-dialog-phone` below 760px. The 3px edge progress bar is functional. Editor fields/actions use `editor-control`, page cards `editor-page`, and upload/inspector overlays the existing 8px group radius. Dashed upload borders and contained, uncropped thumbnails distinguish editing from the reading stage.

## Components

### Buttons

Primary/secondary actions share a 44px minimum height, medium weight, and centered icons/text. The read action spreads its contents, uses 15px vertical padding, and has a minimum width of 210px (220px on phones). Secondary actions use an inset outline.

Base icon buttons are 38px square. The final phone rules enlarge the covered controls—header, toolbar, reader location, drawer/panel close, page controls, selection actions, editor tabs, and editor controls—to at least 40px. Segments, sound presets, range inputs, and annotation swatches also receive 40px phone sizing. Earlier small declarations are superseded in these contexts.

Hover uses a current-color tint; primary hover mixes accent with black. Active icons use a 15% accent tint. Disabled buttons use opacity 0.38 and the disabled cursor. Interactive elements receive a 2px accent focus outline offset by 4px.

### Fields and Segmented Controls

Panel fields use a 6% current-color tint, 20% current-color border, and 42px minimum height. Search is a borderless tinted group. Segmented groups use a 7% current-color tint and accent-filled selection with contrast-aware text. Theme choices form a four-column grid with 64px-minimum tiles. Annotation swatches have 40px phone targets.

### Navigation

VI/EN links carry the same chapter identity across editions, with an explicit active state, restrained divider, and language labels. Each phone target is at least 40px in both book header and reader toolbar.

The contents list is ruled. Sidebar chapter links use a 13% accent tint for the current page; long lists scroll independently. Labelled SVG icon buttons provide compact actions without text glyphs.

### Reader Panel and Feedback

Panels use tinted active paper, rounded corners, a heading, close button, and internal scrolling. Escape closes the panel and focus returns to the previous element. Selection/image controls scroll or wrap within the phone viewport.

Buttons transition background and color over 150ms. There is no implemented paper-fade on language change. Reduced-motion and eink rules disable animation/transitions. Empty, missing-translation, error, and locked-admin surfaces retain the paper/ink vocabulary. Supplied review screenshots evidence only the locked admin, not an authenticated editor session.

### LOCAL TT reader controls and dialogs

Labelled SVG actions cover book page, same-chapter text, local editor, chapters, fullscreen, auto-scroll play/pause, settings and help. VI/EN/TT navigation highlights TT. The chapter widget contains only `Chương 1` / `Chapter 1`, without a story subtitle. Stretch and percent zoom/reset remain bottom-right. Hover uses slate; selected controls cyan on selected teal. Focus is 2px cyan with3px offset; disabled opacity 0.38.

Native dialogs contain focus, close with Escape and restore prior focus. Settings expose vertical/LTR/RTL choices, strip margin, fast/smooth keyboard scrolling with viewport-percent steps, auto speed 20–600px/s, progress edge/hidden, partial/all preload, grayscale and dim 0–100%. Defaults:vertical, gap 0, fast 100% keyboard step,150px/s, left progress, partial preload, grayscale off, dim 0. Persisted settings/stable image-ID positions are separate from text settings. The editor has no default-direction control; the retained draft model is not an exposed setting.

Chapters use search, sample/local/missing sources, chapter/title/actual-update sort, image-only navigation, active highlight and pagination. Search folds accents. Show existing titles and real page availability without invented groups/dates. Missing-page, retry, empty-search and help states retain this palette.

Chrome transitions opacity 180ms ease-out; dialogs enter 130ms ease-out with a 5px lift. Chrome hides after 3 seconds idle unless modal/hover/focus requires it. Activity, center/blank contact,44px wake and tab return reveal it. Blur/hidden/freeze/pagehide stop auto-scroll; return never restarts it automatically. Dialogs pause movement. Reduced-motion disables decorative transitions/animation and smooth scrolling; explicit user-triggered auto-scroll remains available.

### LOCAL TT upload workbench

The editor preserves paper/vermilion actions. It exposes one chapter-title field, dashed drop zone/file picker, ordered thumbnail grid and selected-page inspector. File types/limits appear beside upload; contained thumbnails preserve aspect ratio. Filename, dimensions and byte totals stay visible. Active borders and selected fills differ. Drag ordering also has labelled move buttons; selection, delete/undo, replacement, filename sort, sample reset, local save and actual saved reader preview are concrete actions.

Primary actions have 44px minimum height. Phone save/preview become 44px labelled icon buttons. Card move/delete buttons are 42px square; selection rows 40px high, so the editor is not universally 44px. Upload border/background and card border/fill transitions take 150ms; phone drawer 180ms ease-out. Reduced-motion disables these. Keep loading/busy/error/retry/dirty/saved states and local-only wording. Atomic IndexedDB save is not publication.

## Do's and Don'ts

### Do:

- **Do** preserve the supplied cover and the approved ivory, brown, and vermilion world.
- **Do** place the author below the book title with normal letter spacing.
- **Do** preserve the two-row phone toolbar, grouped VI/EN control, and 40px minimum targets in the covered phone controls.
- **Do** keep settings scrollable, keyboard focus visible, and reduced-motion handling intact.
- **Do** let chosen reader typography and colors govern the text; distinguish defaults from preferences.
- **Do** re-extract values when code changes and check the final applicable media rule.

### Don't:

- **Don't** introduce synthetic cover art or promote cover blue into a new interface palette.
- **Don't** add decorative eyebrows, tracked author labels, or extra display faces.
- **Don't** shrink reading text to fit a viewport or screenshot.
- **Don't** claim a paper-fade animation that the code does not implement.
- **Don't** infer hosted authentication, storage, or publishing verification from the locked admin screen.

### Footnotes — user refinement 28/10/2026

Inline note references use blue superscript digits (0.7em, line-height 1), #3366cc on light paper and #8ab4f8 on dark paper. This requested citation color is an exception to the vermilion control palette. Parentheses remain in DOM text for stable anchors and are visually zero-sized. Legacy missing endnote labels use generated content without changing stored text. The hover/focus preview reuses the tooltip surface with reader paper/ink, 360px width, 14px/1.65 text, internal scrolling and hoverable pointer handling. Clicking/tapping follows existing fragment navigation, focus and Back; Escape/scroll dismisses the preview.

### Book presentation — 28/10/2026

Reader settings adds Ebook / Sách above themes. Book is an opt-in surface using current paper/ink/fonts, a centered 0.72 leaf ratio (1.44 spread), quiet desk, subtle spine, printed first-leaf chapter heading, folios and full-size edge arrows. The title is visual generated content with the existing accessible heading, keeping source text offsets unchanged. Desktop contents is a drawer instead of shrinking paper; bottom controls group contents, first/previous/next/last and Ebook return. Phone uses one leaf, 44px controls, 12px page count and hides duplicate shortcuts below 380px. StPageFlip provides a real 450ms soft fold with front/back text and shadows, isolated from live text; paper opening fades/shadow settles for 180ms and edge glyphs move 3px on hover. Reduced motion/e-ink remove animation. No cover/content/assets are copied from Hanhtrangso.

### Direct paper gestures — 29/10/2026

PC primary mouse pulls start in a 28px outer paper strip, with a grab cursor; the central text keeps native selection. Phone primary horizontal input resolves after 10px, retaining vertical pan/pinch behavior. A single isolated old/new spread folds with displacement while held. An inward release beyond 64px commits one turn with a 220ms cubic settle; a short pull returns. Selection, second pointers, cancellation, Escape, resize and visibility interruptions cancel the preview. The live text/progress changes only on commitment. Mouse and touch preview fresh adjacent chapter pages too.

Phone Book footer fades/slides down after 3 seconds idle, preserving its grid row. A 44px bottom wake surface with a quiet 36px handle, or a tap on actual blank paper/desk, reveals it. Hidden controls are inert; keyboard focus, open panels, contents and selection keep controls available. Desktop/Ebook/PDF chrome is unchanged; reduced motion/e-ink disable decorative motion. No additional vendor/dependency.

### Mobile reliability and footnote preview — 29/10/2026

Accepted touch releases commit semantic page state immediately, separately from the 220ms visual settle; desktop mouse retains its existing settle timing. Pending accepted touch turns survive chapter restoration in order and clear on explicit navigation/settings/locale/lifecycle interruption. Short flicks use recent pointer velocity rather than renderer time; cancelled, reversed and vertical gestures retain their guards. Single-leaf forward folds replace the vendor's temporary front-face copy with the target leaf, using public page APIs. CSS copied into disposable contexts is cached per themed/font-configured renderer instance.

Touch note cards reuse the paper/ink preview at 360px maximum width. A pinned nonmodal dialog adds a 44px close target and internal scrolling; padding reserves space for that control. Touch pointerup works without compatibility click; subsequent generated clicks cannot toggle or navigate twice. Mouse/keyboard clicks on PC keep fragment navigation. Outside contact, Escape, reader scrolling, resize or popstate dismiss; gestures inside the card do not move the book. No new dependency or source-text/storage change.

### LOCAL TT guardrails

- **Do** scope graphite/cyan to the image reader and preserve warm editor/book/text palettes.
- **Do** apply final phone rules, centered dialogs, visible focus, reduced motion and restored tab-return tools.
- **Do** label browser-local drafts and illustrative sample art; preserve original PNG pixels, embedded prompts and provenance.
- **Do** retain editor/chapter-list counts in context; the reading stage has no bottom image counter or thumbnail drawer.
- **Don't** treat TT as a locale, change text preferences or restore the removed default-direction control.
- **Don't** invent groups/dates, a complete adaptation, connected auth/storage or Publish.
- **Don't** promote the two-fix local ship verdict into whole-surface/production approval.
- **Don't** repair pre-existing cover/art provenance drift in this extension; the supplied cover remains outside TT asset scope.
