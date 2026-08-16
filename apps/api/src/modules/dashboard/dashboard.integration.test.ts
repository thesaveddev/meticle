import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Dashboard — stats endpoints', () => {
  it('should return stats, compliance, today-rota, widgets and review-scheduler for an ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dash-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const paths = ['/dashboard/stats', '/dashboard/compliance', '/dashboard/today-rota', '/dashboard/widgets', '/dashboard/review-scheduler']
    for (const path of paths) {
      const res = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    }
  })

  it('should return 200 for a CARE_WORKER (auth only)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `dash2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(200)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/dashboard/stats')
    expect(res.status).toBe(401)
  })
})
