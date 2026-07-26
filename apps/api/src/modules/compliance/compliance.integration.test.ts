import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { query } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)



async function createOrgWithAdmin() {
  const org = await createOrg()
  const user = await createUser({ email: `admin-${Date.now()}@comp-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  const staff = await createStaffProfile({ userId: user.id })
  return { org, user, staff }
}

describe('Compliance Integration — GET /compliance/identity-dashboard', () => {
  it('should return identity dashboard for authenticated user', async () => {
    const { user } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/identity-dashboard')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
  }, 30_000)

  it('should reject without auth', async () => {
    const res = await request(app).get('/compliance/identity-dashboard')
    expect(res.status).toBe(401)
  })
})

describe('Compliance Integration — GET /compliance/documents', () => {
  it('should return document list', async () => {
    const { org, user } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/documents')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(Array.isArray(res.body.data)).toBe(true)
  }, 30_000)

  it('should reject without auth', async () => {
    const res = await request(app).get('/compliance/documents')
    expect(res.status).toBe(401)
  })
})

describe('Compliance Integration — GET /compliance/expiring', () => {
  it('should return expiring documents list', async () => {
    const { org, user } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/expiring')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  }, 30_000)
})

describe('Compliance Integration — GET /compliance/records', () => {
  it('should return compliance records', async () => {
    const { org, user } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/records')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  }, 30_000)
})

describe('Compliance Integration — GET /compliance/trends', () => {
  it('should return trends data', async () => {
    const { org, user, staff } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/trends')
      .set('Authorization', `Bearer ${token}`)
      .query({ staff_id: staff.id })

    expect(res.status).toBe(200)
  }, 30_000)

  it('should reject trends without auth', async () => {
    const res = await request(app).get('/compliance/trends')
    expect(res.status).toBe(401)
  })
})

describe('Compliance Integration — GET /compliance/evidence-mappings', () => {
  it('should return evidence mappings', async () => {
    const { org, user } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/evidence-mappings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  }, 30_000)
})

describe('Compliance Integration — GET /compliance/:staffId', () => {
  it('should return staff compliance record', async () => {
    const { org, user, staff } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get(`/compliance/${staff.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  }, 30_000)

  it('should return 404 for non-existent staff', async () => {
    const { user } = await createOrgWithAdmin()
    const token = generateToken(user)

    const res = await request(app)
      .get('/compliance/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  }, 30_000)
})
