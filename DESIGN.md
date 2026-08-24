---
name: MeticleCare Marketing Site
description: Editorial-operations landing world for a UK care platform — deep navy + a single emerald accent on warm bone grounds, hairline-framed product windows, Inter, charcoal ink.
colors:
  navy: "#0F4C81"
  navy-deep: "#0A3A63"
  emerald: "#10B981"
  emerald-deep: "#047857"
  emerald-hover: "#065F46"
  ink: "#1B2430"
  ink-dark: "#141C24"
  ink-deep: "#1D2733"
  bone: "#F7F4EE"
  mist: "#5B6672"
  hairline: "#E7E1D6"
  text-deep: "#3A4551"
  outline-button-border: "#C9C2B4"
  window-border: "#E0D9CA"
  window-chrome: "#FCFAF6"
  window-chrome-line: "#F0EBE1"
  button-on-navy: "#FFFFFF"
  button-on-navy-hover: "#F3F1EA"
  foot-muted: "#8E98A3"
  foot-heading: "#E8EBEE"
  foot-hairline: "rgba(255,255,255,0.12)"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Inter, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "3.4rem"
    fontWeight: 900
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "2.7rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
  body:
    fontFamily: "Inter, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.12rem"
    lineHeight: 1.7
  label:
    fontFamily: "Inter, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 800
    letterSpacing: "0.08em"
    fontFeature: "uppercase"
rounded:
  sm: "8px"
  md: "16px"
  lg: "24px"
spacing:
  base: "8px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  section: "56px"
  section-xl: "60px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
  button-primary-hover:
    backgroundColor: "{colors.navy-deep}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
  button-cta:
    backgroundColor: "{colors.emerald-deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "15px 28px"
  button-cta-hover:
    backgroundColor: "{colors.emerald-hover}"
  button-on-navy:
    backgroundColor: "{colors.button-on-navy}"
    textColor: "{colors.navy}"
    rounded: "{rounded.sm}"
  button-on-navy-hover:
    backgroundColor: "{colors.button-on-navy-hover}"
  button-text-link:
    backgroundColor: "transparent"
    textColor: "{colors.navy}"
    rounded: "{rounded.sm}"
  nav-link:
    textColor: "{colors.mist}"
    typography: "{typography.body}"
  cap-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "20px 0"
  framed-window:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
---

# Design System: MeticleCare Marketing Site

## Overview

**Creative North Star: "The Editorial Care Console"**

MeticleCare is a connected care-management platform for UK supported living providers, and its marketing surface is built as an honest, editorial operations desk rather than a SaaS product page. The world refuses the metric-stacked, icon-card SaaS default and the floating-dashboard hero: there are no stat badges, no icon grids, no product screenshots drifting on gradients. Instead the dashboard is *seated* — framed in a window with a chrome bar and a warm card beneath it, on a bone ground, like a photograph on a desk.

The palette is a strict two-key system: deep navy **#0F4C81** carries identity and authority, a single emerald **#10B981** is the only accent, and everything else lives on the warm side — bone **#F7F4EE** grounds, white alternating bands, charcoal ink **#1B2430** text, and hairline **#E7E1D6** editorial rules. Typography is Inter across all nine weights (400–900), set tight: hero headlines at weight 900 with `-0.03em` tracking, section heads at 800 with `-0.025em`, secondary copy in mist **#5B6672** at relaxed 1.55–1.75 line heights. Depth is carried almost entirely by a small vocabulary of deep ink shadows (`rgba(20, 32, 45, …)`) that seat framed product windows and floating toasts; surfaces are otherwise flat.

Motion is deliberately quiet. The page authors exactly one entrance — the hero visual column rises 24px and fades in over 0.9s — and a single persistent life cue, a pulsing "Live" dot in the window chrome. Everything else is hover-state micro-motion. Under `prefers-reduced-motion: reduce`, the entrance is skipped entirely (content is rendered instantly) and the pulse animation is disabled. The whole surface alternates warm bone and white bands in a fixed rhythm, separated by hairlines, telling one story: a care manager believes the entire working day — rota, medication, notes, compliance — can run from one honest, connected platform, and acts to start a trial.

**Design Contract** (pinned in `apps/web/index.html`, body comment — quoted verbatim):

> **THESIS:** One connected platform for UK care operations; refuses the metric-stacked, icon-card SaaS default and the floating-dashboard hero.
> **OWN-WORLD:** Deep navy #0F4C81 with emerald #10B981 as the only accent, warm bone grounds, charcoal ink, Inter, editorial hairlines, framed product windows seated on warm surfaces.
> **STORY:** A care manager believes the whole working day — rota, medication, notes, compliance — can be run from one honest, connected platform, and acts to start a trial.
> **FIRST VIEWPORT:** Left, the navy headline "Run your care operations from one connected platform.", a short sub, two actions. Right, the live dashboard seated in a window on a warm surface with a care-note toast. No badges, no stats.
> **FORM:** brief-pinned editorial-operations world. **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md

**Key Characteristics:**
- Strict two-key color system: navy identity + single emerald accent; everything else warm neutral.
- Warm bone/white alternating section bands with editorial 1px hairlines.
- Product UI is always framed — never floating, never on gradients.
- One authored entrance per viewport; reduced-motion skips it entirely.
- Inter across 400–900; tight tracking on display heads (`-0.03em`/`-0.025em`).
- Charcoal ink text on warm grounds; mist secondary copy; opacity layering only on dark navy/ink bands.
- Keyboard reachable everywhere: nav, mega-menu links, capability rows all handle Enter/Space with a 2px emerald focus-visible ring.

## Colors

A two-key palette on a warm neutral base: deep navy is the identity and the only "brand" color, emerald is the single accent reserved for small marks, and the bone/hairline/mist/ink family supplies the editorial furniture.

### Primary
- **Deep Navy** (#0F4C81): The identity color. Logo wordmark "Meticle", primary CTA fills, the navy compliance band, 16px timeline step dots, the active nav-link color, and `theme-color` in `index.html` (line 8). Paired with white it is the button/paper contrast pair.
- **Navy Deep** (#0A3A63): Primary-button hover (`&:hover: { bgcolor: NAVY_DEEP }`, hero CTA and nav "Start free trial"). Navigation hover for all interactive states.

### Secondary
- **Emerald** (#10B981): The single accent. Appears only as small square markers (7×7–10×10px, radius 8px), the 2px top rules on trust cards, the underline of the active window-chrome tab, the pulsing "Live" dot, the focus-visible ring, and the checkmark circle of the care-note toast. Its rarity is the point.
- **Emerald Deep** (#047857): Final-CTA button fill and the capability-row arrow hover color. **Emerald Hover** (#065F46) is the final-CTA hover. Used only inside the ink-dark closing band.

### Neutral
- **Charcoal Ink** (#1B2430): Primary text on all light grounds — hero h1, section heads, row titles, body emphasis, the logo "Meticle" half. On white it reads ~15:1, on bone ~13:1 (both AAA).
- **Ink Dark** (#141C24): The closing CTA band background and the footer background. Darkest surface in the system.
- **Ink Deep** (#1D2733): The footer's bottom legal bar (a hairline-separated darker strip under the footer content).
- **Bone** (#F7F4EE): The warm ground. Hero, Core Capabilities, and Role-Based Benefits section bands; the dropdown hover fill; the warm "desk" under framed product windows. Alternate bands are white `#FFFFFF`.
- **Mist** (#5B6672): All secondary/tertiary copy on light grounds — subs, descriptions, meta lines, inactive nav links, inactive window tabs, footer-muted equivalent on dark. Passes AA on both white (~5.9:1) and bone (~5.4:1).
- **Text Deep** (#3A4551): The role-benefits bullet copy (a slightly softened ink for body-weight reading).
- **Hairline** (#E7E1D6): The 1px editorial rule on light grounds — section separators, nav bottom border, capability-row rows, role-row rows, showcase rows, toast border.
- **Outline Button Border** (#C9C2B4): Hero "See how it works" outline border; hover swaps to ink with `rgba(27,36,48,0.04)` fill.
- **Window Border** (#E0D9CA): The 1px frame around framed product windows (darker than hairline, reads as "frame").
- **Window Chrome** (#FCFAF6): The window title-bar fill; **Window Chrome Line** (#F0EBE1) is its bottom hairline.
- **White** (#FFFFFF): Alternating section bands, window canvas, button-on-navy fill.
- **Foot Muted** (#8E98A3): Footer body links and legal text on ink-dark (~6:1 AA); hover flips to white `#FFFFFF`.
- **Foot Heading** (#E8EBEE): Footer column category labels.
- **Foot Hairline** (`rgba(255,255,255,0.12)`): The 1px divider on dark bands (footer content/legal split; the navy compliance band uses `rgba(255,255,255,0.24)` for row rules).
- **Step Connector** (`rgba(16,185,129,0.4)`): The 40%-alpha emerald line joining the five Connected Operations steps.

### Named Rules
**The One Accent Rule.** Emerald #10B981 appears only as small marks — square dots, 2px rules, the live dot, the focus ring. It never fills a section band and never sets paragraph text. Its rarity is the point.

**The Two-Key Rule.** Navy is the identity, emerald the accent, and everything else is warm neutral. No third hue enters the system anywhere in the landing build.

## Typography

**Display & Body Font:** Inter — loaded from Google Fonts at weights 400, 500, 600, 700, 800, 900 (`apps/web/src/index.css:1`), body default `'Inter', sans-serif` (`index.css:39`). The MUI theme stack is `"Inter", "Roboto", "Helvetica", "Arial", sans-serif` (`ThemeContext.tsx:69`).
**Label/Mono Font:** none — every surface is Inter, differentiated by weight, tracking, and case, never by face.

**Character:** An editorial-operations voice. Display heads are set tight and heavy (900/800) with negative tracking, short line lengths (maxWidth 520–720px), and crisp 1.06–1.15 line heights. Body copy is relaxed (1.55–1.75 line height) in mist, capped at 56ch-ish maxWidths. Labels are small-caps-style eyebrows: uppercase, navy, 0.08em tracking. The pairing sells "serious care software written by people who read paper" — no rounded techno face, no display serif.

### Hierarchy
- **Display** (900, 3.4rem at md / 3rem at sm / 2.4rem at xs, 1.06 line height, `-0.03em`): Hero h1 only — "Run your care operations from one connected platform.", maxWidth 560. The Final CTA head is the same voice at 900 / 3rem md / 2.1rem xs / 1.08 line height / `-0.03em`.
- **Headline** (800, 2.7rem at md / 2.1rem at xs, 1.12 line height, `-0.025em`): Section h2s ("Everything a care team does, in one working set.", "The shift, connected end to end.", "One platform, shaped for each part of the day."). Two variants run slightly smaller: "Built for the way care actually runs." at 2.4rem md / 2rem xs / 1.15 / `-0.02em`, and "One view of the working day." plus "Compliance, supported by the records you keep." at 2.5rem md / 2rem xs / 1.12 / `-0.025em` / `-0.02em`.
- **Title** (800, 1rem): Row titles in the capability index, connected-operations steps, showcase rows, and compliance rows. Role headings step up to 1.6rem md / 1.4rem xs at weight 800, line-height 1.2. Window chrome titles are 0.85rem weight 800.
- **Body** (400 default; 1.12rem lead, 1.7 line height, maxWidth 520): hero sub and final-CTA sub. Secondary body runs 0.86–0.98rem at 1.55–1.75 line height in mist; emphasized rows use weight 500–700 in ink.
- **Label** (800, 0.8rem, 0.08em, uppercase): Capability-group eyebrows ("Care & medication", "People & operations", "Compliance & oversight") and section eyebrows. Footer/nav categories use the same uppercase-800-navy voice at 0.66rem with 1px letterSpacing (nav mega menu) and #E8EBEE (footer).
- **Meta** (600, 0.7–0.9rem): Trial lines ("14-day free trial · No credit card required"), hero caption, "Live", footer legal.

### Named Rules
**The Inter-Only Rule.** No second typeface anywhere in the marketing build. Hierarchy comes from weight (400–900), tracking, size, and case — never a face change.

**The Tight-Head Rule.** Every display and headline sits at negative tracking (`-0.02em` to `-0.03em`) with a max width. Never re-expand a headline to fill a column.

## Layout

The marketing shell (`MarketingLayout.tsx`) is a fixed full-height flex column: `<NavHeader />`, a content region padded below the fixed app bar (`pt: { xs: '64px', md: '72px' }`), and a footer. Routes scroll to top on navigation (`window.scrollTo(0, 0)` on `pathname` change). All content rides MUI's `Container maxWidth="lg"` (1200px).

**Rhythm.** Sections are full-width horizontal bands that alternate **Bone** and **White** and run on a single vertical padding scale: `py: { xs: 9, md: 14 }` (36px / 56px) for every content band; the hero runs `pt { xs: 7, md: 10 }` / `pb { xs: 10, md: 14 }`; the closing CTA runs `py { xs: 11, md: 15 }` (44px / 60px). Adjacent bands are separated by a 1px hairline (`borderBottom: 1px solid #E7E1D6`) rather than whitespace alone at the hero boundary. Inside sections, head-to-content gap is `mb { xs: 7, md: 9 }` (28px / 36px).

**The section structure — ten bands top to bottom (nav and footer included):**
1. **Nav** (`NavHeader.tsx`) — fixed glass app bar over the page.
2. **Hero** (Bone) — two-column: left the navy-display headline, sub, two CTAs, trial meta; right the framed dashboard window with chrome, pulsing Live dot, and the care-note toast. `borderBottom: 1px solid #E7E1D6`.
3. **Trust & Value** (White) — "Built for the way care actually runs." left of a 2×2 grid of four emerald-topped mini-cards (`borderTop: 2px solid #10B981`, `pt: 2.5`).
4. **Core Capabilities** (Bone) — the capability index: three groups (Care & medication / People & operations / Compliance & oversight), each a sticky emerald-dot eyebrow column (sticky at `top: 96`) beside a hairline-stacked list of six selectable `CapRow`s.
5. **Connected Operations** (White) — "The shift, connected end to end." over a five-step timeline: 16px navy dots joined by `rgba(16,185,129,0.4)` connectors (vertical on mobile, horizontal on md+), then a hairline-top strip with an ink summary and a navy text-link "See how it works".
6. **Role-Based Benefits** (Bone) — four hairline-separated rows (Registered managers / Care workers / Relatives & families / Owners & operations leads), each role name + navy tagline left, 7px emerald-square bullets right in a 2-column grid.
7. **Product Interface Showcase** (White) — the framed dashboard window left, three hairline-top feature rows right (8px emerald squares, "Live compliance snapshot / Today's rota / Key indicators").
8. **Compliance & Oversight** (Navy band, white text) — "Compliance, supported by the records you keep." with a white contained CTA and a white text link, right of a five-row list ruled by `rgba(255,255,255,0.24)` with 9px emerald bullets.
9. **Final CTA** (Ink Dark, centered) — "Bring your care operations together." at 900, emerald-deep primary CTA + white outline "Talk to our team", trial meta at 0.7 opacity.
10. **Footer** (`MarketingLayout.tsx`) — ink-dark, five link columns + brand blurb + regulator line, then an ink-deep legal bar split by `rgba(255,255,255,0.12)`.

**Spacing.** The MUI spacing unit is 8px; all padding/gaps are `theme.spacing` multiples: `py 1.75` = 14px, `py 2.5` = 20px, `px 5` = 20px, `p 3` = 24px, mega menu `p: 3`. Cards and rows use consistent 20px vertical breathing. Grid gutters are `spacing={{ xs: 3, md: 4–8 }}` depending on density.

**Responsive rules.** Breakpoints are MUI defaults (xs 0 / sm 600 / md 900 / lg 1200 / xl 1536). The three responsive behaviors that matter: (1) the desktop nav column disappears below `md` and is replaced by a right-anchored Drawer (width 300); (2) hero, showcase, and compliance two-column layouts stack to single columns at `lg` / `md`, respectively; (3) the Connected Operations timeline rotates from horizontal to vertical below `md`. CTA rows wrap to columns on `xs`. The hero headline steps 2.4rem → 3rem → 3.4rem across xs/sm/md; section heads step 2.1rem → 2.7rem.

## Elevation & Depth

The system is flat by default with a single, consistent source of depth: long-offset, low-alpha shadows in the same ink family (`rgba(20, 32, 45, …)`). Shadows exist to *seat* objects on warm surfaces — the framed product window and the floating toast — not to lift cards. There is no hover-lift anywhere; hover is color change and a 4px arrow slide. Tonal layering does the rest of the work: the dark navy and ink-dark bands read as "walls" against the flat bone/white bands.

### Shadow Vocabulary
- **Window — hero** (`0 32px 64px -28px rgba(20, 32, 45, 0.4)`): seats the hero dashboard window on the bone desk.
- **Window — showcase** (`0 32px 64px -28px rgba(20, 32, 45, 0.35)`): the same window, slightly softer, in the mid-page showcase.
- **Toast** (`0 20px 44px -20px rgba(20, 32, 45, 0.45)`): floats the care-note toast above the window chrome's lower edge.
- **Mega menu** (`0 24px 56px -20px rgba(20, 32, 45, 0.22)`): the Features mega menu.
- **Dropdown** (`0 20px 44px -18px rgba(20, 32, 45, 0.2)`): the About dropdown.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows are reserved for objects meant to float or seat (windows, toasts, menus) and are never used for hover feedback on cards or rows.

## Shapes

Form language is square-leaning with three levels of corner, all derived from the MUI theme base radius of 8px (`ThemeContext.tsx:75–77`, `shape.borderRadius: 8`). In MUI sx, numeric `borderRadius` is multiplied by the theme base, so `1` = 8px, `2` = 16px, `3` = 24px — the code uses exactly these three tiers plus full circles.

- **8px (`borderRadius: 1`)**: every button (theme `MuiButton` default radius), all small square markers (7×7, 8×8, 9×9, 10×10 px — effectively squircles), dropdown-list item hover fills, the mega-menu item hover fills.
- **16px (`borderRadius: 2`)**: dropdown panels, the mega menu, the care-note toast.
- **24px (`borderRadius: 3`)**: the framed product windows — the signature silhouette.
- **Circles (`borderRadius: '50%'`)**: 16px timeline dots, the 22px toast checkmark badge, the 8px "Live" dot.

**The Framed Window Rule.** Product imagery always carries the window silhouette: 24px corners, a 1px `#E0D9CA` frame, a chrome title bar (`#FCFAF6`, hairline `#F0EBE1` bottom) and, in the hero, a pulsing Live dot and overlay toast. No product screenshot ever sits flat on the page un-framed.

**Lines.** Editorial hairline 1px rules (`#E7E1D6` light / `rgba(255,255,255,0.12)` dark) separate every stacked list and band; a single 2px emerald top rule introduces each trust card.

## Components

### Buttons
- **Shape:** gently squared corners, 8px (`theme.shape.borderRadius`). Theme-wide: no box-shadow at rest or hover (`MuiButton` overrides, `ThemeContext.tsx:78–87`), default padding `10px 24px`, `textTransform: none`.
- **Primary (navy):** fill #0F4C81, white text, weight 800, `px { xs: 4, sm: 5 }` / `py 1.75` (~16–20px × 14px), 1rem. Hover fills #0A3A63. Used for hero "Start your free trial" and nav "Start free trial".
- **CTA (emerald):** fill #047857, white text, weight 800, 1.05rem, `py 1.9`, wider `px`. Hover fills #065F46. Used only inside the ink-dark Final CTA band.
- **On-navy (white):** fill #FFFFFF, navy text, weight 800; hover fill #F3F1EA. Used on the navy compliance band.
- **Outline:** 1px #C9C2B4 border, ink text, weight 700; hover swaps border to ink with `rgba(27,36,48,0.04)` fill. On ink-dark the variant is white text with `rgba(255,255,255,0.4)` border, white border + `rgba(255,255,255,0.06)` fill on hover.
- **Text link:** navy, weight 800, `textTransform: none`, zero horizontal padding; hover underlines (`textDecoration: 'underline'`) with transparent background. "See how it works" and "Explore reporting →".
- **Focus:** marketing buttons inherit MUI's default focus-visible behavior; interactive text rows and nav links carry the explicit 2px solid #10B981 ring (`outlineOffset: -2` to 4).

### Eyebrow Labels
A 10px emerald square (8px radius) + uppercase navy label at 800, `letterSpacing: 0.08em`, 0.8rem. Labels the three capability groups and anchors section intent. The nav mega menu uses the same voice at 0.66rem with 1px tracking.

### Framed Product Window
The signature component. 24px corners, `overflow: hidden`, 1px #E0D9CA frame, white canvas, `0 32px 64px -28px rgba(20,32,45,…)` shadow. The chrome bar is #FCFAF6 with a #F0EBE1 hairline, holding a 10px navy brand square + 0.85rem ink wordmark, mock tabs ("Rota / eMAR / Compliance"; active tab is navy with a 2px emerald underline), and a pulsing 8px emerald "Live" dot. The hero variant floats a care-note toast over the chrome's lower-left corner.

### Capability Row (CapRow)
The capability index's interactive line: `role="link"`, `tabIndex={0}`, Enter/Space navigates. A 0.98rem ink title (weight 700) + 0.88rem mist description left, a 20px mist arrow right. Hairline bottom rule, `py 2.5`. Hover slides the arrow 4px right and recolors it #047857; the title recolors #0F4C81 (0.15s ease). Focus-visible draws a 2px solid #10B981 ring inset 2px.

### Timeline Dots & Connectors
16px navy circles for each of the five Connected Operations steps, joined by 2px `rgba(16,185,129,0.4)` rules — horizontal 2px-wide rows on md+, vertical 2px-wide columns on xs. Step titles at 1rem/800, descriptions at 0.86rem capped at 200px.

### Toast
White, 16px corners, 1px hairline, `0 20px 44px -20px rgba(20,32,45,0.45)`; a 22px emerald circle holding a 14px white check; an 800-weight ink title ("Care note recorded") over a 0.7rem mist sub-line. Fades in after the hero entrance (`opacity 0.6s ease 1.05s`).

### Navigation
- **App bar:** fixed, `elevation: 0`, `rgba(255,255,255,0.94)` with `backdropFilter: blur(12px)`, 1px hairline bottom border.
- **Brand:** "Meticle" in navy 900 + "Care" in emerald, 1.35rem, `letterSpacing: -1.5px`.
- **Desktop links:** body2 (0.875rem), weight 600, mist; hover and active states navy. Dropdown caret via ExpandMore icon. Keyboard: `tabIndex={0}` with Enter/Space navigation and a 2px emerald focus ring.
- **Features mega menu:** 760px, 3 equal columns, white, 16px corners, hairline border, the deep menu shadow, `p: 3`. Column heads are the eyebrow voice; items are 0.82rem weight 500 mist with bone/navy hover fills. Reveal: opacity + visibility + 4px translateY over 0.18s on parent hover.
- **About dropdown:** 220px min-width, same reveal and language.
- **Mobile:** right Drawer (width 300) with the brand, hairline, a List of top-level items, expand/collapse for Features/About, bone hover fills, then Login and navy "Start free trial". Features render as collapsible uppercase category blocks.

### Footer
Ink-dark band, ink-deep legal bar. Brand + one-line blurb + regulators caption ("CQC · CIW · Care Inspectorate · RQIA") in a 4-col slot, then five link columns (Product / Solutions / Company / Resources / Legal) with #E8EBEE uppercase captions (800, 1px) and #8E98A3 links that flip white on hover. Legal bar repeats Privacy/Terms/Cookies at 0.85rem in foot-muted.

## Do's and Don'ts

### Do:
- **Do** keep every product screenshot inside a framed window (24px corners, 1px #E0D9CA, chrome bar, deep ink shadow) — never flat, never on a gradient.
- **Do** reserve emerald #10B981 for small marks, 2px rules, the live dot, and the focus ring; let navy #0F4C81 carry identity.
- **Do** alternate section bands Bone #F7F4EE and White, and separate stacked rows with 1px #E7E1D6 hairlines.
- **Do** set display heads at 900/800 with negative tracking and a maxWidth (520–720px); set secondary copy in mist #5B6672 at relaxed line heights.
- **Do** author a single page entrance, skip it under `prefers-reduced-motion`, and keep all other motion as hover micro-states.
- **Do** keep buttons shadow-free at rest and hover, squared at 8px, and padded on the 8px spacing grid.

### Don't:
- **Don't** add a third hue — no teal, no purple, no red accents on the marketing surface. Two keys only.
- **Don't** float product imagery, and don't use stat badges or icon-card grids in the hero.
- **Don't** re-expand headlines to fill columns; tight tracking and a max width are the voice.
- **Don't** lift cards with hover shadows; change ink/border color and let the arrow slide 4px instead.
- **Don't** use a second typeface — Inter at 400–900 is the entire scale.
