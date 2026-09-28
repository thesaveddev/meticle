/**
 * Per-worker location decisions: told, agreed or declined, and the refusal honoured.
 *
 * The organisation switch already existed and was tested. This covers the half it
 * could not do: an individual worker saying no.
 *
 * The load-bearing assertions are the ones where a refusal has to survive
 * something. A refusal that is stored but not enforced is worse than no refusal
 * at all, because it produces an audit trail that says a worker objected while
 * the app went on plotting them — so each of those is checked at the place it
 * would actually break: the check-in write, the check-out write, and the map.
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

const NOTICE = { notice_key: 'staff_location', notice_version: '1.1' }

type Fixture = {
  orgId: string; adminId: string
  adminToken: string; managerToken: string; carerToken: string; otherCarerToken: string
  visitId: string
}

async function fixture(suffix: string): Promise<Fixture> {
  const stamp = `${Date.now()}-${suffix}`
  const org = await createOrg()
  const person = await createPerson({ organizationId: org.id })
  const admin = await createUser({ email: `dec-admin-${stamp}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
  const manager = await createUser({ email: `dec-mgr-${stamp}@test.com`, role: 'MANAGER', organization_id: org.id })
  const carer = await createUser({ email: `dec-carer-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const other = await createUser({ email: `dec-other-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const carerProfile = await createStaffProfile({ userId: carer.id })
  // A second real worker, so the evidence view has a denominator that is not
  // entirely made of the one worker the test decided for.
  await createStaffProfile({ userId: other.id })
  const managerToken = generateToken(manager)

  const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
    person_id: person.id, name: 'Support package',
    start_date: new Date().toISOString().split('T')[0], hourly_rate_pence: 1500,
  })
  const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
    package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id,
    visit_type: 'morning', label: 'Morning call',
    scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end,
  })
  expect(visit.status).toBe(201)

  return {
    orgId: org.id, adminId: admin.id,
    adminToken: generateToken(admin), managerToken,
    carerToken: generateToken(carer), otherCarerToken: generateToken(other),
    visitId: visit.body.id,
  }
}

const decide = (token: string, decision: 'agreed' | 'declined') =>
  request(app).post('/homecare/location-decision').set('Authorization', `Bearer ${token}`)
    .send({ decision, ...NOTICE })

const mine = (token: string) =>
  request(app).get('/homecare/location-decision').set('Authorization', `Bearer ${token}`)

const visitRow = (visitId: string) =>
  migrateQuery(
    `SELECT check_in_latitude, check_out_latitude, location_capture_skipped, location_capture_skip_reason
     FROM homecare_visits WHERE id = $1`,
    [visitId],
  ).then(r => r.rows[0])

const checkIn = (f: Fixture, coords = { latitude: 51.5, longitude: -0.1, accuracy_meters: 9 }) =>
  request(app).post(`/homecare/visits/${f.visitId}/check-in`).set('Authorization', `Bearer ${f.carerToken}`)
    .send(coords)

describe('a worker\'s own decision is recorded and read back', () => {
  it('starts as no decision, and says plainly that nothing is collected', async () => {
    const f = await fixture('undecided')
    const res = await mine(f.carerToken)
    expect(res.status).toBe(200)
    expect(res.body.decision).toBeNull()
    // Not agreed is not agreed. This is the distinction that makes an
    // "agreed" record worth having.
    expect(res.body.collects_location).toBe(false)
  })

  it('records an agreement, and only then reports that location is collected', async () => {
    const f = await fixture('agreed')
    expect((await decide(f.carerToken, 'agreed')).status).toBe(201)
    const res = await mine(f.carerToken)
    expect(res.body.decision).toBe('agreed')
    expect(res.body.collects_location).toBe(true)
    expect(res.body.decided_at).toBeTruthy()
  })

  it('records a refusal, and reports that nothing is collected', async () => {
    const f = await fixture('declined')
    expect((await decide(f.carerToken, 'declined')).status).toBe(201)
    const res = await mine(f.carerToken)
    expect(res.body.decision).toBe('declined')
    expect(res.body.collects_location).toBe(false)
  })

  it('lets a worker change their mind, with the current answer replacing the last', async () => {
    const f = await fixture('changed-mind')
    await decide(f.carerToken, 'declined')
    await decide(f.carerToken, 'agreed')
    expect((await mine(f.carerToken)).body.decision).toBe('agreed')

    // And back again. A decision that can only be made once is not a choice.
    await decide(f.carerToken, 'declined')
    expect((await mine(f.carerToken)).body.decision).toBe('declined')

    // One current row per worker, so the answer collection consults is
    // unambiguous; the sequence lives in the audit trail instead.
    const rows = await migrateQuery(
      'SELECT COUNT(*)::int AS count FROM staff_location_decisions WHERE user_id = $1',
      [await userIdFor(f)],
    )
    expect(rows.rows[0].count).toBe(1)
  })

  it('rejects an answer that is neither agreement nor refusal', async () => {
    const f = await fixture('nonsense')
    const res = await request(app).post('/homecare/location-decision')
      .set('Authorization', `Bearer ${f.carerToken}`)
      .send({ decision: 'maybe', ...NOTICE })
    expect(res.status).toBe(400)
  })

  it('will not let one worker record a decision for another', async () => {
    // The body carries a user_id nowhere, and the RLS policy on the table binds
    // the row to the caller. A control an employer can enter on a staff member's
    // behalf is not a decision by that staff member.
    const f = await fixture('cross-worker')
    await decide(f.carerToken, 'declined')
    const forged = await request(app).post('/homecare/location-decision')
      .set('Authorization', `Bearer ${f.otherCarerToken}`)
      .send({ decision: 'agreed', user_id: '00000000-0000-0000-0000-000000000000', ...NOTICE })
    expect(forged.status).toBe(201)
    // The other worker's call wrote their own row and left the first alone.
    expect((await mine(f.carerToken)).body.decision).toBe('declined')
    expect((await mine(f.otherCarerToken)).body.decision).toBe('agreed')
  })
})

describe('a refusal is honoured at the point of collection', () => {
  it('stores no position for a worker who declined, and says why on the visit', async () => {
    const f = await fixture('refused-capture')
    await decide(f.carerToken, 'declined')
    const res = await checkIn(f)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('checked_in')

    const visit = await visitRow(f.visitId)
    expect(visit.check_in_latitude).toBeNull()
    expect(visit.location_capture_skipped).toBe(true)
    expect(visit.location_capture_skip_reason).toBe('worker_declined')
  })

  it('does not let a refusal turn into a blocked check-in', async () => {
    // The failure mode this guards is the obvious wrong fix: demanding
    // coordinates before honouring the decision, so that declining becomes a
    // 400 and a care worker cannot start a shift. The visit is recorded; only
    // the position is missing.
    const f = await fixture('refused-not-blocked')
    await decide(f.carerToken, 'declined')
    const res = await checkIn(f, {} as any)
    expect(res.status).toBe(200)
    expect(res.body.check_in_at).toBeTruthy()
  })

  it('collects nothing for a worker who has not been asked yet, and says that', async () => {
    const f = await fixture('undecided-capture')
    const res = await checkIn(f)
    expect(res.status).toBe(200)
    const visit = await visitRow(f.visitId)
    expect(visit.check_in_latitude).toBeNull()
    expect(visit.location_capture_skip_reason).toBe('not_agreed')
  })

  it('collects the position once a worker has agreed', async () => {
    const f = await fixture('agreed-capture')
    await decide(f.carerToken, 'agreed')
    const res = await checkIn(f)
    expect(res.status).toBe(200)
    expect(Number(res.body.check_in_latitude)).toBeCloseTo(51.5, 3)
    const visit = await visitRow(f.visitId)
    expect(visit.location_capture_skipped).toBe(false)
    expect(visit.location_capture_skip_reason).toBeNull()
  })

  it('stops collecting the moment a worker withdraws, mid-visit', async () => {
    const f = await fixture('withdraw')
    await decide(f.carerToken, 'agreed')
    await checkIn(f)
    expect((await visitRow(f.visitId)).check_in_latitude).not.toBeNull()

    // The strongest form of the control: the refusal arrives after the visit
    // started, and the check-out must still honour it.
    await decide(f.carerToken, 'declined')
    const out = await request(app).post(`/homecare/visits/${f.visitId}/check-out`)
      .set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 9, note: 'Done.' })
    expect(out.status).toBe(200)

    const visit = await visitRow(f.visitId)
    expect(visit.check_out_latitude).toBeNull()
    expect(visit.location_capture_skip_reason).toBe('worker_declined')
  })

  it('lets the organisation switch override a worker\'s agreement', async () => {
    // Order matters. The provider's switch is the outer control: a worker
    // agreeing cannot switch location back on for a provider who turned it off.
    const f = await fixture('org-overrides')
    await decide(f.carerToken, 'agreed')
    await migrateQuery(
      'UPDATE organizations SET location_tracking_enabled = FALSE WHERE id = $1',
      [f.orgId],
    )
    await checkIn(f)
    const visit = await visitRow(f.visitId)
    expect(visit.check_in_latitude).toBeNull()
    expect(visit.location_capture_skip_reason).toBe('organisation_disabled')
  })

  it('reports the organisation as not collecting when the switch is off', async () => {
    const f = await fixture('org-off-read')
    await decide(f.carerToken, 'agreed')
    await migrateQuery(
      'UPDATE organizations SET location_tracking_enabled = FALSE WHERE id = $1',
      [f.orgId],
    )
    const res = await mine(f.carerToken)
    expect(res.body.organisation_collects_location).toBe(false)
    expect(res.body.collects_location).toBe(false)
  })
})

describe('a refusal is honoured on the map', () => {
  it('does not plot a position for a worker who has declined', async () => {
    const f = await fixture('map-refused')
    // A position already on the visit from when this worker had agreed. The
    // decision is the primary control here, not the check-in path, because
    // nothing is re-captured on a visit that already happened.
    await migrateQuery(
      `UPDATE homecare_visits
       SET status = 'checked_in', check_in_at = NOW() - interval '20 minutes',
           check_in_latitude = 51.5074, check_in_longitude = -0.1278
       WHERE id = $1`,
      [f.visitId],
    )
    await decide(f.carerToken, 'declined')

    const res = await request(app).get('/dashboard/live-map').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(200)
    const pin = res.body.active_visits.find((v: any) => v.id === f.visitId)
    expect(pin.latitude).toBeNull()
    expect(pin.position_captured_at).toBeNull()
  })

  it('still plots the position for a worker who has agreed', async () => {
    const f = await fixture('map-agreed')
    await decide(f.carerToken, 'agreed')
    await checkIn(f)
    const res = await request(app).get('/dashboard/live-map').set('Authorization', `Bearer ${f.managerToken}`)
    const pin = res.body.active_visits.find((v: any) => v.id === f.visitId)
    expect(Number(pin.latitude)).toBeCloseTo(51.5, 3)
    expect(pin.position_source).toBe('check_in')
  })
})

describe('the evidence a provider can show', () => {
  it('counts every active worker, including the ones who have not answered', async () => {
    // A summary that only counts the rows it has would let an organisation show
    // "100% agreed" by having answered for four of its forty workers.
    const f = await fixture('summary')
    await decide(f.carerToken, 'agreed')
    const res = await request(app).get('/homecare/location-decisions').set('Authorization', `Bearer ${f.managerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(2)
    expect(res.body.agreed).toBe(1)
    expect(res.body.declined).toBe(0)
    expect(res.body.not_answered).toBe(res.body.total - 1)
  })

  it('names the worker who declined, and the version they decided against', async () => {
    const f = await fixture('summary-declined')
    await decide(f.carerToken, 'declined')
    const res = await request(app).get('/homecare/location-decisions').set('Authorization', `Bearer ${f.managerToken}`)
    const declined = res.body.workers.find((w: any) => w.decision === 'declined')
    expect(declined).toBeDefined()
    expect(declined.name).toBeTruthy()
    expect(declined.notice_version).toBe('1.1')
    // A decision, and nothing about anyone's position.
    expect(Object.keys(declined)).not.toContain('latitude')
  })

  it('does not let a care worker read the whole provider\'s answers', async () => {
    const f = await fixture('summary-role')
    await decide(f.carerToken, 'declined')
    const res = await request(app).get('/homecare/location-decisions').set('Authorization', `Bearer ${f.carerToken}`)
    expect(res.status).toBe(403)
  })

  it('records the direction of the decision in the audit trail', async () => {
    // "She declined last Tuesday and agreed on Wednesday" is a sequence a
    // provider may have to explain, and the current row alone cannot show it.
    const f = await fixture('audit-trail')
    await decide(f.carerToken, 'declined')
    await decide(f.carerToken, 'agreed')
    const rows = await migrateQuery(
      `SELECT action FROM audit_logs
       WHERE entity_type = 'staff_location_decision'
         AND entity_id = (SELECT id FROM staff_location_decisions WHERE user_id = $1)
       ORDER BY created_at`,
      [await userIdFor(f)],
    )
    expect(rows.rows.map(r => r.action)).toEqual(['decline', 'agree'])
  })
})

/** The user id behind the fixture's carer, for assertions against their own row. */
async function userIdFor(f: Fixture): Promise<string> {
  const r = await migrateQuery(
    `SELECT u.id FROM users u JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE u.email LIKE 'dec-carer-%@test.com' AND u.organization_id = $1
     ORDER BY u.created_at DESC LIMIT 1`,
    [f.orgId],
  )
  return r.rows[0].id
}
