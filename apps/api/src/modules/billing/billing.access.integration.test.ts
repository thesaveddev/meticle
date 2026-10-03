import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import pool, { migrateQuery } from '../../shared/database'

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

/**
 * Grant (or, with a past date, withhold) the time-boxed review access added by
 * migration 140.
 *
 * This has to go through `migrateQuery`, not the application pool. Migration
 * 140 installs a BEFORE UPDATE trigger that refuses to let a member of
 * `meticle_app` change these two columns, so writing the grant as the app role
 * now fails — which is the point of the migration, and is asserted separately
 * in `review-access-column-guard.integration.test.ts`.
 */
async function setReviewAccess(orgId: string, expiresAt: string | null) {
  await migrateQuery(
    `UPDATE organizations SET review_access_expires_at = $1, review_access_reason = $2 WHERE id = $3`,
    [expiresAt, expiresAt ? 'test grant' : null, orgId],
  )
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

// Migration 140. The grant exists so the Google Play reviewer can reach the
// product, and the tests below are the only thing standing between a
// convenience for one synthetic tenant and a way to disable billing for a
// paying customer.
describe('Time-boxed review access', () => {
  const expiredTrial = {
    trialEndsAt: new Date(Date.now() - 3600000).toISOString(),
    periodEnd: new Date(Date.now() - 3600000).toISOString(),
  }

  it('leaves an ordinary organisation with an expired trial blocked', async () => {
    // The default case. No grant was ever written, so this must behave exactly
    // as it did before migration 140 existed.
    const { token } = await authenticatedUser('trial', expiredTrial)
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.redirect).toBe('/billing')
  })

  it('lifts the gate for a granted organisation, including write routes', async () => {
    // Read-only would not be enough: a reviewer has to be able to exercise the
    // write paths to review them.
    const { org, token } = await authenticatedUser('trial', expiredTrial)
    await setReviewAccess(org.id, new Date(Date.now() + 86400000).toISOString())

    const read = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(read.status).not.toBe(403)

    // POST /tasks is the same route the grace-period tests above use, where it
    // is blocked with BILLING_RESTRICTED. It must not be blocked here.
    const write = await request(app).post('/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Reviewed by Play' })
    expect(write.status).not.toBe(403)
    expect(write.body?.code).not.toBe('BILLING_RESTRICTED')
  })

  it('does not leak the grant to another organisation', async () => {
    // The grant is per organisation, not a global switch. A second tenant with
    // the same expired trial and no grant must stay locked out while the first
    // one is open.
    const granted = await authenticatedUser('trial', expiredTrial)
    await setReviewAccess(granted.org.id, new Date(Date.now() + 86400000).toISOString())
    const other = await authenticatedUser('trial', expiredTrial)

    const open = await request(app).get('/dashboard').set('Authorization', `Bearer ${granted.token}`)
    expect(open.status).not.toBe(403)

    const locked = await request(app).get('/dashboard').set('Authorization', `Bearer ${other.token}`)
    expect(locked.status).toBe(403)
    expect(locked.body.redirect).toBe('/billing')
  })

  it('re-blocks the route once the grant has expired', async () => {
    // The box closing is the property that makes this safe. Without this test
    // a grant could be written once and then silently work forever.
    const { org, token } = await authenticatedUser('trial', expiredTrial)
    await setReviewAccess(org.id, new Date(Date.now() - 1000).toISOString())
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.redirect).toBe('/billing')
  })
})
