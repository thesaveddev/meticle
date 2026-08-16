import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, createShift, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Shift Audit', () => {
  it('should return the daily audit report for a MANAGER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    await createShift({ locationId: location.id })
    const mgr = await createUser({ email: `sa-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const res = await request(app)
      .get('/shift-audit/daily')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
  })

  it('should trigger audit emails as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `sa2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })

    const res = await request(app)
      .post('/shift-audit/send-emails')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('emailsSent')
  })

  it('should reject CARE_WORKER access to the audit report', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `sa3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const res = await request(app)
      .get('/shift-audit/daily')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/shift-audit/daily')
    expect(res.status).toBe(401)
  })
})
