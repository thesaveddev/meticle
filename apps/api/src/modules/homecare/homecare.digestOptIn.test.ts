import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }))

vi.mock('../../shared/database', () => ({ default: { query: poolQuery } }))

import { NotificationsController } from '../notifications/notifications.controller'
import { AppError } from '../../shared/middleware/error.middleware'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')
const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8')

/** Minimal express Request/Response pair: the controller only touches user + json. */
function reqFor(userId = 'user-1') {
  return { user: { userId, organizationId: 'org-1', role: 'MANAGER' }, body: {} } as any
}
function resStub() {
  const sent: any = { json: vi.fn() }
  sent.json.mockImplementation((payload: unknown) => sent.payload = payload)
  return sent as any & { payload: any }
}

/** The row the INSERT ... RETURNING clause would hand back, from the params it was given. */
function returningRow(params: any[]) {
  // params[0] is user_id, so the preferences start at index 1.
  const [, morning, midday, evening, mTime, dTime, eTime, weekly, wTime, timezone] = params
  return {
    morning_enabled: morning, midday_enabled: midday, evening_enabled: evening,
    morning_time: mTime, midday_time: dTime, evening_time: eTime,
    weekly_enabled: weekly, weekly_time: wTime, timezone,
  }
}

let insertParams: any[] = []

beforeEach(() => {
  vi.clearAllMocks()
  insertParams = []
  poolQuery.mockImplementation(async (text: string, params?: any[]) => {
    if (text.includes('INSERT INTO homecare_digest_preferences')) {
      insertParams = params || []
      return { rows: [returningRow(params || [])] }
    }
    if (text.includes('FROM homecare_digest_preferences WHERE user_id')) {
      return { rows: currentRow ?? [] }
    }
    return { rows: [] }
  })
})

/** Null models a user who has never touched their preferences. */
let currentRow: any[] | null = null

describe('weekly digest preferences: opt-in by default', () => {
  it('reports the weekly report as off for a user who has never set preferences', async () => {
    currentRow = null
    const res = resStub()
    await NotificationsController.getHomecareDigestPreferences(reqFor(), res)
    expect(res.payload.weekly_enabled).toBe(false)
    expect(res.payload.weekly_time).toBe('07:30')
    // The three daily windows are unchanged: this fix is about the new report
    // only, and turning the existing ones off by surprise would be its own bug.
    expect(res.payload.morning_enabled).toBe(true)
    expect(res.payload.evening_enabled).toBe(true)
  })

  it('reports a stored weekly preference rather than overwriting it with the default', async () => {
    currentRow = [{ weekly_enabled: true, weekly_time: '09:15', morning_enabled: true, midday_enabled: true, evening_enabled: true, morning_time: '08:00', midday_time: '13:00', evening_time: '19:00', timezone: 'Europe/London' }]
    const res = resStub()
    await NotificationsController.getHomecareDigestPreferences(reqFor(), res)
    expect(res.payload.weekly_enabled).toBe(true)
    expect(res.payload.weekly_time).toBe('09:15')
  })

  it('lets a manager switch the weekly report on', async () => {
    currentRow = [{ weekly_enabled: false, weekly_time: '07:30', morning_enabled: true, midday_enabled: true, evening_enabled: true, morning_time: '08:00', midday_time: '13:00', evening_time: '19:00', timezone: 'Europe/London' }]
    const req = reqFor()
    req.body = { weekly_enabled: true }
    const res = resStub()
    await NotificationsController.updateHomecareDigestPreferences(req, res)
    expect(insertParams[7]).toBe(true)
    expect(res.payload.weekly_enabled).toBe(true)
  })

  it('leaves the weekly report off when a user saves unrelated settings', async () => {
    // The regression this guards: PATCHing the timezone must not flip a new
    // report on for everyone who ever touched the daily digests.
    currentRow = [{ weekly_enabled: false, weekly_time: '07:30', morning_enabled: true, midday_enabled: true, evening_enabled: true, morning_time: '08:00', midday_time: '13:00', evening_time: '19:00', timezone: 'Europe/London' }]
    const req = reqFor()
    req.body = { timezone: 'Europe/Dublin' }
    await NotificationsController.updateHomecareDigestPreferences(req, resStub())
    expect(insertParams[7]).toBe(false)
    expect(insertParams[9]).toBe('Europe/Dublin')
  })

  it('creates the preference row with the weekly report off for a first-time saver', async () => {
    currentRow = null
    const req = reqFor()
    req.body = { morning_time: '07:00' }
    await NotificationsController.updateHomecareDigestPreferences(req, resStub())
    expect(insertParams[7]).toBe(false)
  })

  it('rejects a malformed weekly time rather than storing it', async () => {
    const req = reqFor()
    req.body = { weekly_time: '7am' }
    await expect(NotificationsController.updateHomecareDigestPreferences(req, resStub())).rejects.toThrow(AppError)
  })

  it('accepts the weekly time on the same HH:MM contract as the other windows', async () => {
    currentRow = null
    const req = reqFor()
    req.body = { weekly_time: '06:45' }
    const res = resStub()
    await NotificationsController.updateHomecareDigestPreferences(req, res)
    expect(insertParams[8]).toBe('06:45')
  })
})

/**
 * These read the source rather than the database, because the defect this fixes
 * was partly a default nobody could reach through the API at all — a test that
 * only exercised the controller would have passed while the scheduler emailed
 * every manager anyway.
 */
describe('the opt-in invariant, in the places that decide it', () => {
  it('migration 132 flips the column default and clears the rows migration 125 defaulted to TRUE', () => {
    const migration = read('apps/api/src/shared/database/migrations/132_weekly_digest_opt_in.sql')
    expect(migration).toMatch(/ALTER COLUMN weekly_enabled SET DEFAULT FALSE/i)
    // Both halves are needed: the default alone leaves existing rows on.
    expect(migration).toMatch(/SET weekly_enabled = FALSE/i)
  })

  it('is registered in the migration list, not just present on disk', () => {
    const setup = read('apps/api/src/shared/database/setup.ts')
    expect(setup).toMatch(/MIGRATION_132/)
    // Positional, because a migration file that exists but is absent from the
    // list is silently never applied. Asserted as a run of three so a later
    // migration appended to the list does not fail this for the wrong reason —
    // and so that adding one forces whoever added it to come back here. That
    // is deliberate: this assertion went red on migration 134 (carer location
    // retention) and again on 135 (medicines in care), and the fix both times
    // was to advance the run rather than loosen the pattern.
    expect(setup).toMatch(/MIGRATION_133, MIGRATION_134, MIGRATION_135\]/)
  })

  it('does not fall back to enabled for a user with no preference row', () => {
    const digests = read('apps/api/src/modules/homecare/homecare.digests.ts')
    expect(digests).toMatch(/COALESCE\(dp\.weekly_enabled, FALSE\)/)
    expect(digests).not.toMatch(/COALESCE\(dp\.weekly_enabled, TRUE\)/)
  })

  it('keeps the weekly window manager-only, so an opt-in is still a role-gated send', () => {
    const digests = read('apps/api/src/modules/homecare/homecare.digests.ts')
    expect(digests).toMatch(/type: 'weekly', enabled: isManager && recipient\.weekly_enabled/)
  })

  it('documents in migration 125 that the default was wrong, so the next reader does not "fix" it back', () => {
    const original = read('apps/api/src/shared/database/migrations/125_homecare_weekly_digest.sql')
    expect(original).toMatch(/DEFAULT TRUE/)
    expect(read('apps/api/src/shared/database/migrations/132_weekly_digest_opt_in.sql')).toMatch(/125/)
  })
})
