import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, createStaffProfile, createShift, createPerson, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Service users (people) — CRUD and sub-resources', () => {
  it('should create, list, get, update and delete a person as MANAGER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const mgr = await createUser({ email: `p-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Grace', last_name: 'Hopper', date_of_birth: '1938-12-09', location_id: location.id })
    expect(created.status).toBe(201)
    expect(created.body.first_name).toBe('Grace')
    expect(created.body.location_id).toBe(location.id)

    const list = await request(app)
      .get('/people')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((p: any) => p.id === created.body.id)).toBe(true)

    const got = await request(app)
      .get(`/people/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.id).toBe(created.body.id)

    const updated = await request(app)
      .patch(`/people/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ room_number: 'B2' })
    expect(updated.status).toBe(200)
    expect(updated.body.room_number).toBe('B2')

    const admin = await createUser({ email: `p2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const deleted = await request(app)
      .delete(`/people/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(deleted.status).toBe(200)
  })

  it('should create sub-resources (care plan, note, risk, family contact, assessment, clinical score, body map, wellbeing, comm log, capacity, pathway, time away)', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const mgr = await createUser({ email: `p3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ email: `p4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(mgr)
    const workerToken = generateToken(worker)

    const person = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Katherine', last_name: 'Johnson', date_of_birth: '1918-08-26', location_id: location.id })
    expect(person.status).toBe(201)
    const pid = person.body.id

    const carePlan = await request(app)
      .post(`/people/${pid}/care-plans`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Personal care plan', category: 'daily living' })
    expect(carePlan.status).toBe(201)

    const note = await request(app)
      .post(`/people/${pid}/daily-notes`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ shift: 'day', category: 'wellbeing', content: 'Had a good day' })
    expect(note.status).toBe(201)

    const risk = await request(app)
      .post(`/people/${pid}/risk-assessments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'falls', risk_level: 'medium' })
    expect(risk.status).toBe(201)

    const contact = await request(app)
      .post(`/people/${pid}/family-contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mary Jackson', relationship: 'daughter', phone: '07700000002' })
    expect(contact.status).toBe(201)

    const assessment = await request(app)
      .post(`/people/${pid}/assessments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assessment_type: 'moving-and-handling', findings: 'Requires hoist' })
    expect(assessment.status).toBe(201)

    const clinical = await request(app)
      .post(`/people/${pid}/clinical-scores`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score_type: 'waterlow', score: 8, risk_level: 'low' })
    expect(clinical.status).toBe(201)

    const bodyMap = await request(app)
      .post(`/people/${pid}/body-map`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body_view: 'front', body_zone: 'left-arm', condition_type: 'bruise', description: 'Small bruise' })
    expect(bodyMap.status).toBe(201)

    const wellbeing = await request(app)
      .post(`/people/${pid}/wellbeing`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorded_date: '2026-08-10', domain: 'mood', score: 8 })
    expect(wellbeing.status).toBe(201)

    const commLog = await request(app)
      .post(`/people/${pid}/communication-log`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contact_method: 'phone', direction: 'outbound', summary: 'Spoke with daughter' })
    expect(commLog.status).toBe(201)

    const capacity = await request(app)
      .post(`/people/${pid}/capacity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision_to_be_made: 'Consent to medication' })
    expect(capacity.status).toBe(201)

    const pathway = await request(app)
      .post(`/people/${pid}/care-pathways`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pathway_type: 'hospital_discharge', title: 'Return from hospital', start_date: '2026-08-01' })
    expect(pathway.status).toBe(201)

    const timeAway = await request(app)
      .post(`/people/${pid}/time-away`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Visit family', time_away_type: 'family_visit' })
    expect(timeAway.status).toBe(201)

    const timeline = await request(app)
      .get(`/people/${pid}/timeline`)
      .set('Authorization', `Bearer ${token}`)
    expect(timeline.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating a person (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `p5-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ first_name: 'Nope', last_name: 'Nope', date_of_birth: '2000-01-01' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/people')
    expect(res.status).toBe(401)
  })
})

/**
 * Blueprint §9.10 — a support worker sees the residents they work with, not the
 * whole provider.
 *
 * These assert the boundary in both directions: what the rota grants, and what it
 * does not. A test that only checked "the worker sees their resident" would pass
 * for an implementation that returned everything, which is the bug this replaced.
 */
describe('Resident read-scoping for support workers (§9.10)', () => {
  /** Two residents at two sites, a rostered worker, and a manager who sees both. */
  async function fixture() {
    const org = await createOrg()
    const mine = await createLocation({ organizationId: org.id })
    const other = await createLocation({ organizationId: org.id })
    const third = await createLocation({ organizationId: org.id })
    const atMine = await createPerson({ organization_id: org.id, location_id: mine.id, first_name: 'Amina', last_name: 'Yusuf', room_number: 'A1' })
    const atOther = await createPerson({ organization_id: org.id, location_id: other.id, first_name: 'Bernard', last_name: 'Okafor', room_number: 'B1' })
    const atThird = await createPerson({ organization_id: org.id, location_id: third.id, first_name: 'Clara', last_name: 'Nwosu', room_number: 'C1' })
    const manager = await createUser({ role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id, locationId: mine.id })
    return { org, mine, other, third, atMine, atOther, atThird, manager, worker, staff }
  }

  const listAs = (token: string) =>
    request(app).get('/people').set('Authorization', `Bearer ${token}`)

  const rostered = (shiftId: string, staffId: string, status = 'assigned') =>
    migrateQuery(
      `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,$3)`,
      [shiftId, staffId, status],
    )

  it('narrows the directory to the locations the worker is rostered at', async () => {
    const f = await fixture()
    const shift = await createShift({ locationId: f.mine.id, status: 'filled' })
    await rostered(shift.id, f.staff.id)

    const res = await listAs(generateToken(f.worker))
    expect(res.status).toBe(200)
    const ids = res.body.map((p: any) => p.id)
    expect(ids).toContain(f.atMine.id)
    expect(ids).not.toContain(f.atOther.id)
    expect(ids).not.toContain(f.atThird.id)
  })

  it('adds a resident named on the worker’s own shift, and still only that one', async () => {
    const f = await fixture()
    // A one-to-one shift: located at the worker's own site, but naming a resident
    // who lives at another one. The 1:1 assignment must grant that resident
    // without dragging in the rest of their location.
    const shift = await createShift({ locationId: f.mine.id, personId: f.atOther.id, status: 'filled' })
    await rostered(shift.id, f.staff.id)

    const res = await listAs(generateToken(f.worker))
    const ids = res.body.map((p: any) => p.id)
    expect(ids).toContain(f.atMine.id)
    expect(ids).toContain(f.atOther.id)
    expect(ids).not.toContain(f.atThird.id)
  })

  it('does not count a shift the worker declined, or one that was cancelled', async () => {
    const f = await fixture()
    const declined = await createShift({ locationId: f.other.id, status: 'filled' })
    await rostered(declined.id, f.staff.id, 'rejected')
    const cancelled = await createShift({ locationId: f.third.id, status: 'cancelled' })
    await rostered(cancelled.id, f.staff.id)

    const res = await listAs(generateToken(f.worker))
    const ids = res.body.map((p: any) => p.id)
    expect(ids).not.toContain(f.atOther.id)
    expect(ids).not.toContain(f.atThird.id)
  })

  it('shows a worker with no rota an empty directory rather than the provider', async () => {
    const f = await fixture()

    const res = await listAs(generateToken(f.worker))
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('leaves the manager with the whole organisation', async () => {
    const f = await fixture()
    const shift = await createShift({ locationId: f.mine.id, status: 'filled' })
    await rostered(shift.id, f.staff.id)

    const res = await listAs(generateToken(f.manager))
    const ids = res.body.map((p: any) => p.id)
    expect(ids).toEqual(expect.arrayContaining([f.atMine.id, f.atOther.id, f.atThird.id]))
  })

  it('applies the same boundary to a single record, without confirming it exists', async () => {
    const f = await fixture()
    const shift = await createShift({ locationId: f.mine.id, status: 'filled' })
    await rostered(shift.id, f.staff.id)
    const token = generateToken(f.worker)

    const visible = await request(app).get(`/people/${f.atMine.id}`).set('Authorization', `Bearer ${token}`)
    expect(visible.status).toBe(200)

    const hidden = await request(app).get(`/people/${f.atOther.id}`).set('Authorization', `Bearer ${token}`)
    expect(hidden.status).toBe(404)
    // A 404, not a 403: the response must not tell the worker that a record is
    // there behind the boundary.
    expect(hidden.body.message ?? hidden.body.error).toMatch(/not found/i)
  })
})
