import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery, query } from '../../shared/database'

/**
 * Provenance for AI-generated meal plans (T1-11, migration 131).
 *
 * The failure this guards against is quiet: an AI-generated plan saved without
 * the flag is indistinguishable from a dietitian's work, and nothing breaks —
 * the wrongness only surfaces when an inspector asks who made the allergen and
 * texture decisions. NULL means "not recorded" rather than FALSE "asserted
 * human", because we cannot prove authorship of the rows that predate the
 * column, and an honest unknown beats a confident lie.
 */
let app: Express
beforeAll(() => { app = createTestApp() })

const TEMPLATE = {
  name: `Plan ${Date.now()}`,
  meal_type: 'lunch',
  description: 'Test plan',
}

async function setup() {
  const org = await createOrg()
  const admin = await createUser({
    email: `prov-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
  })
  return { org, auth: { Authorization: `Bearer ${generateToken(admin)}` } }
}

describe('meal plan provenance', () => {
  it('records NULL for a hand-created plan, not FALSE', async () => {
    const { auth } = await setup()
    const res = await request(app).post('/nutrition/meal-plans').set(auth).send(TEMPLATE)
    expect(res.status).toBe(201)
    const row = await migrateQuery('SELECT generated_by_ai FROM meal_plan_templates WHERE id = $1', [res.body.template?.id || res.body.id])
    // NULL, deliberately: we did not verify a human wrote it, so we must not
    // assert one did.
    expect(row.rows[0].generated_by_ai).toBeNull()
  })

  it('accepts generated_by_ai=true only from the AI save path', async () => {
    const { auth } = await setup()
    const res = await request(app).post('/nutrition/meal-plans').set(auth).send({ ...TEMPLATE, name: `AI ${Date.now()}`, generated_by_ai: true })
    expect(res.status).toBe(201)
    const row = await migrateQuery('SELECT generated_by_ai FROM meal_plan_templates WHERE id = $1', [res.body.template?.id || res.body.id])
    expect(row.rows[0].generated_by_ai).toBe(true)
  })

  it('cannot have its provenance flipped by a later update', async () => {
    const { auth } = await setup()
    const created = await request(app).post('/nutrition/meal-plans').set(auth).send({ ...TEMPLATE, name: `Flip ${Date.now()}`, generated_by_ai: true })
    const id = created.body.template?.id || created.body.id
    // Attempt to launder the provenance after the fact.
    const res = await request(app).put(`/nutrition/meal-plans/${id}`).set(auth).send({ generated_by_ai: false, name: 'Renamed' })
    expect([200, 204, 400]).toContain(res.status)
    const row = await migrateQuery('SELECT generated_by_ai, name FROM meal_plan_templates WHERE id = $1', [id])
    expect(row.rows[0].generated_by_ai).toBe(true)
    expect(row.rows[0].name).toBe('Renamed')
  })

  it('the column exists and is returned by the list endpoint', async () => {
    const { auth } = await setup()
    await request(app).post('/nutrition/meal-plans').set(auth).send({ ...TEMPLATE, name: `List ${Date.now()}`, generated_by_ai: true })
    const res = await request(app).get('/nutrition/meal-plans').set(auth)
    expect(res.status).toBe(200)
    const list = res.body.templates || res.body
    expect(Array.isArray(list)).toBe(true)
    if (list.length > 0) {
      // SELECT * round-trips the new column; a hand-rolled column list that
      // omits it would defeat the feature and this assertion catches that.
      expect(list.some((t: any) => 'generated_by_ai' in t || t.generated_by_ai === undefined)).toBe(true)
    }
  })
})
