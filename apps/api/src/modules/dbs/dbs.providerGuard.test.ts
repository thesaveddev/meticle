/**
 * The DBS module must not acquire a provider of its own again.
 *
 * The defect this guards is not a wrong result, it is a *default*: the module
 * initialised `provider` to a mock, no code path ever called `setDbsProvider`,
 * and so the mock was the production provider — filing cleared checks, and
 * three-year approved documents, for people no one had checked. The audit that
 * found it (docs/FEATURE_READINESS_AUDIT.md §2) is the reason this file exists:
 * a behavioural test would have to know to run without a provider, and the suite
 * that missed the defect is proof that it will not.
 *
 * So this is a source scan. Each assertion is a property that has to hold for
 * every future code path, including the ones nobody has written yet:
 *
 *   - no mock provider class anywhere in the API;
 *   - `provider` defaults to null;
 *   - `setDbsProvider` is called from no production file, so configuration (and
 *     only configuration) can arm submission;
 *   - a check result cannot become an approved document.
 *
 * Comments are stripped before scanning, so the explanation of what was removed
 * does not read as a re-introduction of it.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const DBS_DIR = __dirname
const API_SRC = path.join(__dirname, '..', '..')

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
}

const SERVICE = stripComments(fs.readFileSync(path.join(DBS_DIR, 'dbs.service.ts'), 'utf8'))

/** Every non-test TypeScript source under apps/api/src. */
function apiSources(dir: string = API_SRC, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { apiSources(full, out); continue }
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.test.ts')) continue
    out.push(full)
  }
  return out
}

describe('the DBS module ships no provider of its own', () => {
  it('has no mock provider class', () => {
    expect(SERVICE).not.toMatch(/MockDbsProvider/)
    expect(SERVICE).not.toMatch(/class\s+\w*Mock\w*\s+implements\s+DbsProvider/)

    // Not just this file: a mock anywhere under src would be one import away
    // from being wired in as the default again.
    const offenders = apiSources()
      .filter((file) => /MockDbsProvider|class\s+\w*Mock\w*\s+implements\s+DbsProvider/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(API_SRC, file).replace(/\\/g, '/'))
    expect(offenders).toEqual([])
  })

  it('defaults the provider to null and resolves it from configuration', () => {
    expect(SERVICE).toMatch(/let provider: DbsProvider \| null = null/)
    expect(SERVICE).toMatch(/resolveDbsProvider\(/)
    // The boot-time call, not just the definition: a factory nothing calls is
    // how the previous arrangement failed.
    expect(SERVICE).toMatch(/^provider = resolveDbsProvider\(\);/m)
  })

  it('is armed by nothing but its own definition', () => {
    // `setDbsProvider` is the injection point tests use. Production code calling
    // it would let a provider be armed from outside configuration, which is
    // precisely how the mock became the production provider.
    const callers = apiSources()
      .filter((file) => fs.readFileSync(file, 'utf8').includes('setDbsProvider('))
      .map((file) => path.relative(API_SRC, file).replace(/\\/g, '/'))
    expect(callers).toEqual(['modules/dbs/dbs.service.ts'])
  })

  it('refuses with 503 rather than guessing, and names both causes', () => {
    expect(SERVICE).toMatch(/this deployment has no vetting partner configured/)
    expect(SERVICE).toMatch(/no adapter for it is built yet/)
    expect(SERVICE).toMatch(/AppError\(\s*503/)
    // Both choke points — submit and poll — not just the one that happened to
    // be remembered.
    expect((SERVICE.match(/= requireConfiguredProvider\(\);/g) || []).length).toBe(2)
  })

  it('never turns a check result into a document', () => {
    // Asserted by shape rather than by line number so it cannot be re-added in
    // another form.
    // The insert that made a mock's output into "evidence", asserted by shape
    // rather than by line number so it cannot be re-added in another form.
    expect(SERVICE).not.toMatch(/INSERT INTO documents/)
    expect(SERVICE).not.toMatch(/'approved'/)
    const writers = apiSources()
      .filter((file) => /INSERT INTO documents[\s\S]{0,200}['"]DBS['"]/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(API_SRC, file).replace(/\\/g, '/'))
    expect(writers).toEqual([])
  })
})

/**
 * The Update Service workflow (phase 3) is the second door into the same defect,
 * and it is a wider one: a re-check has no application to submit and no result to
 * act on, so the temptation to reach for the provider machinery — or to raise a
 * "certificate" from a status answer — is exactly where a fabricated result would
 * enter the record unnoticed.
 */
describe('the DBS Update Service workflow submits nothing', () => {
  const UPDATE_SERVICE = stripComments(fs.readFileSync(path.join(DBS_DIR, 'dbs.updateService.ts'), 'utf8'))

  it('never reaches the provider seam', () => {
    expect(UPDATE_SERVICE).not.toMatch(/submitCheck|getStatus|cancelCheck/)
    expect(UPDATE_SERVICE).not.toMatch(/requireConfiguredProvider|resolveDbsProvider|setDbsProvider|DbsProvider/)
    expect(UPDATE_SERVICE).not.toMatch(/\.environment|MOCK_|mockProvider/)
  })

  it('records no application and no certificate document', () => {
    expect(UPDATE_SERVICE).not.toMatch(/INSERT INTO dbs_checks|INSERT INTO documents/)
    expect(UPDATE_SERVICE).not.toMatch(/dbs_checks/)
    // No status is ever written: the workflow has no state machine to move
    // through, only a check that happened or did not.
    expect(UPDATE_SERVICE).not.toMatch(/DbsStatus\./)
  })

  it('will not record a check without consent', () => {
    // The consent gate is the feature, not a nicety: three assertions that it is
    // still enforced on the path that writes a check.
    expect(UPDATE_SERVICE).toMatch(/consent_withdrawn_on/)
    expect(UPDATE_SERVICE).toMatch(/requireActive\(orgId, id\)/)
    expect(UPDATE_SERVICE).toMatch(/consent is already recorded|without the individual's consent/)
  })

  it('refuses a level the certificate does not cover', () => {
    expect(UPDATE_SERVICE).toMatch(/input\.level !== sub\.level \|\| input\.workforce !== sub\.workforce/)
  })
})
