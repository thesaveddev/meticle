/**
 * Login must spend a password comparison on every failure path.
 *
 * `/auth/login` already returns the same status and the same body for an
 * unknown address, a deactivated account and a wrong password — that closed
 * the *message* oracle. It left the *measurement* one open: bcrypt is
 * deliberately slow, so the paths that never reached a comparison answered in
 * a few milliseconds while a real account spent a full cost-10 hash first.
 *
 * Response time is the harder oracle to defend, because nothing about the code
 * looks wrong. `if (!user) throw` is ordinary, correct, fast code, and a
 * reviewer reads it as an early return rather than as a disclosure. These
 * assert the *mechanism* — a comparison happened — because that is
 * deterministic. A wall-clock assertion lives in `authLoginTimingRatio.test.ts`
 * and is a separate file because `/auth/login` is rate limited per IP and each
 * test file gets its own module-level counter.
 *
 * The deactivation is applied with `migrateQuery`, not `query`: the latter is
 * RLS-scoped and matches no rows, which left the "deactivated account" never
 * deactivated — the login fell through to the normal wrong-password path, and
 * the assertion passed because a real comparison happened, for entirely the
 * wrong reason. Found by deleting the fix and watching this file stay green.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Express } from 'express';
import { createTestApp } from './helpers';
import { createUser, createOrg } from './factories';
import { migrateQuery } from '../shared/database';

let app: Express;

const KNOWN_PASSWORD = 'CorrectHorseBattery1!';

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

afterEach(() => {
  vi.restoreAllMocks();
});

async function register(email: string) {
  const org = await createOrg();
  return createUser({ email, password: KNOWN_PASSWORD, role: 'CARE_WORKER', organization_id: org.id });
}

const login = (email: string, password: string) =>
  request(app).post('/auth/login').send({ email, password });

describe('login spends comparable work on every failure', () => {
  it('compares a password even when no account has the address', async () => {
    const spy = vi.spyOn(bcrypt, 'compare');
    const res = await login(`nobody-${Date.now()}@test.com`, 'any-password');
    expect(res.status).toBe(401);
    expect(spy, 'an unknown address returned before comparing anything').toHaveBeenCalled();
  });

  it('compares a password for a deactivated account', async () => {
    const email = `deactivated-${Date.now()}@test.com`;
    await register(email);

    const updated = await migrateQuery(
      `UPDATE users SET status = 'deactivated' WHERE email = $1 RETURNING status`,
      [email],
    );
    // Assert the row actually changed rather than trusting the write, so this
    // test cannot pass by falling through to the wrong-password path.
    expect(updated.rows, 'the account was never deactivated, so this proves nothing').toHaveLength(1);

    const spy = vi.spyOn(bcrypt, 'compare');
    const res = await login(email, 'any-password');
    expect(res.status).toBe(401);
    expect(spy, 'a deactivated account returned before comparing anything').toHaveBeenCalled();
  });

  it('still compares a password for a wrong password on a real account', async () => {
    const email = `real-${Date.now()}@test.com`;
    await register(email);
    const spy = vi.spyOn(bcrypt, 'compare');
    const res = await login(email, 'definitely-wrong');
    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalled();
  });
});
