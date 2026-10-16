/**
 * `CURRENT_DATE` has to mean the provider's day, not UTC's.
 *
 * Nothing set the session timezone, so roughly forty queries that name a day —
 * `appointments.getTodayStats`, Mica's "today", the monthly medicines roll-up,
 * every expiry window — resolved it in UTC. For a UK provider under BST that is
 * the previous day between 00:00 and 01:00, which is the hour a night shift does
 * its round and hands over.
 *
 * The day is computed here in JavaScript for the same zone, so the expectation
 * does not come from the database being tested. On a UTC machine the two agree
 * for all but one hour a day; the assertion that the *session* is London is what
 * holds regardless of where the suite runs.
 */
import { describe, it, expect } from 'vitest'
import { query, migrateQuery, databaseSessionTimeZone } from './index'

/** A date in a given IANA zone as YYYY-MM-DD, computed without the database. */
function dayIn(zone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

describe('the database session timezone', () => {
  it('is Europe/London, the offset and DST rules every supported nation shares', () => {
    expect(databaseSessionTimeZone).toBe(process.env.DB_TIMEZONE || 'Europe/London')
  })

  it('makes CURRENT_DATE the provider day on the app pool', async () => {
    const { rows } = await query(
      "SELECT current_setting('TimeZone') AS tz, CURRENT_DATE::text AS day, NOW()::date::text AS now_day"
    )

    expect(rows[0].tz).toBe(databaseSessionTimeZone)
    expect(rows[0].day).toBe(dayIn(databaseSessionTimeZone))
    // `NOW()::date` is the other spelling of the same thing, and it has to agree.
    expect(rows[0].now_day).toBe(rows[0].day)
  })

  it('makes the day boundaries local too, which is what date arithmetic reads', async () => {
    const { rows } = await query(`
      SELECT to_char(date_trunc('day', NOW()), 'HH24:MI') AS starts_at,
             extract(EPOCH FROM date_trunc('day', NOW()) + INTERVAL '1 day' - date_trunc('day', NOW()))::int AS length_seconds
    `)

    // A local day begins at local midnight, not at 23:00Z or 01:00Z.
    expect(rows[0].starts_at).toBe('00:00')
    // 23 hours on the spring-forward day, 25 on the autumn one, 24 otherwise —
    // a UTC day is always 24, so the DST lengths are the signature of a local day.
    expect([82_800, 86_400, 90_000]).toContain(rows[0].length_seconds)
  })

  it('applies to the migration pool as well, which runs the nightly jobs', async () => {
    const { rows } = await migrateQuery("SELECT current_setting('TimeZone') AS tz")
    expect(rows[0].tz).toBe(databaseSessionTimeZone)
  })
})
