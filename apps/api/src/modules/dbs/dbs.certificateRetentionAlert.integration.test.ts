/**
 * The nightly retention purge is invisible when it stalls: rows past their
 * six-month retention deadline stay on the record, and the only trace is a log
 * line. This test proves that the sweep makes a stall visible — a Mission Control
 * alert that stays until the backlog is caught up, and an in-app notification to
 * the people who can act on it — and, just as importantly, that a purge which
 * works says nothing at all.
 *
 * The distinction is the whole point. A provider with rows due tonight is normal,
 * not non-compliant; the alarm is about information the purge *failed* to delete.
 * So the sweep purges first and judges afterwards, and these tests are written
 * from the provider's side of that: a clean purge is silent, a stall is loud, and
 * a caught-up provider is released from a warning raised earlier.
 */
import { describe, it, expect } from 'vitest'
import { createOrg, createUser, createStaffProfile } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { runScheduledDbsCertificatePurges } from './dbs.certificateRetention'
import { handleRetentionStall } from './dbs.certificateRetentionAlert'
import { runWithOrgContext } from '../events/events.org-context'
import { v4 as uuidv4 } from 'uuid'

const TITLE = 'DBS certificate information held past retention'
const ALERT_TYPE = 'certificate.over_retention'

let seq = 0
/** Unique-enough local part; suites run in parallel against one database. */
const unique = () => `${Date.now()}-${seq++}-${Math.random().toString(36).slice(2, 7)}`

/**
 * A check whose certificate information is past its retention date and still held.
 *
 * `staffProfileId` must be a `staff_profiles.id` — the column is a foreign key to
 * that table, not to `users`. `purge_after` is computed by the database so it
 * matches exactly what the purge compares against.
 */
async function pastRetentionCheck(orgId: string, staffProfileId: string, decisionOn: string, reference: string) {
  const id = uuidv4()
  const purgeAfter = await migrateQuery(
    `SELECT ($1::date + make_interval(months => 6))::date::text AS deadline`,
    [decisionOn],
  )
  await migrateQuery(
    `INSERT INTO dbs_checks (
       id, organization_id, staff_id, level, workforce, status, disclosure_date,
       certificate_number, notes, recruitment_decision, recruitment_decision_on,
       purge_after, certificate_purged_at
     ) VALUES ($1, $2, $3, 'enhanced', 'adult', 'clear', $4, $5, $6, 'proceed', $7, $8, NULL)`,
    [
      id, orgId, staffProfileId, decisionOn, reference,
      'Reference read off the paper certificate', decisionOn, purgeAfter.rows[0].deadline,
    ],
  )
  return id
}

/** A decision comfortably past the six-month window, so the row is due. */
const oldDecision = () => new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

async function notificationsFor(orgId: string) {
  const rows = await migrateQuery(
    `SELECT n.title, n.message, n.link, n.read
       FROM notifications n
       JOIN users u ON u.id = n.user_id
      WHERE u.organization_id = $1 AND n.title = $2
      ORDER BY n.created_at ASC`,
    [orgId, TITLE],
  )
  return rows.rows
}

async function overRetentionAlerts(orgId: string) {
  const rows = await migrateQuery(
    `SELECT severity, title, message, link, dismissed
       FROM mission_control_alerts
      WHERE organization_id = $1 AND alert_type = $2 AND aggregate_id = ''
      ORDER BY created_at ASC`,
    [orgId, ALERT_TYPE],
  )
  return rows.rows
}

describe('DBS certificate retention — the sweep only alarms when it is stalled', () => {
  it('purges a backlog without calling the provider non-compliant', async () => {
    const org = await createOrg()
    await createUser({ email: `dbs-ret-${unique()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const worker = await createUser({ email: `dbs-ret-staff-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ user_id: worker.id })
    const checkId = await pastRetentionCheck(org.id, staff.id, oldDecision(), 'CERT-CLEAN')

    const first = await runScheduledDbsCertificatePurges()
    expect(first.purged).toBeGreaterThanOrEqual(1)
    expect(first.failed).toBe(0)
    // Everything it found, it deleted. Nothing is left to warn about.
    expect(first.flagged).toBe(0)

    expect(await overRetentionAlerts(org.id)).toHaveLength(0)
    expect(await notificationsFor(org.id)).toHaveLength(0)

    // The information really did go — the silence above is not a purge that
    // quietly did nothing.
    const row = await migrateQuery(
      `SELECT certificate_number, notes, disclosure_date, certificate_purged_at, recruitment_decision
         FROM dbs_checks WHERE id = $1`,
      [checkId],
    )
    expect(row.rows[0].certificate_number).toBeNull()
    expect(row.rows[0].notes).toBeNull()
    expect(row.rows[0].disclosure_date).toBeNull()
    expect(row.rows[0].certificate_purged_at).not.toBeNull()
    // The fact of the check survives, which is what a provider must still answer.
    expect(row.rows[0].recruitment_decision).toBe('proceed')
  })

  it('raises one alert and one notification per admin and manager, then withdraws both when caught up', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dbs-ret-admin-${unique()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const manager = await createUser({ email: `dbs-ret-manager-${unique()}@test.com`, role: 'MANAGER', organization_id: org.id })

    // A held backlog that survived the purge is the stall state. Driving it
    // directly is the only way to reach it: a working purge deletes the rows
    // before anything is left to count.
    await runWithOrgContext(org.id, () => handleRetentionStall(org.id, 2))

    const alerts = await overRetentionAlerts(org.id)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].dismissed).toBe(false)
    expect(alerts[0].severity).toBe('high')
    expect(alerts[0].title).toBe(TITLE)
    // The alert has to open the screen it is about, or it is a dead end.
    expect(alerts[0].link).toBe('/compliance')
    expect(alerts[0].message).toContain('2 checks')

    const notifs = await notificationsFor(org.id)
    expect(notifs).toHaveLength(2)
    for (const n of notifs) {
      expect(n.read).toBe(false)
      expect(n.link).toBe('/compliance')
      expect(n.message).toContain('2 checks')
    }
    // Both people who can record certificate metadata were told.
    const recipients = await migrateQuery(
      `SELECT DISTINCT u.id FROM notifications n JOIN users u ON u.id = n.user_id
        WHERE u.organization_id = $1 AND n.title = $2`,
      [org.id, TITLE],
    )
    expect(recipients.rows.map((r: any) => r.id).sort()).toEqual([admin.id, manager.id].sort())

    // A second sweep of the same stall updates in place rather than piling up
    // rows, and does not re-notify somebody who already has an unread one.
    await runWithOrgContext(org.id, () => handleRetentionStall(org.id, 3))
    expect(await overRetentionAlerts(org.id)).toHaveLength(1)
    expect((await overRetentionAlerts(org.id))[0].message).toContain('3 checks')
    expect(await notificationsFor(org.id)).toHaveLength(2)

    // Nothing is due any more and no row is held: the next sweep must visit this
    // org *because its alert is still open* and take the warning down.
    const sweep = await runScheduledDbsCertificatePurges()
    expect(sweep.flagged).toBe(0)
    const cleared = await overRetentionAlerts(org.id)
    expect(cleared).toHaveLength(1)
    expect(cleared[0].dismissed).toBe(true)
    for (const n of await notificationsFor(org.id)) expect(n.read).toBe(true)
  })

  it('reaches an admin who has muted compliance notifications', async () => {
    // Retention is not a category anybody may opt out of: the provider is holding
    // information a rule says must already be deleted. Muting 'compliance' is a
    // preference about the everyday messages; this is the one the alert exists for.
    const org = await createOrg()
    const admin = await createUser({ email: `dbs-ret-muted-${unique()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    await migrateQuery(
      `INSERT INTO notification_preferences (user_id, notification_type, enabled)
       VALUES ($1, 'compliance', FALSE)
       ON CONFLICT (user_id, notification_type) DO UPDATE SET enabled = FALSE`,
      [admin.id],
    )

    await runWithOrgContext(org.id, () => handleRetentionStall(org.id, 1))

    const mine = await notificationsFor(org.id)
    expect(mine).toHaveLength(1)
    expect(mine[0].title).toBe(TITLE)
  })

  it('re-notifies once the previous warning was read and the stall is still real', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dbs-ret-renotify-${unique()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })

    await runWithOrgContext(org.id, () => handleRetentionStall(org.id, 1))
    expect(await notificationsFor(org.id)).toHaveLength(1)

    // The admin reads it and moves on; the backlog, in this simulation, remains.
    await migrateQuery(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND title = $2`, [admin.id, TITLE])

    await runWithOrgContext(org.id, () => handleRetentionStall(org.id, 1))
    const all = await notificationsFor(org.id)
    expect(all).toHaveLength(2)
    expect(all.filter((n: any) => !n.read)).toHaveLength(1)
  })
})
