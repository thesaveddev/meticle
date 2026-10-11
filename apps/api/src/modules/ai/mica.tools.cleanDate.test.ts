import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { cleanDate } from './mica.tools'
import pool, { migrateQuery, query, requestDBStorage } from '../../shared/database'

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
 * This suite pins one database connection to Europe/London and freezes
 * JavaScript's clock on the previous UTC day. The disagreement is reproduced
 * deterministically at any wall-clock hour, with no assumption about CI's
 * cluster-level database timezone.
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
    // Pin an app-pool connection so the tested query and cleanDate share one
    // real database session. The database is not guaranteed to default to the
    // production timezone in CI, so set it explicitly for this transaction.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL TIME ZONE 'Europe/London'")
      await requestDBStorage.run({ client }, async () => {
        const probe = await query(
          `SELECT CURRENT_DATE::text AS session_day,
                  current_setting('TimeZone') AS timezone`,
        )
        const sessionDay: string = probe.rows[0].session_day
        expect(probe.rows[0].timezone).toBe('Europe/London')

        // Make the former UTC fallback wrong on every run, not just during the
        // one hour around UK midnight. The database clock remains real; only
        // JavaScript's Date is pinned to the previous UTC day.
        const previousUtcDay = new Date(Date.parse(`${sessionDay}T12:00:00.000Z`) - 86_400_000)
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(previousUtcDay)
        try {
          expect(new Date().toISOString().slice(0, 10)).not.toBe(sessionDay)
          expect(await cleanDate(undefined)).toBe(sessionDay)
        } finally {
          vi.useRealTimers()
        }
      })
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
  })

  it('accepts and echoes a client-supplied YYYY-MM-DD date', async () => {
    expect(await cleanDate('2026-01-05')).toBe('2026-01-05')
  })

  it('rejects a malformed date argument by falling back to the session day', async () => {
    const fallbackRow = await query('SELECT CURRENT_DATE::text AS day')
    expect(await cleanDate('   ')).toBe(fallbackRow.rows[0].day)
    expect(await cleanDate('not-a-date')).toBe(fallbackRow.rows[0].day)
    expect(await cleanDate(42)).toBe(fallbackRow.rows[0].day)
  })
})
