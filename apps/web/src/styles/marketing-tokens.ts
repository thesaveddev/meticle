/**
 * MeticleCare Marketing Design System — v3
 *
 * Premium B2B healthcare SaaS visual identity.
 * Calm, trustworthy, intelligent, precise.
 * Distinctive teal accent, deep navy foundations, warm neutrals.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#0C1220',   // primary text — deep near-black
  slate:      '#4A5568',   // secondary text
  muted:      '#8896A8',   // tertiary / captions
  subtle:     '#CBD5E1',   // borders, hairlines
  faint:      '#F0F4F8',   // subtle backgrounds

  paper:      '#FAFBFD',   // page bg — cool white
  warm:       '#F7F5F2',   // warm page bg variant
  card:       '#FFFFFF',   // card surfaces

  /* Accent — distinctive teal */
  teal:       '#00C9A7',
  tealDark:   '#00A88C',
  tealSoft:   '#E6FAF5',
  tealDeep:   '#065F56',
  tealMuted:  '#B2F0E3',

  /* Secondary — warm amber for compliance/warnings */
  amber:      '#F59E0B',
  amberLight: '#FEF3C7',

  /* Status */
  coral:      '#EF4444',
  coralLight: '#FEF2F2',
  green:      '#22C55E',
  greenLight: '#F0FDF4',
  blue:       '#3B82F6',
  blueLight:  '#EFF6FF',
  purple:     '#8B5CF6',
  purpleLight:'#F5F3FF',
  pink:       '#EC4899',
  pinkLight:  '#FDF2F8',

  /* Navy — deep, serious, trustworthy */
  navy:       '#0B1426',
  navyMid:    '#131D32',
  navyLight:  '#1C2B45',

  /* Dark sections */
  dark:       '#0B1426',
  darkMid:    '#111827',
  darkCard:   '#1E293B',

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display: {
    fontSize: 'clamp(2.5rem, 5vw + 1rem, 4.25rem)',
    lineHeight: 1.05,
    fontWeight: 800 as const,
    letterSpacing: '-0.035em',
  },
  h1: {
    fontSize: 'clamp(1.75rem, 3.5vw + 0.5rem, 3rem)',
    lineHeight: 1.1,
    fontWeight: 700 as const,
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: 'clamp(1.375rem, 2.5vw + 0.5rem, 2rem)',
    lineHeight: 1.2,
    fontWeight: 700 as const,
    letterSpacing: '-0.02em',
  },
  h3: {
    fontSize: 'clamp(1.05rem, 1.5vw + 0.25rem, 1.25rem)',
    lineHeight: 1.3,
    fontWeight: 600 as const,
    letterSpacing: '-0.01em',
  },
  bodyLg: { fontSize: '1.125rem', lineHeight: 1.7, fontWeight: 400 as const },
  body:   { fontSize: '1rem',     lineHeight: 1.65, fontWeight: 400 as const },
  small:  { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 as const },

  label:    { fontSize: '0.8125rem', lineHeight: 1.4, fontWeight: 600 as const, letterSpacing: '0.02em' },
  caption:  { fontSize: '0.6875rem', lineHeight: 1.3, fontWeight: 700 as const, letterSpacing: '0.1em' },
  overline: { fontSize: '0.75rem',   lineHeight: 1.3, fontWeight: 700 as const, letterSpacing: '0.08em' },

  /* ── Spacing ─────────────────────────────────────── */
  section:   { py: { xs: 8, md: 14 }, px: 0 },
  container: { maxWidth: '1200px' as const, mx: 'auto' },

  /* ── Radii ───────────────────────────────────────── */
  r: { sm: '6px', md: '10px', lg: '14px', xl: '20px', full: '9999px' },

  /* ── Shadows ─────────────────────────────────────── */
  shadow: {
    xs:   '0 1px 2px rgba(0,0,0,0.04)',
    sm:   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md:   '0 4px 16px rgba(0,0,0,0.06)',
    lg:   '0 12px 32px rgba(0,0,0,0.08)',
    xl:   '0 24px 56px rgba(0,0,0,0.12)',
    glow: '0 0 80px rgba(0,201,167,0.12)',
    navy: '0 24px 56px rgba(11,20,38,0.25)',
  },

  /* ── Transitions ─────────────────────────────────── */
  transition: {
    fast:   '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base:   '250ms cubic-bezier(0.4, 0, 0.2, 1)',
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
  gradient: `linear-gradient(165deg, ${M.navy} 0%, ${M.navyMid} 55%, ${M.navyLight} 100%)`,
}
