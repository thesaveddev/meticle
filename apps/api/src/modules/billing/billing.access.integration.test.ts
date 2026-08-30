import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import pool from '../../shared/database'

vi.mock('../../shared/services/stripe.service', () => ({
  getStripe: () => null,
  getOrCreateCustomer: async () => null,
  getOrCreatePrice: async () => null,
}))

let app: Express
beforeAll(() => { app = createTestApp() })

async function setBillingDates(orgId: string, values: { status: string; trialEndsAt?: string | null; periodEnd?: string | null; graceEndsAt?: string | null }) {
  await pool.query(
    `UPDATE organizations SET subscription_status = $1, trial_ends_at = $2, current_period_end = $3, grace_period_ends_at = $4 WHERE id = $5`,
    [values.status, values.trialEndsAt ?? null, values.periodEnd ?? null, values.graceEndsAt ?? null, orgId]
  )
}

async function authenticatedUser(status: string, options: { periodEnd?: string; graceEndsAt?: string; trialEndsAt?: string } = {}) {
  const org = await createOrg({ subscription_status: status })
  await setBillingDates(org.id, {
    status,
    periodEnd: options.periodEnd,
    graceEndsAt: options.graceEndsAt,
    trialEndsAt: options.trialEndsAt,
  })
  const user = await createUser({ email: `billing-access-${Date.now()}-${Math.random()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
  return { org, token: generateToken(user) }
}

describe('Billing access enforcement', () => {
  it('allows full access before a paid period expires', async () => {
    const { token } = await authenticatedUser('active', { periodEnd: new Date(Date.now() + 86400000).toISOString() })
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).not.toBe(403)
  })

  it('allows approved read-only access during the seven-day grace period', async () => {
    const { token } = await authenticatedUser('active', {
      periodEnd: new Date(Date.now() - 3600000).toISOString(),
      graceEndsAt: new Date(Date.now() + 6 * 86400000).toISOString(),
    })
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).not.toBe(403)
  })

  it('blocks writes during the grace period with a billing-specific response', async () => {
    const { token } = await authenticatedUser('active', {
      periodEnd: new Date(Date.now() - 3600000).toISOString(),
      graceEndsAt: new Date(Date.now() + 6 * 86400000).toISOString(),
    })
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Blocked task' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('BILLING_RESTRICTED')
  })

  it('keeps billing and payment recovery available during grace', async () => {
    const { token } = await authenticatedUser('active', {
      periodEnd: new Date(Date.now() - 3600000).toISOString(),
      graceEndsAt: new Date(Date.now() + 6 * 86400000).toISOString(),
    })
    const billing = await request(app).get('/billing/subscription').set('Authorization', `Bearer ${token}`)
    const retry = await request(app).post('/billing/retry-payment').set('Authorization', `Bearer ${token}`)
    expect(billing.status).toBe(200)
    expect(retry.status).toBe(400)
    expect(retry.body.message).toMatch(/Stripe not configured/i)
  })

  it('blocks normal access after grace ends', async () => {
    const { token } = await authenticatedUser('active', {
      periodEnd: new Date(Date.now() - 8 * 86400000).toISOString(),
      graceEndsAt: new Date(Date.now() - 86400000).toISOString(),
    })
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.redirect).toBe('/billing')
  })

  it('does not grant paid grace to an expired trial', async () => {
    const { token } = await authenticatedUser('trial', {
      trialEndsAt: new Date(Date.now() - 3600000).toISOString(),
      periodEnd: new Date(Date.now() - 3600000).toISOString(),
      graceEndsAt: new Date(Date.now() + 6 * 86400000).toISOString(),
    })
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.redirect).toBe('/billing')
  })
})
