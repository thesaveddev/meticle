import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, generateToken } from '../../test/factories'

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
