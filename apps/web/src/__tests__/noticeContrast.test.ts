/**
 * Guards the `notice.*` palette tokens and the migration onto them.
 *
 * ## What went wrong
 *
 * Notices across 38 files were built as `<Paper sx={{ bgcolor: 'success.light' }}>`
 * and the equivalents, on the assumption that `palette.success.light` is a pale
 * tint. It is not — MUI keeps it a *mid* tone (`#4caf50` in light, `#10B981` in
 * dark) and its own `<Alert>` is readable only because `Alert.js` derives a
 * surface with `lighten(light, 0.9)` and a foreground with `darken(light, 0.6)`.
 * Every hand-rolled site bypassed that derivation and used the mid tone
 * directly, under a hardcoded dark label: `#087A55` on `success.light` measured
 * 2.76:1, and on the dark-mode tone the palette swaps to, 1.58–2.73:1. Failing
 * WCAG AA in both modes.
 *
 * `grey.50`/`grey.100` were the same mistake with grey: `#F9FAFB`/`#F7F9FC` in
 * *both* modes, so they became white boxes on a dark page. Three further sites
 * used `success.50`/`warning.50`/`error.50`, which are not MUI tokens at all —
 * the literal string reached CSS as a background value, was discarded, and
 * those elements rendered with no background whatsoever.
 *
 * ## Why these assertions
 *
 * The contrast is computed from the *real* theme rather than from the constants
 * in `noticeTokens.ts`, so editing a token to something that looks right but
 * measures wrong fails here. Dark-mode surfaces are rgba tints and have to be
 * composited over `background.paper` first, which is the mistake of comparing
 * an alpha value as if it were opaque.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createMeticleTheme, type ThemeMode } from '../context/ThemeContext'

/** WCAG 2.1 AA for normal-size text. */
const AA_TEXT = 4.5

type Rgb = [number, number, number]

function toRgb(colour: string): Rgb {
  const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colour.trim())
  if (hex) {
    return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)]
  }
  const rgba = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?\s*\)$/i.exec(
    colour.trim(),
  )
  if (rgba) {
    return [parseInt(rgba[1], 10), parseInt(rgba[2], 10), parseInt(rgba[3], 10)]
  }
  throw new Error(`unrecognised colour: ${colour}`)
}

function alphaOf(colour: string): number {
  const rgba = /rgba\(/i.test(colour)
  if (!rgba) return 1
  const m = /[,/\s]+([\d.]+)\s*\)$/.exec(colour.trim())
  return m ? parseFloat(m[1]) : 1
}

/** Flattens a possibly-translucent surface onto what is behind it. */
function composite(colour: string, behind: string): Rgb {
  const fg = toRgb(colour)
  const a = alphaOf(colour)
  const bg = toRgb(behind)
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))) as Rgb
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const MODES: ThemeMode[] = ['light', 'dark']
const VARIANTS = ['success', 'error', 'warning', 'info'] as const

describe('notice palette tokens are readable in both modes', () => {
  for (const mode of MODES) {
    const palette = createMeticleTheme(mode).palette
    const paper = palette.background.paper

    describe(mode, () => {
      for (const variant of VARIANTS) {
        const { bg, fg } = palette.notice[variant]
        // In dark mode `bg` is an alpha tint, so it only becomes a real
        // surface once it is composited over the paper it sits on.
        const surface = composite(bg, paper)

        it(`${variant} foreground clears ${AA_TEXT}:1 on its own surface`, () => {
          const ratio = contrast(toRgb(fg), surface)
          expect(
            ratio,
            `${variant} in ${mode}: ${fg} on ${bg} over ${paper} is ${ratio.toFixed(2)}:1, ` +
              `below AA ${AA_TEXT}:1`,
          ).toBeGreaterThanOrEqual(AA_TEXT)
        })

        it(`${variant} inherited body text clears ${AA_TEXT}:1 on its surface`, () => {
          // Most children of a notice inherit `text.primary` rather than
          // setting `notice.<v>.fg`, so the surface has to work for both.
          const ratio = contrast(toRgb(palette.text.primary), surface)
          expect(
            ratio,
            `${variant} in ${mode}: text.primary on ${bg} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(AA_TEXT)
        })

        it(`${variant} surface is distinguishable from the page behind it`, () => {
          // A notice that matches the paper is not a notice.
          const ratio = contrast(surface, toRgb(paper))
          expect(
            ratio,
            `${variant} in ${mode}: ${bg} is only ${ratio.toFixed(2)}:1 against ${paper}`,
          ).toBeGreaterThan(1.05)
        })
      }

      it('subtle and muted insets are readable and distinct from paper', () => {
        for (const name of ['subtle', 'muted'] as const) {
          const { bg } = palette.notice[name]
          const surface = composite(bg, paper)
          const text = contrast(toRgb(palette.text.primary), surface)
          const paper_ = contrast(surface, toRgb(paper))
          expect(text, `${name} in ${mode}: text.primary is ${text.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT)
          expect(paper_, `${name} in ${mode}: indistinguishable from paper`).toBeGreaterThan(1.02)
        }
      })
    })
  }
})

/**
 * The migration was a codemod over 71 files, so the interesting regression is
 * the *next* copy-paste. These are the shapes that were wrong.
 */
describe('light-only and non-existent tokens stay gone', () => {
  function pageFiles(dir = join(process.cwd(), 'src'), out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        pageFiles(p, out)
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(p)
      }
    }
    return out
  }

  /** Removes `/* *\/` and `//` comments so historical explanations are exempt. */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/[^\n]*$/gm, '')
  }

  const FORBIDDEN: Record<string, string> = {
    "bgcolor: 'success.light'": 'palette.*.light is a mid tone, not a tint — use notice.success.bg',
    "bgcolor: 'error.light'": 'palette.*.light is a mid tone, not a tint — use notice.error.bg',
    "bgcolor: 'warning.light'": 'palette.*.light is a mid tone, not a tint — use notice.warning.bg',
    "bgcolor: 'info.light'": 'palette.*.light is a mid tone, not a tint — use notice.info.bg',
    "bgcolor: '#F8FAFC'": 'near-white in both modes — use notice.subtle.bg',
    "bgcolor: '#F7F9FC'": 'near-white in both modes — use notice.muted.bg',
    "'success.50'": 'not an MUI token; the literal reached CSS and was discarded',
    "'warning.50'": 'not an MUI token; the literal reached CSS and was discarded',
    "'error.50'": 'not an MUI token; the literal reached CSS and was discarded',
  }

  it('no page reintroduces a light-only surface', () => {
    const offenders: string[] = []
    for (const file of pageFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const [pattern, advice] of Object.entries(FORBIDDEN)) {
        if (code.includes(pattern)) {
          offenders.push(`${file.replace(/\\/g, '/')}: ${pattern} — ${advice}`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('no page uses a foreground token as a background', () => {
    const offenders: string[] = []
    for (const file of pageFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'))
      const bad = code.match(/(bgcolor|backgroundColor):\s*'notice\.\w+\.fg'/g)
      if (bad) offenders.push(`${file.replace(/\\/g, '/')}: ${bad.join(', ')}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
