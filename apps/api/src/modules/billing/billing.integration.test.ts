import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

// No real Stripe in tests — getStripe() returns null so every path is deterministic.
vi.mock('../../shared/services/stripe.service', () => ({
  getStripe: () => null,
  getOrCreateCustomer: async () => null,
  getOrCreatePrice: async () => null,
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Billing — GET /billing/subscription', () => {
  it('returns subscription state with hasUnpaidInvoice for an authenticated admin', async () => {
    const org = await createOrg({ subscription_status: 'past_due' })
    const user = await createUser({ email: `billing-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/billing/subscription')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.subscriptionStatus).toBe('past_due')
    expect(res.body.hasUnpaidInvoice).toBe(false)
    expect(res.body.plan).toBe('starter')
  }, 30_000)

  it('rejects without auth', async () => {
    const res = await request(app).get('/billing/subscription')
    expect(res.status).toBe(401)
  })
})

describe('Billing — POST /billing/retry-payment', () => {
  it('returns 400 when Stripe is not configured', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `billing-${Date.now()}-c@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/billing/retry-payment')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Stripe not configured/i)
  }, 30_000)

  it('rejects without auth', async () => {
    const res = await request(app).post('/billing/retry-payment')
    expect(res.status).toBe(401)
  })
})
