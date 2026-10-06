/**
 * MeticleCare Design System — v2
 *
 * Premium UK care-technology visual identity.
 * Calm, trustworthy, intelligent, precise.
 */

/* ─── Palette ─────────────────────────────────────── */

export const P = {
  /* Primary — deep, serious, trustworthy */
  navy:       '#17202A',
  navyMid:    '#1E293B',
  navyLight:  '#334155',
  slate:      '#475467',
  slateLight: '#667085',
  muted:      '#94A3B8',
  subtle:     '#CBD5E1',
  faint:      '#F5F7FA',

  /* Surfaces */
  paper:      '#FBFCFE',
  warm:       '#F7F9FC',
  card:       '#FFFFFF',

  /* Accent — distinctive teal, not generic healthcare */
  teal:       '#10BFA5',
  tealDark:   '#0C9E89',
  tealLight:  '#E8FAF6',
  tealDeep:   '#087A55',

  /* Secondary accent — indigo for contrast */
  indigo:     '#6B8AFD',
  indigoLight:'#F4F8FF',

  /* Status */
  red:        '#EF4444',
  redLight:   '#FEF0F0',
  amber:      '#F59E0B',
  amberLight: '#FFF7E6',
  green:      '#10B981',
  greenLight: '#EAFBF5',

  /* Dark sections */
  dark:       '#17202A',
  darkMid:    '#17202A',
  darkCard:   '#1E293B',
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
  glow: '0 0 80px rgba(0,201,167,0.12)',
} as const

/* ─── Transitions ─────────────────────────────────── */

export const X = {
  fast:   '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base:   '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const
