import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function registerOrgAdmin() {
  const email = `orgadmin-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.com`
  const res = await request(app).post('/auth/register').send({ email, password: 'TestPass123!', role: 'ORG_ADMIN', name: `Org Admin ${Date.now()}` })
  expect(res.status).toBe(201)
  return { token: res.body.accessToken, orgId: res.body.user.organization_id }
}

describe('Organizations — onboarding dismiss persistence', () => {
  it('persists onboarding_dismissed_at via PATCH and returns it on GET', async () => {
    const { token, orgId } = await registerOrgAdmin()
    const dismissedAt = new Date().toISOString()

    const patchRes = await request(app)
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onboarding_dismissed_at: dismissedAt })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.onboarding_dismissed_at).toBe(dismissedAt)

    const getRes = await request(app)
      .get(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.onboarding_dismissed_at).toBe(dismissedAt)
  }, 30_000)

  it('rejects completing onboarding without a primary service type', async () => {
    const { token, orgId } = await registerOrgAdmin()

    const response = await request(app)
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onboarding_completed: true })

    expect(response.status).toBe(400)
  }, 30_000)

  it('rejects a primary service type that is not selected', async () => {
    const { token, orgId } = await registerOrgAdmin()

    const response = await request(app)
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_types: ['domiciliary'], primary_service_type: 'supported_living' })

    expect(response.status).toBe(400)
  }, 30_000)

  it('allows completing onboarding with a valid service configuration', async () => {
    const { token, orgId } = await registerOrgAdmin()

    const response = await request(app)
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Production Care Organisation ${Date.now()}`, service_types: ['domiciliary'], primary_service_type: 'domiciliary', onboarding_step: 3, onboarding_completed: true })

    expect(response.status).toBe(200)
    expect(response.body.service_types).toEqual(['domiciliary'])
    expect(response.body.primary_service_type).toBe('domiciliary')
    expect(response.body.onboarding_completed).toBe(true)
  }, 30_000)

  it('lets a manager update operational fields like default rates', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `orgmgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const res = await request(app)
      .patch(`/organizations/${org.id}`)
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ default_hourly_rate_pence: 1800, default_mileage_rate_pence: 45, auto_approve_documents: true })

    expect(res.status).toBe(200)
    expect(Number(res.body.default_hourly_rate_pence)).toBe(1800)
    expect(Number(res.body.default_mileage_rate_pence)).toBe(45)
  }, 30_000)

  it('rejects a manager changing identity or commercial fields', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `orgmgr2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const res = await request(app)
      .patch(`/organizations/${org.id}`)
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ plan: 'enterprise', status: 'suspended' })

    expect(res.status).toBe(403)
  }, 30_000)

  it('allows clearing onboarding_dismissed_at back to null', async () => {
    const { token, orgId } = await registerOrgAdmin()
    const dismissedAt = new Date().toISOString()

    await request(app)
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onboarding_dismissed_at: dismissedAt })

    const clearRes = await request(app)
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onboarding_dismissed_at: null })

    expect(clearRes.status).toBe(200)
    expect(clearRes.body.onboarding_dismissed_at).toBeNull()
  }, 30_000)
})
