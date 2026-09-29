/**
 * How long a care organisation keeps carer location, and the job that deletes it
 * when that period passes.
 *
 * ## Why this exists
 *
 * The DPIA has said since version 1.0 that no retention period for carer
 * location had been decided, escalated it to the DPO, and told carers to "ask
 * your employer". All of that is still true of the *legal* position, and none of
 * it is a mechanism. A provider whose DPO came back with "90 days" had nowhere
 * to record that answer and nothing that would ever act on it, so positions
 * accumulated on the visit row for as long as the care record lived.
 *
 * This file supplies the mechanism and deliberately not the answer. The period
 * is NULL until a provider sets one, and that is a decision rather than a
 * forgotten default: a shipped number becomes the policy of every provider who
 * never opens the setting, and picking one here would quietly overturn a
 * documented escalation to a DPO on their behalf — the same error as version
 * 1.0 of the DPIA asserting an unevidenced "recommended 8 years".
 *
 * NULL means "this provider has not set a period". Nothing is deleted
 * automatically, and the settings screen says so loudly rather than letting the
 * absence read as a policy.
 *
 * ## The controller is the care organisation, not MeticleCare
 *
 * We are the processor. A provider sets their own period; we delete on their
 * instruction and keep the receipt. That framing is the reason the policy is
 * org-level and never org-defaulted.
 */
import { migratePool } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';

/** What set a run off. Recorded on the receipt so the history explains itself. */
export type LocationPurgeTrigger = 'scheduled' | 'manual' | 'switch_off' | 'policy_set';

export interface LocationRetentionPolicy {
  /** Null means "this provider has not set a period". Not the same as zero. */
  retention_days: number | null;
  configured_at: string | null;
  configured_by: string | null;
  configured_by_name: string | null;
  /** Convenience for the UI's loud unconfigured state. */
  is_configured: boolean;
}

export interface LocationRetentionSummary extends LocationRetentionPolicy {
  /**
   * How much location is actually stored right now.
   *
   * This is the number that makes the unconfigured state hard to ignore. "No
   * retention period set" is abstract; "no retention period set, and you are
   * holding 41,382 positions, the oldest from 14 months ago" is the sentence
   * that gets a DPO's answer. Counting it is also the only way a provider can
   * find out what they are about to delete when they set a period, which is
   * required before they can be said to have chosen anything.
   */
  positions_stored: number;
  oldest_position_at: string | null;
  next_deletion_due_at: string | null;
  tracking_enabled: boolean;
  /** A short sentence the settings screen can show verbatim. */
  unconfigured_warning: string | null;
}

export interface LocationPurgeRun {
  id: string;
  trigger: LocationPurgeTrigger;
  retention_days: number | null;
  cutoff: string;
  visit_rows_updated: number;
  positions_removed: number;
  audit_rows_cleaned: number;
  mobile_check_ins_deleted: number;
  triggered_by: string | null;
  triggered_by_name: string | null;
  started_at: string;
  completed_at: string | null;
}

/**
 * Ten years is a ceiling, not a recommendation.
 *
 * It exists so a typo cannot set a period that outlives the provider. There is
 * deliberately no lower bound: a provider may legitimately want something
 * shorter than a month, and that is their judgement to make rather than ours to
 * second-guess.
 */
export const MAX_LOCATION_RETENTION_DAYS = 3650;

export async function getLocationRetentionPolicy(orgId: string): Promise<LocationRetentionPolicy> {
  const result = await migratePool.query(
    `SELECT o.location_retention_days,
            o.location_retention_configured_at,
            o.location_retention_configured_by,
            COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS configured_by_name
     FROM organizations o
     LEFT JOIN users u ON u.id = o.location_retention_configured_by
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE o.id = $1`,
    [orgId],
  );
  const row = result.rows[0] || {};
  const days = row.location_retention_days == null ? null : Number(row.location_retention_days);
  return {
    retention_days: days,
    configured_at: row.location_retention_configured_at ?? null,
    configured_by: row.location_retention_configured_by ?? null,
    configured_by_name: row.configured_by_name ?? null,
    is_configured: days != null,
  };
}

/**
 * The policy plus what it is currently costing the provider.
 *
 * Counted live rather than from a summary table: this is read on a settings
 * screen, not on a dashboard, and a cached count that drifts from reality is
 * worse than a slower query. It is a scan of an indexed partial range for one
 * organisation, which is not a table scan.
 */
export async function getLocationRetentionSummary(orgId: string): Promise<LocationRetentionSummary> {
  const policy = await getLocationRetentionPolicy(orgId);

  const counts = await migratePool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM homecare_visits
         WHERE organization_id = $1
           AND (check_in_latitude IS NOT NULL OR check_out_latitude IS NOT NULL)) AS visit_positions,
       (SELECT COUNT(*)::int FROM mobile_check_ins
         WHERE organization_id = $1 AND latitude IS NOT NULL) AS mobile_positions,
       (SELECT COUNT(*)::int FROM audit_logs al
         WHERE al.entity_type = 'homecare_visit'
           AND al.action IN ('check_in', 'check_out')
           AND al.new_data ? 'latitude'
           AND (al.new_data->>'latitude') IS NOT NULL
           AND al.entity_id IN (SELECT id FROM homecare_visits WHERE organization_id = $1)) AS audit_positions,
       (SELECT MIN(t.captured_at) FROM (
          SELECT MIN(COALESCE(check_in_at, check_out_at)) AS captured_at
          FROM homecare_visits
          WHERE organization_id = $1
            AND (check_in_latitude IS NOT NULL OR check_out_latitude IS NOT NULL)
          UNION ALL
          SELECT MIN(checked_in_at) FROM mobile_check_ins
          WHERE organization_id = $1 AND latitude IS NOT NULL
        ) t WHERE t.captured_at IS NOT NULL) AS oldest_position_at,
       (SELECT location_tracking_enabled FROM organizations WHERE id = $1) AS tracking_enabled`,
    [orgId],
  );

  const row = counts.rows[0] || {};
  const positionsStored = Number(row.visit_positions || 0) + Number(row.mobile_positions || 0) + Number(row.audit_positions || 0);
  const oldest = row.oldest_position_at ? new Date(row.oldest_position_at).toISOString() : null;

  // A run that is not coming is different from a run that is coming, and the
  // settings screen has to be able to tell the manager which one they are in.
  const nextDue = policy.retention_days == null || !oldest
    ? null
    : new Date(new Date(oldest).getTime() + policy.retention_days * 86400000).toISOString();

  return {
    ...policy,
    positions_stored: positionsStored,
    oldest_position_at: oldest,
    next_deletion_due_at: nextDue,
    tracking_enabled: row.tracking_enabled !== false,
    unconfigured_warning: policy.is_configured
      ? null
      : buildUnconfiguredWarning(positionsStored, oldest, row.tracking_enabled !== false),
  };
}

function buildUnconfiguredWarning(positionsStored: number, oldest: string | null, trackingEnabled: boolean): string {
  if (trackingEnabled) {
    return `No retention period set. ${positionsStored.toLocaleString('en-GB')} carer positions are being held with no deletion date. The oldest is from ${oldest ? formatDate(oldest) : 'an unknown date'}. Set a period or switch collection off.`;
  }
  // Collection already off, so the exposure is bounded but still unbounded in
  // time, and the fix is a one-off purge rather than a standing policy.
  return `No retention period set. Collection is off, so nothing new is being collected, but ${positionsStored.toLocaleString('en-GB')} positions collected before you switched it off are still held. Set a period, or run a one-off deletion.`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Records a provider's chosen period.
 *
 * Shortening the period takes effect on the next nightly run rather than
 * immediately, except that the controller also offers a one-off run. That is
 * deliberate: a provider who has just typed "30" instead of "300" has almost
 * certainly made a mistake, and an instant purge of a decade of positions on
 * that keystroke is not a consequence anyone agreed to. The settings screen
 * says how many positions the new period would remove before anything is
 * deleted, and the run is a separate, named action.
 */
export async function setLocationRetentionPolicy(
  orgId: string,
  userId: string,
  retentionDays: number,
): Promise<LocationRetentionPolicy> {
  if (!Number.isInteger(retentionDays) || retentionDays <= 0 || retentionDays > MAX_LOCATION_RETENTION_DAYS) {
    throw new AppError(400, `Retention period must be a whole number of days between 1 and ${MAX_LOCATION_RETENTION_DAYS}.`);
  }
  await migratePool.query(
    `UPDATE organizations
     SET location_retention_days = $1,
         location_retention_configured_at = NOW(),
         location_retention_configured_by = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [retentionDays, userId, orgId],
  );
  return getLocationRetentionPolicy(orgId);
}

/**
 * Clears the period, returning the provider to "we have not decided".
 *
 * Allowed, and not hidden behind a confirmation dialog about losing data,
 * because it deletes nothing — it only stops the nightly job. Someone who wants
 * to argue that their period should never have been set needs to be able to
 * undo it, and the thing being undone is a setting.
 */
export async function clearLocationRetentionPolicy(orgId: string): Promise<LocationRetentionPolicy> {
  await migratePool.query(
    `UPDATE organizations
     SET location_retention_days = NULL,
         location_retention_configured_at = NULL,
         location_retention_configured_by = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [orgId],
  );
  return getLocationRetentionPolicy(orgId);
}

/**
 * Deletes carer location for one organisation and writes the receipt.
 *
 * ## Why this uses the migration pool
 *
 * Every other read in the homecare module goes through the request-scoped,
 * RLS-limited `query`, and the purge must not. This runs from a nightly job
 * with no request and therefore no `app.current_org_id`; under RLS that is a
 * context in which the org's rows are invisible, and a purge that can see
 * nothing would report "0 positions removed" and be believed. The org id is
 * passed explicitly in every statement instead, and each statement filters on
 * it, so the pool being wide open is the reason for care rather than a licence.
 *
 * ## Why one transaction
 *
 * A partial purge is the worst outcome available here: some copies of a
 * position deleted and others not, leaving a record that exists in the audit
 * log but not on the visit and nothing to say why. All four statements commit or
 * none do.
 */
export async function runLocationPurge(options: {
  organizationId: string;
  trigger: LocationPurgeTrigger;
  /** Null for a one-off purge with no standing policy behind it. */
  retentionDays: number | null;
  triggeredBy?: string | null;
}): Promise<LocationPurgeRun> {
  const { organizationId, trigger, retentionDays, triggeredBy = null } = options;

  if (retentionDays != null && (!Number.isInteger(retentionDays) || retentionDays <= 0)) {
    throw new AppError(400, 'A retention run needs a whole number of days, or none at all for a one-off deletion.');
  }

  // Null retention means "delete everything held", which is what a one-off
  // switch-off purge means. The cutoff column is NOT NULL, so a full deletion
  // is expressed as "now" — every existing position was captured before now.
  const cutoff = retentionDays == null
    ? new Date()
    : new Date(Date.now() - retentionDays * 86400000);

  const client = await migratePool.connect();
  try {
    await client.query('BEGIN');

    // 1. The visit record. This is the copy the provider believes is the whole
    //    story, and it is the only one with an attendance consequence — hence
    //    the stamp saying a deletion happened, rather than letting a manager
    //    read "no GPS" on an eight-month-old visit as a malfunction that day.
    // The position count is computed in a CTE rather than in RETURNING, and
    // that is not a style choice. RETURNING in an UPDATE yields the *new* row,
    // so counting `check_in_latitude IS NOT NULL` there counts zeros — the
    // deletion works and the receipt claims nothing was removed. Which is the
    // worst possible failure for this feature: it looks like a system that has
    // nothing to delete.
    const visits = await client.query(
      `WITH candidates AS (
         SELECT id,
                (CASE WHEN check_in_latitude IS NOT NULL THEN 1 ELSE 0 END)
              + (CASE WHEN check_out_latitude IS NOT NULL THEN 1 ELSE 0 END) AS positions
         FROM homecare_visits
         WHERE organization_id = $1
           AND location_purged_at IS NULL
           AND (check_in_latitude IS NOT NULL OR check_out_latitude IS NOT NULL)
           AND COALESCE(check_in_at, check_out_at, created_at) < $2
         FOR UPDATE
       )
       UPDATE homecare_visits v
       SET check_in_latitude = NULL,
           check_in_longitude = NULL,
           check_in_accuracy_meters = NULL,
           check_out_latitude = NULL,
           check_out_longitude = NULL,
           check_out_accuracy_meters = NULL,
           location_purged_at = NOW(),
           updated_at = NOW()
       FROM candidates c
       WHERE v.id = c.id
       RETURNING c.id, c.positions`,
      [organizationId, cutoff],
    );

    const visitPositions = visits.rows.reduce((sum, row) => sum + Number(row.positions || 0), 0);
    const visitRows = visits.rows.length;

    // 2. The audit log. Coordinates live here too, in the new_data JSONB of
    //    check_in and check_out rows, and this is the copy that had no
    //    retention rule at all. The keys are stripped rather than the row
    //    deleted: the record that a check-in happened is not the record of
    //    where the carer was, and deleting the whole row would also delete the
    //    evidence that the attendance happened at all.
    //
    //    Scoped by entity_id rather than by user_id, because a visit id names
    //    the organisation unambiguously while a worker may have been in more
    //    than one over the years, and this is a deletion — over-reaching is the
    //    error that matters here.
    const audit = await client.query(
      `UPDATE audit_logs
       SET new_data = new_data - 'latitude' - 'longitude' - 'accuracy_meters' - 'accuracy'
       WHERE entity_type = 'homecare_visit'
         AND action IN ('check_in', 'check_out')
         AND new_data ? 'latitude'
         AND (new_data->>'latitude') IS NOT NULL
         AND created_at < $1
         AND entity_id IN (SELECT id FROM homecare_visits WHERE organization_id = $2)
       RETURNING id`,
      [cutoff, organizationId],
    );

    // 3. SecureVisit check-ins. Deleted outright rather than blanked, because
    //    the row is nothing but a position and a timestamp — there is no
    //    attendance meaning to preserve. Rows that carry no position because
    //    the worker declined are left alone; they are already compliant and
    //    deleting them would destroy the record that they checked in.
    const mobile = await client.query(
      `DELETE FROM mobile_check_ins
       WHERE organization_id = $1
         AND latitude IS NOT NULL
         AND checked_in_at < $2`,
      [organizationId, cutoff],
    );

    // 4. The receipt, written inside the same transaction so that a receipt
    //    cannot exist without the deletion it describes, or the reverse.
    // A check-in position is stored twice — on the visit and in the audit log —
    // so counting both would report two positions for one carer at one place at
    // one moment. The receipt counts the positions, and reports the audit rows
    // cleaned separately as what it is: copies of positions already counted.
    const receipt = await client.query(
      `INSERT INTO carer_location_deletions
         (organization_id, trigger, retention_days, cutoff, visit_rows_updated, positions_removed,
          audit_rows_cleaned, mobile_check_ins_deleted, triggered_by, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        organizationId,
        trigger,
        retentionDays,
        cutoff,
        visitRows,
        visitPositions + mobile.rowCount,
        audit.rowCount,
        mobile.rowCount,
        triggeredBy,
      ],
    );

    // The run id is stamped afterwards, in the same transaction, against the
    // exact ids the update above returned. The column carries no foreign key —
    // it is a link to a receipt that a later purge might itself be explaining —
    // so the link has to be made by the run that did the deleting rather than
    // trusted to arrive.
    if (visits.rows.length > 0) {
      await client.query(
        'UPDATE homecare_visits SET location_purged_run_id = $1 WHERE id = ANY($2::uuid[])',
        [receipt.rows[0].id, visits.rows.map((row) => row.id)],
      );
    }

    await client.query('COMMIT');

    const run = receipt.rows[0];
    logger.info(
      {
        organizationId,
        trigger,
        retentionDays,
        visitRows,
        auditRows: audit.rowCount,
        mobileRows: mobile.rowCount,
        runId: run.id,
      },
      'Carer location purge complete',
    );
    return toPurgeRun(run, null);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function toPurgeRun(row: any, triggeredByName: string | null): LocationPurgeRun {
  return {
    id: row.id,
    trigger: row.trigger,
    retention_days: row.retention_days == null ? null : Number(row.retention_days),
    cutoff: new Date(row.cutoff).toISOString(),
    visit_rows_updated: Number(row.visit_rows_updated || 0),
    positions_removed: Number(row.positions_removed || 0),
    audit_rows_cleaned: Number(row.audit_rows_cleaned || 0),
    mobile_check_ins_deleted: Number(row.mobile_check_ins_deleted || 0),
    triggered_by: row.triggered_by ?? null,
    triggered_by_name: triggeredByName,
    started_at: new Date(row.started_at).toISOString(),
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

/**
 * The purge history.
 *
 * Manager-readable through RLS, so it goes through the request-scoped `query`
 * and the policy on the table does the scoping. Runs that deleted nothing are
 * included and are not noise: "the nightly job ran and found 0 positions past
 * the cutoff" is the evidence that the rule is holding, and omitting those
 * would make a headline figure of "we have deleted 4,096 positions"
 * impossible to reconcile against "how many were there".
 */
export async function listLocationPurgeRuns(limit = 25): Promise<LocationPurgeRun[]> {
  const { query } = await import('../../shared/database');
  const result = await query(
    `SELECT d.*, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS triggered_by_name
     FROM carer_location_deletions d
     LEFT JOIN users u ON u.id = d.triggered_by
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     ORDER BY d.started_at DESC
     LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 25, 1), 200)],
  );
  return result.rows.map((row) => toPurgeRun(row, row.triggered_by_name ?? null));
}

/**
 * The nightly job.
 *
 * Every organisation that has set a period, one run each — including the ones
 * whose run deletes nothing, which is what makes the history reconcilable. A
 * provider with no period set is skipped silently: there is no run to perform,
 * and writing a receipt every night for an organisation that has never decided
 * would bury the runs that matter under thousands of empty ones.
 *
 * One organisation failing does not stop the others. A provider's bad data
 * would otherwise hold up every other provider's deletion, and the failure is
 * logged rather than swallowed.
 */
export async function runScheduledLocationPurges(): Promise<{ orgs: number; runs: number; positionsRemoved: number; failed: number }> {
  const orgs = await migratePool.query(
    'SELECT id, location_retention_days FROM organizations WHERE location_retention_days IS NOT NULL',
  );
  const summary = { orgs: orgs.rows.length, runs: 0, positionsRemoved: 0, failed: 0 };
  for (const org of orgs.rows) {
    try {
      const run = await runLocationPurge({
        organizationId: org.id,
        trigger: 'scheduled',
        retentionDays: Number(org.location_retention_days),
      });
      summary.runs += 1;
      summary.positionsRemoved += run.positions_removed;
    } catch (err) {
      summary.failed += 1;
      logger.error({ err, organizationId: org.id }, 'Scheduled carer location purge failed for organisation');
    }
  }
  if (summary.runs > 0) {
    logger.info(summary, 'Scheduled carer location purge complete');
  }
  return summary;
}
