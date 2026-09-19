/* Hallmark · macrostructure: Editorial · theme: Custom (care-ops editorial)
 * paper-band: mid (52%) · display-style: grotesk-sans · accent-hue: cool (teal 170°)
 */

/**
 * MeticleCare Marketing Design System — Editorial Pass
 * Anti-slop tokens. Navy + teal only. No purple, no pink, no gradients.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#0C1220',
  slate:      '#4A5568',
  muted:      '#8896A8',
  subtle:     '#CBD5E1',
  faint:      '#F0F4F8',

  paper:      '#FAFBFD',
  warm:       '#F7F5F2',
  card:       '#FFFFFF',

  /* Accent — teal only */
  teal:       '#00C9A7',
  tealDark:   '#00A88C',
  tealSoft:   '#E6FAF5',
  tealDeep:   '#065F56',
  tealMuted:  '#B2F0E3',

  /* Status */
  amber:      '#D97706',
  amberLight: '#FEF3C7',
  coral:      '#DC2626',
  coralLight: '#FEF2F2',
  green:      '#16A34A',
  greenLight: '#DCFCE7',

  /* Navy */
  navy:       '#0B1426',
  navyMid:    '#131D32',
  navyLight:  '#1C2B45',

  /* Dark sections */
  dark:       '#0B1426',
  darkMid:    '#111827',

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display: {
    fontSize: 'clamp(2.5rem, 5vw + 1rem, 4rem)',
    lineHeight: 1.05,
    fontWeight: 800 as const,
    letterSpacing: '-0.035em',
  },
  h1: {
    fontSize: 'clamp(1.75rem, 3.5vw + 0.5rem, 2.75rem)',
    lineHeight: 1.1,
    fontWeight: 700 as const,
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: 'clamp(1.375rem, 2.5vw + 0.5rem, 1.875rem)',
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
  },

  /* ── Transitions ─────────────────────────────────── */
  transition: {
    fast:   '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base:   '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
  },

  /* ── Animation ───────────────────────────────────── */
  ease: {
    out:    'cubic-bezier(0.16, 1, 0.3, 1)',
    in:     'cubic-bezier(0.7, 0, 0.84, 0)',
    inOut:  'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const
