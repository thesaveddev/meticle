/* Hallmark · genre: modern-minimal · macrostructure: Split Studio · tone: clear, calm care operations · theme: MeticleCare white-first
 * H2 ratio=7/5, proof=care-day sequence, divider=negative-space · nav=N1b compact five-link cluster · footer=Ft2 inline close
 * theme_axes: light paper / grotesk sans / chromatic green · Inter retained per brand commitment
 */

/**
 * Shared MeticleCare marketing tokens. Keep brand identity in deep navy,
 * emerald accents, warm bone surfaces, and charcoal ink. M.teal is reserved
 * for small marks; use M.tealDeep for text on light surfaces.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#1B2430',
  slate:      '#5B6672',
  muted:      '#5B6672',
  subtle:     '#8C979F',
  faint:      '#E7E1D6',

  paper:      '#F7F4EE',
  warm:       '#F7F4EE',
  card:       '#FFFFFF',

  /* Emerald accents; deep emerald is used for text on light surfaces. */
  teal:       '#10B981',
  tealDark:   '#02A995',
  tealSoft:   '#E8F5EE',
  tealDeep:   '#047857',
  tealMuted:  '#B3EEE6',
  cyan:       '#0187BA',
  sky:        '#3DB8FD',

  /* Status */
  amber:      '#D97706',
  amberLight: '#FEF3C7',
  coral:      '#DC2626',
  coralLight: '#FEF2F2',
  green:      '#047857',
  greenLight: '#DCFCE7',

  /* Deep navy identity, per PRODUCT.md brand commitment. */
  navy:       '#0F4C81',
  navyMid:    '#0A3A63',
  navyLight:  '#2C6B9D',

  /* Retained for existing non-marketing consumers. */
  dark:       '#1B2430',
  darkMid:    '#111923',

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display: {
    fontSize: 'clamp(2.5rem, 5vw + 1rem, 4rem)',
    // 1.0, not 1.05. A display line that tightens to the cap height reads as
    // confident and contemporary; 1.05 leaves a visible seam between lines.
    lineHeight: 1,
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
  r: { sm: '8px', md: '14px', lg: '20px', xl: '28px', full: '9999px' },

  /* ── Shadows ─────────────────────────────────────── */
  shadow: {
    xs:   '0 1px 2px rgba(27,36,48,0.04)',
    sm:   '0 1px 3px rgba(27,36,48,0.06), 0 1px 2px rgba(27,36,48,0.04)',
    md:   '0 4px 16px rgba(27,36,48,0.08)',
    lg:   '0 12px 32px rgba(27,36,48,0.10)',
    xl:   '0 24px 56px rgba(27,36,48,0.14)',
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
