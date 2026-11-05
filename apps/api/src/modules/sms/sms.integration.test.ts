import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createLocation, createOrg, createShift, createStaffProfile, createUser, generateToken } from '../../test/factories';
import { migrateQuery, query } from '../../shared/database';
import { setSmsSender, SmsQueue, smsStatusCallbackUrl } from './sms.queue';
import { sendViaTwilio } from './sms.twilio';

/**
 * SMS notifications end to end, short of Twilio itself: per-org config with
 * encrypted secrets, the manual send, the queue's claim-and-send pass, and
 * the signed delivery webhook. The transport is the injectable seam — no
 * test here touches the network, and a fake that resolves is still a fake,
 * so the row's `sent` state means the queue did its half, not that a phone
 * buzzed.
 */

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

afterEach(() => {
  setSmsSender((creds, args) => sendViaTwilio(creds, args));
});

async function adminInOrg() {
  const org = await createOrg();
  const admin = await createUser({
    email: `sms-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  });
  return { org, token: generateToken(admin), admin };
}

function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}

describe('SMS config', () => {
  it('starts disabled and unconfigured, and only an admin can change it', async () => {
    const { org, token } = await adminInOrg();
    const manager = await createUser({
      email: `sms-mgr-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'MANAGER',
      organization_id: org.id,
    });

    const got = await request(app).get('/sms/config').set('Authorization', `Bearer ${token}`);
    expect(got.status).toBe(200);
    expect(got.body.config).toEqual({ enabled: false, fromNumber: null, configured: false });

    const forbidden = await request(app)
      .put('/sms/config')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ enabled: true });
    expect(forbidden.status).toBe(403);

    const badNumber = await request(app)
      .put('/sms/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromNumber: '07700 900123' });
    expect(badNumber.status).toBe(400);
  });

  it('stores secrets encrypted and never returns them', async () => {
    const { org, token } = await adminInOrg();
    const updated = await request(app)
      .put('/sms/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, accountSid: 'ACtest123', authToken: 'auth-secret', fromNumber: '+447700900123' });
    expect(updated.status).toBe(200);
    expect(updated.body.config).toEqual({ enabled: true, fromNumber: '+447700900123', configured: true });
    expect(JSON.stringify(updated.body)).not.toContain('auth-secret');
    expect(JSON.stringify(updated.body)).not.toContain('ACtest123');

    const row = await query(`SELECT sms_config FROM organizations WHERE id = $1`, [org.id]);
    const cfg = row.rows[0].sms_config;
    expect(cfg.account_sid_enc).toBeTruthy();
    expect(cfg.account_sid_enc).not.toContain('ACtest123');
    expect(cfg.auth_token_enc).not.toContain('auth-secret');

    // Audit rows are read through the migration pool like the other suites
    // do: the RLS policy on audit_logs hides them from the app-role query
    // outside a request, so `query` sees nothing here.
    const audit = await migrateQuery(
      `SELECT new_data FROM audit_logs WHERE entity_type = 'organization_sms_config' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [org.id],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].new_data.credentials_changed).toBe(true);
    expect(JSON.stringify(audit.rows[0].new_data)).not.toContain('auth-secret');
  });
});

describe('SMS send and queue', () => {
  it('refuses to queue while SMS is disabled or unconfigured', async () => {
    const { token } = await adminInOrg();
    const res = await request(app)
      .post('/sms/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: '+447700900123', body: 'Cover needed tonight' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not enabled/i);
  });

  it('queues a valid message, dedups an identical one, and sends it on the next pass', async () => {
    const { org, token } = await adminInOrg();
    await request(app).put('/sms/config').set('Authorization', `Bearer ${token}`).send({
      enabled: true, accountSid: 'ACtest123', authToken: 'auth-secret', fromNumber: '+447700900999',
    });

    const bad = await request(app)
      .post('/sms/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: '07700', body: 'hi' });
    expect(bad.status).toBe(400);

    const queued = await request(app)
      .post('/sms/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: '+447700900123', body: 'Cover needed tonight' });
    expect(queued.status).toBe(201);

    const dup = await request(app)
      .post('/sms/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: '+447700900123', body: 'Cover needed tonight' });
    expect(dup.status).toBe(200);
    expect(dup.body.queued).toBe(false);

    const seen: { to: string; body: string }[] = [];
    setSmsSender(async (_creds, args) => {
      seen.push({ to: args.to, body: args.body });
      return { sid: 'SMtest1' };
    });
    const processed = await SmsQueue.processBatch();
    expect(processed).toBeGreaterThanOrEqual(1);
    expect(seen.some((m) => m.to === '+447700900123' && m.body === 'Cover needed tonight')).toBe(true);

    const rows = await query(
      `SELECT status, provider_sid FROM sms_queue WHERE organization_id = $1 AND to_phone = $2 ORDER BY created_at DESC LIMIT 1`,
      [org.id, '+447700900123'],
    );
    expect(rows.rows[0].status).toBe('sent');
    expect(rows.rows[0].provider_sid).toBe('SMtest1');
  });

  it('fails a Twilio rejection permanently but retries a network failure', async () => {
    const { org, token } = await adminInOrg();
    await request(app).put('/sms/config').set('Authorization', `Bearer ${token}`).send({
      enabled: true, accountSid: 'ACtest123', authToken: 'auth-secret', fromNumber: '+447700900999',
    });
    await request(app).post('/sms/send').set('Authorization', `Bearer ${token}`).send({ to: '+447700900124', body: 'rejected please' });
    await request(app).post('/sms/send').set('Authorization', `Bearer ${token}`).send({ to: '+447700900125', body: 'flaky please' });

    const { TwilioError } = await import('./sms.twilio');
    let calls = 0;
    setSmsSender(async (_creds, args) => {
      calls += 1;
      if (args.to === '+447700900124') throw new TwilioError('Twilio rejected the message (HTTP 400)', 400);
      throw new TwilioError('Twilio request failed: socket hang up', 0);
    });
    await SmsQueue.processBatch();

    const rows = await query(
      `SELECT to_phone, status, retry_count FROM sms_queue WHERE organization_id = $1 AND to_phone IN ('+447700900124', '+447700900125')`,
      [org.id],
    );
    const byPhone = Object.fromEntries(rows.rows.map((r: any) => [r.to_phone, r]));
    expect(byPhone['+447700900124'].status).toBe('failed');
    expect(byPhone['+447700900125'].status).toBe('pending');
    expect(Number(byPhone['+447700900125'].retry_count)).toBeGreaterThan(0);
    expect(calls).toBe(2);
  });
});

describe('SMS assignment producer', () => {
  it('texts the assignee when a shift is assigned, and assigns fine without SMS', async () => {
    const { org, token, admin } = await adminInOrg();
    const loc = await createLocation({ organizationId: org.id, name: 'Ash Court' });
    // Two shifts on different days: the second assign must not trip the
    // overlapping-shift conflict check, and reusing one shift would test
    // the repository's reassign rules instead of the SMS producer.
    const shiftA = await createShift({ organizationId: org.id, locationId: loc.id, status: 'open' });
    const shiftB = await createShift({
      organizationId: org.id,
      locationId: loc.id,
      status: 'open',
      startTime: new Date(Date.now() + 3 * 86400000).toISOString(),
      endTime: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
    });
    const staffUser = await createUser({
      email: `sms-assign-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    });
    const staff = await createStaffProfile({ userId: staffUser.id, locationId: loc.id, phone: '+447700900127' });

    // Without SMS configured the assignment still lands and nothing queues.
    const plain = await request(app)
      .post(`/shifts/${shiftA.id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id });
    expect(plain.status).toBe(201);
    const none = await query(`SELECT COUNT(*)::int AS n FROM sms_queue WHERE organization_id = $1`, [org.id]);
    expect(none.rows[0].n).toBe(0);

    await request(app).put('/sms/config').set('Authorization', `Bearer ${token}`).send({
      enabled: true, accountSid: 'ACtest123', authToken: 'auth-secret', fromNumber: '+447700900999',
    });
    const assigned = await request(app)
      .post(`/shifts/${shiftB.id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id });
    expect(assigned.status).toBe(201);

    // The text is queued after the response is sent, so wait for the row
    // rather than racing the fire-and-forget producer.
    let queued: any = null;
    for (let i = 0; i < 50 && !queued; i++) {
      const rows = await query(
        `SELECT to_phone, body, status FROM sms_queue WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [org.id],
      );
      queued = rows.rows[0] || null;
      if (!queued) await new Promise((r) => setTimeout(r, 100));
    }
    expect(queued).toBeTruthy();
    expect(queued.to_phone).toBe('+447700900127');
    expect(queued.status).toBe('pending');
    expect(queued.body).toContain('Ash Court');
    expect(admin.id).toBeTruthy();
  });
});

describe('SMS delivery webhook', () => {
  it('records delivery only for a valid signature, and ignores replays', async () => {
    const { org, token } = await adminInOrg();
    await request(app).put('/sms/config').set('Authorization', `Bearer ${token}`).send({
      enabled: true, accountSid: 'ACtest123', authToken: 'hook-secret', fromNumber: '+447700900999',
    });
    await request(app).post('/sms/send').set('Authorization', `Bearer ${token}`).send({ to: '+447700900126', body: 'webhook please' });
    setSmsSender(async () => ({ sid: 'SMhook1' }));
    await SmsQueue.processBatch();

    const url = smsStatusCallbackUrl(org.id);
    const params = { MessageSid: 'SMhook1', MessageStatus: 'delivered', To: '+447700900126' };
    const sig = twilioSignature('hook-secret', url, params);

    const forged = await request(app).post(`/sms/status?org=${org.id}`).type('form').send(params);
    expect(forged.status).toBe(200);

    const wrongSig = await request(app)
      .post(`/sms/status?org=${org.id}`).type('form').set('X-Twilio-Signature', 'bogus').send(params);
    expect(wrongSig.status).toBe(200);

    const still = await query(`SELECT status FROM sms_queue WHERE provider_sid = 'SMhook1'`);
    expect(still.rows[0].status).toBe('sent');

    const delivered = await request(app)
      .post(`/sms/status?org=${org.id}`).type('form').set('X-Twilio-Signature', sig).send(params);
    expect(delivered.status).toBe(200);
    const after = await query(`SELECT status, delivered_at FROM sms_queue WHERE provider_sid = 'SMhook1'`);
    expect(after.rows[0].status).toBe('delivered');
    expect(after.rows[0].delivered_at).toBeTruthy();

    // Twilio retries webhooks: the replay is acknowledged and changes nothing.
    const replay = await request(app)
      .post(`/sms/status?org=${org.id}`).type('form').set('X-Twilio-Signature', sig).send(params);
    expect(replay.status).toBe(200);
    const again = await query(`SELECT status FROM sms_queue WHERE provider_sid = 'SMhook1'`);
    expect(again.rows[0].status).toBe('delivered');
  });
});
