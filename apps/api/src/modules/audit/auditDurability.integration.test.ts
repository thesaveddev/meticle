/**
 * Audit durability at the HTTP boundary.
 *
 * The unit tests in `shared/audit/auditDurability.test.ts` prove the mechanism;
 * these prove it is actually wired into the request path, on the endpoint whose
 * audit row is the whole point of the request (a settings change) and on a
 * deliberately slow write, where a response that overtook the write would be
 * visible as a settled flag that is still false when the client has its answer.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createTestApp } from '../../test/helpers'
import { rlsMiddleware } from '../../shared/middleware/rls.middleware'
import { trackAuditWrite } from '../../shared/audit/auditDurability'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migratePool } from '../../shared/database'
import { Express } from 'express'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** An app with only the request-context middleware, for the timing assertions. */
function boundaryApp() {
  const boundary = express()
  boundary.use(rlsMiddleware)

  boundary.get('/write-then-respond', (_req, res) => {
    const write = new Promise<void>(resolve => {
      setTimeout(() => { (globalThis as any).__auditSettled = true; resolve() }, 60)
    })
    trackAuditWrite(write)
    res.json({ ok: true })
  })

  boundary.get('/write-then-fail', (_req, res) => {
    const write = new Promise<void>(resolve => {
      setTimeout(() => { (globalThis as any).__failedAuditSettled = true; resolve() }, 60)
    })
    trackAuditWrite(write)
    res.status(422).json({ error: 'nope' })
  })

  boundary.get('/no-audit', (_req, res) => res.json({ ok: true }))
  return boundary
}

describe('a response waits for the audit rows it caused', () => {
  it('has settled a slow write before the client is answered', async () => {
    (globalThis as any).__auditSettled = false
    const res = await request(boundaryApp()).get('/write-then-respond')

    expect(res.status).toBe(200)
    // Without the deferral this is false: the write takes 60ms and the response
    // would already be with the client.
    expect((globalThis as any).__auditSettled).toBe(true)
  })

  it('does the same for a failing response, because a refused change is still a change that was attempted', async () => {
    (globalThis as any).__failedAuditSettled = false
    const res = await request(boundaryApp()).get('/write-then-fail')

    expect(res.status).toBe(422)
    expect((globalThis as any).__failedAuditSettled).toBe(true)
  })

  it('leaves a request that writes no audit row alone', async () => {
    const res = await request(boundaryApp()).get('/no-audit')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('the audit row exists on another connection when the response arrives', () => {
  it('is committed for a call site that does not await it', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `auditflush-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })

    // `SettingsController.updateOrgSettings` fires its audit write and does not
    // await it — one of roughly a hundred such call sites. Before the flush this
    // reader could see the change with no record of it.
    const res = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ minimum_compliance_percent: 87 })
    expect(res.status).toBe(200)

    // A connection that shares nothing with the request, which is what every
    // auditor, exporter and second request looks like.
    const fresh = await migratePool.connect()
    try {
      const seen = await fresh.query(
        `SELECT action FROM audit_logs WHERE entity_id = $1 AND action = 'UPDATE_ORG_SETTINGS'`,
        [org.id]
      )
      expect(seen.rowCount).toBe(1)
    } finally {
      fresh.release()
    }
  })
})
