import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('DBS — checks CRUD via mock provider', () => {
  it('should create, list, get, submit and update status of a DBS check', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dbs-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const worker = await createUser({ email: `dbs2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id })
    const token = generateToken(admin)

    const created = await request(app)
      .post('/dbs/checks')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id, level: 'enhanced', workforce: 'adult', costPence: 5000, notes: 'Initial check' })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('draft')
    expect(created.body.staff_id).toBe(staff.id)

    const list = await request(app)
      .get('/dbs/checks')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((c: any) => c.id === created.body.id)).toBe(true)

    const got = await request(app)
      .get(`/dbs/checks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.id).toBe(created.body.id)

    const submitted = await request(app)
      .post(`/dbs/checks/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
    expect(submitted.status).toBe(200)
    expect(submitted.body.status).toBe('submitted')

    const updated = await request(app)
      .patch(`/dbs/checks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'clear', certificateNumber: 'CERT-TEST' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('clear')

    const stats = await request(app)
      .get('/dbs/checks/stats')
      .set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)
    expect(stats.body.total).toBeGreaterThanOrEqual(1)
  })

  it('should reject a CARE_WORKER listing checks (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `dbs3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/dbs/checks')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/dbs/checks')
    expect(res.status).toBe(401)
  })
})
