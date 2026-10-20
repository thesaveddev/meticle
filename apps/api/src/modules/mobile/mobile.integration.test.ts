import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery } from '../../shared/database'
import { createOrg, createUser, createPerson, createLocation, createStaffProfile, createShift, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** Record what a worker has decided about their own location being captured. */
async function recordDecision(orgId: string, userId: string, decision: 'agreed' | 'declined') {
  await migrateQuery(
    `INSERT INTO staff_location_decisions (user_id, organization_id, decision, notice_key, notice_version)
     VALUES ($1, $2, $3, 'staff_location', '1.3')`,
    [userId, orgId, decision],
  )
}

describe('Mobile — check-in, roster, voice notes', () => {
  it('should check in, list check-ins and post a note as CARE_WORKER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const worker = await createUser({ email: `mob-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: worker.id })
    // This worker has agreed, so the coordinates below are actually stored. The
    // cases where they are not are separate tests, because the whole point of
    // the gate is that the three outcomes are distinguishable.
    await recordDecision(org.id, worker.id, 'agreed')
    const token = generateToken(worker)

    const checkIn = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy: 12 })
    expect(checkIn.status).toBe(201)
    expect(checkIn.body.user_id).toBe(worker.id)
    expect(checkIn.body.latitude).toBeCloseTo(51.5074)
    expect(checkIn.body.longitude).toBeCloseTo(-0.1278)
    expect(checkIn.body.location_capture_skipped).toBe(false)
    expect(checkIn.body.location_capture_skip_reason).toBeNull()

    // Agreed, but the device sent no fix: still an error, because the agreement
    // is a permission and a missing permission-to-use is a device problem, not
    // a refusal. Refusing here is right; refusing on a refusal is not.
    const missingLocation = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(missingLocation.status).toBe(400)

    const checkIns = await request(app)
      .get('/mobile/check-ins')
      .set('Authorization', `Bearer ${token}`)
    expect(checkIns.status).toBe(200)
    expect(checkIns.body.some((c: any) => c.id === checkIn.body.id)).toBe(true)

    const note = await request(app)
      .post('/mobile/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, content: 'Has been cheerful today' })
    expect(note.status).toBe(201)
    expect(note.body.content).toBe('Has been cheerful today')

    const noteBadPerson = await request(app)
      .post('/mobile/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: crypto.randomUUID(), content: 'Nope' })
    expect(noteBadPerson.status).toBe(404)
  })

  // These three are the reason the check-in endpoint is gated at all. It used to
  // write a position unconditionally, so a worker who had declined, or an
  // organisation that had switched location off, was still being located through
  // this page — and the position sat in mobile_check_ins with nothing that would
  // ever remove it.
  it('records the check-in without a position when the worker has not agreed', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `mob-undecided-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const res = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy: 12 })

    // 201, not 403: a worker must be able to start a shift whether or not they
    // agreed to be located. What they lose is the position, not the check-in.
    expect(res.status).toBe(201)
    expect(res.body.location_capture_skipped).toBe(true)
    expect(res.body.location_capture_skip_reason).toBe('not_agreed')
    expect(res.body.latitude).toBeNull()
    expect(res.body.longitude).toBeNull()
  })

  it('records the check-in without a position when the worker has declined', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `mob-declined-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    await recordDecision(org.id, worker.id, 'declined')
    const token = generateToken(worker)

    const res = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy: 12 })

    expect(res.status).toBe(201)
    expect(res.body.location_capture_skipped).toBe(true)
    expect(res.body.location_capture_skip_reason).toBe('worker_declined')

    // Assert against the stored row, not just the response: the response is
    // built from the same object that was inserted, so it cannot catch a bug
    // where the INSERT and the response disagree about what was stored.
    const stored = await migrateQuery(
      'SELECT latitude, longitude, location_capture_skip_reason FROM mobile_check_ins WHERE id = $1',
      [res.body.id],
    )
    expect(stored.rows[0].latitude).toBeNull()
    expect(stored.rows[0].longitude).toBeNull()
    expect(stored.rows[0].location_capture_skip_reason).toBe('worker_declined')
  })

  it('records the check-in without a position when the organisation has switched location off', async () => {
    const org = await createOrg()
    await migrateQuery('UPDATE organizations SET location_tracking_enabled = FALSE WHERE id = $1', [org.id])
    const worker = await createUser({ email: `mob-switchoff-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    // Agreed, and still refused. The organisation switch is the outer control:
    // a worker's agreement cannot switch it back on.
    await recordDecision(org.id, worker.id, 'agreed')
    const token = generateToken(worker)

    const res = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy: 12 })

    expect(res.status).toBe(201)
    expect(res.body.location_capture_skipped).toBe(true)
    expect(res.body.location_capture_skip_reason).toBe('organisation_disabled')
    expect(res.body.latitude).toBeNull()
  })

  it('should return the 7-day roster for a staff member', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const worker = await createUser({ email: `mob2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id })
    const shift = await createShift({ locationId: location.id })
    const token = generateToken(worker)

    const res = await request(app)
      .get('/mobile/my-roster')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('lists the carer\'s own shifts with the handover state of each', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id, name: 'Ash Grove' })
    const worker = await createUser({ email: `mob-handover-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id, locationId: location.id })
    const colleague = await createUser({ email: `mob-handover-colleague-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const colleagueStaff = await createStaffProfile({ userId: colleague.id, locationId: location.id })
    const token = generateToken(worker)
    const colleagueToken = generateToken(colleague)

    // A shift that has ended: `/my-roster` cannot see it (it only looks forward),
    // and it is exactly the shift whose handover is due.
    const shift = await createShift({
      locationId: location.id,
      start_time: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
      end_time: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      shift_type: 'day',
      status: 'filled',
    })
    for (const member of [staff, colleagueStaff]) {
      await migrateQuery(
        `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
        [shift.id, member.id],
      )
    }
    // Somebody else's shift, which must not appear in this carer's list.
    const otherShift = await createShift({
      locationId: location.id,
      start_time: new Date(Date.now() - 8 * 60 * 60_000).toISOString(),
      end_time: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      status: 'filled',
    })

    const before = await request(app)
      .get('/mobile/my-shifts')
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)
    const mine = before.body.find((row: any) => row.id === shift.id)
    expect(mine).toMatchObject({
      location_name: 'Ash Grove',
      shift_type: 'day',
      handover_due: true,
      handover: null,
    })
    expect(before.body.some((row: any) => row.id === otherShift.id)).toBe(false)

    // The worker writes the handover, then the colleague's view is the one that has
    // not acknowledged it — the two states the screen renders.
    const written = await request(app)
      .post(`/shifts/${shift.id}/handover`)
      .set('Authorization', `Bearer ${token}`)
      .send({ what_happened: 'Calm shift. Two residents out at day service.', outstanding: 'Review the fluid chart for room 4.' })
    expect(written.status).toBe(201)

    const colleagueView = await request(app)
      .get('/mobile/my-shifts')
      .set('Authorization', `Bearer ${colleagueToken}`)
    const colleagueRow = colleagueView.body.find((row: any) => row.id === shift.id)
    expect(colleagueRow.handover_due).toBe(false)
    expect(colleagueRow.handover).toMatchObject({
      version: 1,
      acknowledgement_count: 0,
      viewer_acknowledged: false,
      viewer_is_author: false,
    })

    const acknowledged = await request(app)
      .post(`/shifts/${shift.id}/handover/acknowledge`)
      .set('Authorization', `Bearer ${colleagueToken}`)
      .send({})
    expect(acknowledged.status).toBe(201)

    const afterAck = await request(app)
      .get('/mobile/my-shifts')
      .set('Authorization', `Bearer ${colleagueToken}`)
    expect(afterAck.body.find((row: any) => row.id === shift.id).handover).toMatchObject({
      acknowledgement_count: 1,
      viewer_acknowledged: true,
    })

    // The author's own view still says they have not acknowledged it, because the
    // server refuses that: the screen must not offer the button.
    const authorView = await request(app)
      .get('/mobile/my-shifts')
      .set('Authorization', `Bearer ${token}`)
    expect(authorView.body.find((row: any) => row.id === shift.id).handover).toMatchObject({
      viewer_is_author: true,
      viewer_acknowledged: false,
    })
  })

  // The schedule list has to say which shift is still open, because the phone is where
  // it is clocked on. These three states are the ones the row renders, and they are
  // read from the same counted rule the attendance endpoint applies — an offset alone
  // would call a worker who stepped out and came back "clocked off".
  it('reports this carer\'s own attendance on each shift in the list', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id, name: 'Ash Grove' })
    const worker = await createUser({ email: `mob-clock-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id, locationId: location.id })
    const token = generateToken(worker)

    const shift = await createShift({
      locationId: location.id,
      start_time: new Date(Date.now() - 60 * 60_000).toISOString(),
      end_time: new Date(Date.now() + 5 * 60 * 60_000).toISOString(),
      shift_type: 'day',
      status: 'filled',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
      [shift.id, staff.id],
    )

    const rowFor = async () => {
      const res = await request(app).get('/mobile/my-shifts').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      return res.body.find((row: any) => row.id === shift.id)
    }

    expect(await rowFor()).toMatchObject({ clocked_on_at: null, clocked_off_at: null, on_duty: false })

    const clockedOn = await request(app)
      .post(`/shifts/${shift.id}/clock-on`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Arrived to a quiet house' })
    expect(clockedOn.status).toBe(201)

    const during = await rowFor()
    expect(during.on_duty).toBe(true)
    expect(during.clocked_on_at).toBeTruthy()
    // Nothing has been clocked off yet, so there is no end to report.
    expect(during.clocked_off_at).toBeNull()

    const clockedOff = await request(app)
      .post(`/shifts/${shift.id}/clock-off`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(clockedOff.status).toBe(201)

    const after = await rowFor()
    expect(after.on_duty).toBe(false)
    // Both ends stay legible: the shift was worked, and the row says so.
    expect(after.clocked_off_at).toBeTruthy()
    expect(new Date(after.clocked_off_at).getTime()).toBeGreaterThanOrEqual(new Date(after.clocked_on_at).getTime())
  })

  it('rejects a malformed window rather than guessing one', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `mob-window-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: worker.id })

    const res = await request(app)
      .get('/mobile/my-shifts?from=last-week')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(400)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/mobile/my-roster')
    expect(res.status).toBe(401)
  })
})
