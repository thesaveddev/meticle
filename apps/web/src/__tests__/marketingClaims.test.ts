/**
 * Fails the build when a public page claims something we cannot evidence.
 *
 * See `./marketingClaims.ts` for the registry and the reasoning. The short
 * version: the site has twice advertised a capability it did not have — ISO
 * 27001, and point-in-time recovery — and both were caught by hand, months
 * apart. This makes that a build failure instead.
 *
 * Deliberately left on the default jsdom environment rather than switched to
 * `node`: `src/test/setup.ts` is a global setupFile that expects a window, and
 * overrides the environment per-file in a way that breaks it. Node's fs and
 * path are available regardless, so the environment buys nothing here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, relative, sep } from 'node:path'
import * as ts from 'typescript'
import {
  PUBLIC_COPY_GLOBS,
  FORBIDDEN_CLAIMS,
  REGISTERED_CLAIMS,
  REQUIRED_DISCLAIMERS,
  unDeniedMatches,
  allowanceFor,
} from './marketingClaims'

/**
 * Walk up to the repository root rather than assuming a fixed depth.
 *
 * A hardcoded `../../..` chain silently resolves to the wrong directory the
 * moment this test moves, and then `existsSync` is the only thing standing
 * between a broken path and a test that quietly checks nothing. Looking for
 * the marker keeps it honest wherever the file lives.
 */
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
const WEB_ROOT = resolve(REPO_ROOT, 'apps', 'web')
const READINESS_DOC = join(REPO_ROOT, 'docs', 'GO_LIVE_READINESS.md')
/** Read once. Calling `.includes` on the path string instead of the contents is an easy and silent mistake. */
const READINESS_TEXT = existsSync(READINESS_DOC) ? readFileSync(READINESS_DOC, 'utf8') : ''

/** Minimal glob: only `some/dir/*.ext` forms are used by PUBLIC_COPY_GLOBS. */
function expandGlob(glob: string): string[] {
  const cut = glob.lastIndexOf('/')
  if (cut < 0) throw new Error(`Unsupported glob (need a directory): ${glob}`)
  const dir = glob.slice(0, cut)
  const file = glob.slice(cut + 1)
  const base = join(WEB_ROOT, dir)
  if (!existsSync(base)) return []
  const ext = file.replace('*.', '')
  return readdirSync(base)
    .filter((f) => f.endsWith(`.${ext}`))
    .sort()
    .map((f) => join(base, f))
}

interface ExtractedString {
  file: string
  line: number
  text: string
}

/**
 * Pull user-visible copy out of a .tsx file using the TypeScript parser.
 *
 * A regex over the raw file would be simpler and wrong in two ways that both
 * matter. It would match *comments* — the explanatory comment in FeaturesPage
 * that records the old "Point-in-time recovery" wording quotes the phrase in
 * full, so a naive scan would immediately flag the very comment that documents
 * the fix. And it would match import specifiers, so a module path containing
 * "iso27001" would read as a claim.
 *
 * Parsing solves both: comments are not part of the AST's string literals, and
 * module specifiers can be skipped explicitly.
 */
function extractVisibleStrings(filePath: string): ExtractedString[] {
  const sourceText = readFileSync(filePath, 'utf8')
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const out: ExtractedString[] = []
  const isModuleSpecifier = (node: ts.Node): boolean => {
    let p: ts.Node | undefined = node.parent
    while (p) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) {
        return p.moduleSpecifier === node
      }
      if (ts.isStatement(p) || ts.isSourceFile(p)) return false
      p = p.parent
    }
    return false
  }

  const push = (node: { text?: string; getStart?: () => number }) => {
    const text = node.text
    if (!text) return
    const pos = node.getStart?.() ?? 0
    const { line } = source.getLineAndCharacterOfPosition(pos)
    out.push({
      file: relative(REPO_ROOT, filePath).split(sep).join('/'),
      line: line + 1,
      text,
    })
  }

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node)) push(node)
    } else if (ts.isJsxText(node)) {
      const text = node.text.trim()
      if (text) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        out.push({ file: relative(REPO_ROOT, filePath).split(sep).join('/'), line: line + 1, text })
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

const files = PUBLIC_COPY_GLOBS.flatMap(expandGlob)
const allStrings = files.flatMap(extractVisibleStrings)

/**
 * Reconstructed copy per file, for matching claims against.
 *
 * Claims are matched here rather than against individual strings because JSX
 * splits a sentence into one text node per line. The disclaimer "it does not
 * guarantee compliance, a rating or an inspection outcome" is one sentence to
 * a reader and two or three separate nodes to the parser, so a per-string
 * match misses it. Joining the extracted strings reconstructs what the page
 * actually says, and still excludes comments.
 */
const copyByFile: { file: string; webPath: string; copy: string; strings: { text: string }[] }[] = files.map((file) => {
  const strings = extractVisibleStrings(file)
  return {
    // Reported to the developer relative to the repo root, so a path in a failure
    // message can be pasted straight into an editor.
    file: relative(REPO_ROOT, file).split(sep).join('/'),
    // Matched against `exemptFiles` in the registry, which is expressed relative
    // to apps/web — the same base PUBLIC_COPY_GLOBS uses. Keeping one base for the
    // registry avoids a silent mismatch, which is exactly what happened first time.
    webPath: relative(WEB_ROOT, file).split(sep).join('/'),
    copy: strings.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(),
    // Kept separately as well. The joined blob is right for "does this page say
    // X at all", and wrong for deciding whether a mention is a denial: a
    // negation belongs to the sentence it is in, and joining every string in the
    // file splices unrelated copy together around it.
    strings,
  }
})

/**
 * Best-effort location for a matched phrase, for a useful failure message.
 *
 * Picks the LONGEST literal word in the pattern rather than the first. "First"
 * is wrong in practice: the data-residency pattern starts "no data ...", so the
 * first word over three characters is "data", which matches half the site and
 * reports a line nowhere near the claim. "jurisdiction" is both longer and
 * unambiguous.
 */
function locate(match: RegExp, file: string): string {
  const words = match.source
    .replace(/[\\^$.*+?()[\]{}|]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !w.includes('?:'))
  const needle = words.sort((a, b) => b.length - a.length)[0]
  if (!needle) return file
  const hit = allStrings.find((s) => s.file === file && new RegExp(needle, 'i').test(s.text))
  return hit ? `${hit.file}:${hit.line}` : file
}

describe('marketing claim guard — the guard itself', () => {
  // The most important test in this file. An extractor that silently found
  // nothing would make every other test here pass for the wrong reason, which
  // is exactly the failure mode this whole exercise exists to prevent.
  it('actually reads the public pages', () => {
    expect(files.length).toBeGreaterThan(10)
    expect(allStrings.length).toBeGreaterThan(300)
    // Sanity-check against text we know is on the site.
    expect(copyByFile.map((d) => d.copy).join('\n')).toMatch(/MeticleCare|Meticle Care/i)
  })

  it('extracts copy rather than comments', () => {
    // FeaturesPage carries a comment quoting the withdrawn point-in-time
    // wording. If comments leaked into the extracted text, the forbidden-claim
    // test would be flagging our own record of the fix.
    const featuresPage = allStrings.filter((s) => s.file.endsWith('FeaturesPage.tsx'))
    expect(featuresPage.length).toBeGreaterThan(20)
    expect(featuresPage.some((s) => s.text.startsWith('//'))).toBe(false)
  })
})

describe('marketing claim guard — forbidden claims', () => {
  for (const claim of FORBIDDEN_CLAIMS) {
    it(`does not claim ${claim.label}`, () => {
      const exempt = new Set(claim.exemptFiles ?? [])
      // A claim inside a negation is a disclaimer, not a claim. Without this
      // the only way to satisfy the guard is to delete the sentence that says
      // "we have no NHS accreditation" — which is the sentence doing the work.
      // Both guards apply the same rule; they must not disagree about the same
      // copy, or the stricter one simply gets worked around.
      const hits = copyByFile.filter((d) => {
        if (exempt.has(d.webPath)) return false
        // Judged per extracted string, so a denial in the same sentence counts
        // and a denial in a different string on the same page does not.
        const asserted = d.strings.some((s) => {
          if (unDeniedMatches(s.text, claim.pattern).length === 0) return false
          // Naming a body is not claiming from it. Exact strings only, so this
          // cannot widen into covering an assertion.
          return !(claim.allowedPhrases ?? []).some((p) => s.text.includes(p))
        })
        if (!asserted) return false
        return !allowanceFor(d.file.replace(/\\/g, '/'), d.copy)
      })
      const report = hits.map((d) => `  ${locate(claim.pattern, d.file)}`)
      const exemptionNote = exempt.size
        ? [``, `Exempt: ${[...exempt].join(', ')} — see ./marketingClaims.ts for why.`]
        : []
      expect(
        hits.map((d) => d.file),
        [
          `Public copy claims ${claim.label}, which we cannot evidence.`,
          ``,
          `Why it is blocked: ${claim.why}`,
          `What would permit it: ${claim.whatWouldPermitIt}`,
          ``,
          ...report,
          ...exemptionNote,
          ``,
          `Either change the copy, or record the evidence in ./marketingClaims.ts.`,
        ].join('\n'),
      ).toEqual([])
    })
  }
})

describe('marketing claim guard — registered claims', () => {
  it('has at least one registered claim to police', () => {
    expect(REGISTERED_CLAIMS.length).toBeGreaterThan(0)
  })

  for (const claim of REGISTERED_CLAIMS) {
    it(`records a reason for permitting ${claim.label}`, () => {
      expect(claim.evidence.trim().length).toBeGreaterThan(20)
      // Reject evidence that asserts rather than cites.
      expect(claim.evidence).not.toMatch(/^(trust|it'?s fine|yes|true)\b/i)
      expect(claim.owner.trim().length).toBeGreaterThan(0)
    })

    if (claim.evidencePath) {
      it(`cites a path that exists for ${claim.label}`, () => {
        expect(existsSync(join(REPO_ROOT, claim.evidencePath!))).toBe(true)
      })
    }

    if (claim.status === 'pending') {
      it(`ties pending claim ${claim.label} to a live tracker item`, () => {
        expect(claim.closesOn).toBeTruthy()
        expect(existsSync(READINESS_DOC)).toBe(true)
        // This is the anti-rot link. A pending claim whose tracker item has
        // been deleted or renamed fails here, so it cannot outlive the decision
        // that was supposed to settle it.
        expect(
          READINESS_TEXT.includes(claim.closesOn!),
          `Pending claim "${claim.label}" points at tracker item ${claim.closesOn}, which no longer appears in docs/GO_LIVE_READINESS.md. Either close the claim or re-file the item.`,
        ).toBe(true)
      })
    }
  }
})

describe('marketing claim guard — disclaimers', () => {
  // Asserted to be present, not merely tolerated. Otherwise this file becomes
  // a mechanism for deleting our own disclaimers and then allowing a strong
  // claim back in.
  for (const disclaimer of REQUIRED_DISCLAIMERS) {
    for (const requiredIn of disclaimer.requiredIn) {
      it(`still states "${disclaimer.label}" on ${requiredIn}`, () => {
        const doc = copyByFile.find((d) => d.webPath === requiredIn)
        // A page that does not exist cannot carry the qualification, and that is
        // a failure in its own right: the disclaimer would be silently gone.
        expect(doc, `${requiredIn} is listed as needing this disclaimer but is not among the scanned public pages`).toBeTruthy()
        expect(
          disclaimer.phrase.test(doc!.copy),
          `${requiredIn} no longer carries the qualification "${disclaimer.label}". ${disclaimer.why} If it was removed on purpose, remove it from REQUIRED_DISCLAIMERS in ./marketingClaims.ts and say why.`,
        ).toBe(true)
      })
    }
  }
})
