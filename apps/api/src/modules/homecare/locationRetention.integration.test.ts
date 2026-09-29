/**
 * Retention and deletion for carer location.
 *
 * The rule being tested is simple to state and easy to get wrong in a way that
 * looks like it works: after the period, no copy of a care worker's position
 * may remain anywhere.
 *
 * "Anywhere" is doing the work in that sentence. Location is written to three
 * stores, and two of the three were found by reading what the code actually
 * does rather than what it was documented to do:
 *
 *   1. homecare_visits.check_in_* / check_out_*  — the intended record
 *   2. audit_logs.new_data                      — the same position, again, in
 *      JSONB, on the check_in and check_out rows
 *   3. mobile_check_ins                         — SecureVisit, a separate
 *      endpoint that had no reference to the switch or the worker's decision
 *
 * A purge that clears only the first reports a number, looks successful, and
 * leaves the same position sitting in two other tables. So most of what follows
 * is not about the retention arithmetic — it is about checking the copies are
 * gone, and about the paths by which a refused collection could still write a
 * position after the provider had asked for it to stop.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'
import { runLocationPurge, runScheduledLocationPurges } from './locationRetention'

let app: Express
beforeAll(() => { app = createTestApp() })

const nearDate = (minsFromNow: number, durationMins = 60) => {
  const start = new Date(Date.now() + minsFromNow * 60000)
  const end = new Date(start.getTime() + durationMins * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}

type Fixture = {
  orgId: string; adminToken: string; carerToken: string; visitId: string; otherOrgId: string
}

async function fixture(suffix: string): Promise<Fixture> {
  const stamp = `${Date.now()}-${suffix}`
  const org = await createOrg()
  const person = await createPerson({ organizationId: org.id })
  const admin = await createUser({ email: `ret-admin-${stamp}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
  const manager = await createUser({ email: `ret-mgr-${stamp}@test.com`, role: 'MANAGER', organization_id: org.id })
  const carer = await createUser({ email: `ret-carer-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const carerProfile = await createStaffProfile({ userId: carer.id })
  const managerToken = generateToken(manager)

  const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
    person_id: person.id, name: 'Support package',
    start_date: new Date().toISOString().split('T')[0], hourly_rate_pence: 1500,
  })
  const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
    package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id,
    visit_type: 'morning', label: 'Morning call',
    scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end,
  })
  expect(visit.status).toBe(201)

  return {
    orgId: org.id, adminToken: generateToken(admin), carerToken: generateToken(carer),
    visitId: visit.body.id,
    otherOrgId: (await createOrg()).id,
  }
}

/** A worker who has agreed, so positions actually get written. */
const agree = (token: string) =>
  request(app).post('/homecare/location-decision').set('Authorization', `Bearer ${token}`)
    .send({ decision: 'agreed', notice_key: 'staff_location', notice_version: '1.3' })

const checkIn = (f: Fixture, coords = { latitude: 51.5, longitude: -0.1, accuracy_meters: 9 }) =>
  request(app).post(`/homecare/visits/${f.visitId}/check-in`).set('Authorization', `Bearer ${f.carerToken}`).send(coords)

const checkOut = (f: Fixture, coords = { latitude: 51.51, longitude: -0.11, accuracy_meters: 8 }) =>
  request(app).post(`/homecare/visits/${f.visitId}/check-out`).set('Authorization', `Bearer ${f.carerToken}`).send(coords)

const visitRow = (visitId: string) =>
  migrateQuery('SELECT * FROM homecare_visits WHERE id = $1', [visitId]).then(r => r.rows[0])

const auditRows = (visitId: string) =>
  migrateQuery(
    `SELECT action, new_data FROM audit_logs
     WHERE entity_type = 'homecare_visit' AND entity_id = $1 ORDER BY created_at`,
    [visitId],
  ).then(r => r.rows)

/**
 * Read again until a condition holds, for the audit log only.
 *
 * `audit()` in the controller deliberately does not await its insert — the
 * request should not fail because a log row could not be written, and nothing
 * in the product reads it back on the same request. The consequence is that a
 * row a request has already caused may not have committed by the time the
 * response is read, so a test that looks for it immediately is racing the
 * insert rather than testing anything. This waited for the row to exist; it did
 * not, and the assertions below were failing on a machine that was merely busy.
 *
 * A row that genuinely is never written still fails, on the timeout, with a
 * message that says what was waited for.
 */
async function readUntil<T>(read: () => Promise<T[]>, ready: (rows: T[]) => boolean, waitingFor: string): Promise<T[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const rows = await read()
    if (ready(rows)) return rows
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out after 3s waiting for ${waitingFor}`)
}

/** Audit rows for a visit, read once `ready` says the ones under test have landed. */
const auditRowsUntil = (visitId: string, ready: (rows: any[]) => boolean, waitingFor: string) =>
  readUntil(() => auditRows(visitId), ready, waitingFor)

/** Backdate a visit's timestamps so it falls outside a retention period. */
const backdateVisit = (visitId: string, daysAgo: number) =>
  migrateQuery(
    `UPDATE homecare_visits
     SET check_in_at = NOW() - ($2 || ' days')::interval,
         check_out_at = NOW() - ($2 || ' days')::interval,
         created_at = NOW() - ($2 || ' days')::interval
     WHERE id = $1`,
    [visitId, String(daysAgo)],
  )

const backdateAudit = (visitId: string, daysAgo: number) =>
  migrateQuery(
    `UPDATE audit_logs SET created_at = NOW() - ($2 || ' days')::interval
     WHERE entity_type = 'homecare_visit' AND entity_id = $1`,
    [visitId, String(daysAgo)],
  )

const getPolicy = (token: string) =>
  request(app).get('/homecare/settings/location-retention').set('Authorization', `Bearer ${token}`)

const setPolicy = (token: string, days: number) =>
  request(app).put('/homecare/settings/location-retention').set('Authorization', `Bearer ${token}`)
    .send({ retention_days: days })

const runNow = (token: string, body: any = {}) =>
  request(app).post('/homecare/settings/location-retention/run').set('Authorization', `Bearer ${token}`).send(body)

const listRuns = (token: string) =>
  request(app).get('/homecare/settings/location-retention/runs').set('Authorization', `Bearer ${token}`)

describe('no retention period is a state a provider has to notice', () => {
  it('ships with nothing set, and says so rather than looking like a policy', async () => {
    const f = await fixture('unset')
    const res = await getPolicy(f.adminToken)
    expect(res.status).toBe(200)
    // Null, not a number. A shipped default would become the policy of every
    // provider who never opens the setting, which is the DPIA's unanswered
    // escalation being quietly answered on their behalf.
    expect(res.body.retention_days).toBeNull()
    expect(res.body.is_configured).toBe(false)
    expect(res.body.unconfigured_warning).toContain('No retention period set')
  })

  it('says the same thing once positions exist, and how many', async () => {
    const f = await fixture('unset-counted')
    await agree(f.carerToken)
    await checkIn(f)
    const res = await getPolicy(f.adminToken)
    expect(res.body.positions_stored).toBeGreaterThan(0)
    expect(res.body.oldest_position_at).not.toBeNull()
    // "No retention period set" alone is abstract. The number is what makes it
    // impossible to scroll past.
    expect(res.body.unconfigured_warning).toMatch(/\d/)
  })

  it('warns differently once collection is off, because the fix differs', async () => {
    const f = await fixture('unset-off')
    await agree(f.carerToken)
    await checkIn(f)
    await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'keep' })
    const res = await getPolicy(f.adminToken)
    expect(res.body.tracking_enabled).toBe(false)
    // Collection being off means the exposure is bounded in volume but not in
    // time, and the remedy is a one-off purge rather than a standing period.
    expect(res.body.unconfigured_warning).toContain('run a one-off deletion')
  })
})

describe('a provider sets their own period', () => {
  it('records it, with who and when', async () => {
    const f = await fixture('set')
    const res = await setPolicy(f.adminToken, 90)
    expect(res.status).toBe(200)
    expect(res.body.retention_days).toBe(90)
    expect(res.body.is_configured).toBe(true)
    expect(res.body.configured_at).not.toBeNull()
    expect(res.body.configured_by_name).toBeTruthy()
    // Configured is not the same as enforced, and the warning retires only when
    // the period exists — not when positions happen to be zero today.
    expect(res.body.unconfigured_warning).toBeNull()
  })

  it('refuses a period of zero, a negative, a fraction, and a decade and a half', async () => {
    const f = await fixture('bounds')
    for (const days of [0, -1, 1.5, 3651]) {
      const res = await setPolicy(f.adminToken, days)
      expect(res.status, `days=${days}`).toBe(400)
    }
    // A provider may legitimately want shorter than a month; that is their call.
    expect((await setPolicy(f.adminToken, 1)).status).toBe(200)
    expect((await setPolicy(f.adminToken, 3650)).status).toBe(200)
  })

  it('does not delete on setting, so a mistyped period is not catastrophic', async () => {
    const f = await fixture('set-no-delete')
    await agree(f.carerToken)
    await checkIn(f)
    await setPolicy(f.adminToken, 1)
    // The visit is still there. Enforcing is a separate, named action, because
    // typing "1" instead of "365" should not destroy a decade of attendance.
    expect(Number((await visitRow(f.visitId)).check_in_latitude)).toBeCloseTo(51.5, 3)
  })

  it('lets a provider un-set it, and that deletes nothing', async () => {
    const f = await fixture('clear')
    await agree(f.carerToken)
    await checkIn(f)
    await setPolicy(f.adminToken, 30)
    const res = await request(app).delete('/homecare/settings/location-retention').set('Authorization', `Bearer ${f.adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.retention_days).toBeNull()
    expect(Number((await visitRow(f.visitId)).check_in_latitude)).toBeCloseTo(51.5, 3)
  })
})

describe('the purge reaches every copy', () => {
  it('clears the visit columns, the audit copy and SecureVisit check-ins', async () => {
    const f = await fixture('all-three')
    await agree(f.carerToken)
    await checkIn(f)
    await checkOut(f)
    await request(app).post('/mobile/check-in').set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy: 5 })

    // Confirm all three stores actually hold something first, so a passing
    // assertion below cannot be explained by there having been nothing to do.
    const before = await visitRow(f.visitId)
    expect(Number(before.check_in_latitude)).toBeCloseTo(51.5, 3)
    expect(Number(before.check_out_latitude)).toBeCloseTo(51.51, 3)
    expect((await auditRowsUntil(
      f.visitId,
      (rows) => rows.some((r: any) => r.new_data?.latitude != null),
      'a check-in audit row carrying a position',
    )).some((r: any) => r.new_data?.latitude != null)).toBe(true)
    expect((await migrateQuery('SELECT COUNT(*)::int c FROM mobile_check_ins WHERE organization_id = $1', [f.orgId])).rows[0].c).toBe(1)

    await backdateVisit(f.visitId, 200)
    await backdateAudit(f.visitId, 200)
    await migrateQuery("UPDATE mobile_check_ins SET checked_in_at = NOW() - INTERVAL '200 days' WHERE organization_id = $1", [f.orgId])

    const res = await runNow(f.adminToken, { all: true })
    expect(res.status).toBe(200)
    expect(res.body.run.positions_removed).toBe(3)

    const after = await visitRow(f.visitId)
    expect(after.check_in_latitude).toBeNull()
    expect(after.check_in_longitude).toBeNull()
    expect(after.check_in_accuracy_meters).toBeNull()
    expect(after.check_out_latitude).toBeNull()
    expect(after.check_out_longitude).toBeNull()
    expect(after.check_out_accuracy_meters).toBeNull()

    // Store 2. The coordinates go; the fact that the check-in happened stays,
    // because that record is not a record of where anyone was.
    const audit = await auditRowsUntil(f.visitId, (rows) => rows.length > 0, 'the check-in audit rows')
    expect(audit.length).toBeGreaterThan(0)
    for (const row of audit) {
      expect(row.new_data?.latitude).toBeUndefined()
      expect(row.new_data?.longitude).toBeUndefined()
    }

    // Store 3.
    expect((await migrateQuery('SELECT COUNT(*)::int c FROM mobile_check_ins WHERE organization_id = $1', [f.orgId])).rows[0].c).toBe(0)
  })

  it('stamps the visit so a purged read is not mistaken for a failed device', async () => {
    const f = await fixture('stamp')
    await agree(f.carerToken)
    await checkIn(f)
    const run = await runLocationPurge({ organizationId: f.orgId, trigger: 'manual', retentionDays: null })
    const visit = await visitRow(f.visitId)
    expect(visit.location_purged_at).not.toBeNull()
    // The link back to the receipt, so "when was this deleted and under what
    // authority" has one answer.
    expect(visit.location_purged_run_id).toBe(run.id)
  })

  it('keeps the visit itself, the timesheet and the pay', async () => {
    const f = await fixture('keeps-pay')
    await agree(f.carerToken)
    await checkIn(f)
    await checkOut(f)
    // An hour of work, so the assertion below is about pay surviving a purge
    // rather than about a zero-length visit producing zero pay.
    await migrateQuery(
      "UPDATE homecare_visits SET check_in_at = check_out_at - INTERVAL '60 minutes' WHERE id = $1",
      [f.visitId],
    )
    await migrateQuery(
      `UPDATE homecare_timesheets SET work_minutes = 60, gross_pay_pence = 1500 WHERE visit_id = $1`,
      [f.visitId],
    )
    await runLocationPurge({ organizationId: f.orgId, trigger: 'manual', retentionDays: null })
    const visit = await visitRow(f.visitId)
    // Deleting a position must not delete the attendance record. That is the
    // guarantee the customer-facing guide makes, and it has to hold here.
    expect(visit.check_in_at).not.toBeNull()
    expect(visit.check_out_at).not.toBeNull()
    expect(visit.status).toBe('completed')
    const timesheet = await migrateQuery('SELECT * FROM homecare_timesheets WHERE visit_id = $1', [f.visitId])
    expect(timesheet.rows).toHaveLength(1)
    expect(Number(timesheet.rows[0].gross_pay_pence)).toBeGreaterThan(0)
  })

  it('leaves positions that are still inside the period alone', async () => {
    const f = await fixture('in-period')
    await agree(f.carerToken)
    await checkIn(f)
    await setPolicy(f.adminToken, 90)
    await backdateVisit(f.visitId, 10)
    await backdateAudit(f.visitId, 10)
    const res = await runNow(f.adminToken)
    expect(res.body.run.positions_removed).toBe(0)
    expect(Number((await visitRow(f.visitId)).check_in_latitude)).toBeCloseTo(51.5, 3)
  })

  it('does not touch another organisation\'s positions', async () => {
    const a = await fixture('iso-a')
    const b = await fixture('iso-b')
    for (const f of [a, b]) {
      await agree(f.carerToken)
      await checkIn(f)
    }
    await runLocationPurge({ organizationId: a.orgId, trigger: 'manual', retentionDays: null })
    expect((await visitRow(a.visitId)).check_in_latitude).toBeNull()
    // A deletion that over-reached would be far worse than one that under-reached.
    expect(Number((await visitRow(b.visitId)).check_in_latitude)).toBeCloseTo(51.5, 3)
  })

  it('is idempotent, so a second run does not double-count', async () => {
    const f = await fixture('idempotent')
    await agree(f.carerToken)
    await checkIn(f)
    const first = await runLocationPurge({ organizationId: f.orgId, trigger: 'manual', retentionDays: null })
    const second = await runLocationPurge({ organizationId: f.orgId, trigger: 'manual', retentionDays: null })
    expect(first.positions_removed).toBe(1)
    expect(second.positions_removed).toBe(0)
  })
})

describe('the receipt', () => {
  it('records a run that deleted nothing, because that is the evidence', async () => {
    const f = await fixture('empty-run')
    const res = await runNow(f.adminToken, { all: true })
    expect(res.status).toBe(200)
    // Silently skipping empty runs would make "we have deleted 4,096 positions"
    // impossible to reconcile against "how many were there".
    expect(res.body.run.positions_removed).toBe(0)
    const runs = await listRuns(f.adminToken)
    expect(runs.body.runs.some((r: any) => r.id === res.body.run.id)).toBe(true)
  })

  it('lists runs newest first, with the trigger and who caused it', async () => {
    const f = await fixture('runs')
    const manual = await runNow(f.adminToken, { all: true })
    await setPolicy(f.adminToken, 30)
    const scheduled = await runLocationPurge({ organizationId: f.orgId, trigger: 'scheduled', retentionDays: 30 })
    const res = await listRuns(f.adminToken)
    expect(res.body.runs[0].id).toBe(scheduled.id)
    const byId = (id: string) => res.body.runs.find((r: any) => r.id === id)
    expect(byId(manual.body.run.id).trigger).toBe('manual')
    expect(byId(manual.body.run.id).triggered_by_name).toBeTruthy()
    expect(byId(scheduled.id).trigger).toBe('scheduled')
    // A scheduled run has no person behind it, and pretending otherwise would
    // put a name on a deletion nobody authorised.
    expect(byId(scheduled.id).triggered_by).toBeNull()
  })

  it('is manager-readable, and not writable by any client', async () => {
    const f = await fixture('runs-rls')
    const manager = await createUser({ email: `ret-mgr-read-${Date.now()}@test.com`, role: 'MANAGER', organization_id: f.orgId })
    const res = await listRuns(generateToken(manager))
    expect(res.status).toBe(200)
    // There is no route that creates a receipt. A receipt a manager could edit
    // would not be a receipt.
    const post = await request(app).post('/homecare/settings/location-retention/run').set('Authorization', `Bearer ${generateToken(manager)}`).send({ all: true })
    expect(post.status).toBe(403)
  })
})

describe('the nightly job', () => {
  it('enforces every configured period and skips everyone else', async () => {
    const set = await fixture('job-set')
    const unset = await fixture('job-unset')
    for (const f of [set, unset]) await agree(f.carerToken)
    await checkIn(set)
    await checkIn(unset)
    await backdateVisit(set.visitId, 200)
    await backdateAudit(set.visitId, 200)
    await setPolicy(set.adminToken, 30)

    const result = await runScheduledLocationPurges()
    expect(result.failed).toBe(0)
    expect((await visitRow(set.visitId)).check_in_latitude).toBeNull()
    // No period, no deletion. Not because the worker is protected, but because
    // the provider has not decided and the system is not going to decide for them.
    expect(Number((await visitRow(unset.visitId)).check_in_latitude)).toBeCloseTo(51.5, 3)
    const runs = await listRuns(set.adminToken)
    expect(runs.body.runs.some((r: any) => r.trigger === 'scheduled' && r.organization_id === undefined)).toBe(true)
  })
})

describe('switching collection off asks about what was already collected', () => {
  it('keeps the history by default, and reports what is still held', async () => {
    const f = await fixture('off-keep')
    await agree(f.carerToken)
    await checkIn(f)
    const res = await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false })
    expect(res.status).toBe(200)
    expect(res.body.location_tracking_enabled).toBe(false)
    expect(res.body.existing_positions_handling).toBe('keep')
    expect(res.body.deletion_run).toBeNull()
    // Kept, and counted, so "we stopped collecting" is not mistaken for "we
    // hold nothing".
    expect(Number((await visitRow(f.visitId)).check_in_latitude)).toBeCloseTo(51.5, 3)
    expect(res.body.positions_remaining).toBeGreaterThan(0)
  })

  it('deletes everything held when asked, and says what it removed', async () => {
    const f = await fixture('off-purge')
    await agree(f.carerToken)
    await checkIn(f)
    await backdateVisit(f.visitId, 200)
    const res = await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'purge' })
    expect(res.status).toBe(200)
    expect(res.body.deletion_run.trigger).toBe('switch_off')
    expect(res.body.deletion_run.positions_removed).toBe(1)
    expect(res.body.positions_remaining).toBe(0)
    expect((await visitRow(f.visitId)).check_in_latitude).toBeNull()
  })

  it('applies the configured period once, when that is the choice', async () => {
    const f = await fixture('off-apply')
    await agree(f.carerToken)
    await checkIn(f)
    await setPolicy(f.adminToken, 30)
    await backdateVisit(f.visitId, 200)
    const res = await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'apply_retention' })
    expect(res.body.deletion_run.trigger).toBe('switch_off')
    expect(res.body.deletion_run.retention_days).toBe(30)
    expect((await visitRow(f.visitId)).check_in_latitude).toBeNull()
  })

  it('refuses to apply a policy that does not exist, and leaves the switch on', async () => {
    const f = await fixture('off-apply-unset')
    await agree(f.carerToken)
    await checkIn(f)
    const res = await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'apply_retention' })
    expect(res.status).toBe(400)
    // The order matters: no position can arrive between the decision to stop
    // and the decision about the past, so a rejected request changes nothing.
    const tracking = await request(app).get('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
    expect(tracking.body.location_tracking_enabled).toBe(true)
  })

  it('stops the audit copy being written once the switch is off', async () => {
    const f = await fixture('off-audit')
    await agree(f.carerToken)
    await checkIn(f)
    const before = (await auditRowsUntil(
      f.visitId,
      (rows) => rows.some((r: any) => r.new_data?.latitude != null),
      'the check-in audit row carrying a position',
    )).filter((r: any) => r.new_data?.latitude != null).length
    expect(before).toBe(1)

    await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'keep' })
    // An older app build still sends coordinates. The visit row already ignored
    // them; this is the assertion that the audit log does too, which it did not
    // — the payload used to be built straight from the request body, so the
    // kill switch left a second, uncontrolled copy behind.
    await checkIn(f)
    // Waits for the second check-in's row as well, not just for a row. Reading
    // as soon as the response arrives would find one row, the one that already
    // had the position in it, and the assertion would pass without the second
    // write ever having been observed — which is the thing under test.
    const after = (await auditRowsUntil(
      f.visitId,
      (rows) => rows.length >= 2,
      'the second check-in audit row',
    )).filter((r: any) => r.new_data?.latitude != null).length
    expect(after).toBe(before)
  })

  it('does not audit the choice to keep as if it were a deletion', async () => {
    const f = await fixture('off-audit-choice')
    const res = await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'keep' })
    const logs = await readUntil(
      () => migrateQuery(
        `SELECT created_at, new_data FROM audit_logs
         WHERE action = 'disable' AND entity_type = 'organization_location_tracking' AND entity_id = $1
         ORDER BY created_at`,
        [f.orgId],
      ).then((r) => r.rows),
      (rows) => rows.length > 0,
      `the location-tracking audit row for org ${f.orgId}`,
    )
    // Ordered rather than "the last row the database happened to return": the
    // point of the assertion is what was written, not which of two rows the
    // planner liked best.
    const entry = logs[logs.length - 1]
    expect(entry.new_data.existing_positions_handling).toBe('keep')
    expect(entry.new_data.positions_removed).toBe(0)
    expect(res.body.deletion_run).toBeNull()
  })
})

describe('SecureVisit check-ins go through the same gates', () => {
  it('stores nothing for a worker who has not agreed, and still records the check-in', async () => {
    const f = await fixture('secure-undecided')
    const res = await request(app).post('/mobile/check-in').set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy: 5 })
    expect(res.status).toBe(201)
    expect(res.body.location_capture_skipped).toBe(true)
    expect(res.body.location_capture_skip_reason).toBe('not_agreed')
    const row = await migrateQuery('SELECT * FROM mobile_check_ins WHERE id = $1', [res.body.id])
    // The attendance record survives; the position does not. Losing the ability
    // to check in over a privacy choice would make the choice meaningless.
    expect(row.rows[0].latitude).toBeNull()
    expect(row.rows[0].checked_in_at).not.toBeNull()
  })

  it('stores nothing for a worker who declined', async () => {
    const f = await fixture('secure-declined')
    await request(app).post('/homecare/location-decision').set('Authorization', `Bearer ${f.carerToken}`)
      .send({ decision: 'declined', notice_key: 'staff_location', notice_version: '1.3' })
    const res = await request(app).post('/mobile/check-in').set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy: 5 })
    expect(res.body.location_capture_skip_reason).toBe('worker_declined')
    const row = await migrateQuery('SELECT latitude FROM mobile_check_ins WHERE id = $1', [res.body.id])
    expect(row.rows[0].latitude).toBeNull()
  })

  it('stores nothing once the organisation has switched collection off', async () => {
    const f = await fixture('secure-off')
    await agree(f.carerToken)
    await request(app).put('/homecare/settings/location-tracking').set('Authorization', `Bearer ${f.adminToken}`)
      .send({ enabled: false, existingPositions: 'keep' })
    const res = await request(app).post('/mobile/check-in').set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy: 5 })
    // This endpoint used to consult neither the switch nor the worker's own
    // decision, so a provider who had turned location off entirely still got a
    // position recorded the moment anyone used this page.
    expect(res.body.location_capture_skip_reason).toBe('organisation_disabled')
    const row = await migrateQuery('SELECT latitude FROM mobile_check_ins WHERE id = $1', [res.body.id])
    expect(row.rows[0].latitude).toBeNull()
  })

  it('stores the position for a worker who agreed, so the gate is not just refusing everyone', async () => {
    const f = await fixture('secure-agreed')
    await agree(f.carerToken)
    const res = await request(app).post('/mobile/check-in').set('Authorization', `Bearer ${f.carerToken}`)
      .send({ latitude: 51.5, longitude: -0.1, accuracy: 5 })
    expect(res.body.location_capture_skipped).toBe(false)
    const row = await migrateQuery('SELECT latitude FROM mobile_check_ins WHERE id = $1', [res.body.id])
    expect(Number(row.rows[0].latitude)).toBeCloseTo(51.5, 3)
  })
})
