import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('DSPT — assessment lifecycle', () => {
  it('should create an assessment, update a standard, and submit', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `ds-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const mgr = await createUser({ email: `ds2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(admin)

    const status = await request(app)
      .get('/dspt/status')
      .set('Authorization', `Bearer ${token}`)
    expect(status.status).toBe(200)

    const created = await request(app)
      .post('/dspt/assessments')
      .set('Authorization', `Bearer ${token}`)
    expect(created.status).toBe(201)
    expect(created.body.id).toBeDefined()

    const detail = await request(app)
      .get(`/dspt/assessments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)

    const updated = await request(app)
      .patch(`/dspt/assessments/${created.body.id}/standards/A1`)
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ status: 'met', evidence_notes: 'Policy in place and reviewed' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('met')

    const submitted = await request(app)
      .post(`/dspt/assessments/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
    expect(submitted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating an assessment (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `ds3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/dspt/assessments')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/dspt/status')
    expect(res.status).toBe(401)
  })
})
