import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import {
  createOrg,
  createUser,
  createStaffProfile,
  createIncident,
  createIncidentCategory,
  generateToken,
} from '../../test/factories';
import { migrateQuery as query } from '../../shared/database';

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

async function setUpWorker() {
  const org = await createOrg();
  const worker = await createUser({
    email: `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
    password: 'TestPass123!',
    role: 'CARE_WORKER',
    organization_id: org.id,
  });
  // The factory sets name/phone; set the remaining personal columns directly so
  // there is something to erase.
  const profile = await createStaffProfile({
    userId: worker.id,
    first_name: 'Rowan',
    last_name: 'Adeyemi',
    phone: '07700 900123',
  });
  await query(
    `UPDATE staff_profiles
        SET birth_date = '1990-04-01',
            address = '12 Care Lane',
            city = 'Leeds',
            country = 'UK',
            postal_code = 'LS1 1AA',
            profile_picture_url = 'https://cdn.example.com/rowan.png'
      WHERE id = $1`,
    [profile.id]
  );
  return { org, worker, profile };
}

async function deactivate(user: any) {
  return request(app)
    .post('/staff/self-deactivate')
    .set('Authorization', `Bearer ${generateToken(user)}`);
}

describe('Account deletion — personal data erasure', () => {
  it('erases contact and identifying data but keeps the professional name', async () => {
    const { worker, profile } = await setUpWorker();

    expect((await deactivate(worker)).status).toBe(200);

    const row = (await query('SELECT * FROM users WHERE id = $1', [worker.id])).rows[0];
    expect(row.status).toBe('deactivated');
    // Undeliverable, and not reversible back to the original address.
    expect(row.email).toBe(`deleted-${worker.id}@deleted.invalid`);
    expect(row.email).not.toContain('@test.com');
    expect(row.email_verified).toBe(false);
    expect(row.force_password_reset).toBe(false);

    const pr = (await query('SELECT * FROM staff_profiles WHERE id = $1', [profile.id])).rows[0];
    for (const col of [
      'birth_date',
      'phone',
      'address',
      'city',
      'country',
      'postal_code',
      'profile_picture_url',
    ]) {
      expect(pr[col], `${col} should be erased`).toBeNull();
    }
    // Attribution survives: a care action must still resolve to a named person.
    expect(pr.first_name).toBe('Rowan');
    expect(pr.last_name).toBe('Adeyemi');
  });

  it('replaces the password hash and drops the MFA secrets', async () => {
    const { worker } = await setUpWorker();
    await query(
      `UPDATE users SET mfa_enabled = TRUE, mfa_secret = 'TOTPSECRET', backup_codes = ARRAY['a','b'] WHERE id = $1`,
      [worker.id]
    );
    const before = (await query('SELECT password_hash FROM users WHERE id = $1', [worker.id])).rows[0].password_hash;

    expect((await deactivate(worker)).status).toBe(200);

    const after = (await query('SELECT * FROM users WHERE id = $1', [worker.id])).rows[0];
    expect(after.password_hash).not.toBe(before);
    expect(after.password_hash.length).toBeGreaterThan(64);
    // Leaving these behind would keep a usable second factor on a closed account.
    expect(after.mfa_secret).toBeNull();
    expect(after.backup_codes).toBeNull();
  });

  it('deletes third-party emergency contacts', async () => {
    const { worker, profile } = await setUpWorker();
    await query(
      `INSERT INTO emergency_contacts (staff_id, name, relationship, phone) VALUES ($1, $2, $3, $4)`,
      [profile.id, 'Sam Relative', 'Partner', '07700 900999']
    );

    expect((await deactivate(worker)).status).toBe(200);

    const left = await query('SELECT * FROM emergency_contacts WHERE staff_id = $1', [profile.id]);
    expect(left.rows).toHaveLength(0);
  });

  it('invalidates outstanding password reset and verification tokens', async () => {
    const { worker } = await setUpWorker();
    await query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES ($1, $2, $3, NOW() + interval '1 hour')`,
      [worker.id, 'reset-token-abc', 'password_reset']
    );

    expect((await deactivate(worker)).status).toBe(200);

    const left = await query('SELECT * FROM verification_tokens WHERE user_id = $1', [worker.id]);
    expect(left.rows).toHaveLength(0);
  });

  it('keeps incidents the worker reported, still attributed to them', async () => {
    const { org, worker } = await setUpWorker();
    const category = await createIncidentCategory({ organizationId: org.id });
    const incident = await createIncident({
      organizationId: org.id,
      reportedBy: worker.id,
      title: 'Unsecured window on the second floor',
      categoryId: category.id,
    });

    expect((await deactivate(worker)).status).toBe(200);

    // The record itself must survive a deletion request — it is a safeguarding
    // record, not the user's account data.
    const still = (await query('SELECT id, reported_by FROM incidents WHERE id = $1', [incident.id])).rows[0];
    expect(still).toBeDefined();
    expect(still.reported_by).toBe(worker.id);

    // And the attribution must still resolve back to a name.
    const who = (await query(
      `SELECT sp.first_name, sp.last_name
         FROM incidents i
         JOIN staff_profiles sp ON sp.user_id = i.reported_by
        WHERE i.id = $1`,
      [incident.id]
    )).rows[0];
    expect(who.first_name).toBe('Rowan');
    expect(who.last_name).toBe('Adeyemi');
  });

  it('blocks the deactivated account from authenticating afterwards', async () => {
    const { worker } = await setUpWorker();

    expect((await deactivate(worker)).status).toBe(200);

    const res = await request(app)
      .get('/staff/me')
      .set('Authorization', `Bearer ${generateToken(worker)}`);
    expect(res.status).toBe(403);
  });
});
