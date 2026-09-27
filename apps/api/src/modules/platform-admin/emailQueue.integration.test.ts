import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import pool from '../../shared/database'

/**
 * `GET /api/platform-admin/email-queue` is the only view of delivery problems
 * that does not require reading server logs, and it had no test coverage at
 * all. Two properties are worth pinning down, because both would quietly break
 * the thing it exists for:
 *
 *  1. It is platform-wide, so it must be reachable only by a SUPER_ADMIN. The
 *     queue holds every organisation's mail, and it deliberately has no RLS
 *     policy (see `setup.ts`) because a background worker writes across orgs —
 *     the app scopes reads with a WHERE clause instead. For this endpoint the
 *     correct scope is "all orgs", which makes the role check the only thing
 *     standing between a tenant and another's delivery failures.
 *
 *  2. `recentFailures` is a `LIMIT 50` with no time filter. That is correct
 *     *only* because it orders by `created_at DESC`: newest failures sit at the
 *     top, so a backlog of old failures can never crowd out a new one. Adding
 *     an `ORDER BY id` or an ascending sort here would silently turn the panel
 *     into a frozen snapshot of history, and the test below is what catches it.
 */
let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

const seeded: string[] = []

async function seedFailure(email: string, subject: string, ageDays: number) {
  return seedFailureWithMessage(email, subject, 'Message failed: 550 mailbox unavailable', ageDays)
}

async function seedFailureWithMessage(email: string, subject: string, errorMessage: string, ageDays = 0) {
  const inserted = await pool.query(
    `INSERT INTO email_queue (to_email, subject, html_body, status, error_message, retry_count, max_retries, created_at)
     VALUES ($1, $2, '<p>x</p>', 'failed', $3, 3, 3, NOW() - ($4 || ' days')::interval)
     RETURNING id`,
    [email, subject, errorMessage, ageDays],
  )
  seeded.push(inserted.rows[0].id)
  return inserted.rows[0].id as string
}

afterAll(async () => {
  if (seeded.length) {
    await pool.query('DELETE FROM email_queue WHERE id = ANY($1::uuid[])', [seeded])
  }
})

describe('GET /platform-admin/email-queue', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await request(app).get('/platform-admin/email-queue')
    expect(res.status).toBe(401)
  })

  it('rejects an authenticated non-SUPER_ADMIN', async () => {
    const org = await createOrg()
    const user = await createUser({
      email: `orgadmin-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      // An org-scoped user is required: with a NULL organization_id the RLS
      // session variable is unset, `authenticate` cannot see the user row, and
      // the request fails 401 "User no longer exists" before `requireRole`
      // ever runs — which would make this test pass for the wrong reason.
      organization_id: org.id,
    })
    const res = await request(app)
      .get('/platform-admin/email-queue')
      .set('Authorization', `Bearer ${generateToken(user)}`)
    expect(res.status).toBe(403)
  })

  it('rejects a non-SUPER_ADMIN on the destructive actions too', async () => {
    const org = await createOrg()
    const user = await createUser({
      email: `orgadmin-purge-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    for (const path of ['/platform-admin/email-queue/retry-failed', '/platform-admin/email-queue/purge-failed']) {
      const res = await request(app).post(path).set('Authorization', `Bearer ${generateToken(user)}`)
      expect(res.status, `${path} must not be reachable by a tenant admin`).toBe(403)
    }
  })

  it('reports counts and surfaces new failures past a large backlog of old ones', async () => {
    const superAdmin = await createUser({ email: `sa-queue-${Date.now()}@test.com`, role: 'SUPER_ADMIN' })
    const token = generateToken(superAdmin)

    // More old failures than the endpoint returns, then some new ones.
    for (let i = 0; i < 55; i++) await seedFailure(`stale-${i}@test.com`, `stale-${i}`, 30)
    const fresh = [await seedFailure('fresh-a@test.com', 'fresh-a', 0), await seedFailure('fresh-b@test.com', 'fresh-b', 0)]

    const res = await request(app)
      .get('/platform-admin/email-queue')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.counts.failed).toBeGreaterThanOrEqual(fresh.length)
    expect(res.body.recentFailures.length).toBeLessThanOrEqual(50)

    const returned: string[] = res.body.recentFailures.map((f: { id: string }) => f.id)
    for (const id of fresh) {
      expect(returned, 'a new failure must not be crowded out by an old backlog').toContain(id)
    }

    // The ordering guarantee, stated directly so the intent survives a refactor.
    const created: string[] = res.body.recentFailures.map((f: { created_at: string }) => f.created_at)
    const sorted = [...created].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    expect(created).toEqual(sorted)
  }, 60_000)
})

describe('the failure breakdown answers "whose problem is this?"', () => {
  it('groups failures by cause and owner rather than returning raw strings', async () => {
    const superAdmin = await createUser({ email: `sa-breakdown-${Date.now()}@test.com`, role: 'SUPER_ADMIN' })
    const token = generateToken(superAdmin)

    // Three causes belonging to three different parties: our own malformed
    // envelope, a dead recipient, and a provider asking us to come back.
    await seedFailureWithMessage('ours@example.com', 'ours', 'EENVELOPE: No recipients defined')
    await seedFailureWithMessage('dead@example.com', 'dead', 'Message failed: 550 5.1.1 <dead@example.com>: Recipient address rejected: User unknown')
    await seedFailureWithMessage('busy@example.com', 'busy', 'Message failed: 421 4.7.0 Too many connections - try again later')

    const res = await request(app)
      .get('/platform-admin/email-queue')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)

    const breakdown = res.body.failureBreakdown as Array<{ cause: string; owner: string; count: number; label: string }>
    expect(Array.isArray(breakdown)).toBe(true)

    const ours = breakdown.find(b => b.cause === 'envelope')
    expect(ours, 'a malformed envelope must be attributed to us').toBeDefined()
    expect(ours!.owner).toBe('code')
    expect(ours!.label.length).toBeGreaterThan(0)

    expect(
      breakdown.find(b => b.cause === 'address')?.owner,
      'a dead recipient is the recipient’s problem',
    ).toBe('recipient')
    expect(
      breakdown.find(b => b.cause === 'remote_temporary')?.owner,
      'a 421 is the provider’s problem',
    ).toBe('provider')

    // The summary must agree with the breakdown rather than being a separate
    // count that can drift from it, and a truncated breakdown must say so.
    const summary = res.body.failureSummary
    expect(summary.analysed).toBe(breakdown.reduce((sum, b) => sum + b.count, 0))
    expect(summary.ours).toBeGreaterThanOrEqual(1)
    expect(summary.total).toBeGreaterThanOrEqual(summary.analysed)
    expect(summary.truncated).toBe(summary.analysed < summary.total)
  }, 60_000)

  it('annotates each recent failure so the UI need not re-implement the rules', async () => {
    const superAdmin = await createUser({ email: `sa-rowclass-${Date.now()}@test.com`, role: 'SUPER_ADMIN' })
    await seedFailureWithMessage('row@example.com', 'row', 'EAUTH: Invalid credentials')
    const res = await request(app)
      .get('/platform-admin/email-queue')
      .set('Authorization', `Bearer ${generateToken(superAdmin)}`)
    const row = (res.body.recentFailures as Array<{ to_email: string; cause?: string; owner?: string }>)
      .find(f => f.to_email === 'row@example.com')
    expect(row, 'the seeded failure should appear in recentFailures').toBeDefined()
    expect(row!.cause).toBe('auth')
    expect(row!.owner).toBe('configuration')
  }, 60_000)
})
