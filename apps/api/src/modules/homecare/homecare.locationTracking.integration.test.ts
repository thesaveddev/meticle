/**
 * The per-organisation switch that turns carer location off.
 *
 * The DPIA claimed this control existed in v1.0 and retracted the claim in v1.1
 * because it did not. These tests exist because a control that nothing tests is
 * a control that quietly stops working — and because the failure mode is the
 * worst kind: a customer who switched off staff location and was still being
 * tracked would have no way of knowing.
 *
 * The load-bearing case is the third one. If switching location off broke
 * check-in, the obvious "fix" would be for someone to quietly turn it back on,
 * and a safety control that gets disabled by a bug is worse than not having it.
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
const fd = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

type Fixture = { orgId: string; adminId: string; adminToken: string; managerToken: string; carerToken: string }

/** An organisation with one carer, one client, one package and one open call. */
async function fixture(suffix: string): Promise<Fixture> {
  const stamp = `${Date.now()}-${suffix}`
  const org = await createOrg()
  const person = await createPerson({ organizationId: org.id })
  const admin = await createUser({ email: `loc-admin-${stamp}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
  const manager = await createUser({ email: `loc-mgr-${stamp}@test.com`, role: 'MANAGER', organization_id: org.id })
  const carer = await createUser({ email: `loc-carer-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const carerProfile = await createStaffProfile({ userId: carer.id })

  const managerToken = generateToken(manager)
  const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
    person_id: person.id, name: 'Support package', start_date: fd(1), hourly_rate_pence: 1500,
  })
  const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
    package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id,
    visit_type: 'morning', label: 'Morning call',
    scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end,
  })
  expect(visit.status).toBe(201)

  return {
    orgId: org.id,
    adminId: admin.id,
    adminToken: generateToken(admin),
    managerToken,
    carerToken: generateToken(carer),
  }
}

/** Flips the switch directly in the database, bypassing the endpoint. */
const setTracking = (orgId: string, enabled: boolean, userId: string) =>
  migrateQuery(
    `UPDATE organizations
     SET location_tracking_enabled = $1,
         location_tracking_disabled_at = CASE WHEN $1 THEN NULL ELSE NOW() END,
         location_tracking_disabled_by = CASE WHEN $1 THEN NULL ELSE $3::uuid END
     WHERE id = $2`,
    [enabled, orgId, userId],
  )

async function latestVisit(orgId: string) {
  const result = await migrateQuery(
    `SELECT id, check_in_latitude, check_in_longitude, check_out_latitude, check_out_longitude, location_capture_skipped
     FROM homecare_visits WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orgId],
  )
  return result.rows[0]
}

describe('the location switch is a control, not a preference', () => {
  it('reports the current setting to a manager', async () => {
    const f = await fixture('read')
    const res = await request(app).get('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.location_tracking_enabled).toBe(true)
  })

  it('stops storing a position on check-in once switched off', async () => {
    const f = await fixture('store-off')
    await setTracking(f.orgId, false, f.adminId)

    // The client still sends coordinates. They must not be stored: "off" has to
    // mean off even if an out-of-date app keeps sending them.
    const res = await request(app)
      .post(`/homecare/visits/${(await latestVisit(f.orgId)).id}/check-in`)
      .set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 8 })
    expect(res.status).toBe(200)

    const visit = await latestVisit(f.orgId)
    expect(visit.check_in_latitude).toBeNull()
    expect(visit.check_in_longitude).toBeNull()
    expect(visit.location_capture_skipped).toBe(true)
  })

  it('still lets a carer check in and out with no coordinates at all', async () => {
    // The regression this guards against is subtle and serious: if tracking off
    // broke check-in, the fix someone would reach for is switching it back on,
    // and a data-protection control that a bug can switch off is not one.
    const f = await fixture('no-coords')
    await setTracking(f.orgId, false, f.adminId)
    const visitId = (await latestVisit(f.orgId)).id

    const inRes = await request(app).post(`/homecare/visits/${visitId}/check-in`)
      .set('Authorization', `Bearer ${f.carerToken}`)
      .send({})
    expect(inRes.status).toBe(200)
    expect(inRes.body.status).toBe('checked_in')

    const outRes = await request(app).post(`/homecare/visits/${visitId}/check-out`)
      .set('Authorization', `Bearer ${f.carerToken}`)
      .send({ note: 'Visit completed.' })
    expect(outRes.status).toBe(200)
    expect(outRes.body.status).toBe('completed')

    const visit = await latestVisit(f.orgId)
    expect(visit.check_in_latitude).toBeNull()
    expect(visit.check_out_latitude).toBeNull()
  })

  it('still refuses a coordinate-less check-in when tracking is on', async () => {
    // Making the route schema accept a missing location is what allowed the
    // switch to work. This is the half that must not regress: with tracking on,
    // a check-in with no fix is refused, exactly as before.
    const f = await fixture('require-coords')
    const visitId = (await latestVisit(f.orgId)).id

    const res = await request(app).post(`/homecare/visits/${visitId}/check-in`)
      .set('Authorization', `Bearer ${f.carerToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('records coordinates again once switched back on', async () => {
    const f = await fixture('re-enable')
    const visitId = (await latestVisit(f.orgId)).id
    await setTracking(f.orgId, false, f.adminId)
    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${f.carerToken}`).send({})
    expect((await latestVisit(f.orgId)).check_in_latitude).toBeNull()

    await setTracking(f.orgId, true, f.adminId)
    await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 9 })
    const visit = await latestVisit(f.orgId)
    expect(Number(visit.check_out_latitude)).toBeCloseTo(51.5, 3)
  })

  it('refuses the map endpoint, so hiding it in the UI is not the control', async () => {
    const f = await fixture('map-refused')
    await setTracking(f.orgId, false, f.adminId)
    const res = await request(app).get('/dashboard/live-map').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/switched off/i)
  })

  it('still serves the map while tracking is on', async () => {
    const f = await fixture('map-on')
    const res = await request(app).get('/dashboard/live-map').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(200)
  })
})

describe('switching it is an organisation-level decision', () => {
  it('refuses a manager and accepts an ORG_ADMIN', async () => {
    const f = await fixture('roles')

    const asManager = await request(app).put('/homecare/settings/location-tracking')
      .set('Authorization', `Bearer ${f.managerToken}`)
      .send({ enabled: false })
    expect(asManager.status).toBe(403)

    const asAdmin = await request(app).put('/homecare/settings/location-tracking')
      .set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false })
    expect(asAdmin.status).toBe(200)
    expect(asAdmin.body.location_tracking_enabled).toBe(false)
    // The visit-verification trade-off is returned rather than left for the
    // manager to discover after switching it off.
    expect(asAdmin.body.visit_verification_available).toBe(false)
  })

  it('stamps who switched it off and when', async () => {
    const f = await fixture('stamp')
    await request(app).put('/homecare/settings/location-tracking')
      .set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false })

    const res = await migrateQuery(
      'SELECT location_tracking_disabled_at, location_tracking_disabled_by FROM organizations WHERE id = $1',
      [f.orgId],
    )
    expect(res.rows[0].location_tracking_disabled_at).toBeTruthy()
    expect(res.rows[0].location_tracking_disabled_by).toBeTruthy()
  })

  it('clears the stamp when switched back on, so "when did it stop" has one answer', async () => {
    const f = await fixture('stamp-clear')
    await setTracking(f.orgId, false, f.adminId)
    await request(app).put('/homecare/settings/location-tracking')
      .set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: true })

    const res = await migrateQuery(
      'SELECT location_tracking_disabled_at FROM organizations WHERE id = $1',
      [f.orgId],
    )
    expect(res.rows[0].location_tracking_disabled_at).toBeNull()
  })

  it('does not let one organisation switch off another', async () => {
    const a = await fixture('tenant-a')
    const b = await fixture('tenant-b')
    await setTracking(b.orgId, false, b.adminId)

    // A's admin flipping their own switch must not reach B.
    await request(app).put('/homecare/settings/location-tracking')
      .set('Authorization', `Bearer ${a.adminToken}`)
      .send({ enabled: false })

    const stillOff = await migrateQuery('SELECT location_tracking_enabled FROM organizations WHERE id = $1', [b.orgId])
    expect(stillOff.rows[0].location_tracking_enabled).toBe(false)
  })
})
