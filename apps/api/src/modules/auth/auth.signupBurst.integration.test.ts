/**
 * A care home is one office on one internet connection.
 *
 * When one activates, 15-30 of their staff register inside the same hour and
 * every one of them shares `req.ip`. The per-IP limit is therefore a
 * per-*organisation* budget in practice, and one sized for "one person" gets
 * consumed by "one customer" — the customer's own staff exhaust it between
 * them, and it reads as our software being broken at the exact moment we are
 * trying to win the account.
 *
 * This file exists to prove that does not happen, against the real rate
 * limiter.
 *
 * Note what this file deliberately does NOT do: mock the rate limiter. The
 * sibling `auth.integration.test.ts` mocks it to a no-op, which is precisely
 * why the original limit of 5 was never caught failing. If that mock is ever
 * copied here, `the limiter is genuinely active` below is what catches it.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'

let app: Express

/** Unique per run so repeat runs against a persistent database do not collide. */
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = 'TestPass123!'

const STAFF = Array.from({ length: 20 }, (_, i) => ({
  email: `burst-${RUN}-${i}@test.com`,
  password: PASSWORD,
  role: 'CARE_WORKER',
  // Registration derives the organisation name from this, so it must differ per
  // run as well as per user.
  name: `Burst Worker ${RUN}-${i}`,
}))

beforeAll(async () => {
  app = createTestApp()

  // Pre-seed mailbox ownership rather than driving the verification endpoints.
  //
  // Two reasons. The verification endpoint has its own per-IP limit, so sending
  // 20 codes from one address would throttle partway through and the test would
  // fail on the wrong limit, measuring the wrong thing. And actually sending 20
  // verification emails to test that 20 *registrations* succeed is noise at
  // best.
  //
  // This is the one and only part of the flow stubbed. The register route, the
  // limiter, validation, the proof-of-ownership check and the database are all
  // real.
  const { migrateQuery } = await import('../../shared/database')
  for (const member of STAFF) {
    await migrateQuery(
      `INSERT INTO email_verification_codes (email, code, expires_at, verified)
       VALUES ($1, '123456', NOW() + INTERVAL '10 minutes', TRUE)`,
      [member.email],
    )
  }
}, 60_000)

describe('a whole care home registering at once', () => {
  it('lets all twenty staff through from a single IP', async () => {
    // Fired together rather than in sequence, so they contend for the same
    // per-IP window in the way a real Monday morning would.
    const responses = await Promise.all(
      STAFF.map((member) =>
        request(app).post('/auth/register').send(member),
      ),
    )

    const rejected = responses
      .map((res, i) => ({ res, member: STAFF[i] }))
      .filter(({ res }) => res.status !== 201)

    expect(
      rejected.map(({ res, member }) => `${member.email} -> ${res.status} ${JSON.stringify(res.body)}`),
      'Every member of staff must be able to register. A 429 here means the per-IP limit is still smaller than a real care home.',
    ).toEqual([])

    // And they are genuinely distinct accounts, not one response reused.
    const emails = new Set(responses.map((r) => r.body.user?.email))
    expect(emails.size).toBe(STAFF.length)
    expect(responses.every((r) => Boolean(r.body.accessToken))).toBe(true)
  }, 60_000)
})

describe('the limiter is genuinely active', () => {
  // Guards the test above from passing for the wrong reason. If the rate
  // limiter were mocked out — as it is in the sibling integration test — the
  // burst test would pass no matter what the limit actually was.
  it('still refuses a caller who exceeds a limit', async () => {
    // `/verify-email` is capped at 5 per minute and is cheap to call, so this
    // exercises a real route's real limiter without writing 30 organisations.
    const responses = await Promise.all(
      Array.from({ length: 7 }, () => request(app).post('/auth/verify-email').send({ token: 'not-a-real-token' })),
    )

    const limited = responses.filter((res) => res.status === 429)
    expect(limited.length, 'Seven calls against a limit of five must include a refusal').toBeGreaterThan(0)

    // A refusal has to tell the caller how long to wait, or the web client has
    // nothing to wait out and shows an error instead.
    const refused = limited[0]
    expect(refused.headers['retry-after']).toBeDefined()
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0)
  }, 30_000)
})
