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
rounded:
  language: "4px"
  segment: "5px"
  control: "6px"
  group: "8px"
  panel: "12px"
spacing:
  tight: "3px"
  compact: "6px"
  control-gap: "10px"
  section: "20px"
  reading-gutter-phone: "20px"
  page-gutter-phone: "24px"
  page-gutter-desktop: "46px"
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

## Layout

The desktop book uses a centered main container (maximum 1192px including padding), with a 340px maximum cover track, flexible introduction, and 98px gap. Header/footer cap at 1360px. Ruled contents use two columns with a 55px gap. At 1100px and 900px, cover width, title, and gap step down.

At 600px and below, the book stacks vertically: centered cover (60% width, capped at 220px), centered introduction, one-column contents, and 24px main gutters. The author stays below the h1. The header ellipsizes a long wordmark while preserving the action group.

The reader fills the dynamic viewport. Its desktop top bar is 60px high, with an optional 310px rail (280px at the intermediate breakpoint), a centered reading column, and 35px progress row. The column combines preferred width with responsive gutters. Double-page reading uses up to 1280px; phones resolve double-page mode to a single page.

At 900px and below, the chapter rail becomes a dismissible overlay drawer, up to 340px or 86vw wide. At 600px and below, the top bar is 92px high: the action area is a six-column grid with two rows and 40px minimum columns, and VI/EN occupies a two-column group. Drawer and backdrop begin below the bar. The phone progress row is 44px high.

Settings are independently scrollable and constrained to viewport width/height. On phones the panel begins at 98px, below the toolbar, with maximum height equal to the dynamic viewport minus 110px. Preserve the later mobile overrides rather than copying superseded declarations.

Spacing is contextual, not a universal four-pixel grid: compact controls use 3–10px gaps, page and reading gutters differ, and book margins deliberately exceed control spacing.

## Elevation & Depth

The reading page is flat; quiet rules and tinted paper separate content. The cover suggests a physical object. Temporary overlays rise above the page.

### Shadow Vocabulary

- **Book cover:** `9px 13px 28px #40372a30`.
- **Reader panel:** `0 14px 50px #0003`.
- **Mobile drawer:** `15px 0 40px #0002`.
- **Toast:** `0 6px 24px #0003`.
- **Secondary action outline:** inset `0 0 0 1px` at 25% current color; this is an outline, not ambient elevation.

**The Quiet Surface Rule.** Keep the reading page flat. Reserve shadows for the physical cover and temporary overlays.

## Shapes

Controls are gently rounded; language, segment, control, group, and panel radii are in frontmatter. The cover has asymmetric book-like corners (`2px 5px 5px 2px`). Contents divisions use thin rules rather than enclosing every item in a card.

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
