/**
 * CANONICAL DESIGN TOKENS — the single source of truth.
 *
 * These values were extracted from the code that actually ships, not from the
 * documentation. `scripts/design/lint.mjs` fails the build when a component
 * hardcodes a hex that is not in this palette, and `scripts/design/sync.mjs`
 * generates `.impeccable/design.json` from here, so the docs can no longer
 * drift from the code.
 *
 * Provenance (grep over apps/web/src at the time of writing):
 *   #0F4C81 -> 448 uses, #10B981 -> 110, #047857 -> 50, #1B2430 -> 18,
 *   #E7E1D6 -> 13, #F7F4EE -> 12, #0A3A63 -> 10
 *
 * Adding a colour here is the supported way to introduce one. Adding it as a
 * hex literal in a component is what lint.mjs exists to prevent.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hexToOklch, maxChroma, oklchToRgb, rgbToHex } from './oklch.mjs'

/**
 * Lightness targets for generated tonal ramps, dark to light.
 * Deliberately an even perceptual spread rather than hand-picked stops.
 */
export const RAMP_L = [0.15, 0.27, 0.38, 0.48, 0.58, 0.68, 0.8, 0.92]

/** Chroma taper: 1.0 at mid lightness, 0.55 at the extremes. */
function chromaWeight(L) {
  return 1 - 0.45 * Math.abs(2 * L - 1)
}

/**
 * The brand palette. `role` feeds the generated colorMeta, `name` is the
 * human label used in DESIGN.md.
 *
 * Sourced from the LOGO assets only (Horizontal, Stacked, Monochrome), by
 * `node scripts/brand-colors.mjs "Store assets"`, which decodes the PNGs and
 * clusters their pixels. Weighted roll-up:
 *
 *   #3DB8FD 17.1%  #0164C8 10.2%  #014FB5 10.1%  #0187BA 9.6%
 *   #028ABA  8.0%  #03C6B1  7.7%
 *
 * NOT sourced from the Play Store icons: those are a brighter, more electric
 * blue (#0170FD / #0052EE) that does not match the logo. Google's Play badge
 * is a third-party brand and is excluded outright.
 *
 * The old navy #0F4C81 + emerald #10B981 pairing came from none of these assets.
 *
 * Slot names are kept stable so the `{colors.*}` references in DESIGN.md's
 * components block keep resolving, but the values are the brand's.
 */
export const PALETTE = {
  navy: { value: '#0164C8', role: 'primary', name: 'Brand Blue' },
  'navy-deep': { value: '#014FB5', role: 'primary', name: 'Brand Deep Blue' },
  'brand-blue': { value: '#149DFC', role: 'primary', name: 'Brand Bright Blue' },
  'brand-darkest': { value: '#0251B3', role: 'primary', name: 'Brand Darkest' },
  sky: { value: '#3DB8FD', role: 'primary', name: 'Sky' },
  'sky-bright': { value: '#50C7FD', role: 'primary', name: 'Sky Bright' },
  mint: { value: '#03C6B1', role: 'accent', name: 'Mint' },
  'mint-deep': { value: '#02A995', role: 'accent', name: 'Mint Deep' },
  'mint-hover': { value: '#046E86', role: 'accent', name: 'Accent Deep' },
  teal: { value: '#028ABA', role: 'accent', name: 'Teal' },
  cyan: { value: '#0187BA', role: 'accent', name: 'Cyan' },
  ink: { value: '#0C1B2E', role: 'neutral', name: 'Ink' },
  'ink-dark': { value: '#081320', role: 'neutral', name: 'Ink Dark' },
  'ink-deep': { value: '#112539', role: 'neutral', name: 'Ink Deep' },
  bone: { value: '#F4F9FC', role: 'neutral', name: 'Mist Ground' },
  mist: { value: '#51637A', role: 'neutral', name: 'Slate' },
  hairline: { value: '#E3E9F0', role: 'neutral', name: 'Hairline' },
  'text-deep': { value: '#3A4551', role: 'neutral', name: 'Text Deep' },
  'outline-button-border': { value: '#C3D2E2', role: 'neutral', name: 'Outline Button Border' },
  'window-border': { value: '#D6E2EE', role: 'neutral', name: 'Window Border' },
  'window-chrome': { value: '#F7FAFE', role: 'neutral', name: 'Window Chrome' },
  'window-chrome-line': { value: '#E3E9F0', role: 'neutral', name: 'Window Chrome Line' },
  'button-on-navy': { value: '#FFFFFF', role: 'neutral', name: 'Button On Navy' },
  'button-on-navy-hover': { value: '#EAF2FB', role: 'neutral', name: 'Button On Navy Hover' },
  'foot-muted': { value: '#8497AC', role: 'neutral', name: 'Foot Muted' },
  'foot-heading': { value: '#E8EEF6', role: 'neutral', name: 'Foot Heading' },
  white: { value: '#FFFFFF', role: 'neutral', name: 'White' },
}

/** Non-hex tokens that legitimately appear inline in components. */
export const ALLOWED_ALPHA_TOKENS = {
  'foot-hairline': 'rgba(255,255,255,0.12)',
  'compliance-row-hairline': 'rgba(255,255,255,0.24)',
  'step-connector': 'rgba(3,198,177,0.4)',
}

export const RADIUS = { sm: '8px', md: '14px', lg: '20px', xl: '28px' }

export const SPACING = {
  base: '8px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  section: '56px',
  'section-xl': '60px',
}

export const TYPOGRAPHY = {
  display: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    fontSize: '3.4rem',
    fontWeight: 900,
    // Tightened from 1.06 during the competitor craft review: display lines now
    // close to the cap height, matching marketing-tokens.ts M.display.
    lineHeight: 1,
    letterSpacing: '-0.03em',
  },
  headline: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    fontSize: '2.7rem',
    fontWeight: 800,
    lineHeight: 1.12,
    letterSpacing: '-0.025em',
  },
  title: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    fontSize: '1rem',
    fontWeight: 800,
  },
  body: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    fontSize: '1.12rem',
    fontWeight: 400,
    lineHeight: 1.7,
  },
  label: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
}

/**
 * Generate an even 8-stop tonal ramp for one hex, holding hue and clamping
 * chroma into the sRGB gamut. Deterministic: no randomness, no rounding drift.
 */
export function tonalRamp(hex) {
  const { C, h } = hexToOklch(hex)
  return RAMP_L.map((L) => {
    const target = C * chromaWeight(L)
    const c = Math.min(target, maxChroma(L, h))
    return rgbToHex(oklchToRgb({ L, C: c, h }))
  })
}

/** The colorMeta block written into .impeccable/design.json. */
export function buildColorMeta() {
  const out = {}
  for (const [key, spec] of Object.entries(PALETTE)) {
    out[key] = {
      role: spec.role,
      displayName: spec.name,
      canonical: spec.value,
      tonalRamp: tonalRamp(spec.value),
    }
  }
  return out
}

/**
 * The master UI palette's home: the central token modules the app ships from
 * (context/ThemeContext.tsx METICLE_COLORS / METICLE_CHART_PALETTE, index.css
 * --mc-*, theme/noticeTokens.ts, styles/tokens.ts, styles/marketing-tokens.ts,
 * mobile/src/theme.tsx). The application-wide colour overhaul made these the
 * source of truth for app-UI colour; the logo-derived PALETTE above documents
 * and generates the brand artefacts. lint.mjs allows any hex these modules
 * declare, so a component that hardcodes a stray colour still fails while a
 * token value does not. Harvested at runtime so the two cannot drift apart.
 */
const TOKEN_MODULES = [
  'apps/web/src/context/ThemeContext.tsx',
  'apps/web/src/index.css',
  'apps/web/src/theme/noticeTokens.ts',
  'apps/web/src/styles/tokens.ts',
  'apps/web/src/styles/marketing-tokens.ts',
  'apps/mobile/src/theme.tsx',
]

/** Every hex the brand legitimately uses, uppercased. Used by lint.mjs. */
export function allowedHexes() {
  const allowed = new Set(Object.values(PALETTE).map((p) => p.value.toUpperCase()))
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  for (const rel of TOKEN_MODULES) {
    const src = readFileSync(resolve(root, rel), 'utf8')
    for (const m of src.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
      const body = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
      allowed.add(`#${body.toUpperCase()}`)
    }
  }
  return allowed
}