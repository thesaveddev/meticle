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
  PLAN_PRICE_CONFIG: {
    starter: { amount: 9900, currency: 'gbp', interval: 'month' },
    professional: { amount: 29900, currency: 'gbp', interval: 'month' },
  },
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Billing — GET /billing/subscription', () => {
  it('returns subscription state with hasUnpaidInvoice for an authenticated admin', async () => {
    const org = await createOrg({ subscription_status: 'past_due', service_types: ['supported_living'], primary_service_type: 'supported_living' })
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

  it('returns sales-led domiciliary quote and active-contract amounts to organisation admins', async () => {
    const org = await createOrg({
      service_types: ['domiciliary'],
      primary_service_type: 'domiciliary',
    })
    await (await import('../../shared/database')).default.query(
      `UPDATE organizations
       SET domiciliary_monthly_price_pence = 27500,
           domiciliary_active_monthly_price_pence = 25000,
           domiciliary_price_vat_behavior = 'exclusive',
           domiciliary_quote_accepted_at = NOW(),
           domiciliary_stripe_subscription_id = 'sub_domiciliary_test'
       WHERE id = $1`,
      [org.id],
    )
    const admin = await createUser({ email: `billing-dom-quote-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })

    const res = await request(app).get('/billing/subscription')
      .set('Authorization', `Bearer ${generateToken(admin)}`)

    expect(res.status).toBe(200)
    expect(res.body.plan).toBe('sales_led')
    expect(res.body.domiciliaryMonthlyPricePence).toBe(27500)
    expect(res.body.domiciliaryActiveMonthlyPricePence).toBe(25000)
    expect(res.body.domiciliaryStripeSubscriptionId).toBe('sub_domiciliary_test')
  }, 30_000)

  it('rejects without auth', async () => {
    const res = await request(app).get('/billing/subscription')
    expect(res.status).toBe(401)
  })

  it('allows a non-admin to see subscription status but not financial records or payment methods', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `billing-read-worker-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const subscription = await request(app).get('/billing/subscription').set('Authorization', `Bearer ${token}`)
    const invoices = await request(app).get('/billing/invoices').set('Authorization', `Bearer ${token}`)
    const paymentMethods = await request(app).get('/billing/payment-methods').set('Authorization', `Bearer ${token}`)

    expect(subscription.status).toBe(200)
    expect(invoices.status).toBe(403)
    expect(paymentMethods.status).toBe(403)
  }, 30_000)
})

describe('Billing — pricing configuration', () => {
  it('allows a domiciliary admin to update VAT and travel policies without erasing other settings', async () => {
    const org = await createOrg({ service_types: ['domiciliary'] })
    const user = await createUser({ email: `billing-config-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)
    await (await import('../../shared/database')).default.query(
      `UPDATE organizations SET billing_config = $1 WHERE id = $2`,
      [JSON.stringify({ mileage_rates: [{ id: 'keep-me' }], payroll_provider: 'sage', domiciliary: { vat_rate: 20 } }), org.id]
    )

    const update = await request(app)
      .patch('/billing/pricing-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_config: { domiciliary: { vat_inclusive: true, vat_rate: 20, travel_time_paid: false, pay_inter_client_travel: false } } })

    expect(update.status).toBe(200)
    expect(update.body.billing_config.domiciliary).toMatchObject({ vat_inclusive: true, vat_rate: 20, travel_time_paid: false, pay_inter_client_travel: false })
    expect(update.body.billing_config.mileage_rates).toEqual([{ id: 'keep-me' }])
    expect(update.body.billing_config.payroll_provider).toBe('sage')

    const read = await request(app)
      .get('/billing/pricing-config')
      .set('Authorization', `Bearer ${token}`)
    expect(read.status).toBe(200)
    expect(read.body.domiciliary.travel_time_paid).toBe(false)
  }, 30_000)

  it('blocks supported-living organisations from domiciliary billing configuration', async () => {
    const org = await createOrg({ service_types: ['supported_living'] })
    const admin = await createUser({ email: `billing-sl-admin-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const read = await request(app).get('/billing/pricing-config').set('Authorization', `Bearer ${token}`)
    const write = await request(app).patch('/billing/pricing-config').set('Authorization', `Bearer ${token}`)
      .send({ billing_config: { domiciliary: { travel_time_paid: false } } })

    expect(read.status).toBe(403)
    expect(write.status).toBe(403)
  }, 30_000)

  it('does not allow supported-living admins to accept a domiciliary contract quote', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const admin = await createUser({ email: `billing-sl-quote-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })

    const res = await request(app).post('/billing/domiciliary/accept-quote')
      .set('Authorization', `Bearer ${generateToken(admin)}`)

    expect(res.status).toBe(403)
  }, 30_000)

  it('keeps domiciliary subscription changes sales-led at the API boundary', async () => {
    const org = await createOrg({ service_types: ['domiciliary'] })
    const admin = await createUser({ email: `billing-dom-admin-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app).patch('/billing/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'starter' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/sales-led/i)
  }, 30_000)

  it('rejects malformed pricing configuration and non-admin writes', async () => {
    const org = await createOrg({ service_types: ['domiciliary'] })
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
