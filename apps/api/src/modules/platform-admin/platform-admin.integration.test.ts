import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Platform Admin — SUPER_ADMIN only', () => {
  it('should return platform stats for SUPER_ADMIN', async () => {
    const org = await createOrg()
    const superAdmin = await createUser({ email: `sa-${Date.now()}@test.com`, password: 'TestPass123!', role: 'SUPER_ADMIN' })
    const res = await request(app)
      .get('/platform-admin/stats')
      .set('Authorization', `Bearer ${generateToken(superAdmin)}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.totalOrganizations).toBe('number')
    expect(res.body.subscriptions).toBeDefined()
  })

  it('should list organizations for SUPER_ADMIN', async () => {
    const superAdmin = await createUser({ email: `sa2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'SUPER_ADMIN' })
    const res = await request(app)
      .get('/platform-admin/organizations')
      .set('Authorization', `Bearer ${generateToken(superAdmin)}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.organizations)).toBe(true)
  })

  it('should update an organization status as SUPER_ADMIN', async () => {
    const org = await createOrg()
    const superAdmin = await createUser({ email: `sa3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'SUPER_ADMIN' })
    const res = await request(app)
      .patch(`/platform-admin/organizations/${org.id}/status`)
      .set('Authorization', `Bearer ${generateToken(superAdmin)}`)
      .send({ status: 'suspended' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('suspended')
  })

  it('should reject ORG_ADMIN access to platform-admin', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `sa4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const res = await request(app)
      .get('/platform-admin/stats')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/platform-admin/stats')
    expect(res.status).toBe(401)
  })
})
