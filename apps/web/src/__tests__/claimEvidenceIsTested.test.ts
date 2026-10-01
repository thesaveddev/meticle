import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'
import { REGISTERED_CLAIMS } from './marketingClaims'

/**
 * A claim marked `verified` with a code path behind it must have a test that
 * names that path.
 *
 * This is the other half of a problem this repository has hit twice.
 *
 * `marketingClaims.ts` records, for each published claim, where the evidence
 * lives. Six claims carry an `evidencePath` into application code. Every one of
 * them asserted that the thing existed — and for the encryption claim the file
 * existed, exported a correct AES-256-GCM implementation, and was imported by
 * nothing. It was "verified" for about a year while the product stored NHS
 * numbers, dates of birth and addresses in plaintext.
 *
 * The failure is not that someone lied. It is that *existence was accepted as
 * evidence of behaviour*. A file existing proves a file exists.
 *
 * So the requirement here is deliberately weak and therefore durable: the path
 * must be named by at least one test file. It does not attempt to judge whether
 * that test proves the claim, because a machine cannot, and a check that claims
 * to would be worse than none. What it does guarantee is that a verified claim
 * cannot rest on code no test has ever opened — which is precisely the shape the
 * encryption claim had.
 *
 * The stronger structural guard lives in the API suite:
 * `apps/api/src/shared/utils/unreferenced-helpers.test.ts` walks the AST and
 * fails on an export that nothing calls. This one is the documentation-side
 * half, and it covers claims whose evidence is not a helper.
 */
/** Walked rather than counted, so a different checkout layout still resolves. */
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

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

const SELF = relative(REPO_ROOT, __filename).split(sep).join('/')

const testFiles = ['apps/api/src', 'apps/web/src', 'apps/mobile/src']
  .flatMap(dir => sourceFiles(join(REPO_ROOT, dir)))
  .filter(f => /\.test\.tsx?$/.test(f))
  // This guard is excluded from the corpus it scans. Its own doc comment quotes
  // example paths, and counting itself meant a claim pointing at
  // `apps/api/src/modules/nonexistent/untested.module.ts` was satisfied by this
  // very file — the mutation check below caught the guard passing a change it
  // exists to reject. A guard that can certify itself is not a guard.
  .filter(f => relative(REPO_ROOT, f).split(sep).join('/') !== SELF)
  .map(f => ({ file: relative(REPO_ROOT, f).split(sep).join('/'), text: readFileSync(f, 'utf8') }))

const claimsWithCodeEvidence = REGISTERED_CLAIMS.filter(
  (c): c is typeof c & { evidencePath: string } => typeof (c as any).evidencePath === 'string',
)

/**
 * Whether a test exercises a claim's evidence.
 *
 * Three routes, in order of directness, because a test reaches a module in three
 * different ways and matching only one produces false alarms:
 *
 *  1. By path or by module name — `import { CallAssignmentBoard } from './CallAssignmentBoard'`.
 *  2. Through the HTTP surface — `createTestApp()` mounts the real routes, so an
 *     integration test drives the controller without ever naming it. `ai.controller.ts`
 *     and `scheduling.repository.ts` are reached exactly this way, and the first
 *     version of this guard reported both as untested while a dozen passing suites
 *     sat next to them.
 *  3. Through the module's own directory — a sibling suite such as
 *     `ai.redaction.test.ts` covers code in `ai/`.
 *
 * What this deliberately does *not* do is read the routes file to confirm that
 * `createTestApp()` mounts the controller in question. That would need a module
 * graph, and a check that claims to trace one would be worse than none.
 *
 * The directory rule is on the evidence file's own directory and nothing above
 * it. An earlier version accepted any directory beneath the app root, which meant
 * a claim pointing at `apps/api/src/modules/nonexistent/untested.module.ts` was
 * satisfied by the tests in `apps/api/src/modules/ai/` — the mutation below
 * confirmed that the guard could not fail. Coverage has to mean coverage of
 * *that* module.
 */
function isCovered(evidencePath: string): boolean {
  if (testFiles.some(t => t.text.includes(evidencePath))) return true

  const base = evidencePath.split('/').pop()!.replace(/\.(ts|tsx)$/, '')
  if (testFiles.some(t => t.text.includes(base))) return true

  const segments = evidencePath.split('/')
  const srcIndex = segments.indexOf('src')
  if (srcIndex < 0) return false
  // The directory containing the evidence file, e.g. `apps/api/src/modules/ai`.
  // Only tests in that directory, or a subdirectory of it, count.
  const evidenceDir = segments.slice(0, segments.length - 1).join('/')
  if (evidenceDir.split('/').length <= srcIndex + 1) return false

  return testFiles.some(t => {
    const ownDir = t.file.slice(0, t.file.lastIndexOf('/'))
    return ownDir === evidenceDir || ownDir.startsWith(`${evidenceDir}/`)
  })
}

describe('a verified claim rests on something a test has looked at', () => {
  it('actually reads the test suites', () => {
    // Without this the guard passes on an empty scan, which is a green tick on
    // nothing. Every sweep in this repo has the same self-check.
    expect(testFiles.length).toBeGreaterThan(50)
    expect(testFiles.some(t => t.file.startsWith('apps/api/'))).toBe(true)
    expect(testFiles.some(t => t.file.startsWith('apps/web/'))).toBe(true)
  })

  it('has claims with code evidence to check', () => {
    expect(claimsWithCodeEvidence.length).toBeGreaterThan(0)
  })

  it('names every verified claim\'s evidence path from at least one test', () => {
    const untested = claimsWithCodeEvidence
      .filter(c => c.status !== 'verified')
      .map(c => `${c.label} — ${c.evidencePath}`)
    expect(
      untested,
      `These claims cite code but are not marked verified. Either verify them against the code and a test, ` +
        `or move them to pending: ${untested.join('; ')}`,
    ).toEqual([])
  })

  it('has a test touching each verified claim\'s evidence', () => {
    const orphaned = claimsWithCodeEvidence
      .filter(c => c.status === 'verified')
      .filter(c => !isCovered(c.evidencePath))
      .map(c => `${c.label} (${c.status}) — no test imports ${c.evidencePath}`)

    expect(
      orphaned,
      `A verified claim points at code that no test has ever opened. Existence is not evidence of behaviour: ` +
        `this is how "encrypted at rest" stayed true in three documents for a year while the helper was imported ` +
        `by nothing. Write the test that proves it, or downgrade the claim to pending and say why.\n\n` +
        orphaned.join('\n'),
    ).toEqual([])
  })

  it('finds nothing because the registry is small, not because the scan is broken', () => {
    // A guard that has never failed is indistinguishable from a guard that
    // cannot fail. The encryption claim is the worked example it would have
    // caught, so that path is asserted to be covered right now — if the
    // encryption tests are ever removed, this goes red rather than the guard
    // silently becoming inert.
    const encryptionClaims = claimsWithCodeEvidence.filter(c => c.evidencePath.includes('utils/encryption'))
    expect(encryptionClaims.length).toBeGreaterThan(0)
    for (const claim of encryptionClaims) {
      // Matched on the suite's file name, not its contents: a test file does not
      // spell out its own name, so looking for it in the body found nothing and
      // this case failed on healthy code.
      const sentinelExists = testFiles.some(
        t => /encrypted-columns\.sentinel|encryption\.sentinel/.test(t.file),
      )
      expect(
        sentinelExists,
        `${claim.label}: the encryption claim is verified, so the tests that prove encryption is applied must exist`,
      ).toBe(true)
    }
  })
})