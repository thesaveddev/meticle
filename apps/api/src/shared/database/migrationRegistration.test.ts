import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * A migration file that nothing registers is not a migration — it is a comment.
 *
 * `setup.ts` lists its migrations by hand, each one a `readFileSync` of a named
 * file. Adding a `.sql` and forgetting the entry produces no error anywhere: the
 * file sits in the directory looking authoritative, the runner never sees it, and
 * the table it declares does not exist in any environment. That is exactly what
 * happened twice here. `103_family_visit_feedback.sql` declared `family_feedback`,
 * never ran, and left the family-feedback endpoints answering 500 against a missing
 * relation; `102_compliance_warning_days.sql` declared a column that had to be
 * restated as 151. Both were found by reading, not by a failing check.
 *
 * This is that check. It does not demand that every file be registered — some
 * cannot be, because the runner refuses an unapplied migration below the applied
 * watermark, and a duplicate version is rejected outright. It demands that every
 * file is *accounted for*: registered, or named below with the reason it is not and
 * what replaced it. A new file must be one or the other, and a decision nobody wrote
 * down fails the build.
 */

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')
const SETUP_SOURCE = fs.readFileSync(path.join(__dirname, 'setup.ts'), 'utf8')

/**
 * Files that exist on disk and are deliberately never registered.
 *
 * Every entry has to say why it cannot run and, where it was replaced, by what — so
 * the next person does not "fix" the gap by registering a migration that would either
 * be refused at startup or duplicate a version that already ran.
 */
const SUPERSEDED: Record<string, string> = {
  // Version 53 is registered inline in setup.ts, with three of this file's six
  // statements. Switching the registration to read the file would change the checksum
  // of an already-applied migration and stop the API from starting, so the inline set
  // stays the definition of record and this file is not read.
  '053_billing_schema_reconciliation.sql':
    'Version 53 runs from inline statements in setup.ts (a subset of this file); not read, so it cannot drift a checksum.',
  // A second file sharing version 53 with the registration above. Registering this too
  // would make `sortMigrations` throw on the duplicate version.
  '053_reconcile_historical_schema.sql':
    'Duplicate version 53; the registration in setup.ts is the source for that version.',
  // Demo/winback data and columns that no application code reads; never registered and
  // never applied. Their tables arrive through 069_reconcile_demo_winback_schema instead.
  '063_demo_account_support.sql':
    'Never registered; 069_reconcile_demo_winback_schema is the schema of record for demo accounts.',
  '064_winback_campaign_tracking.sql':
    'Never registered; 069_reconcile_demo_winback_schema is the schema of record for winback tracking.',
  // Declared `organizations.compliance_warning_days`, read by the compliance reminders.
  // Below the watermark by the time it was noticed, so it could never run; restated.
  '102_compliance_warning_days.sql':
    'Superseded by 151_compliance_warning_days (same column, version that could still apply).',
  // Declared `family_feedback`, read by the family-feedback endpoints. Restated.
  '103_family_visit_feedback.sql':
    'Superseded by 159_family_visit_feedback (same table plus RLS, version that could still apply).',
}

const filesOnDisk = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()

/** The migration files setup.ts actually reads. */
const registeredFiles = new Set(
  [...SETUP_SOURCE.matchAll(/migrations',\s*'([^']+\.sql)'/g)].map((m) => m[1])
)

describe('migration registration', () => {
  it('accounts for every migration file on disk', () => {
    const unaccounted = filesOnDisk.filter((f) => !registeredFiles.has(f) && !(f in SUPERSEDED))
    expect(
      unaccounted,
      `These migration files are neither registered in setup.ts nor listed as superseded, so they will never run: ${unaccounted.join(', ')}`
    ).toEqual([])
  })

  it('every registered migration file exists', () => {
    const missing = [...registeredFiles].filter((f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f)))
    expect(missing, `setup.ts reads files that are not on disk: ${missing.join(', ')}`).toEqual([])
  })

  it('keeps the superseded list honest — every entry names a real file and a reason', () => {
    for (const [file, reason] of Object.entries(SUPERSEDED)) {
      expect(filesOnDisk, `${file} is listed as superseded but is not on disk`).toContain(file)
      expect(reason.trim().length, `${file} needs a reason it cannot run`).toBeGreaterThan(20)
      // A retired file that someone quietly registered is the drift this guard exists for.
      expect(registeredFiles.has(file), `${file} is both superseded and registered`).toBe(false)
    }
  })

  it('never reuses a version number for a fresh registration', () => {
    const versions = new Map<number, string>()
    for (const file of registeredFiles) {
      const version = Number.parseInt(file.split('_')[0], 10)
      const existing = versions.get(version)
      expect(existing, `version ${version} is registered twice: ${existing} and ${file}`).toBeUndefined()
      versions.set(version, file)
    }
  })
})
