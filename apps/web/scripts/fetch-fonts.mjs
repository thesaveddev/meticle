#!/usr/bin/env node
/**
 * Downloads Inter and writes it into the app, instead of the app asking Google
 * for it at runtime.
 *
 * Why this exists. The design system is Inter across 400–900 (`DESIGN.md`,
 * `apps/web/src/index.css`), and the app used to get it with a CSS `@import` of
 * `https://fonts.googleapis.com/css2?...`. A `@import` is fetched as a
 * *stylesheet*, so it is `style-src` that decides whether it loads — and the
 * production CSP allows `style-src 'self' 'unsafe-inline'`. The Google
 * stylesheet was therefore blocked, no `@font-face` rule ever reached the page,
 * and every surface fell back to the system sans while the CSP happily allowed
 * `fonts.gstatic.com` for font files that were never referenced. The typography
 * the design specifies did not render in production, and nothing failed.
 *
 * Self-hosting rather than adding `fonts.googleapis.com` to `style-src`, for
 * three reasons: it keeps the CSP's style/font sources at `'self'` (no third
 * party is trusted for anything), it removes a request that sends every user's
 * IP and User-Agent to Google — which this product's DPIAs would otherwise have
 * to cover — and it lets the service worker cache the font, so the installed PWA
 * keeps its typography offline. The Inter licence (SIL OFL 1.1) permits
 * redistribution; `Inter-OFL.txt` is written alongside the files, as it requires.
 *
 * The files are exactly the ones Google serves — the same subsets, so the same
 * glyph coverage and the same `unicode-range` behaviour as before, with browsers
 * still downloading only the subset a page needs. The version is in each file's
 * name (`…v20.woff2`) so a refreshed Inter is a new URL rather than a stale
 * cached one under an immutable-cache location.
 *
 * Usage: npm run fonts --workspace=@meticle/web
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FONT_DIR = path.join(WEB_ROOT, 'public', 'fonts')
const CSS_OUT = path.join(WEB_ROOT, 'src', 'styles', 'fonts.css')

const WEIGHTS = [400, 500, 600, 700, 800, 900]
const GOOGLE_CSS = `https://fonts.googleapis.com/css2?family=Inter:wght@${WEIGHTS.join(';')}&display=swap`
/** Inter's licence, redistributed beside the font files as the OFL requires. */
const LICENSE_URL = 'https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt'

// Google serves woff2 only to a User-Agent it recognises as modern; with a
// default one it answers with truetype, which would triple the bytes on the wire
// and change nothing else. This is why the header is set rather than omitted.
const MODERN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** The Google Fonts CSS, one `/* subset *\/` comment followed by one @font-face. */
async function fetchCss() {
  const res = await fetch(GOOGLE_CSS, { headers: { 'User-Agent': MODERN_UA } })
  if (!res.ok) throw new Error(`Google Fonts CSS request failed: ${res.status} ${res.statusText}`)
  return res.text()
}

/**
 * Each face, as `{ subset, weight, url, unicodeRange, version }`.
 *
 * Parsed rather than trusted: Google's response is the only source of the
 * subset list, the file URLs and the ranges, and a silent shape change there is
 * the kind of thing that would otherwise produce a stylesheet with no faces in
 * it and no error anywhere.
 */
function parseFaces(css) {
  const faces = []
  const block = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g
  let match
  while ((match = block.exec(css)) !== null) {
    const [, subset, body] = match
    const weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1])
    const url = /url\((https:\/\/[^)]+)\)/.exec(body)?.[1]
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1]
    const version = /\/v(\d+)\//.exec(url || '')?.[1]
    if (!weight || !url || !unicodeRange || !version) {
      throw new Error(`Unreadable @font-face for "${subset}": ${body.replace(/\s+/g, ' ').trim()}`)
    }
    faces.push({ subset, weight, url, unicodeRange: unicodeRange.trim(), version })
  }

  // One face per (subset, weight) is the invariant the stylesheet below depends
  // on, so a short response is an error rather than a smaller font. 400 is the
  // reference: if a weight is missing a subset the others have, the browser
  // would fall back for those glyphs at that weight only — a difference nobody
  // would see in a screenshot.
  const unique = new Set(faces.map((f) => `${f.subset}-${f.weight}`))
  if (unique.size !== faces.length) throw new Error(`Duplicate faces: parsed ${faces.length}, ${unique.size} unique`)

  const reference = faces
    .filter((f) => f.weight === WEIGHTS[0])
    .map((f) => f.subset)
    .sort()
  if (!reference.includes('latin')) throw new Error('No latin subset in the response')

  for (const weight of WEIGHTS) {
    const subsets = faces
      .filter((f) => f.weight === weight)
      .map((f) => f.subset)
      .sort()
    if (subsets.join() !== reference.join()) {
      throw new Error(
        `Weight ${weight} covers [${subsets.join(', ')}] where ${WEIGHTS[0]} covers [${reference.join(', ')}]`,
      )
    }
  }
  console.log(`  ${WEIGHTS.length} weights × ${reference.length} subsets (${reference.join(', ')})`)

  // Weight-major, then alphabetical, so a re-run produces a byte-identical file.
  return faces.sort((a, b) => a.weight - b.weight || a.subset.localeCompare(b.subset))
}

/** `inter-latin-600-normal.v20.woff2` — subset, weight and version, all in the name. */
function fileName({ subset, weight, version }) {
  return `inter-${subset}-${weight}-normal.v${version}.woff2`
}

async function download(face) {
  const res = await fetch(face.url)
  if (!res.ok) throw new Error(`Font download failed for ${face.url}: ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())

  // A woff2 file starts with the ASCII tag `wOF2`. Checking it here is the one
  // place that catches an error page saved as a font, which would otherwise ship
  // as a file that silently never renders.
  if (bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`${face.url} is not a woff2 file (starts with "${bytes.subarray(0, 8).toString('latin1')}")`)
  }
  await writeFile(path.join(FONT_DIR, fileName(face)), bytes)
  return bytes.length
}

/** The generated stylesheet. Local URLs, Google's own ranges and order. */
function renderCss(faces, version) {
  const blocks = faces.map(
    (face) => `/* ${face.subset} */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  src: url('/fonts/${fileName(face)}') format('woff2');
  unicode-range: ${face.unicodeRange};
}`,
  )

  return `/**
 * Inter, self-hosted — generated by \`scripts/fetch-fonts.mjs\`. Do not edit.
 *
 * Google Fonts answered this with the same @font-face rules, but it was fetched
 * over \`@import\`, which is a *stylesheet* request and was therefore blocked by
 * the production CSP's \`style-src 'self'\`. The font never loaded and nothing
 * said so — see the script's header for the whole story.
 *
 * The subsets and their \`unicode-range\`s are Google's, unchanged, so a browser
 * still downloads only what the text on screen needs. Re-run
 * \`npm run fonts --workspace=@meticle/web\` to refresh.
 *
 * Inter v${version}, weights ${WEIGHTS.join(', ')}.
 */
${blocks.join('\n\n')}
`
}

/**
 * Point index.html's preloads at the version just written.
 *
 * The preloaded faces are named in two files — this generated stylesheet and
 * `index.html` — and the version lives in the filename. Refreshing Inter without
 * this step would leave the preloads asking for the previous version: a request
 * that 404s, that the browser then repeats unprompted for the real file, and that
 * nothing on the page would look wrong enough to notice.
 */
async function syncPreloads(indexPath, weights, version) {
  const before = await readFile(indexPath, 'utf8')
  let after = before
  for (const weight of weights) {
    const pattern = new RegExp(`/fonts/inter-latin-${weight}-normal\\.v\\d+\\.woff2`, 'g')
    if (!pattern.test(after)) {
      throw new Error(`index.html no longer preloads the latin ${weight} face — update the script or the preloads`)
    }
    pattern.lastIndex = 0
    after = after.replace(pattern, `/fonts/inter-latin-${weight}-normal.v${version}.woff2`)
  }
  if (after === before) return false
  await writeFile(indexPath, after)
  return true
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true })
  const faces = parseFaces(await fetchCss())
  const version = faces[0].version

  // Stale files from an earlier Inter are removed rather than left behind: the
  // version is in the name, so an orphan is a font nobody requests that would
  // still be served from an immutable-cache path forever.
  const keep = new Set(faces.map(fileName))
  const existing = await readdir(FONT_DIR)
  for (const name of existing) {
    if (/^inter-.*\.woff2$/.test(name) && !keep.has(name)) {
      await rm(path.join(FONT_DIR, name))
      console.log(`  removed stale ${name}`)
    }
  }

  let total = 0
  for (const face of faces) total += await download(face)

  const subsets = [...new Set(faces.map((f) => f.subset))]
  console.log(
    `✓ Inter v${version}: ${faces.length} faces (${WEIGHTS.length} weights × ${subsets.length} subsets) ` +
      `into public/fonts, ${(total / 1024).toFixed(0)} KiB total`,
  )

  await writeFile(CSS_OUT, renderCss(faces, version))
  console.log(`✓ Wrote src/styles/fonts.css (${faces.length} @font-face rules, all /fonts/ URLs)`)

  // The two weights index.html preloads: 400 is body copy everywhere, 600 is the
  // weight the app uses most. Anything else loads on demand.
  const changed = await syncPreloads(path.join(WEB_ROOT, 'index.html'), [400, 600], version)
  console.log(changed ? '✓ Updated index.html preloads to the new version' : '✓ index.html preloads already current')

  const license = await fetch(LICENSE_URL)
  if (!license.ok) throw new Error(`Inter licence request failed: ${license.status}`)
  await writeFile(path.join(FONT_DIR, 'Inter-OFL.txt'), await license.text())
  console.log('✓ Wrote public/fonts/Inter-OFL.txt (SIL OFL 1.1, as redistribution requires)')
}

main().catch((error) => {
  console.error(`✗ ${error.message}`)
  process.exit(1)
})
