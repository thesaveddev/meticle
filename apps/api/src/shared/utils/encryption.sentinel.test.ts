import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A sentinel, not a bug: nothing is encrypted at rest yet, and the public
 * privacy policy says so.
 *
 * `encryption.ts` implements aes-256-gcm over an HKDF-derived per-tenant key,
 * which reads like evidence that the product encrypts PII columns. It does not.
 * As of 1 Oct 2026 no production module imports it — `encryptField` and
 * `decryptField` have no call sites outside their own definitions — so every
 * column sits in plaintext regardless of `FIELD_ENCRYPTION_KEY`.
 *
 * That made two documents wrong in the same direction. The claim register said
 * column-level encryption "genuinely exists" and that the only open question was
 * the unset master key; readiness item T0-15 asked for that key to be set. Doing
 * so would have changed nothing.
 *
 * So this asserts the absence. The day someone wires `encryptField` into a named
 * column, this fails on purpose: at-rest encryption becomes real, the published
 * claim may become true, and the scope has to be stated — which columns, under
 * which key, and what happens to existing rows — rather than drifting in behind a
 * cipher that was written months earlier.
 */
const SRC_ROOT = join(__dirname, '..')
const MODULE_UNDER_TEST = join(SRC_ROOT, 'utils', 'encryption.ts')
const ENTRY_POINTS = ['encryptField', 'decryptField'] as const

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

/**
 * A call, not a mention. A comment or a test naming the function is how this
 * file itself would trip the check, so only `name(` counts and the module's own
 * definitions are excluded.
 */
function callSites(files: string[]): { file: string; fn: string }[] {
  const hits: { file: string; fn: string }[] = []
  for (const file of files) {
    if (file === MODULE_UNDER_TEST) continue
    const text = readFileSync(file, 'utf8')
    for (const fn of ENTRY_POINTS) {
      if (new RegExp(`\\b${fn}\\s*\\(`).test(text)) hits.push({ file, fn })
    }
  }
  return hits
}

describe('at-rest encryption is not in use, and the published claim says so', () => {
  it('actually scans the API source tree', () => {
    // A guard that reads nothing passes forever. The digest sentinels exist for
    // the same reason.
    const files = sourceFiles(SRC_ROOT)
    expect(files.length).toBeGreaterThan(50)
    expect(files).toContain(MODULE_UNDER_TEST)
  })

  it('has no production caller of encryptField or decryptField', () => {
    const hits = callSites(sourceFiles(SRC_ROOT))
    const rendered = hits.map(h => `${h.file.replace(SRC_ROOT, 'src')}: ${h.fn}`).join('\n')
    expect(
      rendered,
      `Field encryption is now called from ${hits.length} place(s), so data IS encrypted at rest and the claim registry, readiness item T0-15 and the privacy policy all have to be revisited before this passes:\n${rendered}`,
    ).toBe('')
  })

  it('still ships the cipher that would do it, rather than having lost it', () => {
    // The other direction matters too. If the module were deleted the claim
    // would still be true, but T0-15 would have no starting point and this
    // sentinel would be guarding nothing.
    const text = readFileSync(MODULE_UNDER_TEST, 'utf8')
    expect(text).toMatch(/aes-256-gcm/)
    expect(text).toMatch(/hkdfSync/)
  })
})