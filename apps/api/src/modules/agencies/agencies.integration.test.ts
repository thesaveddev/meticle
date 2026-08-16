import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Agencies — CRUD, workers, rates', () => {
  it('should create an agency, worker, rate and read analytics', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `ag-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const agency = await request(app)
      .post('/agencies')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nightingale Care', contact_name: 'Jane Smith', contact_phone: '0123456789' })
    expect(agency.status).toBe(201)
    expect(agency.body.name).toBe('Nightingale Care')

    const worker = await request(app)
      .post('/agencies/workers')
      .set('Authorization', `Bearer ${token}`)
      .send({ agency_id: agency.body.id, first_name: 'Alice', last_name: 'Jones', role: 'care_worker' })
    expect(worker.status).toBe(201)

    const rate = await request(app)
      .post('/agencies/rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ agency_id: agency.body.id, shift_type: 'day', rate_per_hour: 18.5 })
    expect(rate.status).toBe(201)

    const list = await request(app)
      .get('/agencies')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((a: any) => a.id === agency.body.id)).toBe(true)

    const workers = await request(app)
      .get(`/agencies/${agency.body.id}/workers`)
      .set('Authorization', `Bearer ${token}`)
    expect(workers.status).toBe(200)
    expect(workers.body.some((w: any) => w.id === worker.body.id)).toBe(true)

    const savings = await request(app)
      .get('/agencies/savings')
      .set('Authorization', `Bearer ${token}`)
    expect(savings.status).toBe(200)

    const updated = await request(app)
      .patch(`/agencies/${agency.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contact_name: 'Jane Doe' })
    expect(updated.status).toBe(200)

    const deleted = await request(app)
      .delete(`/agencies/${agency.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating an agency (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `ag2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/agencies')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ name: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/agencies')
    expect(res.status).toBe(401)
  })
})
