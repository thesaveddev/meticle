/**
 * Sweeps every user-facing surface and document for claims we cannot evidence.
 *
 * `marketingClaims.test.ts` covers the public marketing and legal pages. This
 * covers the rest of where a claim can reach a person, and it is the half that
 * was missing when "Live location" survived on the download page months after
 * we withdrew it from the map.
 *
 * Three surfaces are added:
 *
 *   - Public pages outside `pages/marketing` (landing, download).
 *   - The signed-in app, including the carer-facing mobile screens. Not public,
 *     but not private either — a claim in the app is read by the person being
 *     tracked, who is the least able to check it.
 *   - Customer- and regulator-facing documents in `docs/`, which ship as app
 *     store metadata and in procurement packs.
 *
 * Extraction is AST-based for code and raw text for markdown. A regex over a
 * .tsx file would match the explanatory comments this codebase is full of, and
 * would miss a sentence a JSX expression splits across two elements.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep, extname } from 'node:path'
import * as ts from 'typescript'
import {
  CLAIM_SURFACES,
  FORBIDDEN_CLAIMS,
  REGISTERED_CLAIMS,
  RESTRICTED_LOGOS,
  FORBIDDEN_LOGO_REFERENCES,
  DOCUMENT_ALLOWANCES,
  unDeniedMatches,
  allowanceFor,
} from './marketingClaims'

function findRepoRoot(): string {
  let dir = __dirname
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'docs', 'GO_LIVE_READINESS.md'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not locate the repository root from ' + __dirname)
}

const REPO_ROOT = findRepoRoot()
const BASE: Record<string, string> = {
  repo: REPO_ROOT,
  web: join(REPO_ROOT, 'apps', 'web'),
  mobile: join(REPO_ROOT, 'apps', 'mobile'),
}

interface Surface { rootedAt: string; glob: string; kind: 'published' | 'internal'; path: string }

/** `some/dir/*.ext`, `some/dir/**\/*.ext`, or a literal `some/dir/file.md`. */
function expand(rootedAt: string, glob: string): string[] {
  const base = BASE[rootedAt]
  // A literal path, not a glob. Without this, a published document named
  // individually — which is how the store answers are scoped, because that one
  // is published and the rest of docs/ is internal — silently matches nothing.
  if (!glob.includes('*')) {
    const literal = join(base, ...glob.split('/'))
    return existsSync(literal) ? [literal] : []
  }
  const recursive = glob.includes('**')
  const parts = glob.split('/')
  const file = parts.pop()!
  // For a recursive glob, the directory is everything before the `**`.
  const dirParts = recursive ? glob.split('**')[0].split('/').filter(Boolean) : parts
  const dir = join(base, ...dirParts)
  if (!existsSync(dir)) return []
  // Strip the glob prefix properly. `replace('*.', '')` leaves the leading dot
  // on '*.tsx', and then the comparison is against '..tsx' — which matches
  // nothing, so the sweep silently reads no files and passes.
  const ext = file.replace(/^\*\./, '')
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const full = join(d, entry)
      if (statSync(full).isDirectory()) { if (recursive) walk(full); continue }
      if (entry.endsWith(`.${ext}`)) out.push(full)
    }
  }
  walk(dir)
  return out.sort()
}

const SURFACES: Surface[] = CLAIM_SURFACES.flatMap(s =>
  s.globs.map(glob => ({ rootedAt: s.rootedAt, glob, kind: s.kind, path: '' })),
)

/** Every file the sweep reads, published or internal. */
const ALL_FILES = SURFACES.flatMap(s => expand(s.rootedAt, s.glob).map(path => ({ ...s, path })))

/** Copy that a customer, regulator or worker actually reads. */
const PUBLISHED_COPY: Extracted[] = ALL_FILES
  .filter(s => s.kind === 'published')
  .flatMap(s => extractCopy(s.path))

interface Extracted { file: string; line: number; text: string }

/**
 * User-visible copy, without comments.
 *
 * Comments are excluded because this codebase explains itself in them, and a
 * comment that says "this is not a live feed" is the opposite of a claim.
 */
function extractCopy(filePath: string): Extracted[] {
  const rel = relative(REPO_ROOT, filePath).split(sep).join('/')
  const source = readFileSync(filePath, 'utf8')

  // Markdown has no comments, so the whole file is the copy.
  if (extname(filePath) === '.md') {
    return source.split('\n').map((text, i) => ({ file: rel, line: i + 1, text })).filter(e => e.text.trim())
  }

  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2020, true,
    extname(filePath) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: Extracted[] = []
  const add = (text: string, node: ts.Node) => {
    if (text.trim()) out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text })
  }
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      add(node.text, node)
    } else if (ts.isJsxText(node)) {
      // JSX text is split around entities and expressions, so a sentence can
      // span several nodes. Collapsed before matching, or "point-in-time" split
      // by an inline element would sail past.
      add(node.getText(sf).replace(/\s+/g, ' '), node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const ALL_COPY: Extracted[] = ALL_FILES.flatMap(s => extractCopy(s.path))

/**
 * Wraps a long list so a failure names the file and line, not a wall of text.
 *
 * A match inside a negation is skipped, because "your managers do not see a
 * live feed" is a disclaimer and deleting it would leave a worker worse off.
 */
function findings(patterns: { label: string; pattern: RegExp; allowedPhrases?: string[] }[], copy: Extracted[]): string[] {
  const found: string[] = []
  for (const item of copy) {
    for (const { label, pattern, allowedPhrases } of patterns) {
      // Every match, not just the first: a denied first mention must not
      // mask a genuine later one in the same string.
      if (unDeniedMatches(item.text, pattern).length === 0) continue
      if ((allowedPhrases ?? []).some((p) => item.text.includes(p))) continue
      // A document allowed to name a claim, but only on a line that still
      // carries its qualifier. Drop the qualifier and this stops applying.
      if (allowanceFor(item.file, item.text)) continue
      found.push(`${label} — ${item.file}:${item.line} — "${item.text.trim().slice(0, 120)}"`)
    }
  }
  return found
}

describe('the claim sweep', () => {
  it('actually reads the surfaces it claims to cover', () => {
    // A guard that silently scans nothing is the worst outcome available, and
    // a broken path produces exactly that with a green build.
    expect(ALL_COPY.length).toBeGreaterThan(200)
    const files = new Set(ALL_COPY.map(c => c.file))
    expect([...files].some(f => f.startsWith('apps/mobile/')), 'no mobile screens scanned').toBe(true)
    expect([...files].some(f => f.startsWith('docs/')), 'no documents scanned').toBe(true)
    expect([...files].some(f => f === 'apps/web/src/pages/LandingPage.tsx'), 'landing page not scanned').toBe(true)
    expect([...files].some(f => f.includes('staffLocationNotice')), 'the carer-facing notice is not scanned').toBe(true)
  })

  it('finds no claim we cannot evidence on a published surface', () => {
    const hits = findings(
      FORBIDDEN_CLAIMS.map(c => ({ label: c.label, pattern: c.pattern, allowedPhrases: c.allowedPhrases })),
      PUBLISHED_COPY,
    )
    expect(hits, `\nUn-evidenced claims found:\n${hits.join('\n')}\n`).toEqual([])
  })

  it('still reads internal documents, so the scope cannot be quietly widened', () => {
    // Internal documents are exempt from the claim block, but they are still
    // read — otherwise "move this to internal" would be a way to ship a false
    // claim into a document that a customer later asks us for.
    const internal = new Set(ALL_COPY.map(c => c.file).filter(f => f.startsWith('docs/')))
    expect(internal.size).toBeGreaterThan(5)
    expect(PUBLISHED_COPY.some(c => c.file.startsWith('docs/'))).toBe(true)
    expect(internal.has('docs/GO_LIVE_READINESS.md')).toBe(true)
  })

  it('references no restricted logo', () => {
    const hits: string[] = []
    for (const surface of ALL_FILES) {
      const source = readFileSync(surface.path, 'utf8')
      for (const logo of FORBIDDEN_LOGO_REFERENCES) {
        if (source.includes(`/logos/${logo}`)) {
          hits.push(`${logo} referenced in ${relative(REPO_ROOT, surface.path)}`)
        }
      }
    }
    expect(hits, `\nRestricted logos in use:\n${hits.join('\n')}\n`).toEqual([])
  })

  it('keeps the NHS logo on disk but out of the product', () => {
    // The file is left in place deliberately: deleting it would make the
    // removal look like an accident and someone would restore it. What matters
    // is that nothing points at it.
    const logoPath = join(REPO_ROOT, 'apps', 'web', 'public', 'logos', 'nhs.svg')
    expect(existsSync(logoPath)).toBe(true)
    expect(RESTRICTED_LOGOS.find(l => l.file === 'nhs.svg')?.owner).toBe('Adetoye')
  })

  it('cites evidence that still exists for every verified claim', () => {
    for (const claim of REGISTERED_CLAIMS) {
      if (claim.status !== 'verified') continue
      expect(claim.evidencePath, `${claim.label} is verified but cites no path`).toBeTruthy()
      expect(existsSync(join(REPO_ROOT, claim.evidencePath!)), `${claim.label} cites ${claim.evidencePath}, which does not exist`).toBe(true)
    }
  })

  it('gives every forbidden claim a reason and a way out', () => {
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(claim.why.length, `${claim.label} has no reason`).toBeGreaterThan(30)
      expect(claim.whatWouldPermitIt.length, `${claim.label} has no route to being allowed`).toBeGreaterThan(20)
    }
  })

  it('keeps every document allowance tied to a qualifier that still exists', () => {
    // An allowance whose qualifier has been edited away is a hole: it would
    // keep exempting a line that no longer says what the exemption assumed.
    const docText = new Map<string, string>()
    for (const allowance of DOCUMENT_ALLOWANCES) {
      const key = allowance.file
      if (!docText.has(key)) {
        docText.set(key, readFileSync(join(REPO_ROOT, key), 'utf8'))
      }
      expect(
        allowance.mustContain.test(docText.get(key)!),
        `${allowance.label}: the qualifier in ${key} no longer matches, so the allowance is dead`,
      ).toBe(true)
    }
  })
})
