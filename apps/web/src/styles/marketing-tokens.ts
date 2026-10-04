/* Hallmark · macrostructure: Editorial · theme: Custom (care-ops editorial)
 * paper-band: mid (52%) · display-style: grotesk-sans · accent-hue: cool (cyan 185°)
 */

/**
 * MeticleCare Marketing Design System — brand rebuild.
 *
 * Palette derived from the LOGO assets only, by `scripts/brand-colors.mjs`,
 * which decodes the actual PNGs and clusters their pixels. Weighted across
 * Horizontal, Stacked and Monochrome logos:
 *
 *   #3DB8FD  17.1%   sky          #0164C8  10.2%   brand blue
 *   #014FB5  10.1%   deep blue    #0187BA   9.6%   teal-cyan
 *   #028ABA   8.0%   teal         #03C6B1   7.7%   mint
 *
 * The Play Store icons are deliberately NOT the source. They are a brighter,
 * more electric blue (#0170FD / #0052EE) that does not match the logo, and
 * Google's own Play badge is third-party brand and excluded outright. The logo
 * is deeper and more teal; the brand is built on that.
 *
 * The previous navy #0B1426 + emerald #00C9A7 pairing came from none of these
 * assets at all.
 *
 * Two recommended additions, both derived from logo hues rather than invented:
 *  - `tealDeep` #046E86. The logo's mint/teal fails AA as small text on white
 *    (#03C6B1 is ~1.9:1). This darkened sibling keeps the hue and passes.
 *  - `navy` #014FB5 rather than #0164C8, so white on dark bands lands near
 *    8.5:1 instead of ~6.6:1 — same hue, more headroom for body copy.
 *
 * Key names are deliberately unchanged. Every marketing page reads M.navy,
 * M.teal, M.slate and so on, so re-pointing them here re-skins the whole
 * marketing surface at once instead of touching a dozen page files.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#0C1B2E',
  slate:      '#51637A',
  muted:      '#8497AC',
  subtle:     '#C3D2E2',
  faint:      '#EEF4FB',

  paper:      '#F7FAFE',
  warm:       '#F4F9FC',
  card:       '#FFFFFF',

  /* Accent — mint + teal, from the logo */
  teal:       '#03C6B1',
  tealDark:   '#02A995',
  tealSoft:   '#E4FAF6',
  tealDeep:   '#046E86',
  tealMuted:  '#B3EEE6',
  cyan:       '#0187BA',
  sky:        '#3DB8FD',

  /* Status */
  amber:      '#D97706',
  amberLight: '#FEF3C7',
  coral:      '#DC2626',
  coralLight: '#FEF2F2',
  green:      '#0E9F6E',
  greenLight: '#DCFCE7',

  /* Brand blue — from the logo.
     `navy` is #0164C8, the modal colour in the logo assets (10.2%), not the
     deeper #014FB5. The deeper blue read as heavy against the mint accent and
     was doing the CTA label only 3.49:1 — an AA failure at 0.9rem/700. The
     brighter brand blue gives white-on-fill 5.74:1, and button *text* on mint
     is ink instead of any blue (8.02:1). */
  navy:       '#0164C8',
  navyMid:    '#014FB5',
  navyLight:  '#149DFC',

  /* Dark sections */
  dark:       '#0C1B2E',
  darkMid:    '#112539',

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
    xs:   '0 1px 2px rgba(0,0,0,0.04)',
    sm:   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md:   '0 4px 16px rgba(1,71,184,0.08)',
    lg:   '0 12px 32px rgba(1,71,184,0.10)',
    xl:   '0 24px 56px rgba(1,71,184,0.14)',
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
