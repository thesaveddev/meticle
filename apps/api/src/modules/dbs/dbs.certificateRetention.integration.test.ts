/**
 * Phase 0 items 4–5 of `docs/DBS_INTEGRATION_PLAN.md`, asserted where it matters:
 * the record and the clock on it.
 *
 * Two properties are being bought here, and neither is visible from a green
 * build:
 *
 *   1. **What may be held is a closed set.** A check may carry a certificate
 *      reference, its issue date, the recruitment decision and its date, a
 *      renewal marker and a note — and a test asserts the endpoint's accepted
 *      fields are exactly that list, so adding a place to keep a copy or an image
 *      of a certificate fails here rather than passing review. The source scan
 *      (`dbs.certificateRetention.guard.test.ts`) covers the other doors.
 *   2. **It is held for six months and then it is gone.** Not "a purge exists":
 *      that the reference, the issue date and the note are empty afterwards, that
 *      the *fact of the check* — level, workforce, status, the decision taken —
 *      very much is not, and that a second run changes nothing.
 *
 * Dates are asserted against fixed days where a fixed day can be asserted, so the
 * suite does not fail at 00:30 on the day it runs. Where the expectation really
 * does depend on today (a clock that starts now), the assertion is a range or a
 * shape rather than an instant.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../test/helpers';
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories';
import { migrateQuery } from '../../shared/database';
import { runScheduledDbsCertificatePurges } from './dbs.certificateRetention';

let app: Express;

beforeAll(async () => {
  app = createTestApp();
}, 30_000);

async function orgWithAdmin() {
  const org = await createOrg();
  const admin = await createUser({
    email: `dbs-ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
  });
  const worker = await createUser({
    email: `dbs-ret-staff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
  });
  return { org, token: generateToken(admin), staff: await createStaffProfile({ user_id: worker.id }) };
}

async function draftCheck(token: string, staffId: string) {
  const res = await request(app)
    .post('/dbs/checks')
    .set('Authorization', `Bearer ${token}`)
    .send({ staffId, level: 'enhanced', workforce: 'adult' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

/** Record certificate metadata, asserting it was accepted. */
async function record(token: string, checkId: string, body: Record<string, unknown>) {
  const res = await request(app)
    .patch(`/dbs/checks/${checkId}/certificate`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

async function get(token: string, checkId: string) {
  const res = await request(app).get(`/dbs/checks/${checkId}`).set('Authorization', `Bearer ${token}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

async function purge(token: string) {
  const res = await request(app).post('/dbs/certificates/purge').set('Authorization', `Bearer ${token}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

/**
 * A day `months` back, on the 15th so calendar arithmetic cannot clamp.
 *
 * The retention deadlines asserted below are exact days, but which day they are
 * must not depend on when the suite runs — a decision 5 months ago is always a
 * real decision inside its window, which a hard-coded date stops being the day it
 * turns six months old. The 15th avoids the month-end clamping that `31 January +
 * six months` gets differently in JavaScript and in Postgres.
 */
function decisionMonthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  d.setUTCDate(15);
  return d.toISOString().slice(0, 10);
}

/** The same calendar arithmetic the database does: `date + interval '6 months'`. */
function plusMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/** Today as the API will see it. UTC is never ahead of a UK provider's day. */
const utcToday = () => new Date().toISOString().slice(0, 10);

/**
 * Move a check's deadline into the past.
 *
 * The alternative is a suite that takes five months to run, and the row state is
 * indistinguishable: this is the same check after the clock has moved. It is also
 * the only way to reach "due", because the API refuses to *write* a deadline that
 * has already passed.
 */
async function ageDeadline(checkId: string) {
  await migrateQuery(`UPDATE dbs_checks SET purge_after = NOW() - INTERVAL '1 hour' WHERE id = $1`, [checkId]);
}

describe('DBS certificate metadata — what may be held', () => {
  it('records the permitted set and dates the clock from the decision', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    const decidedOn = decisionMonthsAgo(2);

    const updated = await record(token, check.id, {
      certificateNumber: 'CERT-123',
      certificateIssuedOn: decidedOn,
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: decidedOn,
      renewalDueOn: plusMonths(decidedOn, 36),
      notes: 'Seen in person',
    });

    expect(updated.certificate_number).toBe('CERT-123');
    expect(updated.disclosure_date).toBe(decidedOn);
    expect(updated.recruitment_decision).toBe('proceed');
    expect(updated.recruitment_decision_on).toBe(decidedOn);
    expect(updated.renewal_due_on).toBe(plusMonths(decidedOn, 36));
    expect(updated.notes).toBe('Seen in person');

    // Six months from the recruitment decision, to the day.
    expect(updated.purge_after_on).toBe(plusMonths(decidedOn, 6));
    expect(updated.certificate_purged_on).toBeNull();
    // Two months of the window already spent, so four remain.
    expect(updated.days_until_purge).toBeGreaterThan(100);
    expect(updated.days_until_purge).toBeLessThan(130);
  });

  it('refuses information whose retention date has already passed, naming the dates', async () => {
    // The rule is a ceiling, so there is nothing to extend: a decision from more
    // than six months ago means this information should already be gone. Refusing
    // is the only answer that neither keeps it nor silently rewrites the deadline.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    const oldDecision = decisionMonthsAgo(9);

    const res = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ certificateNumber: 'CERT-TOO-OLD', recruitmentDecision: 'proceed', recruitmentDecisionOn: oldDecision });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(oldDecision);
    expect(res.body.message).toContain(plusMonths(oldDecision, 6));
    // The number comes from the same constant the deadline is computed from, so
    // the refusal and the rule cannot disagree.
    expect(res.body.message).toMatch(/longer than 6 months/);

    // Nothing was written, so the refusal cannot be mistaken for a stale write.
    const after = await get(token, check.id);
    expect(after.certificate_number).toBeNull();
    expect(after.recruitment_decision).toBeNull();
    expect(after.purge_after_on).toBeNull();
  });

  it('starts the clock today when a reference is recorded before any decision', async () => {
    // "Only for the purpose obtained, and normally no longer than six months"
    // cuts both ways: a provider that has typed in a certificate reference and not
    // yet decided whether to hire must not be able to hold it indefinitely by
    // never recording a decision.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);

    const updated = await record(token, check.id, { certificateNumber: 'CERT-NO-DECISION' });

    expect(updated.purge_after_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // A shade under six calendar months (181–184 days depending on the months) and
    // never more than six of them.
    expect(updated.days_until_purge).toBeGreaterThan(170);
    expect(updated.days_until_purge).toBeLessThanOrEqual(184);
  });

  it('re-dates the clock when the decision is recorded afterwards', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await record(token, check.id, { certificateNumber: 'CERT-RE-DATE' });

    const decidedOn = decisionMonthsAgo(3);
    const decided = await record(token, check.id, {
      recruitmentDecision: 'proceed_with_conditions',
      recruitmentDecisionOn: decidedOn,
    });

    expect(decided.recruitment_decision).toBe('proceed_with_conditions');
    expect(decided.recruitment_decision_on).toBe(decidedOn);
    // The decision is the earlier of the two dates, and the deadline follows it
    // — the clock moves *back*, which is the point: the outer bound from today
    // was never the real period.
    expect(decided.purge_after_on).toBe(plusMonths(decidedOn, 6));
  });

  it('leaves fields alone that the request does not mention, and clears ones it nulls', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await record(token, check.id, {
      certificateNumber: 'CERT-KEEP',
      certificateIssuedOn: '2026-02-01',
      notes: 'Keep me',
    });

    // A decision only — the reference and issue date are untouched.
    const decided = await record(token, check.id, { recruitmentDecision: 'proceed' });
    expect(decided.certificate_number).toBe('CERT-KEEP');
    expect(decided.disclosure_date).toBe('2026-02-01');
    expect(decided.notes).toBe('Keep me');

    // A mistyped reference has to be correctable, which is the whole reason
    // `null` and "not sent" are different requests.
    const cleared = await record(token, check.id, { certificateNumber: null, notes: null });
    expect(cleared.certificate_number).toBeNull();
    expect(cleared.notes).toBeNull();
    expect(cleared.disclosure_date).toBe('2026-02-01');
  });

  it('refuses a certificate from the future, a decision from the future, and a renewal before the certificate', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);

    const futureCertificate = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ certificateIssuedOn: '2999-01-01' });
    expect(futureCertificate.status).toBe(400);
    expect(futureCertificate.body.message).toMatch(/future/);

    const futureDecision = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recruitmentDecision: 'proceed', recruitmentDecisionOn: '2999-01-01' });
    expect(futureDecision.status).toBe(400);

    const backwardsRenewal = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ certificateIssuedOn: '2026-05-01', renewalDueOn: '2026-01-01' });
    expect(backwardsRenewal.status).toBe(400);
    expect(backwardsRenewal.body.message).toMatch(/before/i);

    // A date with no decision to go with it does not say what happened, so it is
    // refused rather than stored as a date next to a blank.
    const dateless = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recruitmentDecisionOn: '2026-04-01' });
    expect(dateless.status).toBe(400);

    // Nothing above may have been written.
    const unchanged = await get(token, check.id);
    expect(unchanged.certificate_number).toBeNull();
    expect(unchanged.recruitment_decision).toBeNull();
  });
});

describe('DBS certificate retention — what is deleted, and what is kept', () => {
  it('deletes the certificate information and keeps the fact of the check', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    const renewalDueOn = plusMonths(decisionMonthsAgo(2), 36);
    await record(token, check.id, {
      certificateNumber: 'CERT-PURGE-ME',
      certificateIssuedOn: decisionMonthsAgo(2),
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: decisionMonthsAgo(2),
      renewalDueOn,
      notes: 'Seen in person, reference noted',
    });
    // Five months later, in effect: the clock has run out and the sweep is what
    // deletes it.
    await ageDeadline(check.id);

    const run = await purge(token);
    expect(run.rows_purged, JSON.stringify(run)).toBe(1);
    // Three fields, counted before the delete rather than after it — returning the
    // updated row would report zero cleared while plainly having cleared them.
    expect(run.fields_cleared).toBe(3);
    expect(run.trigger).toBe('manual');

    const after = await get(token, check.id);
    expect(after.certificate_number).toBeNull();
    expect(after.disclosure_date).toBeNull();
    expect(after.notes).toBeNull();

    // The stamp is what stops an emptied reference reading as data loss.
    expect(after.certificate_purged_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // And the check itself is intact: a provider asked "was this person checked,
    // and what did you decide?" can still answer.
    expect(after.level).toBe(check.level);
    expect(after.workforce).toBe(check.workforce);
    expect(after.status).toBe('draft');
    expect(after.recruitment_decision).toBe('proceed');
    expect(after.recruitment_decision_on).toBe(decisionMonthsAgo(2));
    expect(after.renewal_due_on).toBe(renewalDueOn);
  });

  it('purges nothing twice', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await record(token, check.id, {
      certificateNumber: 'CERT-ONCE',
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: decisionMonthsAgo(2),
    });
    await ageDeadline(check.id);

    expect((await purge(token)).rows_purged).toBe(1);
    const second = await purge(token);
    expect(second.rows_purged).toBe(0);
    expect(second.fields_cleared).toBe(0);
  });

  it('leaves a check inside its six months alone', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    // No decision date given, so the clock starts today and runs forward.
    const recorded = await record(token, check.id, { certificateNumber: 'CERT-TOO-SOON', recruitmentDecision: 'proceed' });
    expect(recorded.purge_after_on).toBe(plusMonths(utcToday(), 6));
    expect(recorded.days_until_purge).toBeGreaterThan(170);

    const run = await purge(token);
    expect(run.rows_purged).toBe(0);

    const after = await get(token, check.id);
    expect(after.certificate_number).toBe('CERT-TOO-SOON');
    expect(after.certificate_purged_on).toBeNull();
  });

  it('never touches a check that holds no certificate information', async () => {
    // An application in flight has references the next poll depends on and no
    // certificate at all, so the retention rule has nothing to say about it.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await migrateQuery(
      `UPDATE dbs_checks SET status = 'submitted', submitted_at = NOW(),
              provider_reference = 'IN-FLIGHT-REF', application_reference = 'IN-FLIGHT-APP',
              purge_after = NOW() - INTERVAL '30 days'
        WHERE id = $1`,
      [check.id],
    );

    const run = await purge(token);
    expect(run.rows_purged).toBe(0);

    const after = await get(token, check.id);
    expect(after.provider_reference).toBe('IN-FLIGHT-REF');
    expect(after.application_reference).toBe('IN-FLIGHT-APP');
    expect(after.certificate_purged_on).toBeNull();
  });

  it('lets a replacement certificate be recorded after a purge, on a fresh clock', async () => {
    // A new certificate is new information and is entitled to its own window; a
    // purge stamp would otherwise be permanent and quietly exempt the row.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await record(token, check.id, {
      certificateNumber: 'CERT-OLD',
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: decisionMonthsAgo(2),
    });
    await ageDeadline(check.id);
    await purge(token);
    expect((await get(token, check.id)).certificate_purged_on).not.toBeNull();

    // A certificate obtained on a re-check is a new decision about a current
    // certificate, and the window runs from that decision — which is the way the
    // refusal above points a manager to.
    const replaced = await record(token, check.id, {
      certificateNumber: 'CERT-NEW',
      certificateIssuedOn: utcToday(),
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: utcToday(),
    });
    expect(replaced.certificate_number).toBe('CERT-NEW');
    expect(replaced.certificate_purged_on).toBeNull();
    expect(replaced.days_until_purge).toBeGreaterThan(170);
    expect(replaced.days_until_purge).toBeLessThanOrEqual(184);
  });

  it('keeps the record of a deletion when a save holds no certificate information', async () => {
    // Correcting a renewal date on a record whose certificate detail has already
    // been deleted must not erase the evidence that it *was* deleted — an emptied
    // reference that stops explaining itself reads as missing data.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await record(token, check.id, {
      certificateNumber: 'CERT-GONE',
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: decisionMonthsAgo(2),
    });
    await ageDeadline(check.id);
    await purge(token);
    const deleted = (await get(token, check.id)).certificate_purged_on;
    expect(deleted).not.toBeNull();

    const afterRenewal = await record(token, check.id, { renewalDueOn: plusMonths(utcToday(), 36) });

    expect(afterRenewal.certificate_purged_on).toBe(deleted);
    expect(afterRenewal.renewal_due_on).toBe(plusMonths(utcToday(), 36));
    expect(afterRenewal.certificate_number).toBeNull();
  });

  it('starts the clock on the operator-recorded completion path too', async () => {
    // The typed-in status route is a data-entry path for a result a manager holds
    // (phase 2 will relabel it). Whatever it is called, it can put a certificate
    // reference on a check, and information with no retention date is information
    // held indefinitely — so the clock has to start there as well.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);

    const typed = await request(app)
      .patch(`/dbs/checks/${check.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'clear', certificateNumber: 'CERT-TYPED' });
    expect(typed.status, JSON.stringify(typed.body)).toBe(200);

    const after = await get(token, check.id);
    expect(after.certificate_number).toBe('CERT-TYPED');
    expect(after.purge_after_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(after.days_until_purge).toBeGreaterThan(170);
    expect(after.days_until_purge).toBeLessThanOrEqual(184);
  });

  it('deletes only one provider’s certificate information', async () => {
    const a = await orgWithAdmin();
    const b = await orgWithAdmin();
    const checkA = await draftCheck(a.token, a.staff.id);
    const checkB = await draftCheck(b.token, b.staff.id);

    for (const [ctx, check] of [[a, checkA], [b, checkB]] as const) {
      await record(ctx.token, check.id, {
        certificateNumber: 'CERT-ORG-SCOPED',
        recruitmentDecision: 'proceed',
        recruitmentDecisionOn: decisionMonthsAgo(2),
      });
      await ageDeadline(check.id);
    }

    const run = await purge(a.token);
    expect(run.rows_purged).toBe(1);
    expect((await get(a.token, checkA.id)).certificate_number).toBeNull();
    // The other tenant's row is untouched — and this is the assertion that would
    // fail if the purge were ever rewritten without its organisation filter.
    expect((await get(b.token, checkB.id)).certificate_number).toBe('CERT-ORG-SCOPED');
  });

  it('sweeps every organisation that has something due, and says so', async () => {
    const a = await orgWithAdmin();
    const b = await orgWithAdmin();
    const due = [await draftCheck(a.token, a.staff.id), await draftCheck(b.token, b.staff.id)];
    for (const [ctx, check] of [[a, due[0]], [b, due[1]]] as const) {
      await record(ctx.token, check.id, {
        certificateNumber: 'CERT-SWEPT',
        recruitmentDecision: 'proceed',
        recruitmentDecisionOn: decisionMonthsAgo(2),
      });
      await ageDeadline(check.id);
    }

    const summary = await runScheduledDbsCertificatePurges();
    expect(summary.purged).toBeGreaterThanOrEqual(2);
    expect(summary.failed).toBe(0);
    expect((await get(a.token, due[0].id)).certificate_number).toBeNull();
    expect((await get(b.token, due[1].id)).certificate_number).toBeNull();
  });
});

describe('DBS retention — the screen-read signals', () => {
  it('reports the retention period, what is held, and what a purge has removed', async () => {
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    await record(token, check.id, {
      certificateNumber: 'CERT-STATS',
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: decisionMonthsAgo(2),
    });
    await ageDeadline(check.id);

    const before = await request(app).get('/dbs/checks/stats').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.certificate_retention_months).toBe(6);
    expect(before.body.certificate_details_held).toBe(1);
    expect(before.body.certificate_details_purged).toBe(0);
    // Past its deadline and still holding: the alarm the sweep is meant to clear.
    expect(before.body.certificate_purge_due).toBe(1);

    await purge(token);

    const after = await request(app).get('/dbs/checks/stats').set('Authorization', `Bearer ${token}`);
    expect(after.body.certificate_details_held).toBe(0);
    expect(after.body.certificate_details_purged).toBe(1);
    expect(after.body.certificate_purge_due).toBe(0);
  });

  it('says submission is closed, in the words the refusal uses', async () => {
    // The compliance screen renders this message rather than carrying its own
    // copy, so the sentence the screen shows and the sentence a refused Submit
    // returns cannot drift apart.
    const { token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);

    const stats = await request(app).get('/dbs/checks/stats').set('Authorization', `Bearer ${token}`);
    expect(stats.body.submission.available).toBe(false);
    expect(stats.body.submission.message).toMatch(/does not submit checks yet/);
    expect(stats.body.submission.message).toMatch(/record the certificate metadata/);

    const refused = await request(app).post(`/dbs/checks/${check.id}/submit`).set('Authorization', `Bearer ${token}`);
    expect(refused.status).toBe(503);
    expect(refused.body.message).toBe(stats.body.submission.message);
  });
});

describe('DBS certificate metadata — access control', () => {
  it('refuses a CARE_WORKER the metadata and the purge', async () => {
    const { org, token, staff } = await orgWithAdmin();
    const check = await draftCheck(token, staff.id);
    const worker = await createUser({
      email: `dbs-ret-cw-${Date.now()}@test.com`,
      password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
    });
    const workerToken = generateToken(worker);

    const metadata = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ certificateNumber: 'NOPE' });
    expect(metadata.status).toBe(403);

    const manual = await request(app).post('/dbs/certificates/purge').set('Authorization', `Bearer ${workerToken}`);
    expect(manual.status).toBe(403);

    // A manager may do both: recording what was on a certificate is the manager's
    // routine work, not an administrative act.
    const manager = await createUser({
      email: `dbs-ret-mgr-${Date.now()}@test.com`,
      password: 'TestPass123!', role: 'MANAGER', organization_id: org.id,
    });
    const managerToken = generateToken(manager);
    const asManager = await request(app)
      .patch(`/dbs/checks/${check.id}/certificate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ certificateNumber: 'MANAGER-RECORDED' });
    expect(asManager.status).toBe(200);
  });

  it('rejects an unauthenticated purge (401)', async () => {
    const res = await request(app).post('/dbs/certificates/purge');
    expect(res.status).toBe(401);
  });
});
