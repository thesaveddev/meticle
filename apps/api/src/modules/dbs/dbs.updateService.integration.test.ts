/**
 * The DBS Update Service re-check workflow, asserted through the API.
 *
 * Phase 3 of `docs/DBS_INTEGRATION_PLAN.md` is a consent-led workflow, and the
 * two ways it could be wrong are both silent: recording a check for somebody who
 * withdrew their consent, or never telling anybody a check is due. Neither shows
 * up in a unit test of the happy path, so the cases below are mostly the
 * refusals, the record left behind after them, and the sweep.
 *
 * Nothing here is verified by a mock: there is no provider in this workflow at
 * all, which is the point of the feature.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { runUpdateServiceReminders } from './dbs.updateService'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * An England-registered org, an admin who works the workflow, and one member of
 * staff — which is all this workflow needs, because nothing leaves the database.
 */
async function orgWithStaff() {
  const org = await createOrg()
  const admin = await createUser({
    email: `dbs-us-${unique()}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  const worker = await createUser({
    email: `dbs-us-staff-${unique()}@test.com`,
    password: 'TestPass123!',
    role: 'CARE_WORKER',
    organization_id: org.id,
  })
  const staff = await createStaffProfile({ user_id: worker.id })
  return { org, admin, worker, staff, token: generateToken(admin) }
}

/** The subscription body a manager would submit, with today's preconditions. */
function subscribeBody(staffId: string, overrides: Record<string, unknown> = {}) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    staffId,
    level: 'enhanced',
    workforce: 'adult',
    updateServiceId: 'US-1234567890',
    certificateReference: 'CERT-0001',
    certificateIssuedOn: today,
    consentGivenOn: today,
    consentMethod: 'written',
    paperCertificateSeenOn: today,
    identityVerifiedOn: today,
    identityMethod: 'manual_document_check',
    ...overrides,
  }
}

async function subscribe(token: string, staffId: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/dbs/update-service')
    .set('Authorization', `Bearer ${token}`)
    .send(subscribeBody(staffId, overrides))
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body
}

async function recordCheck(token: string, id: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/dbs/update-service/${id}/checks`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      outcome: 'no_change',
      level: 'enhanced',
      workforce: 'adult',
      ...body,
    })
}

/** Notifications for one user, which is how a test avoids other suites' rows. */
async function notificationsFor(userId: string): Promise<any[]> {
  const res = await migrateQuery('SELECT title, link FROM notifications WHERE user_id = $1 ORDER BY created_at ASC', [userId])
  return res.rows.map((r: any) => ({ title: r.title, link: r.link }))
}

async function subscriptionsFor(staffId: string) {
  const res = await migrateQuery(
    'SELECT * FROM dbs_update_service_subscriptions WHERE staff_id = $1 ORDER BY created_at ASC',
    [staffId],
  )
  return res.rows
}

async function checksFor(subscriptionId: string) {
  const res = await migrateQuery(
    'SELECT * FROM dbs_update_service_checks WHERE subscription_id = $1 ORDER BY checked_on ASC',
    [subscriptionId],
  )
  return res.rows
}

async function reminderRows(subscriptionId: string) {
  const res = await migrateQuery(
    'SELECT kind, due_on FROM dbs_update_service_reminders WHERE subscription_id = $1 ORDER BY due_on ASC',
    [subscriptionId],
  )
  return res.rows
}

describe('DBS Update Service — subscribing is a consent record', () => {
  it('records the consent, the preconditions and the first due date', async () => {
    const { staff, token } = await orgWithStaff()
    const created = await subscribe(token, staff.id)

    expect(created.status).toBe('active')
    expect(created.consent_method).toBe('written')
    expect(created.paper_certificate_seen_on).toBeTruthy()
    expect(created.identity_verified_on).toBeTruthy()
    expect(created.identity_method).toBe('manual_document_check')
    expect(created.checks_recorded).toBe(0)
    expect(created.staff_user_id).toBeTruthy()
    // Twelve months out by default, and due_state is derived rather than stored.
    expect(created.days_until_check).toBeGreaterThan(300)
    expect(created.due_state).toBe('current')

    // Nothing resembling an application was created by subscribing.
    const checks = await migrateQuery('SELECT COUNT(*)::int AS n FROM dbs_checks WHERE staff_id = $1', [staff.id])
    expect(checks.rows[0].n).toBe(0)
  })

  it('refuses a member of staff the DBS does not apply to, naming their scheme', async () => {
    const { staff, token } = await orgWithStaff()
    await migrateQuery(`UPDATE staff_profiles SET vetting_scheme = 'pvg_scotland' WHERE id = $1`, [staff.id])

    const res = await request(app)
      .post('/dbs/update-service')
      .set('Authorization', `Bearer ${token}`)
      .send(subscribeBody(staff.id))

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/PVG/)
    // A refusal with a route attached, and no half-made subscription behind it.
    expect(await subscriptionsFor(staff.id)).toHaveLength(0)
  })

  it('refuses a second active subscription, and allows one after consent is withdrawn', async () => {
    const { staff, token } = await orgWithStaff()
    const first = await subscribe(token, staff.id)

    const duplicate = await request(app)
      .post('/dbs/update-service')
      .set('Authorization', `Bearer ${token}`)
      .send(subscribeBody(staff.id))
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.message).toMatch(/already has an active Update Service subscription/)

    await request(app)
      .post(`/dbs/update-service/${first.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Individual asked us to stop checking' })
      .expect(200)

    // Consenting again after withdrawing is legitimate; both records stay.
    const second = await subscribe(token, staff.id)
    expect(second.id).not.toBe(first.id)
    expect(await subscriptionsFor(staff.id)).toHaveLength(2)
  })
})

describe('DBS Update Service — recording a check', () => {
  it('records the check against the staff record and moves the due date on', async () => {
    const { staff, token, admin } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)

    const res = await recordCheck(token, subscription.id, { notes: 'Checked with the individual present' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.checks_recorded).toBe(1)
    expect(res.body.last_checked_on).toBeTruthy()
    expect(res.body.days_until_check).toBeGreaterThan(300)

    const checks = await checksFor(subscription.id)
    expect(checks).toHaveLength(1)
    expect(checks[0].outcome).toBe('no_change')
    // The entitlement assertion is stored per check, with who made it.
    expect(checks[0].level).toBe('enhanced')
    expect(checks[0].workforce).toBe('adult')
    expect(checks[0].checked_by).toBe(admin.id)

    // The phase 0 invariant, extended: a status check is a fact about a check,
    // so it mints neither an application nor an approved document.
    const artifacts = await migrateQuery(
      `SELECT (SELECT COUNT(*)::int FROM documents WHERE staff_id = $1) AS docs,
              (SELECT COUNT(*)::int FROM dbs_checks WHERE staff_id = $1) AS checks`,
      [staff.id],
    )
    expect(artifacts.rows[0].docs).toBe(0)
    expect(artifacts.rows[0].checks).toBe(0)
  })

  it('refuses a check at a level or workforce the certificate does not cover', async () => {
    const { staff, token } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)

    const res = await recordCheck(token, subscription.id, { workforce: 'child' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/level and workforce of the certificate held/)

    // Refused before anything was written: no check row, and the cadence is where
    // it was.
    expect(await checksFor(subscription.id)).toHaveLength(0)
    const after = await request(app).get(`/dbs/update-service/${subscription.id}`).set('Authorization', `Bearer ${token}`)
    expect(after.body.next_check_due_on).toBe(subscription.next_check_due_on)
  })

  it('records an uncompleted attempt without pretending the check happened', async () => {
    const { staff, token } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)

    const res = await recordCheck(token, subscription.id, { outcome: 'unable_to_check', notes: 'Service unavailable' })
    expect(res.status).toBe(201)
    // Recorded, so the attempt is visible…
    expect(res.body.checks_recorded).toBe(1)
    // …and due again tomorrow rather than in a year, because it has not happened.
    expect(res.body.days_until_check).toBeLessThanOrEqual(1)
    expect(res.body.renewal_due_on).toBeNull()
  })

  it('raises the renewal marker and tells managers when a check finds a change', async () => {
    const { staff, token, admin } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)

    const res = await recordCheck(token, subscription.id, { outcome: 'changed' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.renewal_due_on).toBeTruthy()
    expect(res.body.renewal_completed_on).toBeNull()

    // Found now, not at the next sweep — delivered through the outbox worker.
    await new Promise((r) => setTimeout(r, 900))
    const rows = await notificationsFor(admin.id)
    expect(rows).toSatisfy((ns: any[]) => ns.some((n) => n.title === 'DBS Update Service check found a change'))
  })
})

describe('DBS Update Service — the renewal marker', () => {
  it('can be set and cleared by hand without claiming a certificate arrived', async () => {
    const { staff, token } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    const dueOn = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    const marked = await request(app)
      .patch(`/dbs/update-service/${subscription.id}/renewal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ renewalDueOn: dueOn, note: 'Role change to regulated activity' })
    expect(marked.status, JSON.stringify(marked.body)).toBe(200)
    expect(marked.body.renewal_due_on).toBe(dueOn)
    expect(marked.body.renewal_note).toBe('Role change to regulated activity')

    const cleared = await request(app)
      .patch(`/dbs/update-service/${subscription.id}/renewal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ renewalDueOn: null })
    expect(cleared.status).toBe(200)
    expect(cleared.body.renewal_due_on).toBeNull()
    // Clearing a marker is not a renewal: only recording the certificate is.
    expect(cleared.body.renewal_completed_on).toBeNull()
  })

  it('is cleared by recording the new certificate, which restarts the cadence', async () => {
    const { staff, token } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    await recordCheck(token, subscription.id, { outcome: 'changed' })

    const issued = new Date().toISOString().slice(0, 10)
    const res = await request(app)
      .post(`/dbs/update-service/${subscription.id}/renewal/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ certificateReference: 'CERT-NEW-0002', certificateIssuedOn: issued })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.renewal_due_on).toBeNull()
    expect(res.body.renewal_completed_on).toBeTruthy()
    // Metadata only — the reference and the date, never a copy of the certificate.
    expect(res.body.certificate_reference).toBe('CERT-NEW-0002')
    expect(res.body.certificate_issued_on).toBe(issued)
    expect(res.body.days_until_check).toBeGreaterThan(300)
  })
})

describe('DBS Update Service — consent withdrawn', () => {
  it('stops checks, records when and why, and stops reminders', async () => {
    const { staff, token, admin } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)

    const withdrawn = await request(app)
      .post(`/dbs/update-service/${subscription.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Individual withdrew consent in writing' })
    expect(withdrawn.status, JSON.stringify(withdrawn.body)).toBe(200)
    expect(withdrawn.body.status).toBe('withdrawn')
    expect(withdrawn.body.consent_withdrawn_on).toBeTruthy()
    expect(withdrawn.body.consent_withdrawn_reason).toBe('Individual withdrew consent in writing')

    const refused = await recordCheck(token, subscription.id, {})
    expect(refused.status).toBe(409)
    expect(refused.body.message).toMatch(/[Cc]onsent/)
    expect(await checksFor(subscription.id)).toHaveLength(0)

    // Reminders stop with the subscription: neither the due date nor the marker
    // is a reason to ask for a check nobody has consented to.
    await migrateQuery(
      `UPDATE dbs_update_service_subscriptions SET next_check_due_on = CURRENT_DATE - 5 WHERE id = $1`,
      [subscription.id],
    )
    await runUpdateServiceReminders()
    const titles = await notificationsFor(admin.id)
    expect(titles.filter(t => /Update Service/.test(t))).toHaveLength(0)
    expect(await reminderRows(subscription.id)).toHaveLength(0)
  })

  it('cannot be withdrawn twice', async () => {
    const { staff, token } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    await request(app)
      .post(`/dbs/update-service/${subscription.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Withdrawn once' })
      .expect(200)

    await request(app)
      .post(`/dbs/update-service/${subscription.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Withdrawn again' })
      .expect(409)
  })
})

describe('DBS Update Service — the reminder sweep', () => {
  it('tells managers once, and only once, that a check is overdue', async () => {
    const { staff, worker, token, admin } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    await migrateQuery(
      `UPDATE dbs_update_service_subscriptions SET next_check_due_on = CURRENT_DATE - 2 WHERE id = $1`,
      [subscription.id],
    )

    const first = await runUpdateServiceReminders()
    expect(first.notified).toBeGreaterThanOrEqual(1)
    const afterFirst = await notificationsFor(admin.id)
    const overdue = afterFirst.filter((n: any) => n.title === 'DBS Update Service check overdue')
    expect(overdue).toHaveLength(1)
    // The reminder opens the subscription on the staff member's own record, not the
    // compliance page — and it is addressed by the *user* id and the subscription id,
    // which is what `/staff/:userId` and the profile's Update Service panel read.
    expect(overdue[0].link).toBe(`/staff/${worker.id}?tab=compliance&record=${subscription.id}`)

    // The ledger is the claim: the same subscription and the same due date can be
    // said once, so a sweep that runs again says nothing new.
    await runUpdateServiceReminders()
    expect(
      (await notificationsFor(admin.id)).filter((n: any) => n.title === 'DBS Update Service check overdue'),
    ).toHaveLength(1)
    expect(await reminderRows(subscription.id)).toHaveLength(1)
  })

  it('warns before the due date inside the provider’s own window, and opens the staff record', async () => {
    const { staff, worker, token, admin, org } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    await migrateQuery(`UPDATE organizations SET compliance_warning_days = 30 WHERE id = $1`, [org.id])
    // Twenty days out: inside a 30-day window, outside the default 14.
    await migrateQuery(
      `UPDATE dbs_update_service_subscriptions SET next_check_due_on = CURRENT_DATE + 20 WHERE id = $1`,
      [subscription.id],
    )

    await runUpdateServiceReminders()
    expect(
      (await notificationsFor(admin.id)).filter((n: any) => n.title === 'DBS Update Service check due').length,
    ).toBe(1)
    expect(
      (await notificationsFor(admin.id)).find((n: any) => n.title === 'DBS Update Service check due').link,
    ).toBe(`/staff/${worker.id}?tab=compliance&record=${subscription.id}`)

    const listed = await request(app)
      .get('/dbs/update-service?dueState=due_soon')
      .set('Authorization', `Bearer ${token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.some((s: any) => s.id === subscription.id)).toBe(true)
  })

  it('reminds about a renewal that is outstanding, and opens the staff record', async () => {
    const { staff, worker, token, admin } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    await migrateQuery(
      `UPDATE dbs_update_service_subscriptions SET renewal_due_on = CURRENT_DATE - 1 WHERE id = $1`,
      [subscription.id],
    )

    await runUpdateServiceReminders()
    expect(
      (await notificationsFor(admin.id)).filter((n: any) => n.title === 'DBS certificate renewal outstanding').length,
    ).toBe(1)
    expect(
      (await notificationsFor(admin.id)).find((n: any) => n.title === 'DBS certificate renewal outstanding').link,
    ).toBe(`/staff/${worker.id}?tab=compliance&record=${subscription.id}`)
  })

  it('reports the state of the register', async () => {
    const { staff, token } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    await migrateQuery(
      `UPDATE dbs_update_service_subscriptions SET next_check_due_on = CURRENT_DATE - 3 WHERE id = $1`,
      [subscription.id],
    )

    const stats = await request(app)
      .get('/dbs/update-service/stats')
      .set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)
    expect(stats.body.total).toBe(1)
    expect(stats.body.active).toBe(1)
    expect(stats.body.overdue).toBe(1)
    expect(stats.body.checks_last_30_days).toBe(0)
  })

  it('routes the change-found notification to the staff record too', async () => {
    const { staff, worker, token, admin } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)
    // A status check whose outcome is `changed` is what the whole feature exists for;
    // its notification is a finding, not a reminder — same target as the reminders.
    await request(app)
      .post(`/dbs/update-service/${subscription.id}/checks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcome: 'changed', level: 'enhanced', workforce: 'adult' })
      .expect(201)

    // The consumer delivers it asynchronously, so it may take a tick.
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      await new Promise((r) => setTimeout(r, 80))
      const match = (await notificationsFor(admin.id)).find(
        (n: any) => n.title === 'DBS Update Service check found a change',
      )
      if (match) {
        found = true
        expect(match.link).toBe(`/staff/${worker.id}?tab=compliance&record=${subscription.id}`)
      }
    }
    expect(found).toBe(true)
  })
})

describe('DBS Update Service — access and isolation', () => {
  it('rejects a CARE_WORKER and an unauthenticated caller', async () => {
    const { staff, token, org } = await orgWithStaff()
    const subscription = await subscribe(token, staff.id)

    const worker = await createUser({
      email: `dbs-us-cw-${unique()}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const workerToken = generateToken(worker)

    expect((await request(app).get('/dbs/update-service').set('Authorization', `Bearer ${workerToken}`)).status).toBe(403)
    expect((await request(app).post('/dbs/update-service').set('Authorization', `Bearer ${workerToken}`).send(subscribeBody(staff.id))).status).toBe(403)
    expect((await request(app).post(`/dbs/update-service/${subscription.id}/checks`).set('Authorization', `Bearer ${workerToken}`).send({ outcome: 'no_change', level: 'enhanced', workforce: 'adult' })).status).toBe(403)
    expect((await request(app).get('/dbs/update-service')).status).toBe(401)
  })

  it('does not let another provider read the subscription', async () => {
    const one = await orgWithStaff()
    const subscription = await subscribe(one.token, one.staff.id)

    const other = await orgWithStaff()
    const read = await request(app)
      .get(`/dbs/update-service/${subscription.id}`)
      .set('Authorization', `Bearer ${other.token}`)
    // 404, not 403: the row is not in this tenant at all, and saying otherwise
    // would confirm somebody else's record exists.
    expect(read.status).toBe(404)

    const check = await request(app)
      .post(`/dbs/update-service/${subscription.id}/checks`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ outcome: 'no_change', level: 'enhanced', workforce: 'adult' })
    expect(check.status).toBe(404)

    expect(await checksFor(subscription.id)).toHaveLength(0)
  })
})
