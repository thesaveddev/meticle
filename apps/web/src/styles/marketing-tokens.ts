/**
 * MeticleCare Marketing Design System — Premium
 *
 * A distinctive, premium B2B healthcare SaaS visual identity.
 * Calm, trustworthy, intelligent, precise.
 * Not generic healthcare blue. Not AI template green.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#0F172A',   // primary text — near-black
  slate:      '#475569',   // secondary text
  muted:      '#94A3B8',   // tertiary / captions
  subtle:     '#CBD5E1',   // borders, hairlines
  faint:      '#F1F5F9',   // subtle backgrounds

  paper:      '#FAFBFC',   // page bg — clean neutral white
  warm:       '#F8F6F3',   // warm page bg variant
  card:       '#FFFFFF',   // card surfaces

  /* Accent — distinctive teal, not generic healthcare */
  teal:       '#00C9A7',
  tealDark:   '#00A88C',
  tealSoft:   '#E0F7F1',
  tealDeep:   '#065F56',

  /* Secondary accent — indigo for contrast */
  indigo:     '#6366F1',
  indigoLight:'#EEF2FF',

  /* Navy — deep, serious, trustworthy */
  navy:       '#0B1426',
  navyMid:    '#162033',
  navyLight:  '#1E2D45',

  /* Status */
  coral:      '#EF4444',
  amber:      '#F59E0B',
  green:      '#22C55E',
  greenLight: '#F0FDF4',

  /* Dark sections */
  dark:       '#0B1426',
  darkMid:    '#111827',
  darkCard:   '#1E293B',

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display: {
    size: 'clamp(2.75rem, 5vw + 1rem, 4.5rem)',
    height: 1.05,
    weight: 800 as const,
    tracking: '-0.035em',
  },
  h1: {
    size: 'clamp(2rem, 3.5vw + 0.5rem, 3.25rem)',
    height: 1.1,
    weight: 700 as const,
    tracking: '-0.025em',
  },
  h2: {
    size: 'clamp(1.5rem, 2.5vw + 0.5rem, 2.25rem)',
    height: 1.2,
    weight: 700 as const,
    tracking: '-0.02em',
  },
  h3: {
    size: 'clamp(1.125rem, 1.5vw + 0.25rem, 1.375rem)',
    height: 1.3,
    weight: 600 as const,
    tracking: '-0.01em',
  },
  bodyLg: { size: '1.125rem', height: 1.7, weight: 400 as const },
  body:   { size: '1rem',     height: 1.65, weight: 400 as const },
  small:  { size: '0.875rem', height: 1.5, weight: 400 as const },

  label:   { size: '0.8125rem', height: 1.4, weight: 600 as const, tracking: '0.02em' },
  caption: { size: '0.6875rem', height: 1.3, weight: 700 as const, tracking: '0.1em' },
  overline:{ size: '0.75rem',   height: 1.3, weight: 700 as const, tracking: '0.08em' },

  /* ── Spacing ─────────────────────────────────────── */
  section:   { py: { xs: 8, md: 14 }, px: 0 },
  container: { maxWidth: '1200px' as const, mx: 'auto' },

  /* ── Radii ───────────────────────────────────────── */
  r: { sm: '6px', md: '10px', lg: '14px', xl: '20px', full: '9999px' },

  /* ── Shadows ─────────────────────────────────────── */
  shadow: {
    xs:  '0 1px 2px rgba(0,0,0,0.04)',
    sm:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md:  '0 4px 12px rgba(0,0,0,0.07)',
    lg:  '0 10px 30px rgba(0,0,0,0.1)',
    xl:  '0 20px 50px rgba(0,0,0,0.14)',
    glow: '0 0 80px rgba(0,201,167,0.12)',
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
