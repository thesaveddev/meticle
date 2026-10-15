/**
 * Typography has to render in production, which is a claim about four files
 * agreeing: the stylesheet that declares the faces, the files those faces name,
 * the CSP that decides whether either may load, and index.html's preloads.
 *
 * It did not hold. `index.css` fetched Inter over
 * `@import url('https://fonts.googleapis.com/css2?…')`, and an `@import` is
 * fetched as a *stylesheet* — so `style-src` governed it, and the production CSP
 * allows only `style-src 'self'`. The @font-face rules never arrived, no font
 * file was ever requested, and the `fonts.gstatic.com` that `font-src` did allow
 * was waiting for a request that could not happen. Production rendered in the
 * system sans; every dev machine, which has no CSP, rendered Inter. The failure
 * lived exclusively in the environment where it is hardest to see.
 *
 * These are file assertions rather than a browser test on purpose. The property
 * is true at build time — nothing third-party in any stylesheet, every named file
 * present and really a woff2, and a CSP that needs nothing but 'self' for styles
 * and fonts — and reading that is cheap, deterministic, and does not need a
 * server, a network, or a browser to be meaningful.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WEB_ROOT = join(__dirname, '..', '..')
const SRC = join(WEB_ROOT, 'src')
const FONT_DIR = join(WEB_ROOT, 'public', 'fonts')
const FONTS_CSS = join(SRC, 'styles', 'fonts.css')
const INDEX_HTML = readFileSync(join(WEB_ROOT, 'index.html'), 'utf8')
const SNIPPET = readFileSync(join(WEB_ROOT, 'security-headers.conf'), 'utf8')

const WEIGHTS = [400, 500, 600, 700, 800, 900]

/** Every stylesheet the app ships, however deep it sits. */
function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.name.endsWith('.css') ? [full] : []
  })
}

interface Face {
  weight: number
  subset: string
  url: string
  body: string
}

/** The generated stylesheet, read the way a browser would read it. */
function faces(): Face[] {
  const css = readFileSync(FONTS_CSS, 'utf8')
  const parsed: Face[] = []
  const block = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = block.exec(css)) !== null) {
    const [, subset, body] = match
    parsed.push({
      subset,
      body,
      weight: Number(/font-weight:\s*(\d+)/.exec(body)?.[1]),
      url: /url\('([^']+)'\)/.exec(body)?.[1] ?? '',
    })
  }
  return parsed
}

describe('self-hosted typography', () => {
  it('declares every face completely, so no rule is silently ignored', () => {
    const all = faces()
    expect(all.length).toBeGreaterThan(0)
    for (const face of all) {
      const where = `${face.subset} ${face.weight}`
      // A missing family, a missing `unicode-range` (which is what decides which
      // file is used for which text) or a missing swap each makes the whole rule
      // inert, leaving a stylesheet that looks populated and renders nothing.
      expect(face.body, where).toMatch(/font-family:\s*'Inter'/)
      expect(face.body, where).toMatch(/font-style:\s*normal/)
      expect(face.body, where).toMatch(/font-display:\s*swap/)
      expect(face.body, where).toMatch(/unicode-range:\s*U\+/)
      expect(face.body, where).toMatch(/format\('woff2'\)/)
    }
  })

  it('covers every weight the design system uses, per subset', () => {
    const all = faces()
    expect(all.length).toBeGreaterThan(0)

    const subsets = [...new Set(all.map(f => f.subset))].sort()
    // A UK care platform still sets names outside latin, and these subsets are
    // what makes that render in Inter rather than in a fallback face.
    expect(subsets).toContain('latin')
    expect(subsets.length).toBeGreaterThanOrEqual(6)

    for (const weight of WEIGHTS) {
      const covered = all.filter(f => f.weight === weight).map(f => f.subset).sort()
      expect(covered, `weight ${weight}`).toEqual(subsets)
    }
  })

  it('names only files that exist, that are really woff2, and that are not empty', () => {
    for (const face of faces()) {
      expect(face.url, `${face.subset} ${face.weight}`).toMatch(/^\/fonts\/[a-z0-9.-]+\.woff2$/)

      const file = join(FONT_DIR, face.url.replace('/fonts/', ''))
      expect(existsSync(file), `${face.url} is referenced but does not exist`).toBe(true)

      // `wOF2` is the woff2 magic number. Without this check an error page or a
      // truncated download committed as a .woff2 would satisfy everything above
      // and render nothing, which is the same silent failure as the bug this
      // file exists for.
      expect(readFileSync(file).subarray(0, 4).toString('latin1'), file).toBe('wOF2')
      expect(statSync(file).size, file).toBeGreaterThan(1024)
    }
  })

  it('keeps the Inter licence beside the files it covers', () => {
    const licence = join(FONT_DIR, 'Inter-OFL.txt')
    expect(existsSync(licence)).toBe(true)
    expect(readFileSync(licence, 'utf8')).toMatch(/SIL Open Font License/)
  })

  it('loads no font from a third-party origin anywhere in the app', () => {
    const offenders: string[] = []
    for (const file of cssFiles(SRC)) {
      const css = readFileSync(file, 'utf8')
      // Both halves of the original bug: the Google Fonts stylesheet the app
      // fetched, and any stylesheet fetched over a bare `http(s)` URL — which a
      // same-origin-only `style-src` blocks, whatever it happens to contain.
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(css) || /@import\s+url\(\s*['"]?https?:/.test(css)) {
        offenders.push(file.replace(WEB_ROOT, ''))
      }
    }
    expect(offenders).toEqual([])
  })

  it('preloads only same-origin fonts, and says so with the attribute that matters', () => {
    expect(INDEX_HTML).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)

    const preloads = INDEX_HTML.match(/<link[^>]*rel="preload"[^>]*>/g) ?? []
    expect(preloads.length).toBeGreaterThan(0)

    for (const tag of preloads) {
      const href = /href="([^"]+)"/.exec(tag)?.[1] ?? ''
      expect(href, tag).toMatch(/^\/fonts\/[a-z0-9.-]+\.woff2$/)
      expect(tag, `${href} must be preloaded as a font`).toContain('as="font"')
      expect(tag, `${href} must declare its type`).toContain('type="font/woff2"')
      // Fonts are always fetched in CORS mode, even same-origin. Without
      // `crossorigin` the browser treats the preload as a different request and
      // downloads the file a second time on first paint.
      expect(tag, `${href} must be preloaded with crossorigin`).toContain('crossorigin')
      expect(existsSync(join(FONT_DIR, href.replace('/fonts/', ''))), `${href} does not exist`).toBe(true)
    }
  })

  it('needs nothing but self for styles and fonts', () => {
    const csp = /Content-Security-Policy "([^"]+)"/.exec(SNIPPET)?.[1] ?? ''
    expect(csp).toBeTruthy()

    const directive = (name: string) =>
      (csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) ?? '').slice(name.length).trim()

    // 'self' is the whole point: the stylesheet and the font files are both ours,
    // so nothing here needs broadening when the font is refreshed. If a future
    // change does need a third-party style or font origin, this is the assertion
    // that should make someone say why out loud.
    expect(directive('font-src')).toBe("'self'")
    expect(directive('style-src')).not.toMatch(/https?:\/\//)
    expect(csp).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
  })
})
