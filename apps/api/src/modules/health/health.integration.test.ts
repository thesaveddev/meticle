import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Health — observations, bowel, fluid', () => {
  it('should create, list, update and delete an observation as CARE_WORKER/MANAGER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const worker = await createUser({ email: `hth-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const mgr = await createUser({ email: `hth2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const workerToken = generateToken(worker)
    const mgrToken = generateToken(mgr)

    const listEmpty = await request(app)
      .get(`/health/${person.id}/observations`)
      .set('Authorization', `Bearer ${workerToken}`)
    expect(listEmpty.status).toBe(200)
    expect(listEmpty.body).toEqual([])

    const created = await request(app)
      .post(`/health/${person.id}/observations`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ observation_date: '2026-08-01', category: 'sleep', severity: 'mild', notes: 'Anxious in the morning' })
    expect(created.status).toBe(201)
    expect(created.body.person_id).toBe(person.id)

    const updated = await request(app)
      .patch(`/health/${person.id}/observations/${created.body.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ severity: 'moderate' })
    expect(updated.status).toBe(200)
    expect(updated.body.severity).toBe('moderate')

    const deleted = await request(app)
      .delete(`/health/${person.id}/observations/${created.body.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER updating an observation (403)', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `hth3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .patch(`/health/${person.id}/observations/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ severity: 'severe' })
    expect(res.status).toBe(403)
  })

  it('should create a bowel movement and a fluid intake entry', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `hth4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const bowel = await request(app)
      .post(`/health/${person.id}/bowel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorded_date: '2026-08-02', bristol_type: 4, notes: 'Normal' })
    expect(bowel.status).toBe(201)
    expect(bowel.body.person_id).toBe(person.id)

    const fluid = await request(app)
      .post(`/health/${person.id}/fluid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorded_date: '2026-08-02', amount_ml: 250, fluid_type: 'water' })
    expect(fluid.status).toBe(201)
    expect(fluid.body.amount_ml).toBe(250)

    const total = await request(app)
      .get(`/health/${person.id}/fluid/total?date=2026-08-02`)
      .set('Authorization', `Bearer ${token}`)
    expect(total.status).toBe(200)
  })

  it('should require a date for the fluid total (400)', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `hth5-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get(`/health/${person.id}/fluid/total`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(400)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/health/00000000-0000-0000-0000-000000000000/observations')
    expect(res.status).toBe(401)
  })
})
