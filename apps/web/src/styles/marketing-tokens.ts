/**
 * MeticleCare Marketing Design System — Editorial Operations
 *
 * Two-key system: deep navy identity + single emerald accent.
 * Warm bone grounds, charcoal ink, Inter, editorial hairlines.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#1B2430',   // charcoal ink — primary text
  slate:      '#5B6672',   // secondary text
  muted:      '#8E98A3',   // tertiary / captions
  subtle:     '#C9C2B4',   // borders, hairlines
  faint:      '#E7E1D6',   // editorial rules

  paper:      '#F7F4EE',   // warm bone ground
  warm:       '#FCFAF6',   // warm chrome
  card:       '#FFFFFF',   // card surfaces

  /* Accent — deliberately rare emerald */
  teal:       '#10B981',
  tealDark:   '#065F46',
  tealSoft:   '#ECFDF5',
  tealDeep:   '#047857',
  tealMuted:  '#A7F3D0',

  /* Status */
  amber:      '#F59E0B',
  amberLight: '#FEF3C7',
  coral:      '#EF4444',
  green:      '#22C55E',

  /* Navy — deep, serious, trustworthy */
  navy:       '#0F4C81',
  navyMid:    '#0A3A63',
  navyLight:  '#132E4F',

  /* Dark sections */
  dark:       '#0B1426',
  darkMid:    '#141C24',
  darkCard:   '#1D2733',

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display: {
    fontSize: 'clamp(2.5rem, 5vw + 1rem, 4rem)',
    lineHeight: 1.06,
    fontWeight: 900 as const,
    letterSpacing: '-0.03em',
  },
  h1: {
    fontSize: 'clamp(1.75rem, 3.5vw + 0.5rem, 2.75rem)',
    lineHeight: 1.12,
    fontWeight: 800 as const,
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: 'clamp(1.25rem, 2.5vw + 0.5rem, 2rem)',
    lineHeight: 1.2,
    fontWeight: 800 as const,
    letterSpacing: '-0.02em',
  },
  h3: {
    fontSize: 'clamp(1.05rem, 1.5vw + 0.25rem, 1.25rem)',
    lineHeight: 1.3,
    fontWeight: 700 as const,
    letterSpacing: '-0.01em',
  },
  bodyLg: { fontSize: '1.125rem', lineHeight: 1.7, fontWeight: 400 as const },
  body:   { fontSize: '1rem',     lineHeight: 1.65, fontWeight: 400 as const },
  small:  { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 as const },

  label:    { fontSize: '0.8125rem', lineHeight: 1.4, fontWeight: 700 as const, letterSpacing: '0.02em' },
  caption:  { fontSize: '0.6875rem', lineHeight: 1.3, fontWeight: 800 as const, letterSpacing: '0.1em' },
  overline: { fontSize: '0.75rem',   lineHeight: 1.3, fontWeight: 800 as const, letterSpacing: '0.08em' },

  /* ── Spacing ─────────────────────────────────────── */
  section:   { py: { xs: 9, md: 14 }, px: 0 },
  container: { maxWidth: '1200px' as const, mx: 'auto' },

  /* ── Radii ───────────────────────────────────────── */
  r: { sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px' },

  /* ── Shadows ─────────────────────────────────────── */
  shadow: {
    xs:   '0 1px 2px rgba(20,32,45,0.04)',
    sm:   '0 1px 3px rgba(20,32,45,0.06), 0 1px 2px rgba(20,32,45,0.04)',
    md:   '0 4px 16px rgba(20,32,45,0.06)',
    lg:   '0 12px 32px rgba(20,32,45,0.08)',
    xl:   '0 24px 56px rgba(20,32,45,0.12)',
    navy: '0 24px 56px rgba(20,32,45,0.25)',
  },

  /* ── Transitions ─────────────────────────────────── */
  transition: {
    fast:   '150ms cubic-bezier(0.16, 1, 0.3, 1)',
    base:   '250ms cubic-bezier(0.16, 1, 0.3, 1)',
    smooth: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const

/* Section tone helper */
export type SectionTone = 'light' | 'warm' | 'dark' | 'accent' | 'gradient'

export const sectionBg: Record<SectionTone, string> = {
  light:   M.card,
  warm:    M.paper,
  dark:    M.navy,
  accent:  M.teal,
  gradient: M.navy,
}
