import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { migrateQuery } from '../../shared/database';
import { unsubscribeToken } from '../../shared/utils/emailUnsubscribe';
import { EmailService } from '../../shared/utils/email.service';

/**
 * The unsubscribe contract, end to end.
 *
 * Two things are being pinned. The link works without a session and only for the
 * address it was minted for — a public endpoint that acted on an unsigned token
 * would let anybody stop anybody's mail. And the opt-out is honoured at send time:
 * a link that records a row nothing reads is the failure mode this whole feature
 * exists to prevent, so the assertions go through the real sender and the real
 * queue table rather than a helper.
 */

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

/** The queued mail for one address, newest first. */
async function queuedFor(email: string) {
  const result = await migrateQuery(
    `SELECT subject, html_body, headers FROM email_queue WHERE lower(to_email) = lower($1) ORDER BY created_at DESC`,
    [email],
  );
  return result.rows;
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe('email unsubscribe', () => {
  it('describes a valid link without changing anything', async () => {
    const email = uniqueEmail('describe');
    const token = unsubscribeToken(email, 'notifications')!;

    const res = await request(app).get('/email/unsubscribe').query({ token });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email, scope: 'notifications' });
    expect(res.body.scope_label).toContain('survey');
    // Nothing was recorded by looking.
    const rows = await migrateQuery('SELECT 1 FROM email_opt_outs WHERE lower(email) = $1', [email]);
    expect(rows.rows).toHaveLength(0);
  });

  it('records the opt-out, and records it once however many times it is asked', async () => {
    const email = uniqueEmail('optout');
    const token = unsubscribeToken(email, 'notifications')!;

    const first = await request(app).post('/email/unsubscribe').send({ token });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ unsubscribed: true, scope: 'notifications' });

    const second = await request(app).post('/email/unsubscribe').query({ token }).send({});
    expect(second.status).toBe(200);

    const rows = await migrateQuery(
      'SELECT scope, source FROM email_opt_outs WHERE lower(email) = $1',
      [email],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ scope: 'notifications', source: 'link' });
  });

  it('refuses a token that was tampered with', async () => {
    const email = uniqueEmail('forged');
    const token = unsubscribeToken(email, 'notifications')!;
    const [, , signature] = token.split('.');
    const forged = `notifications.${Buffer.from('someone-else@example.com').toString('base64url')}.${signature}`;

    expect((await request(app).get('/email/unsubscribe').query({ token: forged })).status).toBe(400);
    expect((await request(app).post('/email/unsubscribe').send({ token: forged })).status).toBe(400);

    const rows = await migrateQuery('SELECT 1 FROM email_opt_outs WHERE lower(email) = $1', ['someone-else@example.com']);
    expect(rows.rows).toHaveLength(0);
  });

  it('answers 400, not 500, when there is no token at all', async () => {
    expect((await request(app).get('/email/unsubscribe')).status).toBe(400);
    expect((await request(app).post('/email/unsubscribe').send({})).status).toBe(400);
  });

  it('stops notification email to an address that has opted out, and leaves transactional mail alone', async () => {
    const email = uniqueEmail('suppress');
    await request(app).post('/email/unsubscribe').send({ token: unsubscribeToken(email, 'notifications') });

    await EmailService.sendMissedCallEmail(email, 'Manager', 'Alice', 'Morning call', '08:00');
    // A password reset is not something anybody can opt out of.
    await EmailService.sendPasswordResetEmail(email, 'reset-token');

    const queued = await queuedFor(email);
    expect(queued).toHaveLength(1);
    expect(queued[0].subject).toMatch(/password/i);
  });

  it('keeps the two scopes apart: marketing opt-out still allows operational notices', async () => {
    const email = uniqueEmail('scopes');
    await request(app).post('/email/unsubscribe').send({ token: unsubscribeToken(email, 'marketing') });

    await EmailService.sendMissedCallEmail(email, 'Manager', 'Alice', 'Morning call', '08:00');

    // Unsubscribing from winback mail must not silence the shift reminders someone
    // needs to do their job.
    expect((await queuedFor(email)).some(row => /missed call/i.test(row.subject))).toBe(true);
  });

  it('puts a working link and one-click headers on mail that can be stopped', async () => {
    const email = uniqueEmail('headers');
    await EmailService.sendMissedCallEmail(email, 'Manager', 'Alice', 'Morning call', '08:00');

    const [row] = await queuedFor(email);
    expect(row).toBeTruthy();
    expect(row.html_body).toContain('/unsubscribe?token=');
    expect(row.html_body).toContain('Unsubscribe from');
    expect(row.headers).toMatchObject({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    expect(row.headers['List-Unsubscribe']).toContain('/unsubscribe?token=');
  });

  /**
   * The header URL has to be something that acts when a mail client POSTs to it.
   *
   * This is the failure the feature is one edit away from: point `List-Unsubscribe`
   * at the marketing page and a static host answers the POST with HTML and a 200,
   * the client tells the recipient they are unsubscribed, and the next digest still
   * arrives. So the test reads the address out of the header, posts to it the way an
   * RFC 8058 client does, and checks the queue stays quiet afterwards.
   */
  it('honours the one-click POST a mail client makes to the URL it was given', async () => {
    const email = uniqueEmail('oneclick');
    await EmailService.sendMissedCallEmail(email, 'Manager', 'Alice', 'Morning call', '08:00');

    const [row] = await queuedFor(email);
    const listed = String(row.headers['List-Unsubscribe']);
    const oneClick = listed.match(/<([^>]+unsubscribe[^>]*)>/)?.[1];
    expect(oneClick).toBeTruthy();

    // The URL is the production address; nginx strips `/api` before the router sees
    // it, so the path the test app serves is the same one minus that prefix.
    const parsed = new URL(oneClick!);
    const path = parsed.pathname.replace(/^\/api/, '') + parsed.search;
    const res = await request(app)
      .post(path)
      .type('form')
      .send('List-Unsubscribe=One-Click');

    expect(res.status).toBe(200);
    const recorded = await migrateQuery(
      'SELECT scope, source FROM email_opt_outs WHERE lower(email) = $1',
      [email],
    );
    expect(recorded.rows).toHaveLength(1);
    expect(recorded.rows[0]).toMatchObject({ scope: 'notifications', source: 'one-click' });

    // And the next one of the same kind does not go out.
    await EmailService.sendMissedCallEmail(email, 'Manager', 'Alice', 'Evening call', '20:00');
    expect(await queuedFor(email)).toHaveLength(1);
  });

  it('leaves transactional mail without an unsubscribe link it cannot honour', async () => {
    const email = uniqueEmail('transactional');
    await EmailService.sendPasswordResetEmail(email, 'reset-token');

    const [row] = await queuedFor(email);
    expect(row.html_body).not.toContain('/unsubscribe?token=');
  });

  /**
   * The generic sender is the one every module reaches for, so its scope has to be
   * a caller's decision rather than a default. A recurring alert passes
   * `'notifications'` and can be stopped; a one-off access link passes nothing and
   * promises nothing.
   */
  it('lets a caller decide whether the generic send can be stopped', async () => {
    const email = uniqueEmail('generic');
    await EmailService.sendEmail(email, 'Compliance alert: threshold breached', '<p>Body</p>', 'notifications');
    await EmailService.sendEmail(email, 'Audit access link', '<p>Body</p>');

    const rows = await queuedFor(email);
    const alert = rows.find(row => /threshold breached/i.test(row.subject))!;
    const access = rows.find(row => /audit access/i.test(row.subject))!;
    expect(alert.html_body).toContain('/unsubscribe?token=');
    expect(alert.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(access.html_body).not.toContain('/unsubscribe?token=');
    expect(access.headers).toBeNull();

    // And the opt-out actually stops the recurring one, which is the whole point of
    // offering it: a link that records a row nothing reads is the same as no link.
    await request(app).post('/email/unsubscribe').send({ token: unsubscribeToken(email, 'notifications') });
    await EmailService.sendEmail(email, 'Compliance alert: threshold breached again', '<p>Body</p>', 'notifications');
    await EmailService.sendEmail(email, 'Second audit access link', '<p>Body</p>');

    const after = await queuedFor(email);
    expect(after.some(row => /threshold breached again/i.test(row.subject))).toBe(false);
    expect(after.some(row => /second audit access/i.test(row.subject))).toBe(true);
  });
});
