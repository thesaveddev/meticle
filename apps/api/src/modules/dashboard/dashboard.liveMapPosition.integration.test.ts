/**
 * What time does a pin on the live map describe?
 *
 * The page used to render the visit row's `updated_at` next to a green "GPS
 * captured" badge, which reads as "this is where the carer is now". It is not:
 * `updated_at` moves forward whenever anything writes to the visit — a note, a
 * task, a status change — while the position itself was captured once at
 * check-in and once at check-out and never again. A pin from 09:00 would read
 * 14:32 after an afternoon edit, and a manager would have no way to tell.
 *
 * These tests run against the database rather than mocking the query, because
 * the bug lived in the SQL: the coordinates came from a COALESCE and the time
 * came from a different column, with nothing tying them together. A mocked
 * query would have passed happily over that.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

const nearDate = (minsFromNow: number, durationMins = 60) => {
  const start = new Date(Date.now() + minsFromNow * 60000)
  const end = new Date(start.getTime() + durationMins * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}

type Fixture = { orgId: string; managerToken: string; visitId: string }

/** An organisation with one carer, one client and one call starting shortly. */
async function fixture(suffix: string): Promise<Fixture> {
  const stamp = `${Date.now()}-${suffix}`
  const org = await createOrg()
  const person = await createPerson({ organizationId: org.id })
  const manager = await createUser({ email: `map-mgr-${stamp}@test.com`, role: 'MANAGER', organization_id: org.id })
  const carer = await createUser({ email: `map-carer-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const carerProfile = await createStaffProfile({ userId: carer.id })
  const managerToken = generateToken(manager)

  // Collection requires a worker's own recorded agreement (migration 133), and
  // the map plots a position only for a worker who has agreed. This file is
  // about *which time* a pin reports, so the worker agrees first and the
  // agreement is not what is under test.
  await migrateQuery(
    `INSERT INTO staff_location_decisions (user_id, organization_id, decision, notice_key, notice_version)
     VALUES ($1, $2, 'agreed', 'staff_location', '1.1')
     ON CONFLICT (user_id) DO NOTHING`,
    [carer.id, org.id],
  )

  const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
    person_id: person.id, name: 'Support package', start_date: new Date().toISOString().split('T')[0], hourly_rate_pence: 1500,
  })
  const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
    package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id,
    visit_type: 'morning', label: 'Morning call',
    scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end,
  })
  expect(visit.status).toBe(201)

  return { orgId: org.id, managerToken, visitId: visit.body.id }
}

const mapFor = async (f: Fixture) => {
  const res = await request(app).get('/dashboard/live-map').set('Authorization', `Bearer ${f.managerToken}`)
  expect(res.status).toBe(200)
  return res.body
}

const visitRow = (visitId: string) =>
  migrateQuery(
    `SELECT check_in_at, check_out_at, updated_at FROM homecare_visits WHERE id = $1`,
    [visitId],
  ).then(r => r.rows[0])

/** Puts a check-in position on a visit the way the mobile check-in does. */
const checkInAt = (visitId: string, minutesAgo: number) =>
  migrateQuery(
    `UPDATE homecare_visits
     SET status = 'checked_in',
         check_in_at = NOW() - ($2 || ' minutes')::interval,
         check_in_latitude = 51.5074, check_in_longitude = -0.1278,
         updated_at = NOW()
     WHERE id = $1`,
    [visitId, String(minutesAgo)],
  )

describe('the time a live-map pin reports', () => {
  it('reports the moment the position was captured, not when the visit row was last written', async () => {
    const f = await fixture('capture-time')
    await checkInAt(f.visitId, 180) // captured three hours ago

    const before = await visitRow(f.visitId)
    const first = await mapFor(f)
    const pin = first.active_visits.find((v: any) => v.id === f.visitId)
    expect(pin).toBeDefined()
    expect(pin.position_source).toBe('check_in')
    expect(new Date(pin.position_captured_at).toISOString())
      .toBe(new Date(before.check_in_at).toISOString())

    // The regression: an unrelated edit to the visit moves updated_at forward.
    // The pin's time must not move with it, because nothing about the position
    // was re-captured.
    await migrateQuery(
      `UPDATE homecare_visits SET visit_notes = 'Client asked about the rota', updated_at = NOW() WHERE id = $1`,
      [f.visitId],
    )
    const after = await visitRow(f.visitId)
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime())

    const second = await mapFor(f)
    const moved = second.active_visits.find((v: any) => v.id === f.visitId)
    expect(new Date(moved.position_captured_at).toISOString())
      .toBe(new Date(before.check_in_at).toISOString())
    expect(new Date(moved.position_captured_at).getTime())
      .toBeLessThan(new Date(after.updated_at).getTime())
  })

  it('never returns a row-write time that a client could mistake for a position time', async () => {
    const f = await fixture('no-row-time')
    await checkInAt(f.visitId, 45)
    const body = await mapFor(f)
    const pin = body.active_visits.find((v: any) => v.id === f.visitId)
    // The field that caused the finding is gone from the contract entirely, so
    // the mistake cannot be reintroduced by rendering whatever it is called.
    expect(pin).not.toHaveProperty('last_updated')
    expect(pin).not.toHaveProperty('check_in_at')
    expect(Object.keys(pin)).toContain('position_captured_at')
  })

  it('describes a check-out point with the check-out time when that is the point plotted', async () => {
    const f = await fixture('checkout-point')
    // No check-in coordinates, but a check-out pair — the fallback branch.
    await migrateQuery(
      `UPDATE homecare_visits
       SET status = 'checked_in',
           check_in_at = NOW() - interval '200 minutes',
           check_out_latitude = 51.51, check_out_longitude = -0.13,
           check_out_at = NOW() - interval '150 minutes',
           updated_at = NOW()
       WHERE id = $1`,
      [f.visitId],
    )
    const row = await visitRow(f.visitId)
    const pin = (await mapFor(f)).active_visits.find((v: any) => v.id === f.visitId)

    expect(pin.latitude).toBeCloseTo(51.51, 3)
    expect(pin.position_source).toBe('check_out')
    // Not the check-in time: the point plotted came from the other branch, so
    // the time has to come from that branch too.
    expect(new Date(pin.position_captured_at).toISOString())
      .toBe(new Date(row.check_out_at).toISOString())
    expect(new Date(pin.position_captured_at).getTime())
      .not.toBe(new Date(row.check_in_at).getTime())
  })

  it('reports no position and no time for a visit with nothing captured', async () => {
    const f = await fixture('no-position')
    const body = await mapFor(f)
    const pin = body.scheduled_visits.find((v: any) => v.id === f.visitId)
    expect(pin.latitude).toBeNull()
    expect(pin.position_source).toBeNull()
    expect(pin.position_captured_at).toBeNull()
  })

  it('plots nothing for a half-recorded position rather than a pin on one axis', async () => {
    const f = await fixture('partial')
    await migrateQuery(
      `UPDATE homecare_visits
       SET status = 'checked_in', check_in_at = NOW() - interval '20 minutes',
           check_in_latitude = 51.5074, check_in_longitude = NULL
       WHERE id = $1`,
      [f.visitId],
    )
    const pin = (await mapFor(f)).active_visits.find((v: any) => v.id === f.visitId)
    expect(pin.latitude).toBeNull()
    expect(pin.position_captured_at).toBeNull()
  })
})
