/**
 * Handover due at shift end — the sweep behind the last open item in blueprint §9.9.
 *
 * A supported-living shift ends in a handover, and §9.2 made that a record: what
 * happened, what is outstanding, who is aware, written by the staff on the shift and
 * acknowledged by name. What nothing did was notice a shift that ended *without* one.
 * The handover is the transfer of responsibility for the people in the setting, so a
 * shift that ends with no handover recorded is the moment that transfer silently did
 * not happen — and it was invisible to everyone except a manager who happened to open
 * the rota and read it.
 *
 * This sweep looks for exactly that state and raises `shift.handover_due`: a shift
 * whose rota end time has passed, with staff on it, and no handover. The consumer
 * turns it into one notification for each of those staff; Mission Control keeps the
 * manager-facing copy.
 *
 * Five decisions, each of which is a way this could have been a nuisance instead:
 *
 *  * **A grace period after the end time.** The rota's end time is not the moment a
 *    worker stops working — they finish up, lock up and then write the sentence.
 *    Nagging at the minute the shift was due to end would teach people to ignore it,
 *    so nothing is raised until `HANDOVER_GRACE_MINUTES` have passed.
 *  * **A bounded lookback.** The first run after a deploy would otherwise raise a
 *    nudge for every historical shift with no handover, which is thousands of
 *    notifications about work nobody can still do. A shift that ended more than
 *    `HANDOVER_LOOKBACK_HOURS` ago is left alone; the daily shift audit is where
 *    history is read.
 *  * **The roster is the audience, so there has to be one.** The join on
 *    `shift_assignments` is the audience test rather than an optimisation: a shift
 *    that ended with nobody rostered has nobody to hand over to and nobody to tell,
 *    and an unstaffed shift is already the `shift.unfilled` family's business.
 *  * **Once per shift.** `shifts.handover_due_notified_at` (migration 154) is the
 *    marker, the same one-shot shape as `start_notification_sent_at` and
 *    `unclaimed_notified_at` on the same table. It is stamped *after* the event is
 *    recorded, never before: a crash in between nudges twice, which is the direction
 *    to fail in, where the other order loses the nudge entirely.
 *  * **An org context, not a bare query.** Discovery runs on the superuser pool and
 *    every organisation's work runs inside `runWithOrgContext`, because the app role
 *    is subject to RLS and a background job has no session variables. This is not
 *    theoretical: measured against this database as `meticle_app`, `SELECT … FROM
 *    shifts` with no session context returns zero rows, so a sweep written like a
 *    request would find nothing and say nothing.
 */
import { migrateQuery, query } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { runWithOrgContext } from '../events/events.org-context';
import { publishShiftHandoverDueEvent, ShiftHandoverDueRecipient } from './scheduling.events';

/**
 * How long after its end time a shift is left alone before anyone is nudged.
 *
 * Exported because Mission Control's handover-gap view is the same judgement seen
 * from the other side: if the two disagreed, a shift would appear as a missing
 * handover on the compliance screen while the sweep still considered it too early
 * to mention, and a manager would chase work that was not yet late.
 */
export const HANDOVER_GRACE_MINUTES = 30;

/** How far back a shift is still worth telling anyone about. */
export const HANDOVER_LOOKBACK_HOURS = 24;

/** A ceiling on one organisation's work in a single run. */
const MAX_SHIFTS_PER_ORG = 100;

/**
 * Shifts that have ended with no handover and staff on them.
 *
 * One predicate, used twice: by the superuser discovery query (which organisations
 * to visit) and by the org-scoped read (which shifts). Written once because the two
 * drifting is silent in both directions — an org discovery visits but the read
 * cannot see is a wasted round trip, and a shift the read would return but discovery
 * skips is a handover nobody is ever told about.
 */
const DUE_SHIFTS_FROM = `
  FROM shifts s
  JOIN locations l ON l.id = s.location_id
  JOIN shift_assignments sa ON sa.shift_id = s.id AND sa.status <> 'rejected'
  JOIN staff_profiles sp ON sp.id = sa.staff_id
  JOIN users u ON u.id = sp.user_id AND u.status = 'active'
  LEFT JOIN shift_handovers h ON h.shift_id = s.id
  WHERE s.status <> 'cancelled'
    AND h.id IS NULL
    AND s.handover_due_notified_at IS NULL
    AND s.end_time <= CURRENT_TIMESTAMP - interval '${HANDOVER_GRACE_MINUTES} minutes'
    AND s.end_time > CURRENT_TIMESTAMP - interval '${HANDOVER_LOOKBACK_HOURS} hours'`;

interface DueShiftRow {
  id: string;
  shift_type: string | null;
  start_time: Date;
  end_time: Date;
  location_id: string;
  location_name: string;
  minutes_since_end: number | string;
  rostered: ShiftHandoverDueRecipient[];
}

export interface HandoverDueSweepResult {
  /** Organisations that had at least one shift due a nudge. */
  orgs: number;
  /** Events raised, one per shift. */
  published: number;
  /** Organisations whose sweep threw; the run continues for the others. */
  failed: number;
}

/** The sweep's own read, scoped to one organisation by the caller's RLS context. */
async function findDueShifts(orgId: string): Promise<DueShiftRow[]> {
  const result = await query(
    `SELECT s.id, s.shift_type, s.start_time, s.end_time,
            l.id AS location_id, l.name AS location_name,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.end_time))::int / 60 AS minutes_since_end,
            JSON_AGG(JSON_BUILD_OBJECT('user_id', sp.user_id, 'name', TRIM(sp.first_name || ' ' || sp.last_name))
                     ORDER BY sp.first_name, sp.last_name) AS rostered
     ${DUE_SHIFTS_FROM}
       AND l.organization_id = $1
     GROUP BY s.id, s.shift_type, s.start_time, s.end_time, l.id, l.name
     ORDER BY s.end_time
     LIMIT $2`,
    [orgId, MAX_SHIFTS_PER_ORG],
  );
  return result.rows as DueShiftRow[];
}

/**
 * Raise the events for one organisation, then mark the shifts they were about.
 *
 * A shift whose event fails to publish is not marked, so the next run tries again
 * rather than dropping it — and one bad shift does not stop the rest of the rota.
 */
async function sweepOrg(orgId: string): Promise<number> {
  const due = await findDueShifts(orgId);
  if (due.length === 0) return 0;

  const notified: string[] = [];
  for (const row of due) {
    try {
      await publishShiftHandoverDueEvent({
        organizationId: orgId,
        shiftId: row.id,
        locationId: row.location_id,
        locationName: row.location_name,
        shiftType: row.shift_type || 'day',
        startTime: new Date(row.start_time).toISOString(),
        endTime: new Date(row.end_time).toISOString(),
        // The rota grid opens on the shift's own start day — the same week the
        // handover-recorded event and the claim-reminder email use, so every link to
        // a shift in this product agrees about which grid it is on.
        week: new Date(row.start_time).toISOString().slice(0, 10),
        minutesSinceEnd: Number(row.minutes_since_end),
        rostered: Array.isArray(row.rostered) ? row.rostered : [],
      });
      notified.push(row.id);
    } catch (err: any) {
      logger.error(
        { err: err?.message, orgId, shiftId: row.id },
        'Could not raise shift.handover_due; the shift stays unnotified for the next run',
      );
    }
  }

  if (notified.length > 0) {
    await query(
      `UPDATE shifts SET handover_due_notified_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])`,
      [notified],
    );
  }
  return notified.length;
}

/**
 * Sweep every organisation for shifts that ended with no handover recorded.
 *
 * Discovery is a single read on the superuser pool — a background job has no RLS
 * session — and everything org-specific then runs inside `runWithOrgContext`, so the
 * read and the mark are scoped to one provider at a time. One provider failing does
 * not stop the others, and a failure is logged rather than thrown at the timer.
 */
export async function runHandoverDueSweep(): Promise<HandoverDueSweepResult> {
  const orgs = await migrateQuery(`SELECT DISTINCT l.organization_id AS id ${DUE_SHIFTS_FROM}`);

  let published = 0;
  let failed = 0;
  let visited = 0;
  for (const org of orgs.rows) {
    visited += 1;
    try {
      published += await runWithOrgContext(org.id, () => sweepOrg(org.id));
    } catch (err: any) {
      failed += 1;
      logger.error({ err: err?.message, orgId: org.id }, 'Handover-due sweep failed for organisation');
    }
  }

  return { orgs: visited, published, failed };
}
