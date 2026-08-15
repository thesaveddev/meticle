import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'

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
