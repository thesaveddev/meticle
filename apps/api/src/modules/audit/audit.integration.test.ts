import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Audit — GET /audit/logs', () => {
  it('should list audit logs filtered by entity for an ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `audit-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const incident = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Audit trail test incident', severity: 'low' })
    expect(incident.status).toBe(201)

    const res = await request(app)
      .get(`/audit/logs?entity_type=incident&entity_id=${incident.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0].entity_type).toBe('incident')
  })

  it('should reject CARE_WORKER access to audit logs', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `auditw-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const res = await request(app)
      .get('/audit/logs')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/audit/logs')
    expect(res.status).toBe(401)
  })
})
