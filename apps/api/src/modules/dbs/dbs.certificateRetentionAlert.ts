/**
 * A stalled nightly purge is a real risk: six months from a recruitment decision,
 * certificate information has to be deleted, and if the job that deletes it stops
 * running, a provider can wake up a month later with retention deadlines quietly
 * missed and no one being told.
 *
 * The purge itself reports a summary in its log when it deletes something, but a
 * log line is invisible to a manager on a Tuesday morning. This module closes that
 * gap: after the nightly sweep, for each org visited, it re-evaluates whether
 * certificate information is still held past its retention date, and if so raises
 * (a) a Mission Control alert row that stays until the next clean sweep dismisses
 * it, and (b) an in-app notification to each active org admin and manager who does
 * not already have an unread one of this title — the same people who may record the
 * certificate metadata, so the warning reaches whoever can act on it.
 *
 * The alert is one row per org, deduped by (organization_id, alert_type) with no
 * aggregate_id — a single sticky row per org, updated in place until dismissed.
 * That's the right shape: the thing to notice is the *provider* being non-compliant
 * with retention, not a single check, and a provider with five checks past retention
 * has one problem to fix, not five.
 *
 * The notification is one per admin or manager, deduped by title + unread status, so a
 * sweep that runs again while the stall persists does not re-notify an admin who
 * already has an unread one. A re-notification happens only when the previous one
 * was read and the stall still exists — the shape that says "this is still broken"
 * rather than "this was broken once".
 *
 * Both are written directly by the sweep (per org, inside runWithOrgContext), never
 * through a separate event or consumer, because the sweep is the thing that knows
 * whether the purge stalled and it is the only place that should write this. Routing
 * it through an event would put the knowledge in two places that could drift.
 */
import { migrateQuery, query } from '../../shared/database';
import { NotificationsController } from '../notifications/notifications.controller';
import logger from '../../shared/utils/logger';
import { runWithOrgContext } from '../events/events.org-context';
import { readStaleJobs } from '../../shared/jobs/heartbeat';

/**
 * The purge job's name in `job_heartbeats`, and the key `EXPECTED_JOB_CADENCE`
 * declares it under.
 *
 * It lives here rather than beside the sweep because this module is where the
 * *absence* of a run is judged: the sweep imports the stall handling from here, and a
 * constant owned by the file that is checked keeps the checks together.
 */
export const DBS_CERTIFICATE_RETENTION_JOB = 'dbs_certificate_retention';

const ALERT_TYPE = 'certificate.over_retention';
const NOTIFICATION_TITLE = 'DBS certificate information held past retention';
const NOTIFICATION_LINK = '/compliance';

const RETENTION_HELD_FROM = `
  FROM dbs_checks
  WHERE organization_id = $1
    AND purge_after IS NOT NULL
    AND purge_after <= NOW()
    AND certificate_purged_at IS NULL
    AND (certificate_number IS NOT NULL OR disclosure_date IS NOT NULL OR notes IS NOT NULL)`;

/**
 * The organisations holding information nobody has deleted, with no organisation filter
 * — for the check that runs when there has been no sweep to discover them.
 */
const RETENTION_HELD_ORGS_SQL = `
  SELECT DISTINCT organization_id AS id
    FROM dbs_checks
   WHERE purge_after IS NOT NULL
     AND purge_after <= NOW()
     AND certificate_purged_at IS NULL
     AND (certificate_number IS NOT NULL OR disclosure_date IS NOT NULL OR notes IS NOT NULL)`;

/**
 * After a purge run for one org, handle the retention-stall state for that org.
 *
 * `heldCount` is the count of checks still holding certificate information past
 * their retention date *after* the purge for this org ran.
 */
export async function handleRetentionStall(
  orgId: string,
  heldCount: number,
  /**
   * Set when the purge job itself is missing rather than merely behind. It changes what
   * the provider is told — "the purge has not caught up" is wrong when the purge has
   * not run at all — without changing the shape of the warning, because the provider's
   * position is the same either way and it is their action that is needed.
   */
  options: { sweepStalled?: boolean; sweepAgeMinutes?: number | null } = {},
): Promise<void> {
  try {
    if (heldCount > 0) {
      await upsertOverRetentionAlert(orgId, heldCount, options);
      await notifyAdminsAndManagers(orgId, heldCount, options);
    } else {
      await dismissOverRetentionAlert(orgId);
      await markRetentionNotificationRead(orgId);
    }
  } catch (err: any) {
    // The provider may still be non-compliant; log rather than let one org's
    // failure stop the rest of the sweep.
    logger.error({ err: err?.message, orgId, heldCount }, 'DBS retention stall handling failed for organisation');
  }
}

async function upsertOverRetentionAlert(
  orgId: string,
  heldCount: number,
  options: { sweepStalled?: boolean; sweepAgeMinutes?: number | null } = {},
): Promise<void> {
  const n = heldCount;
  const message = `${n} ${n === 1 ? 'check' : 'checks'} still hold DBS certificate information past the six-month retention date. ${stallSentence(options)}`;

  await query(
    `INSERT INTO mission_control_alerts
       (organization_id, alert_type, aggregate_id, severity, title, message, link, dismissed)
     VALUES ($1, $2, '', 'high', $3, $4, $5, FALSE)
     ON CONFLICT (organization_id, alert_type, aggregate_id)
     DO UPDATE SET
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       message = EXCLUDED.message,
       link = EXCLUDED.link,
       updated_at = CURRENT_TIMESTAMP,
       dismissed = FALSE`,
    [orgId, ALERT_TYPE, NOTIFICATION_TITLE, message, NOTIFICATION_LINK],
  );
}

async function dismissOverRetentionAlert(orgId: string): Promise<void> {
  await query(
    `UPDATE mission_control_alerts
     SET dismissed = TRUE, updated_at = NOW()
     WHERE organization_id = $1 AND alert_type = $2 AND aggregate_id = ''`,
    [orgId, ALERT_TYPE],
  );
}

/**
 * Which flavour of "nobody has deleted this" the provider is being told about.
 *
 * The distinction matters to whoever reads it: a sweep that ran and could not clear a
 * row needs the row looked at, where a sweep that has not run at all needs the platform
 * looked at. Both leave the provider holding information it may not keep, which is why
 * both are worth a notification.
 */
function stallSentence(options: { sweepStalled?: boolean; sweepAgeMinutes?: number | null }): string {
  if (!options.sweepStalled) {
    return 'The nightly retention purge has not caught up — review before the next run, because certificate information may not be kept longer than six months after a recruitment decision.';
  }
  const age = options.sweepAgeMinutes === null || options.sweepAgeMinutes === undefined
    ? 'has never completed a run'
    : `last completed a run ${Math.floor(options.sweepAgeMinutes / 60)} hours ago`;
  return `The nightly retention purge itself ${age}, so nothing has deleted what is due for deletion — report this to your platform administrator, and record the recruitment decisions these checks belong to so the window can be run from the right date.`;
}

async function notifyAdminsAndManagers(
  orgId: string,
  heldCount: number,
  options: { sweepStalled?: boolean; sweepAgeMinutes?: number | null } = {},
): Promise<void> {
  const admins = await query(
    `SELECT id, email
     FROM users
     WHERE organization_id = $1
       AND role IN ('ORG_ADMIN', 'MANAGER')
       AND status = 'active'`,
    [orgId],
  );

  for (const admin of admins.rows) {
    const alreadyUnread = await query(
      `SELECT id FROM notifications
       WHERE user_id = $1
         AND title = $2
         AND read = FALSE
       LIMIT 1`,
      [admin.id, NOTIFICATION_TITLE],
    );

    if (alreadyUnread.rows.length === 0) {
      await NotificationsController.createNotification(
        admin.id,
        NOTIFICATION_TITLE,
        `${heldCount} ${heldCount === 1 ? 'check' : 'checks'} still hold DBS certificate information past the six-month retention date. ${stallSentence(options)}`,
        'compliance',
        NOTIFICATION_LINK,
        // Not a preference. The provider is holding information the rules say must
        // already be gone, so an admin who muted 'compliance' still has to hear it —
        // otherwise the one message this alert exists for is the one that gets
        // filtered out, and being told is the whole point of the alert.
        { ignorePreferences: true },
      );
    }
  }
}

/**
 * Judge the providers that are holding information nobody is going to delete.
 *
 * Every other warning in this module is written by a purge run, which is exactly the
 * hole this closes: a job that has stopped running writes nothing, so its own warnings
 * cannot fire. This is the same judgement made from the outside — the state is read from
 * the data, and the reading does not depend on any run having happened.
 *
 * Only providers with something genuinely past its date are visited, so a healthy
 * platform does no work here, and one provider's failure does not stop the rest.
 */
export async function surfaceStalledRetentionSweep(): Promise<{
  stalled: boolean;
  assessed: number;
  flagged: number;
}> {
  const job = (await readStaleJobs()).find((candidate) => candidate.job_name === DBS_CERTIFICATE_RETENTION_JOB);
  // Not stalled, or stalled and already surfaced by the run that made it stale: either
  // way there is nothing to add.
  if (!job) return { stalled: false, assessed: 0, flagged: 0 };

  const orgs = await migrateQuery(RETENTION_HELD_ORGS_SQL);

  let flagged = 0;
  for (const org of orgs.rows) {
    try {
      await runWithOrgContext(org.id, async () => {
        const heldRow = await query(
          `SELECT COUNT(*)::int AS n ${RETENTION_HELD_FROM}`,
          [org.id],
        );
        const held = Number(heldRow.rows[0]?.n ?? 0);
        if (held > 0) {
          flagged += 1;
          await handleRetentionStall(org.id, held, { sweepStalled: true, sweepAgeMinutes: job.age_minutes });
        }
      });
    } catch (err: any) {
      logger.error({ err: err?.message, orgId: org.id }, 'Could not surface a stalled DBS retention sweep for organisation');
    }
  }

  return { stalled: true, assessed: orgs.rows.length, flagged };
}

async function markRetentionNotificationRead(orgId: string): Promise<void> {
  await query(
    `UPDATE notifications
     SET read = TRUE
     WHERE user_id IN (
       SELECT id FROM users
       WHERE organization_id = $1
         AND role IN ('ORG_ADMIN', 'MANAGER')
         AND status = 'active'
     ) AND title = $2 AND read = FALSE`,
    [orgId, NOTIFICATION_TITLE],
  );
}
