import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Insights — manager/admin analytics', () => {
  it('should return overview, staffing, compliance, leave, rota and care outcomes for a MANAGER', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `ins-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const paths = ['/insights/overview', '/insights/staffing', '/insights/compliance', '/insights/leave', '/insights/rota', '/insights/care-outcomes']
    for (const path of paths) {
      const res = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    }
  })

  it('should reject a CARE_WORKER (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `ins2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/insights/overview')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/insights/overview')
    expect(res.status).toBe(401)
  })
})
