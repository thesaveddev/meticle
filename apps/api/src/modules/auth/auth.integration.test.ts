import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser } from '../../test/factories'

// Mock rate limiter to no-op for tests
vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)



describe('Auth Integration — POST /auth/register', () => {
  it('should reject missing required fields', async () => {
    const res = await request(app).post('/auth/register').send({ email: `missing-${Date.now()}@test.com` })

    expect(res.status).toBe(400)
  })

  it('should reject weak passwords', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: `weak-${Date.now()}@test.com`, password: 'short', role: 'CARE_WORKER', name: 'Weak' })

    expect(res.status).toBe(400)
  })

  it('should return 400 (not 500) for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken')

    expect(res.status).toBe(400)
    expect(res.body.statusCode).toBe(400)
  })

  it('should register a new CARE_WORKER user', async () => {
    const org = await createOrg()
    const email = `worker-${Date.now()}@test.com`
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'TestPass123!', role: 'CARE_WORKER', name: 'Test Worker', organizationId: org.id })

    expect(res.status).toBe(201)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.email).toBe(email)
    expect(res.body.user.role).toBe('CARE_WORKER')
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  }, 30_000)

  it('should register a new ORG_ADMIN user', async () => {
    const email = `admin-${Date.now()}@test.com`
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'TestPass123!', role: 'ORG_ADMIN', name: `Test Admin ${Date.now()}` })

    expect(res.status).toBe(201)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.email).toBe(email)
    expect(res.body.user.role).toBe('ORG_ADMIN')
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  })

  it('should reject registration with existing email', async () => {
    const org = await createOrg()
    const email = `duplicate-${Date.now()}@test.com`
    await request(app).post('/auth/register').send({ email, password: 'TestPass123!', role: 'CARE_WORKER', name: 'First', organizationId: org.id })
    const res = await request(app).post('/auth/register').send({ email, password: 'TestPass123!', role: 'CARE_WORKER', name: 'Second', organizationId: org.id })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('already exists')
  }, 30_000)
})

describe('Auth Integration — POST /auth/login', () => {
  it('should login with valid credentials', async () => {
    const org = await createOrg()
    const email = `login-test-${Date.now()}@test.com`
    await createUser({ email, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'TestPass123!' })

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
    expect(res.body.user.email).toBe(email)
  }, 30_000)

  it('should reject invalid password', async () => {
    const email = `wrongpass-${Date.now()}@test.com`
    await createUser({ email, password: 'TestPass123!', role: 'CARE_WORKER' })

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WrongPass1!' })

    expect(res.status).toBe(401)
  })

  it('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: `nobody-${Date.now()}@test.com`, password: 'TestPass123!' })

    expect(res.status).toBe(401)
  })
})

describe('Auth Integration — GET /auth/me', () => {
  it('should return current user with valid token', async () => {
    const org = await createOrg()
    const email = `me-test-${Date.now()}@test.com`
    await createUser({ email, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })

    const loginRes = await request(app).post('/auth/login').send({ email, password: 'TestPass123!' })
    const token = loginRes.body.accessToken

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(email)
    expect(res.body.user.role).toBe('ORG_ADMIN')
  }, 30_000)

  it('should reject request without token', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('should reject request with invalid token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer invalid-token')
    expect(res.status).toBe(401)
  })
})

describe('Auth Integration — POST /auth/refresh', () => {
  it('should refresh tokens with valid refresh token', async () => {
    const org = await createOrg()
    const email = `refresh-${Date.now()}@test.com`
    await createUser({ email, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const loginRes = await request(app).post('/auth/login').send({ email, password: 'TestPass123!' })
    const refreshToken = loginRes.body.refreshToken

    const res = await request(app).post('/auth/refresh').send({ refreshToken })

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  }, 30_000)

  it('should reject invalid refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'invalid' })
    expect(res.status).toBe(401)
  })
})
