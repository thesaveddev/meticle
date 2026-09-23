import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import pool from '../../shared/database'

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

  it('counts domiciliary MRR only for an accepted, active Stripe contract at the active amount', async () => {
    const org = await createOrg({
      primary_service_type: 'domiciliary',
      service_types: ['domiciliary'],
      subscription_status: 'trial',
    })
    const superAdmin = await createUser({ email: `sa-dom-mrr-${Date.now()}@test.com`, role: 'SUPER_ADMIN' })
    const token = generateToken(superAdmin)
    const getMrr = async () => {
      const response = await request(app).get('/platform-admin/stats').set('Authorization', `Bearer ${token}`)
      expect(response.status).toBe(200)
      return Number(response.body.mrr)
    }

    const baseline = await getMrr()
    await pool.query(
      `UPDATE organizations SET subscription_status = 'active', domiciliary_monthly_price_pence = 27500,
       domiciliary_active_monthly_price_pence = 25000, domiciliary_stripe_subscription_id = 'sub_dom_mrr_test',
       domiciliary_quote_accepted_at = NULL WHERE id = $1`,
      [org.id],
    )
    expect(await getMrr()).toBeCloseTo(baseline, 2)

    await pool.query('UPDATE organizations SET domiciliary_quote_accepted_at = NOW() WHERE id = $1', [org.id])
    expect(await getMrr()).toBeCloseTo(baseline + 250, 2)
  }, 30_000)

  it('sets a sales-led domiciliary quote and blocks repricing while the contract is active', async () => {
    const org = await createOrg({
      primary_service_type: 'domiciliary',
      service_types: ['domiciliary'],
      subscription_status: 'trial',
    })
    const superAdmin = await createUser({ email: `sa-dom-quote-${Date.now()}@test.com`, role: 'SUPER_ADMIN' })
    const token = generateToken(superAdmin)

    const initial = await request(app)
      .put(`/platform-admin/organizations/${org.id}/domiciliary-quote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ monthly_price_pence: 24000, vat_behavior: 'exclusive' })
    expect(initial.status).toBe(200)
    expect(initial.body.domiciliary_monthly_price_pence).toBe(24000)

    await pool.query(
      `UPDATE organizations SET subscription_status = 'active', domiciliary_quote_accepted_at = NOW(),
       domiciliary_stripe_subscription_id = 'sub_active_test', domiciliary_active_monthly_price_pence = 24000
       WHERE id = $1`,
      [org.id],
    )
    const changed = await request(app)
      .put(`/platform-admin/organizations/${org.id}/domiciliary-quote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ monthly_price_pence: 26000, vat_behavior: 'exclusive' })
    expect(changed.status).toBe(409)

    const currentQuote = await pool.query(
      'SELECT domiciliary_monthly_price_pence, domiciliary_quote_accepted_at, domiciliary_active_monthly_price_pence FROM organizations WHERE id = $1',
      [org.id],
    )
    expect(currentQuote.rows[0].domiciliary_monthly_price_pence).toBe(24000)
    expect(currentQuote.rows[0].domiciliary_quote_accepted_at).toBeTruthy()
    expect(currentQuote.rows[0].domiciliary_active_monthly_price_pence).toBe(24000)
  }, 30_000)

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

  it('should allow a SUPER_ADMIN to review and progress a contact enquiry', async () => {
    const superAdmin = await createUser({ email: `sa-leads-${Date.now()}@test.com`, password: 'TestPass123!', role: 'SUPER_ADMIN' })
    const inserted = await pool.query(
      `INSERT INTO contact_submissions (name, email, company, message, privacy_consent) VALUES ('Lead Person', 'lead@example.com', 'Lead Care', 'Please call me', true) RETURNING id`,
    )
    const token = generateToken(superAdmin)
    const list = await request(app).get('/contact/submissions').set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.submissions.some((lead: any) => lead.id === inserted.rows[0].id)).toBe(true)

    const update = await request(app)
      .patch(`/contact/submissions/${inserted.rows[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'qualified', notes: 'Initial qualification completed.' })
    expect(update.status).toBe(200)
    expect(update.body.status).toBe('qualified')
  })

  it('should reject organisation admins from the sales pipeline', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `org-leads-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const res = await request(app).get('/contact/submissions').set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(403)
  })
})
