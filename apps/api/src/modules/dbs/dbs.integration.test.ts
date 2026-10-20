/**
 * Phase 0 of `docs/DBS_INTEGRATION_PLAN.md`, asserted where it matters: the API.
 *
 * The defect this file now guards against survived its own test suite, because
 * the suite asserted the mock. It submitted a check, got `submitted` back, moved
 * it to `clear`, and passed — which is exactly what a provider does *not* get to
 * do without a vetting partner. Every case below runs with configuration
 * cleared first, so the suite's default state is the state production ships in.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { setDbsProvider, type DbsProvider } from './dbs.service'
import { DbsStatus } from './dbs.types'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/**
 * Nothing configured is the state under test by default.
 *
 * `setDbsProvider` is reset as well as the variable, so a test that injects a
 * stub cannot leave it armed for the next one.
 */
beforeEach(() => {
  setDbsProvider(null)
  delete process.env.DBS_PROVIDER
})
afterEach(() => {
  setDbsProvider(null)
  delete process.env.DBS_PROVIDER
})

/** A stub a test can count calls on, standing in for a partner adapter. */
function stubProvider(overrides: Partial<DbsProvider> = {}): DbsProvider & { submitCalls: number } {
  const stub = {
    submitCalls: 0,
    async submitCheck() {
      stub.submitCalls++
      return { provider_reference: 'STUB-REF-1', application_reference: 'STUB-APP-1' }
    },
    async getStatus() {
      return { status: DbsStatus.CLEAR, certificate_number: 'STUB-CERT-1' }
    },
    async cancelCheck() {},
    ...overrides,
  }
  return stub as DbsProvider & { submitCalls: number }
}

async function staffIn() {
  const org = await createOrg()
  const admin = await createUser({
    email: `dbs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
  })
  const worker = await createUser({
    email: `dbs-staff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
  })
  return { org, token: generateToken(admin), staff: await createStaffProfile({ user_id: worker.id }) }
}

async function draftCheck(token: string, staffId: string) {
  const res = await request(app)
    .post('/dbs/checks')
    .set('Authorization', `Bearer ${token}`)
    .send({ staffId, level: 'enhanced', workforce: 'adult', costPence: 5000, notes: 'Initial check' })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body
}

/**
 * A check already at the provider.
 *
 * Written directly, because the only honest way to reach `submitted` is through
 * a provider — and the point of this suite is that there is not one.
 */
async function submittedCheck(token: string, staffId: string) {
  const check = await draftCheck(token, staffId)
  await migrateQuery(
    `UPDATE dbs_checks SET status = 'submitted', submitted_at = NOW(), provider_reference = 'TEST-REF-1' WHERE id = $1`,
    [check.id],
  )
  return check
}

/** Counted over the superuser connection, so RLS cannot hide a row. */
async function dbsDocumentCount(staffId: string): Promise<number> {
  const res = await migrateQuery(`SELECT COUNT(*)::int AS n FROM documents WHERE staff_id = $1 AND type = 'DBS'`, [staffId])
  return res.rows[0].n
}

describe('DBS — with nothing configured, which is how it ships', () => {
  it('refuses to submit, and says what is missing', async () => {
    const { token, staff } = await staffIn()
    const check = await draftCheck(token, staff.id)

    const res = await request(app)
      .post(`/dbs/checks/${check.id}/submit`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/no vetting partner configured/)
    // The refusal has to route the provider somewhere, not just deny.
    expect(res.body.message).toMatch(/record the certificate metadata/)

    // And the check is untouched: a refusal must not look like progress.
    const got = await request(app).get(`/dbs/checks/${check.id}`).set('Authorization', `Bearer ${token}`)
    expect(got.body.status).toBe('draft')
    expect(got.body.provider_reference).toBeNull()
    expect(got.body.submitted_at).toBeNull()
  })

  it('refuses to poll rather than inventing a result', async () => {
    const { token, staff } = await staffIn()
    const check = await submittedCheck(token, staff.id)

    const res = await request(app)
      .post(`/dbs/checks/${check.id}/poll`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/no vetting partner configured/)

    const got = await request(app).get(`/dbs/checks/${check.id}`).set('Authorization', `Bearer ${token}`)
    expect(got.body.status).toBe('submitted')
    expect(got.body.certificate_number).toBeNull()
    expect(got.body.completed_at).toBeNull()
  })

  it('is not re-armed by an injected provider alone', async () => {
    // The guard reads configuration, not the module variable. Otherwise any
    // future `setDbsProvider(mock)` call re-opens submission — which is exactly
    // how a mock became the production provider in the first place.
    const stub = stubProvider()
    setDbsProvider(stub)
    const { token, staff } = await staffIn()
    const check = await draftCheck(token, staff.id)

    const res = await request(app)
      .post(`/dbs/checks/${check.id}/submit`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/no vetting partner configured/)
    // Not merely refused after the fact: the provider was never called.
    expect(stub.submitCalls).toBe(0)
  })

  it('refuses when the configuration names a partner whose adapter is not built', async () => {
    process.env.DBS_PROVIDER = 'carecheck'
    const { token, staff } = await staffIn()
    const check = await draftCheck(token, staff.id)

    const res = await request(app)
      .post(`/dbs/checks/${check.id}/submit`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/carecheck/)
    expect(res.body.message).toMatch(/no adapter for it is built yet/)
  })

  it('does not synthesise an approved document from a typed-in clear result', async () => {
    // The second half of the defect: a `clear` result minted a DBS document with
    // `status = 'approved'` and a three-year expiry, which is what made an
    // unverified result indistinguishable from a certificate a manager had read.
    const { token, staff } = await staffIn()
    const check = await submittedCheck(token, staff.id)

    const updated = await request(app)
      .patch(`/dbs/checks/${check.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'clear', certificateNumber: 'CERT-TEST' })

    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('clear')
    expect(await dbsDocumentCount(staff.id)).toBe(0)
  })
})

describe('DBS — with a configured partner, the submission contract still works', () => {
  beforeEach(() => {
    process.env.DBS_PROVIDER = 'stub-partner'
    setDbsProvider(stubProvider())
  })

  it('creates, lists, gets, submits and reports stats', async () => {
    const { token, staff } = await staffIn()

    const created = await draftCheck(token, staff.id)
    expect(created.status).toBe('draft')
    expect(created.staff_id).toBe(staff.id)

    const list = await request(app).get('/dbs/checks').set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((c: any) => c.id === created.id)).toBe(true)

    const got = await request(app).get(`/dbs/checks/${created.id}`).set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.id).toBe(created.id)

    const submitted = await request(app)
      .post(`/dbs/checks/${created.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)
    expect(submitted.body.status).toBe('submitted')
    expect(submitted.body.provider_reference).toBe('STUB-REF-1')

    const stats = await request(app).get('/dbs/checks/stats').set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)
    expect(stats.body.total).toBeGreaterThanOrEqual(1)
  })

  it('records a provider result without minting a document for it', async () => {
    const { token, staff } = await staffIn()
    const check = await draftCheck(token, staff.id)
    await request(app).post(`/dbs/checks/${check.id}/submit`).set('Authorization', `Bearer ${token}`)

    const polled = await request(app)
      .post(`/dbs/checks/${check.id}/poll`)
      .set('Authorization', `Bearer ${token}`)

    expect(polled.status, JSON.stringify(polled.body)).toBe(200)
    expect(polled.body.status).toBe('clear')
    expect(polled.body.certificate_number).toBe('STUB-CERT-1')
    // The result is a fact about a check. Evidence is a document somebody
    // uploaded, and this path is not allowed to manufacture one.
    expect(await dbsDocumentCount(staff.id)).toBe(0)
  })
})

describe('DBS — access control', () => {
  it('rejects a CARE_WORKER listing checks (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({
      email: `dbs-cw-${Date.now()}@test.com`,
      password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
    })

    const res = await request(app)
      .get('/dbs/checks')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('rejects without auth (401)', async () => {
    const res = await request(app).get('/dbs/checks')
    expect(res.status).toBe(401)
  })
})
