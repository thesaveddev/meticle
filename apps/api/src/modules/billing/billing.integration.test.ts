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

describe('Billing — pricing configuration', () => {
  it('allows an organisation admin to update VAT and domiciliary rates without erasing other settings', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `billing-config-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)
    await (await import('../../shared/database')).default.query(
      `UPDATE organizations SET billing_config = $1 WHERE id = $2`,
      [JSON.stringify({ mileage_rates: [{ id: 'keep-me' }], payroll_provider: 'sage', domiciliary: { per_client_monthly: 600, vat_rate: 20 } }), org.id]
    )

    const update = await request(app)
      .patch('/billing/pricing-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_config: { domiciliary: { per_client_monthly: 750, vat_inclusive: true, vat_rate: 20 } } })

    expect(update.status).toBe(200)
    expect(update.body.billing_config.domiciliary).toMatchObject({ per_client_monthly: 750, vat_inclusive: true, vat_rate: 20 })
    expect(update.body.billing_config.mileage_rates).toEqual([{ id: 'keep-me' }])
    expect(update.body.billing_config.payroll_provider).toBe('sage')

    const read = await request(app)
      .get('/billing/pricing-config')
      .set('Authorization', `Bearer ${token}`)
    expect(read.status).toBe(200)
    expect(read.body.domiciliary.per_client_monthly).toBe(750)
  }, 30_000)

  it('rejects malformed pricing configuration and non-admin writes', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `billing-config-admin-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const worker = await createUser({ email: `billing-config-worker-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })

    const invalid = await request(app)
      .patch('/billing/pricing-config')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ billing_config: { domiciliary: { vat_rate: 101 } } })
    expect(invalid.status).toBe(400)

    const forbidden = await request(app)
      .patch('/billing/pricing-config')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ billing_config: { domiciliary: { vat_rate: 20 } } })
    expect(forbidden.status).toBe(403)
  }, 30_000)
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
