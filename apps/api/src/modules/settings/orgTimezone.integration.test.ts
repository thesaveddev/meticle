/**
 * The provider's day is a per-organisation fact, not a per-deployment one.
 *
 * `CURRENT_DATE` and every `date_trunc('day', …)` resolve in the session
 * `TimeZone`, so this column is what decides which day roughly forty queries
 * name. The assertions below are written so that they could not pass by reading
 * the column back: the session is set through the same function the request path
 * calls, and the day is compared against one computed in JavaScript with `Intl`
 * for the same zone, so the expectation does not come from the database under
 * test.
 *
 * The fallback case is the one that matters most. A stored value the server
 * cannot resolve must not fail the request: the statement it is used in is the
 * one that carries the RLS context, so the failure mode of a naive
 * `set_config('TimeZone', <stored value>)` is not a wrong day for one tenant, it
 * is a tenant that cannot make any authenticated request at all.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import pool, { migrateQuery, databaseSessionTimeZone, resetRlsSessionVars } from '../../shared/database'
import { setRlsSessionVars } from '../../shared/middleware/auth.middleware'
import { PoolClient } from 'pg'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** A date in a zone as `YYYY-MM-DD`, computed without the database. */
function dayIn(zone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/** The session's timezone and day on the connection a request would use. */
async function sessionOf(
  client: PoolClient,
  user: { userId: string; organizationId?: string; email?: string; role?: any }
) {
  await setRlsSessionVars(client, {
    userId: user.userId,
    email: user.email || 'test@example.com',
    role: user.role || 'ORG_ADMIN',
    organizationId: user.organizationId,
  })
  const { rows } = await client.query(
    "SELECT current_setting('TimeZone') AS tz, CURRENT_DATE::text AS day"
  )
  return rows[0]
}

describe('Organisation time zone', () => {
  it('is settable by an org admin, read back, and refused for a name that is not a zone', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `tz-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const initial = await request(app).get('/settings/org').set('Authorization', `Bearer ${token}`)
    expect(initial.status).toBe(200)
    expect(initial.body.timezone).toBe('Europe/London')

    const saved = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Europe/Dublin' })
    expect(saved.status).toBe(200)
    expect(saved.body.timezone).toBe('Europe/Dublin')

    const persisted = await request(app).get('/settings/org').set('Authorization', `Bearer ${token}`)
    expect(persisted.body.timezone).toBe('Europe/Dublin')

    // A zone the runtime has never heard of is a 400, not a stored value that
    // would later have to be handled by every query that names a day.
    const nonsense = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Mars/Olympus' })
    expect(nonsense.status).toBe(400)

    const notAString = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 42 })
    expect(notAString.status).toBe(400)

    const stillDublin = await request(app).get('/settings/org').set('Authorization', `Bearer ${token}`)
    expect(stillDublin.body.timezone).toBe('Europe/Dublin')
  })

  it('is not something a manager can move, because it moves everyone’s day', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `tzmgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)

    const refused = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Pacific/Kiritimati' })
    expect(refused.status).toBe(403)

    // And alongside a field a manager *may* set, it is dropped rather than saved.
    const mixed = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Pacific/Kiritimati', minimum_compliance_percent: 88 })
    expect(mixed.status).toBe(200)
    expect(mixed.body.timezone).toBe('Europe/London')
    expect(mixed.body.minimum_compliance_percent).toBe(88)
  })

  it('refuses a value at the database, not only at the API', async () => {
    // The API is not the only writer in an incident, and the character class is
    // the last thing between a hand-edited row and a `set_config` call.
    const org = await createOrg()
    await expect(
      migrateQuery(`UPDATE organizations SET timezone = $1 WHERE id = $2`, ['Europe/London; DROP TABLE users', org.id])
    ).rejects.toThrow(/organizations_timezone_format_check/)
  })

  it('sets the session timezone from the organisation, and the day from that zone', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `tzsess-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })

    // A zone whose calendar day is guaranteed to differ from the deploy
    // default's at the moment this runs. +14 and -10 between them cover every
    // hour of the UTC day, so one of them always disagrees with Europe/London.
    const candidates = ['Pacific/Kiritimati', 'Pacific/Honolulu']
    const zone = candidates.find((candidate) => dayIn(candidate) !== dayIn(databaseSessionTimeZone))
    expect(zone, 'neither candidate disagreed with the default zone — the check itself is broken').toBeTruthy()

    await migrateQuery(`UPDATE organizations SET timezone = $1 WHERE id = $2`, [zone, org.id])

    const client = await pool.connect()
    try {
      const session = await sessionOf(client, { userId: admin.id, organizationId: org.id })
      expect(session.tz).toBe(zone)
      expect(session.day).toBe(dayIn(zone as string))
      expect(session.day).not.toBe(dayIn(databaseSessionTimeZone))
    } finally {
      await resetRlsSessionVars(client)
      client.release()
    }
  })

  it('gives each tenant its own day on a connection they share, and leaves none behind', async () => {
    // One pooled connection, two organisations in turn — which is the whole
    // point of setting this per request rather than once at boot.
    const orgA = await createOrg()
    const orgB = await createOrg()
    const adminA = await createUser({ email: `tza-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: orgA.id })
    const adminB = await createUser({ email: `tzb-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: orgB.id })
    await migrateQuery(`UPDATE organizations SET timezone = 'Europe/Dublin' WHERE id = $1`, [orgA.id])

    const client = await pool.connect()
    try {
      expect((await sessionOf(client, { userId: adminA.id, organizationId: orgA.id })).tz).toBe('Europe/Dublin')
      // orgB has never had its own value set: it must get the deploy default,
      // not the zone the previous tenant left on this connection.
      expect((await sessionOf(client, { userId: adminB.id, organizationId: orgB.id })).tz).toBe(databaseSessionTimeZone)

      await resetRlsSessionVars(client)
      const afterReset = await client.query("SELECT current_setting('TimeZone') AS tz")
      expect(afterReset.rows[0].tz).toBe(databaseSessionTimeZone)
    } finally {
      await resetRlsSessionVars(client)
      client.release()
    }
  })

  it('falls back to the deploy default when the stored zone is one the server cannot resolve', async () => {
    // Well-formed, so it passes the column's CHECK and can only have got there
    // by hand — and unresolvable, which is the case that must not take a tenant
    // offline. `app_org_time_zone` proves the name before it is applied, so this
    // returns NULL instead of raising inside the RLS statement.
    const org = await createOrg()
    const admin = await createUser({ email: `tzbad-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await migrateQuery(`UPDATE organizations SET timezone = 'Nowhere/Nothing' WHERE id = $1`, [org.id])

    const client = await pool.connect()
    try {
      const session = await sessionOf(client, { userId: admin.id, organizationId: org.id })
      expect(session.tz).toBe(databaseSessionTimeZone)
      expect(session.day).toBe(dayIn(databaseSessionTimeZone))

      // The request context itself must still be set — the fallback may not cost
      // the tenant its RLS context.
      const orgVar = await client.query("SELECT current_setting('app.current_org_id') AS id")
      expect(orgVar.rows[0].id).toBe(org.id)
    } finally {
      await resetRlsSessionVars(client)
      client.release()
    }
  })

  it('falls back for a user with no organisation, and still sets the rest of the context', async () => {
    const client = await pool.connect()
    try {
      const session = await sessionOf(client, {
        userId: '00000000-0000-0000-0000-000000000000',
        organizationId: undefined,
        role: 'SUPER_ADMIN',
      })
      expect(session.tz).toBe(databaseSessionTimeZone)
      const vars = await client.query(
        "SELECT current_setting('app.current_org_id') AS org, current_setting('app.current_user_role') AS role"
      )
      expect(vars.rows[0].org).toBe('')
      expect(vars.rows[0].role).toBe('SUPER_ADMIN')
    } finally {
      await resetRlsSessionVars(client)
      client.release()
    }
  })
})
