/**
 * An address with no account must not be measurably faster to reject than one
 * that has a real account with a wrong password.
 *
 * The mechanism is asserted deterministically in `authLoginTiming.test.ts` —
 * a `bcrypt.compare` spy proving a comparison happened on every failure path.
 * This file checks the property that actually matters, end to end: the response
 * times overlap.
 *
 * It is a separate file for a mundane reason. `/auth/login` carries
 * `rateLimit(10, 15 * 60 * 1000)`, and in tests `REDIS_URL` is empty so the
 * limiter falls back to a module-level in-memory map. Vitest gives each test
 * file a fresh module registry, so keeping the two apart gives each a full
 * budget instead of sharing ten requests.
 *
 * Two measurement traps, both hit while writing this:
 *
 *  - The per-email lockout allows five failed attempts. Exceed it and the real
 *    account answers 429 without ever reaching bcrypt, so it measures *faster*
 *    than the unknown path and the ratio inverts. Every sample therefore uses a
 *    freshly registered account, and each sample asserts a 401 so a lockout or
 *    a rate limit fails loudly instead of quietly producing a meaningless
 *    number.
 *  - The first request through a route pays lazy module initialisation. Both
 *    paths are warmed once on throwaway addresses before anything is measured.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from './helpers';
import { createUser, createOrg } from './factories';

let app: Express;

const KNOWN_PASSWORD = 'CorrectHorseBattery1!';
/** Three samples is enough for a median; a fourth would crowd the rate limit. */
const SAMPLES = 3;
/** Comfortably under `rateLimit(10, ...)` for this file. */
const MAX_REQUESTS = 10;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

async function register(email: string) {
  const org = await createOrg();
  return createUser({ email, password: KNOWN_PASSWORD, role: 'CARE_WORKER', organization_id: org.id });
}

describe('login response time does not separate unknown addresses from real ones', () => {
  it('rejects an unknown address about as slowly as a real account with a wrong password', async () => {
    const requests = 2 /* warm-up */ + SAMPLES * 2;
    expect(requests, 'this file would exceed the per-IP rate limit on /auth/login').toBeLessThanOrEqual(MAX_REQUESTS);

    const timed = async (email: string) => {
      const started = process.hrtime.bigint();
      const res = await request(app).post('/auth/login').send({ email, password: 'wrong-password' });
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      // A 429 here would mean a lockout or the rate limiter, either of which
      // short-circuits before bcrypt and makes the sample worthless.
      expect(res.status, `expected 401, got ${res.status} — the sample never reached a password comparison`).toBe(401);
      return ms;
    };
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

    // Warm both paths on throwaway addresses: an unknown one, and a real one
    // that is registered first so it actually reaches bcrypt.
    const warmReal = `warm-real-${Date.now()}@test.com`;
    await register(warmReal);
    await timed(`warm-unknown-${Date.now()}@test.com`);
    await timed(warmReal);

    // A fresh account per sample, so the five-attempt per-email lockout can
    // never engage and the per-path cost stays identical for every sample.
    const unknown: number[] = [];
    const real: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const unknownEmail = `absent-${Date.now()}-${i}@test.com`;
      const realEmail = `timing-${Date.now()}-${i}@test.com`;
      await register(realEmail);
      unknown.push(await timed(unknownEmail));
      real.push(await timed(realEmail));
    }

    const unknownMs = median(unknown);
    const realMs = median(real);
    const ratio = unknownMs / realMs;

    // Loose on purpose: an omitted bcrypt comparison puts this near 0.02, so
    // even a 0.5 threshold has enormous headroom over the failure it guards,
    // and a loaded CI box cannot push a correctly-fixed build below it.
    expect(
      ratio,
      `unknown ${unknownMs.toFixed(1)}ms vs real ${realMs.toFixed(1)}ms (ratio ${ratio.toFixed(2)}) — ` +
        'an address with no account is measurably faster, which is an enumeration oracle',
    ).toBeGreaterThanOrEqual(0.5);
  }, 60_000);
});
