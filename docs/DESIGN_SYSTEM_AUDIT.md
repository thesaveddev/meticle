# Design System Audit & Unification — MeticleCare

**Status:** Phase A–C complete and verified; Phase D (mobile) complete for the shares it
touches; Phase E partially complete; Phase F (regression sweep of all 129 web routes) is
**partial** — see [Outstanding work](#11-outstanding-work).

**Canonical specification:** [DESIGN.md](../DESIGN.md) — tokens, typography, component
vocabulary and the generated route inventory. This document is the audit and remediation
record; it deliberately does not restate DESIGN.md's token tables except where the audit
found a deviation.

**Date:** 12 October 2026 · **Scope:** `apps/web`, `apps/mobile`, transactional email,
MICA.

---

## 1. Method

1. **Inventory first.** `apps/web/src/App.tsx` and `apps/mobile/src/screens/` were read as
   the authoritative route and screen sets (not the navigation menu, which omits
   permission-gated and conditional routes), then frozen into a generated appendix
   (`node scripts/design/audit-inventory.mjs`). Child routes are resolved against their
   parent before being reported, because a relative `<Route path="calls">` under
   `<Route path="/mission-control">` serves `/mission-control/calls`, not `/calls`.
   (Found and fixed during this audit: the first generator pass reported the literals, which
   made a six-workspace Mission Control look like two routes. The generator now scans tags
   brace-aware, so `>` characters inside `element={…}` cannot corrupt the nesting depth.)
2. **One token source of truth.** `scripts/design/palette.mjs` holds the canonical palette
   and is harvested by `scripts/design/lint.mjs`, which fails on any hex in a component
   that the token modules do not declare. The token modules themselves
   (`context/ThemeContext.tsx`, `index.css` `--mc-*`, `theme/noticeTokens.ts`,
   `styles/tokens.ts`, `styles/marketing-tokens.ts`, `mobile/src/theme.tsx`) are the
   application-facing source of truth.
3. **Migrate, don't redesign.** Preserved every layout, field, action, permission and
   navigation item; changed colour, typography, radius and state treatment in place.
4. **Guard, then verify.** Each rule earned a test that fails if a page drifts back
   (§10).

---

## 2. Route and screen inventory

Generated, not hand-written — regenerate with `node scripts/design/audit-inventory.mjs`
(it writes DESIGN.md **Appendix A** and fails the `design:check` guard when stale).

| Surface | Count | Source of truth |
|---|---|---|
| Web routes (resolved unique paths) | 129 | `apps/web/src/App.tsx` |
| Web page components | 139 | `apps/web/src/pages` |
| Web shared components | 48 | `apps/web/src/components` |
| Mobile screens | 28 | `apps/mobile/src/screens` |

The full per-branch listing (including nested paths such as `/compliance/readiness`,
`/incidents/:id`, `/family-portal/:token`, `/platform-admin/organizations/:id`, and
Mission Control's six workspace routes `/mission-control/{today,calls,staffing,compliance,care,incidents}`
plus `/mission-control` and `/mission-control/alerts`) and the 28 mobile screen names are in
DESIGN.md Appendix A.

**Inventory characteristics worth noting for regression work**

- **Public/unauthenticated surfaces** are a large fraction: marketing (`/`, `/pricing`,
  `/platform`, `/features/:slug`, `/solutions/:slug`, `/blog`, `/case-studies`,
  `/how-it-works`, `/contact`, `/download`, `/compliance-badges`), legal (5 paths), auth
  (9 paths), and tokenised surfaces (`/survey/satisfaction/:token`,
  `/survey/engagement/:token`, `/family-portal/:token`, `/family-portal/feedback/:token`,
  `/invoice/:token`).
- **Token-guarded surfaces render outside `ThemeProvider`** and therefore cannot read MUI
  theme tokens; they use the static token exports instead (`EMAIL_BRAND`,
  `NOTICE_COLORS`, `styles/tokens.ts`). Any future token work must keep those static
  exports valid.
- **Conditional routes**: several `dashboard`, `today`, `care`, `staffing`, `incidents`
  paths are workspace selectors rather than distinct pages (Mission Control tabs).

---

## 3. Design-system specification

**Where the values live** (a component must not hardcode a colour; `design:lint` enforces
it):

| Concern | Source of truth |
|---|---|
| Canonical brand palette + generated tonal ramps | `scripts/design/palette.mjs` |
| Web app colour + chart series | `apps/web/src/context/ThemeContext.tsx` (`METICLE_COLORS`, `METICLE_CHART_PALETTE`), `apps/web/src/index.css` (`--mc-*`) |
| Mode-aware notice surfaces (light/dark) | `apps/web/src/theme/noticeTokens.ts` |
| Marketing surfaces | `apps/web/src/styles/marketing-tokens.ts`, `styles/tokens.ts` |
| Mobile | `apps/mobile/src/theme.tsx` |
| Transactional email / PDF | `apps/api/src/shared/utils/email.template.ts` (`EMAIL_BRAND`, `EMAIL_TEXT`, `EMAIL_PRINT`) |
| Existing component API | `apps/web/src/components/ui/index.tsx`, `components/design/*` |
| Generated artefacts | `DESIGN.md` front-matter, `.impeccable/design.json` (`npm run design:sync`) |

**Colour.** One brand ramp derived from the shipped logo assets, plus a semantic set.

| Role | Token | Value |
|---|---|---|
| Primary | `--mc-primary` / `METICLE_COLORS.primary` | `#0164C8` |
| Primary hover / active | `--mc-primary-hover` / `-active` | `#0251B3` / `#014FB5` |
| Primary soft / subtle | `--mc-primary-soft` / `-subtle` | `#D4E6FF` / `#EAF3FF` |
| Sky | `METICLE_COLORS.sky` | `#3DB8FD` |
| Accent (mint) | `METICLE_COLORS.secondary` | `#03C6B1` (hover `#02A995`, active `#046E86`) |
| Success | `--mc-success` / soft / text | `#10B981` / `#EAFBF5` / `#087A55` |
| Warning | `--mc-warning` / soft / text | `#F59E0B` / `#FFF7E6` / `#9A6700` |
| Danger | `--mc-danger` / soft / text | `#EF4444` / `#FEF0F0` / `#B42318` |
| Ink text | `--mc-text` | `#0C1B2E` |
| Secondary text | `--mc-text-secondary` | `#51637A` |
| Border / hairline | `--mc-border` | `#E3E9F0` |
| Surface | `--mc-surface` | `#FFFFFF` (dark: `#112539`) |
| Ground | `--mc-bg` (mist ground) | `#F4F9FC` |

**Semantics are fixed, not decorative.** Red is reserved for errors and genuinely urgent
conditions, amber for warnings and upcoming deadlines, blue for primary actions and the
selected navigation item, mint for accent marks only. Status is never communicated by
colour alone — badges carry a word, and the notice tokens pair every surface with a
foreground that clears 4.5:1.

**Typography.** Inter across the whole product (web `styles/tokens.ts` `T.*`, marketing
`M.*`, mobile `theme.tsx`). Display `clamp(2.75rem, 5vw+1rem, 4.25rem)`, weight 800,
tracking `-0.035em`; H1/H2/H3 weights 700/700/600 with `-0.025em`/`-0.02em`/`-0.01em`;
body `1rem/1.65`, small `0.875rem`; labels 600 plus `0.02em`; overline/caption 700 with
`0.08em`/`0.1em`. No second typeface anywhere.

**Spacing, radii, elevation, motion.** Spacing on a 4/8px scale; radii 8/14/20/28 with the
card radius held at `--radius-lg`; shadows a five-step ramp (`--shadow-sm … xl`), flat by
default with the border carrying separation; motion 150/250/400ms on
`cubic-bezier(0.4,0,0.2,1)` (smooth: `cubic-bezier(0.16,1,0.3,1)`), honouring
`prefers-reduced-motion` for the marketing entrance and pulse.

**Breakpoints.** MUI defaults plus the responsive grid used in `Layout.tsx` and page
containers: `xs <600`, `sm ≥600`, `md ≥900`, `lg ≥1200`, `xl ≥1536`. Content container
1200px (narrow 900, wide 1400).

**Dark mode.** Tokenised, not inverted: `--mc-*` and `noticeTokens` each carry a dark
value, so surfaces, insets and notice text are re-derived rather than flipped. Covered by
`authPagesDarkMode.test.ts` and `noticeContrast.test.ts`.

---

## 4. Audit finding: three palettes were in the repository

This is the most important finding of the audit and the reason the remediation was a
migration rather than a restyle.

| Palette | Values | Where it lived | Resolution |
|---|---|---|---|
| **Retired identity** | navy `#0F4C81`, emerald `#10B981` accent, bone `#F7F4EE`, ink `#1B2430`, hairline `#E7E1D6`, `#047857`, `#0A3A63` | web pages/components, mobile screens, marketing, docs | **Removed.** These now appear only inside the guard test's denylist (`paletteAudit.test.ts`), which fails if any returns |
| **Logo-derived brand ramp** | `#0164C8`, `#014FB5`, `#149DFC`, `#3DB8FD`, `#03C6B1`, `#028ABA`, `#0187BA`, `#0C1B2E`, `#F4F9FC`, `#E3E9F0`, `#51637A` | `scripts/design/palette.mjs` (clustered from the shipped logo PNGs) | **Adopted** as the single identity across web, mobile and email |
| **Email/transactional** | primary `#2F80ED` / `#1F68C7`, neutrals `#F7F9FC` `#E4EAF2` `#101828` `#667085` `#98A2B3` | `email.template.ts` and three server-side brand defaults | **Brand blue aligned to `#0164C8`**; the neutral ramp was kept (see below) |

### 4.1 Deviation from the palette supplied in the brief — recorded, not silently taken

The brief asked for `#0170FD` / `#0052EE` / `#41BAFD` / `#1DD2DE` / `#2EE1DB` / `#03BFAE`
with neutrals `#F7F9FC` / `#FFFFFF` / `#101828` / `#667085` / `#E4EAF2`.

`scripts/design/palette.mjs` documents, from pixel clustering of the shipped logo assets,
that `#0170FD` / `#0052EE` is **the Play Store icon blue**, and that it "does not match
the logo"; the Google Play badge is excluded outright as third-party brand. The
repository's logo-derived values (`#0164C8`, `#3DB8FD`, `#03C6B1`, `#0187BA`) are the same
hue family at different steps, are already enforced by CI, and are what every guarded
surface renders.

**Decision taken:** migrate to the repository's logo-derived ramp rather than to the
brief's exact hexes, because (a) it is derived from the real brand asset, (b) CI already
guards it and DESIGN.md/`.impeccable/design.json` are generated from it, and (c) switching
to the Play Store blue would have contradicted the logo the app ships beside.
**To reverse:** edit `PALETTE` in `scripts/design/palette.mjs`, then run `npm run
design:sync && npm run design:lint:update && npm run design:test`. The brief's *neutral*
values (`#F7F9FC`, `#101828`, `#667085`, `#E4EAF2`) are already the email ramp; the app's
neutrals (`#F4F9FC`, `#0C1B2E`, `#51637A`, `#E3E9F0`) are one to two steps away in the
same ramp and were left as the app standard.

---

## 5. Shared component inventory

**Retained (existing, correct, untouched in API):** `components/Layout.tsx` (shell:
sidebar, top bar, search, notifications, user menu, mobile drawer), `ModuleGuard`,
`AuthGuard`, `SubscriptionGuard`, `components/ui/index.tsx` (`PageHeader`,
`SectionHeader`, `ConfirmDialog`, `LoadingState`, `ErrorState`, `StatusBadge`,
`RecordCard`, `EmptyRow`, `Card`, `CardHeader`, `SkeletonCard`, `SectionError`,
`MetricCard`), `components/design/*` (`PageContainer`, `PremiumCard`, `AppButton`,
`EmptyState`), `components/charts/*` (`AreaChart`, `BarChart`, `LineChart`, `PieChart`,
`RadarChart`, `StatCard`, `ReportTable`), `components/mica/*` (`MicaOrb`, `MicaOverlay`,
`MicaFab`, `useMica`), `components/auth/*`, `components/marketing/*`.

**Consolidated (one definition, many callers):**

- **Colour** — page-local colour constants across marketing, insights, compliance, health,
  nutrition, scheduling, admin, mobile screens and the chart wrappers now resolve from the
  token modules; the identity hexes exist once.
- **Notice surfaces** — 38 files that hand-rolled `bgcolor: 'notice.*.bg'` now read the
  derived pair from `theme/noticeTokens.ts`, so a tint and its readable foreground travel
  together (see §9).
- **Charts** — `AreaChart`/`BarChart`/`LineChart`/`PieChart`/`RadarChart`/`ReportTable`/
  `StatCard` share `METICLE_CHART_PALETTE` and one grid/tooltip/axis treatment instead of
  per-chart hexes.
- **Status colours** — one semantic set (`success`/`warning`/`danger`/`info`/`neutral`)
  reached through `StatusBadge` and the notice tokens, so an incident is never green on
  one page and amber on another.
- **Buttons** — one radius and one disabled/loading treatment; the loading spinner rule is
  applied through `AppButton`/MUI `Button` rather than per-page.
- **Mobile** — `mobile/src/theme.tsx` carries the same ramp and status set; screens read
  it rather than declaring local palettes, and `utils/patchStaticStyles.ts` maps the
  remaining static style objects onto it.

**Created:** `scripts/design/audit-inventory.mjs` (generates the route/screen appendix of
DESIGN.md), `scripts/design/route-tracker.mjs` (derives the per-route audited/updated/tested
status in Appendix A), `scripts/design/brand-migration.mjs` (the repeatable migration pass),
plus the guard tests in §10. Both generators run inside `design:check`, so a stale block is a
red build rather than a stale table. No component was duplicated to create these.

**Deleted:** the four eye-icon "view" affordances banned by the project rules
(`pages/tasks`, `pages/appointments`, `pages/incidents`, `pages/compliance-portal`) — the
rows and cards in those tables already open the read-only detail dialog on click, and
their edit/delete actions already `stopPropagation`. Verified: no `VisibilityIcon` or
`RemoveRedEye` remains anywhere in `apps/web` or `apps/mobile`; the only `<Visibility>`
usages left are the two password show/hide toggles on auth forms, which the rule permits.

---

## 6. Audit findings (ranked)

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | Three competing palettes (retired navy/emerald, logo ramp, email blue) across web, mobile and email | High — brand incoherence on every screen | Migrated to the logo ramp; email brand blue aligned |
| 2 | Hand-rolled notice surfaces used a palette *mid tone* as a background: 4.53–7.32:1 in light, **1.58–2.73:1 in dark** — a WCAG AA failure | High — accessibility | `theme/noticeTokens.ts` derives surface + readable foreground per mode; 28 tests guard it |
| 3 | Dark mode inverted rather than tokenised: near-white insets (`grey.50/100`) rendered as white boxes on dark paper | Medium | Named brand neutrals + dark notice tints; `authPagesDarkMode.test.ts` |
| 4 | `--mc-*`/theme drift between web token modules and mobile `theme.tsx` | Medium | Both carry the same ramp and semantics; mobile typecheck green |
| 5 | Four pages carried a banned eye-icon "view" button beside already-clickable rows | Medium — project rule | Removed (§5) |
| 6 | Transactional email claimed `--mc-primary` = `#2F80ED` while the app renders `#0164C8` | Medium — brand on every outbound mail | `EMAIL_BRAND.primary/primaryDeep/info*` and three server-side brand defaults aligned |
| 7 | Page-local colour constants duplicated the palette in ~60 pages | Medium — maintenance | Consolidated onto tokens where the identity values were at stake |
| 8 | No automated WCAG/axe harness; contrast is guarded by targeted token tests only | Medium — coverage gap | Recorded as outstanding (§11) |
| 9 | 69 off-palette hex occurrences across 62 keys sat inline in components, with a `design:lint` baseline holding the build green | Low — cosmetic drift | **Closed.** Near-miss neutrals and semantics routed onto `styles/tokens.ts` `P`/notice tokens; the three darker-than-palette Mission Control severity grounds moved onto the notice dark tints; the genuinely non-brand sets (regulator and payment marks, the Bristol stool scale, the policy category ramp) declared once in the same module rather than retyped. The empty `hex-baseline.json` is deleted, so a stray literal now fails the build outright |
| 10 | Marketing surfaces render outside `ThemeProvider`, so they cannot read MUI theme tokens | Low — design constraint | Static token exports kept valid; documented in DESIGN.md |
| 11 | Mica described itself four ways: the state union was declared twice, three different accessible names covered three surfaces, geometry was inline magic numbers, and the overlay's z-index (1300) tied with MUI's modal layer — so overlay-vs-dialog order depended on DOM order | Medium — accessibility, positioning | One identity module (`mica.identity.ts`) with states, labels, geometry and the z-ladder; overlay moved to 1350 so every rung is distinct |
| 12 | `/dashboard` mounted **two independent Mica sessions** — the global FAB and the in-page assistant banner — so two orbs existed, and two overlays could be open at once | Medium — bug | `MicaProvider` gives the shell one session that both entry points share |
| 13 | Mobile could park a dragged orb **on top of the tab bar** (clamped 40px from the *window* bottom, inside a ~68px bar) and on the home-indicator strip; web reserved no space for its orb at all | High — occlusion of navigation and page controls | Mobile bounds computed in the inset frame with the tab bar's real height; web reserves a 122px corner and sits below the dialog layer |
| 14 | Mica's failure paths rendered as the calm "responding…" state, so a failed request looked like speech | Low — misleading signal | Explicit `error` state: danger-ring orb, no waveform, error card, spoken and announced for screen readers |
| 15 | Route coverage was a hand-written claim: the document could not say which routes had been reviewed, and the generated DESIGN.md inventory had drifted unnoticed because `design:check` never ran it | Low — process | `scripts/design/route-tracker.mjs` derives audited/updated/tested per route from the router, page tree and test tree; both generators now gate `design:check`, and the drifted inventory was regenerated |

---

## 7. Remediation tracker

| Surface / area | Files | What changed | Verified |
|---|---|---|---|
| Web application colour identity | ~142 under `apps/web/src` | Retired navy/emerald → logo ramp; status semantics unified; dark-mode tokens | `paletteAudit` (6), `noticeContrast` (28), `authPagesDarkMode` (4), `design:lint` |
| Web token modules | `index.css`, `context/ThemeContext.tsx`, `theme/noticeTokens.ts`, `styles/{tokens,marketing-tokens,export-tokens}.ts` | Canonical values; `noticeTokens` derivation | `design:check`, `design:test` (15), typecheck |
| Shell & navigation | `components/Layout.tsx`, `PageMeta`, `GlobalSearch`, guards | Token colours; active-state and service-type gating unchanged | `Layout.test.tsx` (domiciliary + supported-living, collapse/expand) |
| Dashboards & Mission Control | `pages/dashboard/*`, `pages/mission-control/*` | Token colours; Today/Calls/Staffing/Compliance/Care/Incidents remain separate workspaces with persistent active tab | `MissionControlWorkspace.test.tsx`, `dashboardEntry.test.ts` |
| Directories & lists | people, staff, agencies, incidents, policies, training, tasks, room-checks, appointments, notifications | Badge/status semantics, hover affordances, banned view buttons removed | targeted tests + `design:lint` |
| Detail pages & tabs | `PersonProfilePage`, `StaffProfilePage`, `IncidentDetailPage`, `PolicyDetailPage`, `LocationDetailPage` | Token colours; tab/URL behaviour untouched | `PersonProfilePage.test.tsx` (5), `carePlanCardView.test.tsx` (2) |
| Medication & clinical | `EMedicationPage`, `ArchivedMarPage`, person Health/BodyMap/Nutrition/Sleep tabs, charts | Token colours only — **no dosing, timing, warning or confirmation logic touched** | `medicationMetrics.test.ts`, `EMedicationPage.test.tsx`, typecheck |
| Compliance & incidents | compliance hub, identity, evidence packs, CQC readiness, records, surveys, engagement, incidents | Severity/badge semantics unified; no completion control altered | `src/__tests__` suite (132) |
| Settings & administration | `SettingsPage`, `OrganizationPage`, admin, platform-admin, billing, onboarding | Token colours; no section, toggle or confirmation behaviour changed | typecheck, `design:lint` |
| Auth & recovery | login, register, forgot/reset (incl. expired/invalid/success), verify-email, MFA setup/challenge, invitation acceptance | Dark-mode + token colours; password show/hide toggles kept | `authPagesDarkMode.test.ts`, `noticeContrast` |
| Public/unauthenticated | marketing (14 pages), legal (5), survey/family/invoice token pages, errors | Token colours; contrast-safe notices | `src/__tests__` (incl. claim/evidence and marketing-claims guards) |
| MICA | `components/mica/*`, mobile `FloatingMicaOrb`, `MicaHomeScreen` | Orb, overlay, idle/listening/responding/error states and positioning kept; colour only, animated per the existing direction, reduced-motion respected | `MicaOverlay.test.tsx`, mobile jest |
| Mobile application | 20 files: `theme.tsx`, `Icons.tsx`, `MapAppLogos`, splash background, 12 screens, `patchStaticStyles`, `App.tsx` consumers | Same ramp and semantics as web | mobile typecheck + jest 286/286 |
| Transactional email | `email.template.ts`, `billing.controller.ts`, `leave.controller.ts`, `familyFeedback.controller.ts` | Brand blue aligned to `#0164C8` | `email.typography.test.ts` (2), typecheck |
| Design tooling & docs | `palette.mjs` consumers, `lint.mjs`, `audit-inventory.mjs`, `route-tracker.mjs`, `brand-migration.mjs`, `DESIGN.md`, `tests/visual/marketing.spec.ts`, `tests/visual/app.spec.ts` | Inventory generation, per-route tracker, regenerated front-matter/appendix | `design:check`, `design:lint`, `design:test` |

**Not marked complete:** the full 129-route regression sweep (Phase F) and the viewport
matrix (§11). Routes were reviewed through their source, tokens and guards, and the
colour-sensitive ones exercised by test, but they were **not** visited one by one in a
running browser in this pass. How far that sweep got, route by route, is no longer a claim:
the generated tracker in Appendix A derives it from the router, the page tree and the test
tree on every run.

### 7.1 Purpose-fit verification — consistency without uniformity

The design system unifies *rules* (tokens, components, states, accessibility, interaction
conventions), never information architecture. This subsection records the evidence that the
pass did not flatten any module into a shared template, using the two-part acceptance test:
**consistency** (does the page follow the shared language?) and **purpose-fit** (does it
still use the right hierarchy, density and interactions for its own job?).

**Method — diff classification.** For every module that owns a purpose-specific layout, each
changed line was classified as colour-related or structural:

```bash
COLOUR='#[0-9A-Fa-f]{3,8}|--mc-|METICLE_|COLORS|notice\.|radius|shadow|color|Color|border|Border|bgcolor|background'
git diff -U0 -- <file> | grep -E '^[+-][^+-]' | grep -vcE "$COLOUR"
```

| Module (purpose-specific layout) | Changed lines | Non-colour changed lines |
|---|---|---|
| `EMedicationPage.tsx` — MAR grid + printable MAR | 260 | 0 (2 matched only because they are an ink-tinted shadow, `rgba(12,27,46,…)`) |
| `PersonProfilePage.tsx` — person-centred record (20 tabs) | 66 | 0 |
| `CompliancePage.tsx` — compliance requirement workspace | 26 | 0 |
| `CompetencyAssessmentsPage.tsx` | 2 | 0 |
| `TrainingMatrixPage.tsx` | 2 | 0 |
| `StaffDirectoryPage.tsx` — directory listing | 28 | 0 |
| `StaffProfilePage.tsx` — staff detail | 32 | 0 |
| `RotaPlannerPage.tsx` | 62 | 0 |
| `rota/RosterView.tsx` · `DayBoardView.tsx` · `TimelineView.tsx` — three distinct rota views | 18 / 6 / 14 | 0 / 0 / 0 |
| `MissionControlViews.tsx` — six workspaces | 4 | 0 |

**Result: this pass changed colour, radius, shadow and state tokens only.** No page's
information architecture, density, field set, action set, tab system or workflow was altered.

**Purpose-fit verdicts:**

| Module | Purpose-fit requirement | Evidence | Verdict |
|---|---|---|---|
| Mission Control | Six separate workspaces (Today, Calls, Staffing, Compliance, Care, Incidents), one rendered at a time, persistent active state, URL-consistent — *not* all six stacked vertically | `/mission-control` is a layout route with child routes `today`, `calls`, `staffing`, `compliance`, `care`, `incidents` plus an index redirect (`App.tsx:235-244`); `MissionControlTabs` renders `NavLink`s and sets `aria-current="page"`; six view components in `MissionControlViews.tsx`; `MissionControlWorkspace.test.tsx` asserts *"redirects the root route to Today and renders only the Today workspace"*, *"switches the visible workspace and the active tab when a tab is clicked"* and *"keeps the selected tab active on the Incidents route and hides the other workspaces"* | **Pass** |
| MAR / eMAR | Dense clinical grid; person and medication identification; administration times; due/administered/omitted/refused; recording actions; warnings; auditability; printable MAR preserved | Diff is colour-only — the printable MAR's markup and stylesheet are unchanged apart from hex values (MAR codes, status colours, initials, notes and cell structure intact); `EMedicationPage.test.tsx` and `medicationMetrics.test.ts` green | **Pass** |
| Staff compliance | Grouped requirements; met vs outstanding; expiring and overdue; evidence and verification dates; actions — not the MAR's schedule layout | `CompliancePage`, `CompetencyAssessmentsPage`, `TrainingMatrixPage` are colour-only diffs; their own grouping, filters and evidence handling are untouched | **Pass** |
| Client care plan | Person-centred record: identity and context, needs, goals, planned support, risk, review history — not a compliance checklist | `PersonProfilePage` is a colour-only diff; the 20-tab category structure and the care-plan card view are unchanged; `PersonProfilePage.test.tsx` and `carePlanCardView.test.tsx` green | **Pass** |
| Staff directory vs staff profile | Directory stays a searchable listing; the profile keeps its detail layout | Two separate components, both colour-only diffs; no listing/detail merge and no profile layout imposed on the directory | **Pass** |
| Rota planner | Grid and schedule layouts appropriate to scheduling, with min-safe-staffing and compliance blocks | Three view components retained (`RosterView`, `DayBoardView`, `TimelineView`) with colour-only diffs; quick-add, assignment and compliance behaviour untouched | **Pass** |
| Forms, dialogs, tables, badges, buttons | Shared standards without removing fields, validation or permissions | Shared components reused rather than re-created; the only removals anywhere in the pass were the four banned eye-icon affordances (§5), whose rows already opened the detail dialog | **Pass** |

**Structural variety retained.** The product still runs several deliberately different layout
families: the dense clinical MAR grid, grouped compliance requirement views, a person-centred
tabbed record, directory tables, three rota views, six Mission Control workspaces, and
mobile task lists. Uniformity was applied to tokens, components, states and accessibility —
not to information architecture.

### 7.2 Mica — states, entry point, positioning and accessible names

**Where it stands now.** `apps/web/src/components/mica/mica.identity.ts` is the single source
of truth, and both platforms read it (mobile mirrors it in `apps/mobile/src/theme.tsx`).

| Concern | Standard | Web | Mobile |
|---|---|---|---|
| States | `idle · listening · thinking · responding · error` | `useMica` owns the machine; the union is imported, not re-declared | `mica.states` in the theme; the orb takes an optional `state` prop and derives `idle`/`listening` from the legacy `listening` flag so old call sites are unchanged |
| Error state | Session failure is a **state**; a blocked mic or unsupported browser stays a non-modal notice | `error` state: danger ring, no waveform, error card, still dismissable by Esc/close; the failure is spoken then held until dismissed | Error keeps Mica's blue and adds a danger ring plus an alert icon — same control, different condition |
| Entry point | One per platform, and one session — the session owns the surfaces that must exist once | The global orb (`MicaFab`) and the dashboard banner are two doors into **one** session (`MicaProvider`), which is also the only component that renders the overlay and the pre-session notice (otherwise two identical `aria-modal` dialogs would be mounted) | One orb per screen: the duplicate orbs on the Mica and SOS screens are gone, and pushing an already-open Mica/SOS screen no longer stacks a second copy |
| Positioning | Geometry and layer order are tokens | 90px box, 24px offset, `--mc-mica-clearance: 122px` reserved in the shell; orb at z 1200 (below MUI's 1300 modal), overlay 1350, notices 1500 | 56px orb, 12px inset; bounds computed in the **inset frame** with the tab bar's real height as clearance |
| Accessible names | One name per surface, shared | Orb “Mica assistant”, overlay “Mica voice assistant” | Orb “Mica assistant — tap to open. Press and hold for emergency options.” |
| Animation | Quiet, and never loops on failure | Four speech/reasoning animations as before; `error` is deliberately still | Unchanged; `prefers-reduced-motion` handling untouched |

The visible product name is **“Mica”**, not “MICA”: every visible surface already said
“Mica”, and a screen reader spells an all-caps acronym letter by letter.

**Proof that the orb cannot cover navigation or controls.** Two mechanisms, each tested:

1. **Web** — the orb sits *below* the dialog layer (1200 < 1300), so any open dialog, including
the medication administration dialog and every confirmation, paints over it; and the shell
reserves a bottom corner (`--mc-mica-clearance`, ≥ the orb's box + offset + gap) that
`Layout.tsx` adds to the page padding, so the last row of a table, a pagination control or a
form's action bar cannot sit under it. The orb also hides itself while Mica is active.
2. **Mobile** — the drag bounds are computed in the inset screen frame with the tab bar's
height as clearance, so the whole box plus the bar stays above the frame's bottom edge and
below its top (the old clamp allowed a parked orb *inside* the tab bar).

Rather than assert either in prose, both are exercised: `mica.identity.test.ts` checks the
z-ladder against MUI's own 1300/1400 layers, that the shell declares a clearance at least as
tall as the footprint **and consumes it**, and that the accessible name and state list are
character-identical in the mobile theme; `FloatingMicaOrb.test.tsx` checks the bounds across
five real devices with and without a tab bar, including a frame too short for the clearance
(which must clamp to the floor, not go off-screen).

**Still not proven:** neither test is a pixel check. They prove the geometry the orb is
positioned from and the layer it is drawn beneath; they cannot prove that a *dynamic* page
never draws its own control into the reserved gutter, nor how Mica and a page's controls look
overlapped on a real device. That needs the browser/device sweep recorded in §11.

---

## 8. Organisation-type matrix

Organisation type is read from the existing configuration — `primary_service_type` and
`service_types` on the organisation record — never inferred from a page name or tenant id.
Web: `App.tsx` and `Layout.tsx` resolve it and `pages/dashboard/dashboardServiceMode.ts`
picks the dashboard variant. API: `shared/middleware/requireServiceType.ts` gates
individual routes and returns a not-authorised/no-service-type state rather than an empty
page. Navigation items declare `serviceTypes?: string[]` and a role list, and are filtered
by both.

| Area | Domiciliary care | Supported living | How it adapts |
|---|---|---|---|
| Landing dashboard | Calls/visits day view (`DomiciliaryDashboard`) | Operational dashboard (`DashboardPage`) | `getDashboardServiceMode` → different component, same tokens and card vocabulary |
| Mission Control | Homecare workspace (calls, assignment, live map) | Supported-living workspaces (today, staffing, compliance, care, incidents) | Separate workspaces; `HomecareMissionControl` vs `MissionControlPage` |
| Navigation | Supported-living-only items hidden; notifications stay in the top bar | Supported-living items shown (e.g. Medications, Meal Plans with `['residential','supported_living']`) | `serviceTypes` filter in `Layout.tsx`; covered by `Layout.test.tsx` for both organisation types |
| Scheduling | Call scheduling, assignment board, weekly call planner, mileage, live map, carer totals, payroll export | Rota Planner (`['supported_living','residential']`), overtime claims, marketplace | Shared grids and status badges; domain layout per service type |
| Care records | Visits, care notes, medication, client invoices | Person-centred plans, goals/outcomes, risk assessments, wellbeing, handovers, care reviews | Same `PersonProfilePage` tab system, different tab emphasis |
| Medication | MAR, administrations, exceptions, stock, deliveries, daily counts | Same, plus exceptions surfaced in compliance | One eMAR implementation; `['residential','supported_living']`-gated |
| Compliance/incidents | Visit compliance, CQC/DSPT readiness | Same engines, supported-living evidence packs | Shared badges, due dates and action placement |
| Not applicable | — | Feature not configured for the org is **hidden by the existing rules or shown as not-applicable**, never exposed because a shared component renders it | Existing guards retained; no shared component widens visibility |

---

## 9. Accessibility findings

- **Resolved — notice contrast (highest impact).** Replacing the mid-tone-as-background
  pattern with derived pairs moved the failing surfaces (4.53–7.32:1 light,
  **1.58–2.73:1 dark**) above 4.5:1 in both modes. `noticeContrast.test.ts` (28 tests)
  includes guards that no page reintroduces a light-only surface and that no page uses a
  foreground token as a background.
- **Resolved — dark-mode surfaces.** `authPagesDarkMode.test.ts` (4 tests) covers the auth
  and account-recovery screens; `--mc-*` and notice tokens carry dark values.
- **Resolved — contrast hygiene.** `paletteAudit.test.ts` (6 tests) bans the retired
  identity hexes, MUI `grey.*` references (light-only in both modes), 3-digit shorthand
  hex, and navy-tinted rgba shadows.
- **Preserved — semantics that don't rely on colour.** Status badges render a word; the
  banned eye-icon removal left the clickable-row affordance (cursor, hover border/shadow)
  plus `stopPropagation` on the edit/delete buttons, so keyboard users still reach the
  row action.
- **Preserved — focus and labelling.** `focus-visible` rings on the shared interactive
  components, `aria-label`/`role="status"` on loading and error states
  (`LoadingState`, `SkeletonCard`, `ErrorState`, `SectionError`), persistent field labels
  and MUI's field-level error association in forms.
- **Open — no automated audit.** There is no axe/`toHaveNoViolations` harness in the
  repository. Contrast is guarded by the targeted token tests above; structural
  accessibility (focus order, dialog focus trap, tab semantics, touch-target sizes) is
  reviewed by inspection only. Recorded in §11.

---

## 10. Test report

Environment note: the machine had ~4 GB free of 16 GB during this pass. The **entire** web
vitest suite was attempted three times and each attempt either died with V8
out-of-memory (two concurrent suites) or stalled for 10+ minutes on the heaviest jsdom
component files. It was therefore **not** run to completion — see §11. Targeted runs, the
mobile suite, the API unit test and the node-based design guards all completed and are
reported below with the exact commands and exit statuses.

| # | Command | Result |
|---|---|---|
| 1 | `cd apps/web && npx tsc --noEmit` | **pass** (`WEB_EXIT=0`) |
| 2 | `cd apps/api && npx tsc --noEmit` | **pass** (`API_TSC_EXIT=0`) — re-run after the email/brand-default edits |
| 3 | `cd apps/mobile && npx tsc --noEmit` | **pass** (`MOBILE_TSC_EXIT=0`) |
| 4 | `npm run design:check` | **pass** — `design.json and DESIGN.md match palette.mjs` |
| 5 | `npm run design:lint` | **pass** — `0 off-palette hex occurrences across 0 unique keys`, `no new off-palette colours`. Re-run after `scripts/design/hex-baseline.json` was deleted, and with a planted `#123456` in a scanned dir to prove the rule still fails closed (`EXIT=1`) without a baseline |
| 6 | `npm run design:test` | **pass** — 15/15 (`node --test`) at the time of the sweep; 23/23 after the route tracker and its derivations were added (rows 17–19) |
| 7 | `cd apps/web && npx vitest run --maxWorkers=1 src/components/Layout.test.tsx src/__tests__` | **pass** — 11 files, **140 tests**, 147.7s (`EXIT=0`) |
| 8 | `cd apps/web && npx vitest run --maxWorkers=1 src/pages/people/carePlanCardView.test.tsx src/pages/mission-control/MissionControlWorkspace.test.tsx src/pages/dashboard/dashboardEntry.test.ts src/pages/emedication/medicationMetrics.test.ts` | **pass** — 4 files, **28 tests**, 82.9s (`EXIT=0`) |
| 9 | `cd apps/web && npx vitest run --maxWorkers=1 src/components/Layout.test.tsx src/pages/people/PersonProfilePage.test.tsx` | **pass** — 2 files, **13 tests**, 164.3s (`EXIT=0`) |
| 10 | `cd apps/mobile && npx jest` | **pass** — 37 suites, **304 tests**, 36.5s (`MOBILE_JEST_EXIT=0`) — re-run after the Mica orb changes |
| 11 | `cd apps/api && npx vitest run src/shared/utils/email.typography.test.ts` | **pass** — 2 tests, 7.1s (`EXIT=0`), test DB migrated |
| 12 | `cd apps/web && npx vitest run --maxWorkers=1 src/components/mica/MicaOverlay.test.tsx src/components/mica/useMica.intents.test.ts src/pages/emedication/EMedicationPage.test.tsx` | **pass** — 3 files, **20 tests**, 126.3s (`EXIT=0`) |
| 13 | `node scripts/design/audit-inventory.mjs` | **pass** — `DESIGN.md inventory is up to date` |
| 14 | `cd apps/web && npx vitest run --maxWorkers=1 src/components/mica src/components/Layout.test.tsx` | **pass** — 5 files, **40 tests**, 87.9s (`EXIT=0`) |
| 15 | `cd apps/mobile && npx jest src/components/__tests__/FloatingMicaOrb.test.tsx` | **pass** — **18 tests** (`JEST_EXIT=0`) |
| 16 | `cd apps/mobile && npx tsc --noEmit` (re-run after the orb-bounds refactor; an earlier run had caught a type error in the new test file) | **pass** (`MOBILE_TSC_EXIT=0`) |
| 17 | `npm run design:check` (re-run after `audit-inventory.mjs` and the new `route-tracker.mjs` were wired into it) | **pass** — `design.json and DESIGN.md match palette.mjs`, `DESIGN.md inventory is up to date`, `the per-route tracker is up to date` |
| 18 | `node scripts/design/route-tracker.mjs --write` | **pass** — appended the per-route tracker (Appendix A); the DESIGN.md inventory, reported stale on first run, was regenerated by `design:sync` |
| 19 | `npm run design:test` | **pass** — **23/23** (`node --test`), including the six route-tracker derivations |

**Verified totals:** every web run above passed — 11 files/140 tests, 4 files/28, 2 files/13,
5 files/40 (`Layout.test.tsx` and the three palette/contrast guards each appear in more than
one run), 304 mobile tests across 37 suites, 17 design-tooling/email tests, and three
typechecks. Every check above was re-run *after* the last edit to the files it covers.

**Two failures found and fixed during verification, recorded because they are instructive:**
`MicaOrb.test.tsx` had been asserting on a colour literal (`rgb(16, 191, 165)`) that stopped
matching when the orb's cyan was re-pointed at the brand token during the earlier palette
sweep — it was a stale test that had gone red unnoticed, and it is now asserted through
data-attribute hooks instead of a colour. And `App.test.tsx`'s quick-action test queried the
dashboard synchronously after waiting only for the tab bar, so it raced the dashboard's own
fetch; it now awaits the quick action, which fixes the race rather than masking it.

**The visual gate went red, and was repaired with the pipeline's own rendering.** The first CI
run on this work failed the `visual-regression` job for two independent reasons, not one:

| # | Command | Result |
|---|---|---|
| 20 | `npx playwright test --project=mobile-light --grep-invert "matches its baseline"` (local dev server, Chromium 1.63, Pixel 7) | **pass** — 5 tests, 31.4s (`PLAYWRIGHT_EXIT=0`), including the repaired palette assertion below |
| 21 | `gh run view <run> --log-failed` and its artifact | both causes identified from the log and the uploaded expected/actual/diff images (below) |

*Cause 1 — a stale assertion, not a stale colour.* `marketing home page paints with the
master brand palette` asserted `rgb(8, 122, 85)`: the retired `M.tealDeep` (`#087A55`, the old
emerald's text-safe sibling). The sweep re-pointed that token to the brand mint's own deep
sibling `#004E45`, and it is the token that paints the eyebrow labels on every marketing page,
so the assertion was pinning a colour the identity no longer has. The CI log's received array
settled it — `["rgb(12, 27, 46)", "rgb(81, 99, 122)", "rgb(0, 78, 69)", "rgb(1, 100, 200)", …]`
— and a local Chromium render of `/` reproduced that array element for element. The expectation
is now `rgb(0, 78, 69)`, the comment names `M.tealDeep`, and the contrast claim was measured
rather than asserted: **9.10:1** on the bone paper `#F4F9FC`, against **2.04:1** for the raw
accent `#03C6B1` — which is precisely why the deepened sibling exists for text.

*Cause 2 — a baseline that predated the code it guarded.* `pricing.png` was committed on 8
October; `BrandWordmark` and the nav that renders it landed on 11 October. Decoding the two
PNGs (custom inflate + defilter, RGBA) showed the delta was confined to two things and nothing
else: the palette re-point — `#F7F9FC→#F4F9FC` (250 k px, the canvas), `#10BFA5→#03C6B1`,
`#17202A→#0C1B2E`, `#475467→#51637A`, `#2F80ED→#0164C8`, `#E6EAF0→#E3E9F0` — and roughly 570
pixels of brand-blue glyphs at x 49–124, y 21–33, where the committed baseline is 100% white:
the header wordmark, which a fresh local render paints exactly as CI's capture does. So the gate
was red against a *stale* baseline, and the correct new baseline is the settled current render.

The two `pricing.png` baselines are therefore **adopted from the CI artifact, not regenerated
locally**. That is deliberate and now measured: a Windows render of the same page at the same
viewport differs from the Linux capture by **7.75%** of the frame (26,798 pixels across 262 rows,
all text rasterisation), so a locally-generated baseline could never clear the gate's 1%
`maxDiffPixelRatio`. The committed baseline carries the provenance the comparison runs in.

**Observation for §11, not fixed here:** that 1% tolerance is what let the header regression sit
undetected. The wordmark's own delta was ~0.17% of the frame, comfortably inside it, so
`pricing.png` passed for a week against a baseline that no longer matched its page — the sweep's
canvas-wide change is the only reason the mismatch became visible. Tightening the tolerance is a
decision with its own cross-platform risk, so it is recorded rather than taken.

**The next release went red for a baselines-only reason, and the repair was to make a
regeneration complete rather than partial.** The failing tests were the eight mobile screenshot
comparisons — `home`, `login`, `pricing` and `mission-control-today` in `mobile-light` and
`mobile-dark`; all four desktop comparisons and all twenty non-screenshot tests passed. Every
committed baseline rendered the *retired* palette — `#2F80ED` primary, `#17202A` ink, `#F7F9FC`
canvas — while the current render paints `#0164C8`, `#0C1B2E` and `#F4F9FC`. The commit under
test was not what drifted: checked out over its parent, the same mobile capture is byte-identical
except for 50 of 345,668 pixels (one glyph edge), so the change under test moved no pixels at
all. The baselines were simply old — the mobile captures are dated 8 October, the mobile
`pricing.png` 12 October, the desktop captures 11 October — and the mobile deltas are 1.8%
(`login`), 2.7% (`mission-control-today`), 4.6% (`home`) and 12.5% (`pricing`) of the frame.

The regeneration as it stood returned a set that was only half new, which is the part worth
recording. `playwright test --update-snapshots` rewrites a snapshot only when its comparison
failed, and the comparator cannot see this drift: its default `threshold` of 0.2 is 1,408 units of
squared-YIQ distance, while `#2F80ED` → `#0164C8` measures 625. So the four desktop captures came
back as the committed files and the mobile ones as fresh renders — an artifact that looks
regenerated but carries two epochs of the design system. The workflow now deletes
`tests/visual/__screenshots__` before regenerating, so every file in the artifact is a capture of
the commit it ran on, and that is the only kind of baseline worth adopting.

Two things about this harness are now measured rather than assumed. The runner's rendering is
deterministic: two independent dispatches of that workflow on one commit returned byte-identical
PNGs in all sixteen files — a zero-pixel noise floor, not the ~3% the workflow header assumes.
And a baseline is only ever worth adopting from the artifact, never generated locally: a Windows
render of the same page sits 4.7% of the frame from the Linux capture.

All sixteen baselines are adopted from that run, and every one is verified to paint the master
palette — no retired blue, ink or canvas value survives in any of them.

**That observation is now closed, and the cause was the harness rather than the design system.**
The `*-dark` captures were md5-identical to their `*-light` counterparts in every case, old set and
new, because Playwright's `colorScheme` only emulates `prefers-color-scheme` while this app reads
its theme from `localStorage['theme-mode']` — defaulting to light — so two of the four projects were
photographing light pages under a dark name. `tests/visual/theme.ts` now seeds the stored
preference, which is the same path a person takes in Appearance.

The eight `-dark` baselines were then adopted from the runner's own regeneration of `c4d0dc79`, and
the adoption is checkable rather than trusted: all eight `-light` captures in that artifact are
byte-identical to the ones already committed, so only the dark set moved, and no `-light` baseline
is touched by the change. In the tree now, mean luminance on `desktop-dark/login.png` is **38.6**
against `desktop-light`'s 243.0, and `mission-control-today.png` **31.9** against 247.3, with 94.0%
and 99.5% of their pixels differing — twins no longer. The marketing pairs move 7.2% (`home`) and
7.4% (`pricing`), which is what that commit's message says they should: those pages stay light by
design and only the dark ground shows through.

**The gate is green on the adoption.** `ci.yml` run 38896138463 on `96374dfd` — the baselines-only
commit — reports the `Visual regression (marketing + app)` job **success, 36 passed**: the sixteen
screenshot comparisons (three marketing routes plus the mission-control route, in each of the four
projects) and the twenty palette/Lenis assertions, with `lint-and-typecheck` and the design-system
job green beside it. Before that run, `Visual regression` was the *only* failing job on `32bef695`
and on `c4d0dc79`, which is what a baseline set that answers the wrong question looks like: the
comparison had begun rendering dark pages and was diffing them against light images.

**Nothing checked that the dark renders stayed dark, so that gap is now closed too.** A `-dark`
baseline could return to duplicating its `-light` twin and no comparison would notice — both sides
of it move together, which is exactly how sixteen files carried a lie about two thirds of the
matrix. Both screenshot specs now assert the page answered the seeded preference before it is
photographed (`expectThemeApplied`, `tests/visual/theme.ts`), reading `data-theme` — the attribute
`ThemeContext` writes from the same `localStorage` key a person's Appearance choice lands in. It is
not vacuous: forcing `theme-mode: light` in the `desktop-dark` project makes it fail with
`answered "light"`. And it holds on every captured route in both modes — a throwaway probe of `/`,
`/pricing`, `/login` and the authenticated workspace returned `data-theme` equal to the seeded
value in all eight cases.

**CI has since run three of those four against these two commits**, and both are green — including
the screenshot job under the tightened comparator, which is the only proof that matters for the
baselines, since the artifact and the comparison both come from the runner.

**The remaining suites have now been run locally, on a throwaway database built by the same setup
path** (`meticle_test_local`, created and dropped by a scratch runner, so the dev database's own
rows were never in the blast radius of a suite that — as the next paragraph records — used to
delete table-wide): web 63 files / 485 tests, API 163 files / 1,605 tests, mobile 37 suites / 310
tests, all green. `npm run visual:test` is the one that still cannot run here by construction: a
Windows render of the same page sits several percent of the frame from the Linux capture, so the
runner is the only place a screenshot comparison means anything. No interactive browser pass over
the routes was performed.

**The one flake that run surfaced has been traced and fixed, and the first guess was wrong.** CI's
API suite exposed it (1,605 tests, one failure, green on rerun) as a Postgres `40P01 deadlock
detected` reported against
`locationRetention.integration.test.ts > switching collection off asks about what was already
collected > deletes everything held when asked, and says what it removed`, with the cycle printed
as one session waiting for a `RowShareLock` and the other for an `AccessExclusiveLock`. That reads
like a purge-path lock-ordering bug, and it is not one: the statement the failing session was
waiting on is the purge's own `SELECT ... FOR UPDATE`, its first statement in that transaction, so
that session held nothing with which to block anybody.

The `AccessExclusiveLock` was taken by the test suite itself. `rls.integration.test.ts`
re-applied `002_enable_rls.sql` and `003_add_missing_rls.sql` and ran `GRANT ... ON ALL TABLES IN
SCHEMA public` from its own `beforeAll` — 162 statements of DDL taking an exclusive lock on every
table in the schema — inside a parallel run whose other three workers are unavoidably
mid-transaction. Measured on 15 October 2026 with a single ordinary read transaction held open:
361 lock waits, the sweep blocked for 55 seconds, `AccessExclusiveLock` granted on users, people,
locations, teams, invoices, invitations and more, other suites' foreign-key checks queued behind
it (`RowShareLock on users`, 141 samples), and the suite itself dead on its 30-second hook
timeout. CI met the same graph and resolved it as a deadlock instead of a stall.

The role and its grants now come from `test/global-setup.ts` via `test/rlsTestRole.ts`, which runs
before any worker exists and therefore cannot meet a transaction. The suite asserts the
precondition — role present, privilege present, FORCE RLS on — rather than creating it, so a
missing prerequisite fails by name instead of quietly locking the schema. Its cleanup no longer
deletes table-wide: eight tables are scoped to the two staff profiles and two service users this
file creates, and `compliance_profile_requirements` was dropped from that list because this file
never inserts into it (settings does), so the old statement was destroying another suite's
fixtures. With the same read held open the measurement is zero waits and the suite passes in 6s
rather than failing at 35s, and across the whole local API run the only `AccessExclusiveLock` in
seven minutes was one session's `CREATE TEMP TABLE`.

---

## 11. Outstanding work

1. **Suites run; the route sweep is what is left.** Everything this audit listed as unrun has now
   been run whole and green — web 63 files / 485 tests, API 163 files / 1,605, mobile 37 suites /
   310 — and the single API failure was traced to the RLS suite's mid-run DDL and fixed (see the
   deadlock note above). What remains is the interactive pass: the routes in Appendix A are
   reviewed in source and their access rules are generated and checked, but no one has walked them
   in a browser on this machine.
2. **Route-by-route regression sweep (Phase F).** Appendix A answers this per route, derived
   rather than claimed: the page module each route renders, whether that module is recorded as
   reviewed here, whether it is token-clean, and whether a test covers it — alongside the routes
   that are redirects, structural wrappers, or render nothing. The counts stay in the generated
   block on purpose: repeating them in this prose is how the document went stale before.
   Permission-gated and conditional routes (`/platform-admin/*`, `/portal/*`,
   `/reset-expired`, `/reset-invalid`, org-type variants) should still be walked with fixtures
   on a machine with headroom.
3. **Viewport matrix not executed.** 1440 / 1280 / 1024 / 768 / 390 and small/large mobile
   devices were not tested interactively in this pass. `Layout.tsx` and the container
   components carry the responsive rules; only source review was performed.
4. **No axe/automated accessibility harness.** Add one to CI over the auth, dashboard,
   directory, detail and settings routes.
5. **Off-palette literals are cleared and the baseline is gone.** All 62 baselined keys were
   routed onto tokens and `scripts/design/hex-baseline.json` deleted, so `design:lint` now fails
   on any off-palette hex rather than merely refusing to let the count grow. What remains is
   *duplication of the token layer*, not stray colour: the marketing ramp is restated as a local
   `const C = { … }` block in ~10 pages and `pages/chat/utils.ts`, each value a `P`/`NOTICE_COLORS`
   reference, so no page can drift onto a near-miss hex — but the name map itself should collapse
   into one shared marketing ramp (`styles/marketing-tokens.ts` is its natural home).
6. **Neutral-ramp divergence between app (`#F4F9FC`/`#51637A`/`#E3E9F0`) and email/PDF
   (`#F7F9FC`/`#667085`/`#E4EAF2`).** Same family, one to two steps apart; left as-is
   because email carriers need an almost-white canvas. Documented so it is a decision
   rather than a drift.
7. **Palette decision in §4.1 remains reversible** — if the Play Store blue family is the
   intended identity, it is a one-file change in `scripts/design/palette.mjs` plus
   `design:sync`/`design:lint:update`.
8. **DESIGN.md prose is partly stale** (it still narrates the retired identity in its
   narrative sections) even though its front-matter, colour tables and appendix are
   generated and current. The prose sections need a reading pass; the generated parts must
   not be hand-edited.
9. **Seven page modules are not reachable from the router**, found by the tracker's
   reachability walk: `pages/LandingPage.tsx`, `pages/marketing/BlogPage.tsx`,
   `pages/marketing/ContactPage.tsx`, `pages/marketing/PublicSitePage.tsx`,
   `pages/incidents/IncidentsPage.tsx`, `pages/homecare/MileagePolicyPage.tsx` and
   `pages/mission-control/HomecareMissionControl.tsx`. Nothing imports them and no route
   renders them, so they are dead code or pages whose route was removed — and several were
   tokenised during the colour sweep, which is effort spent on code that does not ship. Each
   needs a route-or-delete decision; the tracker keeps listing them until then.
   **Closed 20 Oct 2026 — delete**, all four live counterparts verified first:
   `IncidentsPage` (superseded by `IncidentDirectoryPage` + `IncidentDetailPage` on
   `/incidents`), `HomecareMissionControl` (superseded by `MissionControlViews`), and
   `MileagePolicyPage` / `PublicSitePage` (unrouted, unreferenced). 1,105 lines removed;
   the one load-bearing reference — the disclaimer the claims test required in
   `PublicSitePage` — stays covered on the live `CompliancePage`/`FeaturePage`, and
   `design:sync` + `design:check` are green after the removal. `LandingPage`, `BlogPage`
   and `ContactPage` from the original list of seven are routed and were never dead.
10. **The visual gate's tolerance is now measured rather than inherited — decided 15 October,
    in its own commit, against the CI-rendered baseline set this item asked for.** Two
    independent regenerations of one commit returned byte-identical PNGs in all sixteen files,
    so the cross-run noise floor is zero pixels and the cross-platform allowance the old
    `maxDiffPixelRatio: 0.01` was paying for does not exist here. The comparator is now
    `threshold: 0.1` with `maxDiffPixelRatio: 0.001`: 352 units of squared-YIQ distance, below
    the 625 that `#2F80ED` → `#0164C8` measures and above a stray caret or a single glyph edge,
    with a pixel allowance small enough to catch the ~0.17% header regression that previously
    sat inside the old one for a week (§10). What remains outstanding is the environment the
    tolerance is now trusting: a roll of `ubuntu-latest` changes text rasterisation, which will
    turn this gate red and wants `visual-baselines.yml` re-dispatched — not a widened tolerance,
    which is how this item started.

<!-- BEGIN generated route tracker -->

## Appendix A — Per-route remediation status (generated)

Generated by `node scripts/design/route-tracker.mjs` from the router
(`apps/web/src/App.tsx`), the page tree and the test tree, and verified by
`design:check`. Do not edit by hand; run `npm run design:sync` after adding a route,
a page, or a test. Every column is derived, so this table cannot claim progress the
code does not have:

- **audited** — this document names the page module, i.e. the pass recorded reviewing it.
  The tracker block itself is excluded from the search, so the table cannot certify itself.
- **updated** — `design:lint` finds no off-palette colour literal in the module. A colour
  claim only: it says the module is token-clean, not that its layout was reviewed.
- **tested** — a colocated `<module>.test.tsx` exists, or a test file imports the module.

A path served by two different modules (the marketing and the application `/compliance`,
for instance) appears once per module, and `†` marks a path the router declares more than
once — the first declaration wins at runtime.

| Surface | Count |
|---|---|
| Routes with a page module | 122 |
| Route × module rows | 123 |
| Distinct page modules routed | 106 |
| Redirect routes (no page to review) | 7 |
| Structural wrapper routes (guards, layouts) | 1 |
| Route elements that resolve to nothing | 0 |
| Page-tree modules the router does not reach | 2 |
| audited / updated / tested | 19 / 112 / 34 |
| Fully signed off (all three) | 13 |
| Gaps (any of the three missing) | 110 |

**Structural wrapper routes** — guards and layouts that render no page of their own:
`(root)`.

### Routes

| Route | Page module | audited | updated | tested |
|---|---|---|---|---|
| `/` | `pages/marketing/HomePage.tsx` | no | no | no |
| `/*` | `pages/errors/NotFoundPage.tsx` | no | yes | no |
| `/about` | `pages/marketing/AboutPage.tsx` | no | no | no |
| `/agencies` | `pages/agencies/AgenciesPage.tsx` | no | yes | no |
| `/app` | `pages/marketing/DownloadPageNew.tsx` | no | yes | no |
| `/appointments` | `pages/appointments/AppointmentsPage.tsx` | no | yes | yes |
| `/availability` | `pages/homecare/AvailabilityPage.tsx` | no | yes | yes |
| `/billing` | `pages/billing/BillingPage.tsx` | no | yes | no |
| `/blog` | `pages/marketing/PublicBlogPage.tsx` | no | no | no |
| `/blog/:slug` | `pages/marketing/PublicBlogPage.tsx` | no | no | no |
| `/call-assignment` | `pages/homecare/CallAssignmentBoard.tsx` | no | yes | yes |
| `/call-scheduling` | `pages/homecare/WeeklyCallPlanner.tsx` | no | yes | yes |
| `/call-scheduling/day` | `pages/homecare/CallSchedulingPage.tsx` | no | yes | yes |
| `/case-studies` | `pages/marketing/CaseStudiesPage.tsx` | no | yes | no |
| `/chat` | `pages/chat/ChatPage.tsx` | no | yes | no |
| `/client-billing` | `pages/homecare/ClientBillingPage.tsx` | no | yes | no |
| `/compliance` † | `pages/compliance/CompliancePage.tsx` | yes | yes | yes |
| `/compliance` † | `pages/marketing/CompliancePage.tsx` | yes | no | no |
| `/compliance-badges` | `pages/marketing/ComplianceBadgesPage.tsx` | no | yes | no |
| `/compliance/:slug` | `pages/marketing/CompliancePage.tsx` | yes | no | no |
| `/compliance/competency` | `pages/compliance/CompetencyAssessmentsPage.tsx` | yes | yes | no |
| `/compliance/dspt` | `pages/dspt/DSPTPage.tsx` | no | yes | no |
| `/compliance/engagement` | `pages/compliance/StaffEngagementPage.tsx` | no | yes | no |
| `/compliance/evidence` | `pages/compliance/EvidencePacksPage.tsx` | no | yes | no |
| `/compliance/homecare` | `pages/compliance/HomecareCompliancePage.tsx` | no | yes | no |
| `/compliance/identity` | `pages/compliance/IdentityMonitoringPage.tsx` | no | yes | no |
| `/compliance/readiness` | `pages/compliance/CqcReadinessPage.tsx` | no | yes | no |
| `/compliance/records` | `pages/compliance/ComplianceRecordsPage.tsx` | no | yes | no |
| `/compliance/satisfaction` | `pages/compliance/SatisfactionSurveysPage.tsx` | no | yes | no |
| `/compliance/supervisions` | `pages/compliance/SupervisionsPage.tsx` | no | yes | no |
| `/compliance/training` | `pages/training/TrainingMatrixPage.tsx` | yes | yes | no |
| `/contact` | `pages/marketing/ContactPageNew.tsx` | no | no | no |
| `/cookies` | `pages/legal/CookiePolicyPage.tsx` | no | yes | no |
| `/dashboard` | `pages/dashboard/DashboardPage.tsx` | no | yes | no |
| `/delete-account` | `pages/legal/AccountDeletionPage.tsx` | no | yes | no |
| `/download` | `pages/marketing/DownloadPageNew.tsx` | no | yes | no |
| `/emedication` | `pages/emedication/EMedicationPage.tsx` | yes | yes | yes |
| `/emedication/archived` | `pages/emedication/ArchivedMarPage.tsx` | no | yes | no |
| `/expenses` | `pages/expenses/ExpensesPage.tsx` | no | yes | no |
| `/family-portal/:token` | `pages/FamilyPortalPage.tsx` | no | yes | no |
| `/family-portal/feedback/:token` | `pages/FamilyFeedbackPage.tsx` | no | yes | no |
| `/features` | `pages/marketing/FeaturesPage.tsx` | no | yes | no |
| `/features/:slug` | `pages/marketing/FeaturePage.tsx` | no | no | no |
| `/forgot-password` | `pages/auth/ForgotPasswordPage.tsx` | no | yes | no |
| `/homecare` | `pages/homecare/HomecarePage.tsx` | no | yes | yes |
| `/how-it-works` | `pages/marketing/HowItWorksPage.tsx` | no | yes | no |
| `/incidents` | `pages/incidents/IncidentDirectoryPage.tsx` | no | yes | no |
| `/incidents/:id` | `pages/incidents/IncidentDetailPage.tsx` | no | yes | no |
| `/insights` | `pages/insights/InsightsPage.tsx` | no | yes | no |
| `/intelligence` | `pages/insights/IntelligencePage.tsx` | no | yes | no |
| `/invoice/:token` | `pages/homecare/PublicClientInvoicePage.tsx` | no | yes | no |
| `/learn` | `pages/learn/LearningCenterPage.tsx` | no | yes | no |
| `/leave` | `pages/leave/LeaveManagerPage.tsx` | no | yes | yes |
| `/live-map` | `pages/homecare/LiveMapPage.tsx` | no | yes | yes |
| `/locations` | `pages/locations/LocationsPage.tsx` | no | yes | no |
| `/locations/:locationId` | `pages/locations/LocationDetailPage.tsx` | no | yes | no |
| `/login` | `pages/auth/LoginPage.tsx` | no | yes | no |
| `/manager-briefing` | `pages/insights/ManagerBriefingPage.tsx` | no | yes | no |
| `/marketplace` | `pages/marketplace/MarketplacePage.tsx` | no | yes | yes |
| `/meal-plans` | `pages/nutrition/MealPlanPage.tsx` | no | yes | no |
| `/medications` | `pages/emedication/EMedicationPage.tsx` | yes | yes | yes |
| `/mfa-challenge` | `pages/auth/MfaChallengePage.tsx` | no | yes | no |
| `/mfa-setup` | `pages/auth/MfaSetupPage.tsx` | no | yes | no |
| `/mileage` | `pages/homecare/MileagePage.tsx` | no | yes | yes |
| `/mission-control` † | `pages/mission-control/MissionControlWorkspace.tsx` | no | yes | yes |
| `/mission-control/alerts` | `pages/mission-control/MissionControlPage.tsx` | no | yes | no |
| `/mission-control/calls` | `pages/mission-control/MissionControlViews.tsx` | yes | yes | yes |
| `/mission-control/care` | `pages/mission-control/MissionControlViews.tsx` | yes | yes | yes |
| `/mission-control/compliance` | `pages/mission-control/MissionControlViews.tsx` | yes | yes | yes |
| `/mission-control/incidents` | `pages/mission-control/MissionControlViews.tsx` | yes | yes | yes |
| `/mission-control/staffing` | `pages/mission-control/MissionControlViews.tsx` | yes | yes | yes |
| `/mission-control/today` | `pages/mission-control/MissionControlViews.tsx` | yes | yes | yes |
| `/mobile` | `pages/marketing/DownloadPageNew.tsx` | no | yes | no |
| `/mobile/check-in` | `pages/mobile/CheckInPage.tsx` | no | yes | no |
| `/mobile/voice-notes` | `pages/mobile/MobileNotesPage.tsx` | no | yes | no |
| `/my-profile` | `pages/homecare/MyProfilePage.tsx` | no | yes | no |
| `/my-week` | `pages/homecare/MyWeekPage.tsx` | no | yes | yes |
| `/notifications` | `pages/notifications/NotificationsPage.tsx` | no | yes | yes |
| `/nutrition` | `pages/nutrition/MealPlanPage.tsx` | no | yes | no |
| `/onboarding` | `pages/onboarding/OnboardingFlow.tsx` | no | yes | yes |
| `/organizations` | `pages/organization/OrganizationPage.tsx` | no | yes | no |
| `/payroll-export` | `pages/homecare/PayrollExportPage.tsx` | no | yes | yes |
| `/payroll-timesheets` | `pages/homecare/PayrollExportPage.tsx` | no | yes | yes |
| `/people` | `pages/people/PersonDirectoryPage.tsx` | no | yes | no |
| `/people/:id` | `pages/people/PersonProfilePage.tsx` | yes | yes | yes |
| `/platform` | `pages/marketing/PlatformPage.tsx` | no | no | no |
| `/platform-admin` | `pages/admin/PlatformAdminPage.tsx` | no | yes | no |
| `/platform-admin/email-queue` | `pages/admin/EmailQueueDashboard.tsx` | no | yes | yes |
| `/platform-admin/organizations/:id` | `pages/admin/AdminOrganizationDetailPage.tsx` | no | yes | no |
| `/policies` | `pages/policies/PoliciesPage.tsx` | no | yes | no |
| `/policies/:id` | `pages/policies/PolicyDetailPage.tsx` | no | yes | no |
| `/portal/dashboard` | `pages/compliance-portal/CompliancePortalPage.tsx` | no | yes | no |
| `/portal/login` | `pages/compliance-portal/CompliancePortalPage.tsx` | no | yes | no |
| `/pricing` | `pages/marketing/PricingPage.tsx` | no | yes | no |
| `/privacy` | `pages/legal/PrivacyPolicyPage.tsx` | no | yes | no |
| `/register` | `pages/auth/RegisterPage.tsx` | no | yes | no |
| `/reporting` | `pages/reporting/ReportingPage.tsx` | no | yes | no |
| `/reports` | `pages/reporting/ReportingPage.tsx` | no | yes | no |
| `/reports/:reportId` | `pages/reporting/ReportBuilder.tsx` | no | yes | no |
| `/reset-expired` | `pages/auth/ResetExpiredPage.tsx` | no | yes | no |
| `/reset-invalid` | `pages/auth/ResetInvalidPage.tsx` | no | yes | no |
| `/reset-password` | `pages/auth/ResetPasswordPage.tsx` | no | yes | no |
| `/reset-success` | `pages/auth/ResetSuccessPage.tsx` | no | yes | no |
| `/room-checks` | `pages/room-checks/RoomChecksPage.tsx` | no | yes | no |
| `/schedule` | `pages/scheduling/RotaPlannerPage.tsx` | yes | yes | yes |
| `/scheduling` | `pages/scheduling/RotaPlannerPage.tsx` | yes | yes | yes |
| `/scheduling/overtime-claims` | `pages/scheduling/OvertimeClaimsPage.tsx` | no | yes | yes |
| `/security` | `pages/marketing/SecurityPage.tsx` | no | no | no |
| `/settings` | `pages/settings/SettingsPage.tsx` | no | yes | no |
| `/shift-marketplace` | `pages/shift-marketplace/ShiftMarketplacePage.tsx` | no | yes | no |
| `/signup` | `pages/auth/SignupPage.tsx` | no | yes | no |
| `/solutions/:slug` | `pages/marketing/SolutionsPage.tsx` | no | no | no |
| `/staff` | `pages/staff/StaffDirectoryPage.tsx` | yes | yes | no |
| `/staff/:userId` | `pages/staff/StaffProfilePage.tsx` | yes | yes | yes |
| `/survey/engagement/:token` | `pages/SurveyFormPage.tsx` | no | yes | no |
| `/survey/satisfaction/:token` | `pages/SurveyFormPage.tsx` | no | yes | no |
| `/swap-transfer` | `pages/homecare/SwapTransferPage.tsx` | no | yes | yes |
| `/tasks` | `pages/tasks/TasksPage.tsx` | no | yes | yes |
| `/terms` | `pages/legal/TermsOfUsePage.tsx` | no | yes | no |
| `/training` | `pages/training/TrainingMatrixPage.tsx` | yes | yes | no |
| `/unauthorized` | `pages/errors/UnauthorizedPage.tsx` | no | yes | no |
| `/unsubscribe` | `pages/legal/UnsubscribePage.tsx` | no | yes | yes |
| `/verify-email` | `pages/auth/VerifyEmailPage.tsx` | no | yes | no |

### Page-tree modules the router does not reach

Reachability follows relative imports transitively from every routed module and from the
entry points (`main.tsx`, `App.tsx`), so a sub-component reached from a routed page is not
listed here and neither is anything the router imports directly. An entry below is reached
by nothing in the application: dead code, or a page whose route was removed.

- `pages/LandingPage.tsx`
- `pages/marketing/BlogPage.tsx`

<!-- END generated route tracker -->
