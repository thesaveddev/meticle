import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { cleanDate } from './mica.tools'
import { migrateQuery, pool } from '../../shared/database'

/**
 * The "today" fallback for Mica's read-only tools must agree with the bare
 * `::date` casts the tool SQL itself uses — and a bare cast resolves in the
 * database session's TimeZone, not in JavaScript's UTC day.
 *
 * Before the fix the fallback came from `new Date().toISOString()`, which
 * slices the day in UTC. Around local midnight (00:00–01:00 in BST,
 * 23:00–00:00 in winter) the UTC day is still yesterday while every
 * `start_time::date` cast in the tool SQL resolves in London to today — a
 * shift or appointment seeded "today" at 08:00 UTC looks like TOMORROW to the
 * fallback, and both `who_supports_person` and `get_appointments` returned
 * zero rows even though the user's rota visibly had them.
 *
 * This suite runs the *process* in UTC while the *database session* stays in
 * Europe/London, so the two conventions genuinely disagree — the midnight
 * hour is reproduced on demand, deterministically, instead of relying on the
 * wall clock happening to sit inside it when the suite runs.
 */

const ORIGINAL_TZ = process.env.TZ

beforeAll(() => {
  // Node honours TZ at(Date) call sites, not at import time, so switching
  // here puts the whole test process in UTC without restarting anything.
  process.env.TZ = 'UTC'
})

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ
})

describe('cleanDate — "today" is the database session day, not the UTC day', () => {
  it('returns the DB session CURRENT_DATE even when the UTC day has lagged behind', async () => {
    // Prove the divergence is real in this process: ask Postgres for both
    // conventions in one statement. `local_timestamp::date` is the session
    // (London) day; the JS fallback we replaced would have produced the UTC
    // day. If these already agree the suite cannot exercise its premise this
    // hour, so there is nothing to assert about ordering.
    const probe = await migrateQuery(
      `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE current_setting('TimeZone'))::date, 'YYYY-MM-DD') AS session_day,
              to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS utc_day`,
    )
    const sessionDay: string = probe.rows[0].session_day
    const utcDay: string = probe.rows[0].utc_day

    // The DB session must stay in a zone whose half-hour offset can genuinely
    // diverge from UTC — London in summer diverges 00:00–01:00.59.
    const tzRow = await migrateQuery(`SELECT current_setting('TimeZone') AS tz`)
    const dbTz: string = tzRow.rows[0].tz

    const resolved = await cleanDate(undefined)

    // Assert against the session day, which is the only convention the tool
    // SQL's bare ::date casts agree with.
    expect(dbTz).toBe('Europe/London')
    expect(resolved).toBe(sessionDay)

    // Anti-regression shape: the old implementation returned
    // `new Date().toISOString().split('T')[0]` — the UTC day. Whenever the
    // two conventions diverge (at least one hour of every BST day in this
    // repo's production timezone) the old code returned utcDay and the
    // assertion above failed. Probing both days in the same statement keeps
    // this honest rather than tautological.
    if (sessionDay !== utcDay) {
      expect(resolved).not.toBe(utcDay)
    }
  })

  it('accepts and echoes a client-supplied YYYY-MM-DD date', async () => {
    expect(await cleanDate('2026-01-05')).toBe('2026-01-05')
  })

  it('rejects a malformed date argument by falling back to the session day', async () => {
    const fallbackRow = await migrateQuery('SELECT CURRENT_DATE::text AS day')
    expect(await cleanDate('   ')).toBe(fallbackRow.rows[0].day)
    expect(await cleanDate('not-a-date')).toBe(fallbackRow.rows[0].day)
    expect(await cleanDate(42)).toBe(fallbackRow.rows[0].day)
  })
})
