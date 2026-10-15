/**
 * MeticleCare Design System — v2
 *
 * Premium UK care-technology visual identity.
 * Calm, trustworthy, intelligent, precise.
 */

/* ─── Palette ─────────────────────────────────────── */

export const P = {
  /* Primary — the logo-derived brand ramp (scripts/design/palette.mjs):
     Ink #0C1B2E, Mist Ground #F4F9FC, Hairline #E3E9F0, Brand Blue #0164C8. */
  navy:       '#0C1B2E',
  navyMid:    '#112539',
  navyLight:  '#2A3C54',
  slate:      '#51637A',
  slateLight: '#5D6E85',
  muted:      '#5D6E85',
  subtle:     '#C3D2E2',
  faint:      '#F7FAFE',

  /* Surfaces and the line that separates them. `hairline` is the brand Hairline
     (#E3E9F0): every card border, table rule and grid line in the app comes
     from it, so a page that retypes it is a page that will drift. */
  paper:      '#FCFDFF',
  warm:       '#F4F9FC',
  card:       '#FFFFFF',
  hairline:   '#E3E9F0',

  /* Accent — brand Mint, not generic healthcare teal */
  teal:       '#03C6B1',
  tealDark:   '#046E86',
  tealLight:  '#D2FBF4',
  tealDeep:   '#004E45',

  /* Secondary accent — indigo for contrast */
  indigo:     '#6B8AFD',
  indigoLight:'#EAF3FF',

  /* Status */
  red:        '#EF4444',
  redLight:   '#FEF0F0',
  amber:      '#F59E0B',
  amberLight: '#FFF7E6',
  green:      '#10B981',
  greenLight: '#EAFBF5',

  /* The product's action green — the value `CATEGORY_COLORS.mint` names — with the
     two shades a dark surface needs. `action` is what a confirm button is filled
     with (white on the brand emerald is about 2.3:1, so the darker green is the one
     a carer reads before approving a record), `actionHover` is that button pressed,
     and `greenOnDark` is the muted line above it. Named here rather than left as
     literals in the component because the theme's own `--mc-success-soft` cannot
     serve the last one: it is #123B34 under the dark theme, which is dark green
     text on a dark card. */
  action:      '#087A55',
  actionHover: '#076747',
  greenOnDark: '#6EE7B7',

  /* Brand primaries, straight from scripts/design/palette.mjs. Spelled out so
     a page that needs the brand blue as a literal — a print sheet, an inline
     style, a third-party button clone — has a name for it instead of retyping
     the hex and drifting onto #004B93 or #0158AC. */
  primary:      '#0164C8',
  primaryHover: '#0251B3',
  primaryDeep:  '#014FB5',

  /* Dark sections */
  dark:       '#0C1B2E',
  darkMid:    '#112539',
  darkCard:   '#112539',
  /* Deeper than ink, for a dark band stacked on another dark band. */
  inkDark:    '#081320',
} as const

/**
 * Categorical colour — one entry per category, hue carries no status meaning.
 *
 * Policies, appointment types, incident categories and team belts all need to
 * tell N items apart in a legend. The semantic set (success/warning/error/info)
 * cannot do that: eight categories must not read as eight severities, and two
 * categories sharing a hue is a legend nobody can read. So this is a categorical
 * ramp, declared once here so the policy directory, an eMAR chart and any future
 * module draw from the same ten hues instead of each inventing its own.
 *
 * Deliberately named by hue, not by category: the values outlive the categories
 * that currently use them.
 */
export const CATEGORY_COLORS = {
  blue:   '#0164C8',
  teal:   '#027A8B',
  green:  '#087443',
  crimson:'#B42318',
  amber:  '#9A6700',
  violet: '#8B7CF6',
  mint:   '#087A55',
  cyan:   '#087E8B',
  rust:   '#C4320A',
  plum:   '#9F1239',
} as const

/**
 * The Bristol Stool Form Scale, as published by the Royal College of Nursing.
 *
 * Clinical data, not brand colour: types 1–7 are conventionally charted in this
 * brown-to-green sequence and a carer reads the colour as the type number. They
 * are declared here so the scale exists once, with its provenance, rather than
 * sitting as seven anonymous literals inside the bowel-chart tab.
 */
export const BRISTOL_SCALE_COLORS: Record<number, string> = {
  1: '#6B4226',
  2: '#8B5E3C',
  3: '#A0785A',
  4: '#8FBC8F',
  5: '#D4A76A',
  6: '#D2B48C',
  7: '#C4A882',
}

/**
 * Third-party brand marks.
 *
 * Regulators publish their own colours and the card networks insist on theirs.
 * These are not MeticleCare brand values and must never be re-pointed at the
 * ramp above — a CQC badge in brand blue is a wrong badge. Declared here so the
 * two pages that need them import a name and lint.mjs can still fail any new
 * stray literal elsewhere.
 */
export const EXTERNAL_BRAND = {
  /* The four UK care regulators, each with the colour its own badge uses. */
  cqcBlue:               '#005EA5',
  ciwGreen:              '#00855A',
  careInspectorateBlue:  '#0065BD',
  rqiaPlum:              '#6D2077',
  /* Card networks' marks, used for the card artwork in billing. */
  amex:           '#1A1F71',
  amexAlt:        '#2E86AB',
  mastercardRed:  '#EB001B',
  mastercardGold: '#F79E1B',
} as const

/* ─── Typography ──────────────────────────────────── */

export const T = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  /* Display — hero headlines */
  display: {
    size: 'clamp(2.75rem, 5vw + 1rem, 4.25rem)',
    height: 1,
    weight: 800 as const,
    tracking: '-0.035em',
  },

  /* H1 — page titles */
  h1: {
    size: 'clamp(2rem, 3.5vw + 0.5rem, 3.25rem)',
    height: 1.1,
    weight: 700 as const,
    tracking: '-0.025em',
  },

  /* H2 — section titles */
  h2: {
    size: 'clamp(1.5rem, 2.5vw + 0.5rem, 2.25rem)',
    height: 1.2,
    weight: 700 as const,
    tracking: '-0.02em',
  },

  /* H3 — card/feature titles */
  h3: {
    size: 'clamp(1.125rem, 1.5vw + 0.25rem, 1.375rem)',
    height: 1.3,
    weight: 600 as const,
    tracking: '-0.01em',
  },

  /* Body */
  bodyLg: { size: '1.125rem', height: 1.7, weight: 400 as const },
  body:   { size: '1rem',     height: 1.65, weight: 400 as const },
  small:  { size: '0.875rem', height: 1.5, weight: 400 as const },

  /* Labels */
  label:    { size: '0.8125rem', height: 1.4, weight: 600 as const, tracking: '0.02em' },
  caption:  { size: '0.6875rem', height: 1.3, weight: 700 as const, tracking: '0.1em' },
  overline: { size: '0.75rem',   height: 1.3, weight: 700 as const, tracking: '0.08em' },
} as const

/* ─── Spacing & Layout ────────────────────────────── */

export const L = {
  container: { maxWidth: '1200px' as const },
  narrow:    { maxWidth: '900px' as const },
  wide:      { maxWidth: '1400px' as const },

  sectionPy: { xs: 8, md: 14 } as const,
  sectionPyCompact: { xs: 6, md: 10 } as const,
} as const

/* ─── Radii ───────────────────────────────────────── */

export const R = {
  sm:   '8px',
  md:   '14px',
  lg:   '20px',
  xl:   '28px',
  full: '9999px',
} as const

/* ─── Shadows ─────────────────────────────────────── */

export const S = {
  xs:  '0 1px 2px rgba(0,0,0,0.04)',
  sm:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  md:  '0 4px 12px rgba(0,0,0,0.07)',
  lg:  '0 10px 30px rgba(0,0,0,0.1)',
  xl:  '0 20px 50px rgba(0,0,0,0.14)',
  glow: '0 0 80px rgba(3,198,177,0.12)',
} as const

/* ─── Transitions ─────────────────────────────────── */

export const X = {
  fast:   '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base:   '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const
