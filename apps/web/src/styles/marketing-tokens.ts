/* Hallmark · genre: modern-minimal · macrostructure: Split Studio · tone: clear, calm care operations · theme: MeticleCare white-first
 * H2 ratio=7/5, proof=care-day sequence, divider=negative-space · nav=N1b compact five-link cluster · footer=Ft2 inline close
 * theme_axes: mist-ground paper / grotesk sans / chromatic brand blue · Inter retained per brand commitment
 */

/**
 * Shared MeticleCare marketing tokens. The identity is the logo-derived brand
 * ramp — Brand Blue #0164C8, Mint #03C6B1, Ink #0C1B2E and Mist Ground
 * #F4F9FC — the same values the product UI ships from, so the marketing
 * surface and the application present one blue and one mint. M.teal is
 * reserved for small marks; use M.tealDeep for text on light surfaces.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#0C1B2E',
  slate:      '#51637A',
  muted:      '#51637A',
  subtle:     '#5D6E85',
  faint:      '#E3E9F0',

  paper:      '#F4F9FC',
  warm:       '#F4F9FC',
  card:       '#FFFFFF',

  /* Brand mint accents; deep mint is used for text on light surfaces. */
  teal:       '#03C6B1',
  tealDark:   '#02A995',
  tealSoft:   '#D2FBF4',
  tealDeep:   '#004E45',
  tealMuted:  '#2DAE9D',
  cyan:       '#0187BA',
  sky:        '#3DB8FD',

  /* Status */
  amber:      '#F59E0B',
  amberLight: '#FFF7E6',
  coral:      '#EF4444',
  coralLight: '#FEF0F0',
  green:      '#087A55',
  greenLight: '#EAFBF5',

  /* Brand blue identity, per PRODUCT.md brand commitment. */
  navy:       '#0164C8',
  navyMid:    '#014FB5',
  navyLight:  '#0251B3',

  /* Retained for existing non-marketing consumers. */
  dark:       '#0C1B2E',
  darkMid:    '#081320',

  /* ── Figma marketing surfaces ────────────────────────
   * Exact shades from the marketing Figma frames. They live here (rather
   * than as literals) because scripts/design/lint.mjs forbids off-palette
   * hex in components absolutely; the linter harvests this module, so a
   * token value is automatically allowed. Near-duplicate Figma picks that
   * differ by a single 8-bit step (#EAF3FD/#EBF3FC vs #EAF3FC, #E4E9F1 vs
   * #E3EAF1, #F1F4F8 vs #EDF1F6) are unified onto one token — the delta is
   * far below perception and below the visual comparator's threshold. */
  bodyText:   '#2A3A50', // body copy on light; step circles on navy
  onNavyMuted:'#B7C4D6', // muted copy on navy bands
  arrowMuted: '#8A9AAE', // muted chevron/arrow icons
  rule:       '#C9D5E2', // strong hairlines, outlined-button borders
  hair:       '#E3EAF1', // card hairlines (unifies #E4E9F1)
  heroTint:   '#EAF3FC', // hero gradient stop (unifies #EAF3FD/#EBF3FC)
  gradMid:    '#F8FBFE', // brand-panel gradient mid-stop (auth pages, per Figma 1.7)
  heroGlow:   '#D2E3F6', // radial hero glow
  chipBlue:   '#E8F1FD', // pale-blue chips on navy text
  avBlue:     '#DCE9F7', // avatar ground, blue
  avGreen:    '#D2F3E3', // avatar ground, green
  avAmber:    '#FCEFC7', // avatar ground, amber
  blockBlue:  '#BFD9F5', // rota-block illustration
  barSand:    '#F5C97B', // chart bar, sand
  barAmber:   '#D9A441', // chart bar, amber
  selBorder:  '#D9E6F5', // selected-card border
  skel:       '#E8EDF3', // skeleton bars
  inset:      '#EDF1F6', // inset badges/tracks (unifies #F1F4F8)
  navIcon:    '#F4F8FB', // nav icon tile
  amberBand:  '#FFF3DC', // due/amber band
  amberText:  '#8A5300', // text on amberBand
  mintText:   '#7BE3D6', // text on mint-tint chips
  navyInk:    '#0152A6', // deep-blue text
  navyHover:  '#0157AD', // primary-button hover
  navyBadge:  '#1570CC', // trust-badge fill on the navy footer

  /* ── Typography ──────────────────────────────────── */
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display: {
    fontSize: 'clamp(2.5rem, 5vw + 1rem, 4rem)',
    // 1.0, not 1.05. A display line that tightens to the cap height reads as
    // confident and contemporary; 1.05 leaves a visible seam between lines.
    lineHeight: 1,
    fontWeight: 600 as const,
    letterSpacing: '-0.035em',
  },
  h1: {
    fontSize: 'clamp(1.75rem, 3.5vw + 0.5rem, 2.75rem)',
    lineHeight: 1.1,
    fontWeight: 600 as const,
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: 'clamp(1.375rem, 2.5vw + 0.5rem, 1.875rem)',
    lineHeight: 1.2,
    fontWeight: 600 as const,
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
  caption:  { fontSize: '0.6875rem', lineHeight: 1.3, fontWeight: 600 as const, letterSpacing: '0.1em' },
  overline: { fontSize: '0.75rem',   lineHeight: 1.3, fontWeight: 600 as const, letterSpacing: '0.08em' },

  /* ── Spacing ─────────────────────────────────────── */
  section:   { py: { xs: 8, md: 14 }, px: 0 },
  container: { maxWidth: '1200px' as const, mx: 'auto' },

  /* ── Radii ───────────────────────────────────────── */
  r: { sm: '8px', md: '14px', lg: '20px', xl: '28px', full: '9999px' },

  /* ── Shadows ─────────────────────────────────────── */
  shadow: {
    xs:   '0 1px 2px rgba(12,27,46,0.04)',
    sm:   '0 1px 3px rgba(12,27,46,0.06), 0 1px 2px rgba(12,27,46,0.04)',
    md:   '0 4px 16px rgba(12,27,46,0.08)',
    lg:   '0 12px 32px rgba(12,27,46,0.10)',
    xl:   '0 24px 56px rgba(12,27,46,0.14)',
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
