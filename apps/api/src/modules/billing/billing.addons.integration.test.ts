import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { reconcileAddonsFromItems } from './billing.addons'

// A Stripe-shaped fake: canned subscription list, recording updates, and a
// price that matches the catalogued add-on. `stripeOn` flips the whole
// fake off so the unconfigured-Stripe path is covered in the same file.
const store = vi.hoisted(() => ({
  stripeOn: true,
  subs: [] as any[],
  updated: [] as { id: string; params: any }[],
}))

vi.mock('../../shared/services/stripe.service', () => ({
  getStripe: () =>
    store.stripeOn
      ? {
          subscriptions: {
            list: async () => ({ data: store.subs }),
            update: async (id: string, params: any) => {
              store.updated.push({ id, params })
              return { id, ...params }
            },
          },
          prices: {
            retrieve: async (id: string) => ({
              id,
              active: true,
              currency: 'gbp',
              unit_amount: 4900,
              recurring: { interval: 'month', interval_count: 1 },
            }),
          },
        }
      : null,
  getOrCreateCustomer: async () => 'cus_test123',
  getOrCreatePrice: async () => null,
  getOrCreateAddonPrice: async () => 'price_addon_extra_location',
  isExpectedAddonPrice: () => true,
  PLAN_PRICE_CONFIG: {
    starter: { amount: 9900, currency: 'gbp', interval: 'month' },
    professional: { amount: 29900, currency: 'gbp', interval: 'month' },
  },
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

beforeEach(() => {
  store.stripeOn = true
  store.subs = []
  store.updated = []
})

function planSub(orgId: string) {
  return {
    id: 'sub_plan_1',
    status: 'active',
    metadata: { organizationId: orgId },
    items: { data: [{ id: 'si_plan', price: 'price_starter', metadata: {} }] },
  }
}

async function adminToken(orgId: string) {
  const user = await createUser({
    email: `addon-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: orgId,
  })
  return generateToken(user)
}

describe('Billing — GET /billing/addons', () => {
  it('returns the purchasable catalog and the orgs active add-ons', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)

    const res = await request(app).get('/billing/addons').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.catalog).toHaveLength(1)
    expect(res.body.catalog[0]).toMatchObject({ slug: 'extra_location', amountDisplay: '£49.00 / month' })
    expect(res.body.active).toEqual([])
  }, 30_000)
})

describe('Billing — POST /billing/addons/purchase', () => {
  it('rejects an unknown add-on before touching Stripe', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)

    const res = await request(app)
      .post('/billing/addons/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'private_jet' })

    expect(res.status).toBe(400)
    expect(store.updated).toHaveLength(0)
  }, 30_000)

  it('refuses to sell without an active plan subscription to attach to', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)
    store.subs = []

    const res = await request(app)
      .post('/billing/addons/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'extra_location' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/plan first/)
  }, 30_000)

  it('answers 503 when Stripe is not configured', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)
    store.stripeOn = false

    const res = await request(app)
      .post('/billing/addons/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'extra_location' })

    expect(res.status).toBe(503)
  }, 30_000)

  it('purchases the add-on: billed item, local flag, and audit row', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)
    store.subs = [planSub(org.id)]

    const res = await request(app)
      .post('/billing/addons/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'extra_location' })

    expect(res.status).toBe(200)
    expect(res.body.addons).toEqual(['extra_location'])
    expect(store.updated).toHaveLength(1)
    expect(store.updated[0].id).toBe('sub_plan_1')
    const added = store.updated[0].params.items.find((item: any) => item.price === 'price_addon_extra_location')
    expect(added?.metadata?.addon).toBe('extra_location')

    const { migrateQuery } = await import('../../shared/database')
    const db = await migrateQuery('SELECT addons FROM organizations WHERE id = $1', [org.id])
    expect(db.rows[0].addons).toEqual(['extra_location'])
    const audit = await migrateQuery(
      `SELECT action FROM audit_logs WHERE entity_type = 'organization' AND entity_id = $1 AND action = 'PURCHASE_ADDON'`,
      [org.id],
    )
    expect(audit.rows).toHaveLength(1)
  }, 30_000)

  it('refuses to bill the same add-on twice', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)
    store.subs = [planSub(org.id)]

    await request(app).post('/billing/addons/purchase').set('Authorization', `Bearer ${token}`).send({ addon: 'extra_location' })
    const res = await request(app)
      .post('/billing/addons/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'extra_location' })

    expect(res.status).toBe(409)
    expect(store.updated).toHaveLength(1)
  }, 30_000)
})

describe('Billing — POST /billing/addons/cancel', () => {
  it('answers 404 when the add-on is not active', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)

    const res = await request(app)
      .post('/billing/addons/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'extra_location' })

    expect(res.status).toBe(404)
  }, 30_000)

  it('cancels the add-on: Stripe item removed, flag cleared, audit row', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)
    store.subs = [
      {
        ...planSub(org.id),
        items: {
          data: [
            { id: 'si_plan', price: 'price_starter', metadata: {} },
            { id: 'si_addon', price: 'price_addon_extra_location', metadata: { addon: 'extra_location' } },
          ],
        },
      },
    ]

    await request(app).post('/billing/addons/purchase').set('Authorization', `Bearer ${token}`).send({ addon: 'extra_location' })
    store.updated = []
    const res = await request(app)
      .post('/billing/addons/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ addon: 'extra_location' })

    expect(res.status).toBe(200)
    expect(res.body.addons).toEqual([])
    const removed = store.updated[0].params.items.find((item: any) => item.id === 'si_addon')
    expect(removed?.deleted).toBe(true)

    const { migrateQuery } = await import('../../shared/database')
    const audit = await migrateQuery(
      `SELECT action FROM audit_logs WHERE entity_type = 'organization' AND entity_id = $1 AND action = 'CANCEL_ADDON'`,
      [org.id],
    )
    expect(audit.rows).toHaveLength(1)
  }, 30_000)

  it('no longer serves the free-form add-on writer', async () => {
    const org = await createOrg({ service_types: ['supported_living'], primary_service_type: 'supported_living' })
    const token = await adminToken(org.id)

    const res = await request(app)
      .patch('/billing/addons')
      .set('Authorization', `Bearer ${token}`)
      .send({ addons: ['extra_location'] })

    expect(res.status).toBe(404)
  }, 30_000)
})

describe('reconcileAddonsFromItems', () => {
  it('keeps catalogued add-on slugs and drops everything else', () => {
    expect(
      reconcileAddonsFromItems([
        { metadata: { addon: 'extra_location' } },
        { metadata: {} },
        { metadata: { addon: 'private_jet' } },
        null,
      ]),
    ).toEqual(['extra_location'])
  })

  it('treats a missing item list as no add-ons', () => {
    expect(reconcileAddonsFromItems(null)).toEqual([])
    expect(reconcileAddonsFromItems(undefined)).toEqual([])
  })
})
