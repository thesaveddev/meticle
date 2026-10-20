/**
 * DBS certificate retention — phase 0 items 4 and 5 of
 * `docs/DBS_INTEGRATION_PLAN.md`.
 *
 * ## What may be kept, and for how long
 *
 * A DBS certificate is not a document a provider may keep. The model policy
 * permits limited *audit metadata* — issue date, certificate type, role,
 * certificate reference and the recruitment decision — and says not to keep a
 * photocopy, image or copy of the certificate contents; the usual retention
 * period is no longer than six months after the recruitment decision. So this
 * module holds the permitted list and deletes it on that timetable, and it holds
 * nothing else: there is no column here for an image, no upload path, and no
 * `documents` row — a check result is a fact about a check, and evidence is
 * something a human uploaded and an approver accepted.
 *
 * ## Two halves of a check
 *
 * `dbs_checks` carries two kinds of fact and the purge separates them:
 *
 *   - the **check** — level, workforce, status and its times, the cost, and the
 *     recruitment decision taken on it. None of that is certificate
 *     information, and all of it survives. A provider asked "was this person
 *     checked, and what did you do about the result?" must be able to answer
 *     after the metadata has gone.
 *   - the **certificate information** — the reference, the issue date, and the
 *     free-text note (because a note is where a certificate number gets
 *     pasted). `purge_after` is when these must go; `certificate_purged_at` is
 *     the stamp that says they did, so an empty reference reads as a retention
 *     decision rather than as missing data.
 *
 * ## When the clock starts
 *
 * Six months from the **recruitment decision**, which is what DBS measures from.
 * Where a manager records a certificate reference before taking the decision,
 * the clock starts that day as an outer bound and re-dates when the decision
 * lands — "only for the purpose obtained, and normally no longer than six
 * months" cuts both ways, and holding a reference indefinitely because nobody
 * typed a decision is not a defensible reading of it.
 *
 * There is no extending the deadline. A write whose deadline has already passed
 * is **refused** with the dates named, because the two alternatives are both
 * wrong: storing it holds information the rules say must be gone, and quietly
 * re-dating it to six months from today would break the ceiling this module
 * exists to enforce. The refusal names the way forward — record the decision the
 * certificate actually belongs to, which for a certificate obtained after an
 * old decision is a re-check decision and runs from its own date.
 *
 * ## Why there is no receipt table
 *
 * The carer-location purge writes one (`carer_location_deletions`) because it
 * deletes *inside other records* and a run record is the only place the fact of
 * a deletion can live. Here the stamp is on the row itself, which is strictly
 * more useful: a manager reading a staff member's DBS record sees that the
 * detail was deleted and when, on the same line as the check it belonged to.
 * `dbs_checks.certificate_purge_due` in `getDbsStats` is the compensating
 * signal — rows past their date that still hold information mean the job is not
 * running, and that count is visible on the compliance screen rather than
 * buried in a log.
 *
 * ## Why the nightly run is not attributed in `audit_logs`
 *
 * `audit_logs` enforces tenancy through its policy — `user_id` → `users` → org —
 * so a row with no user cannot be written for a tenant at all, and the job has
 * no user. The manual run (a real ORG_ADMIN in a real request) is audited
 * normally; the scheduled run leaves the per-row stamp, which is the part an
 * inspector would ask for anyway, and logs its summary.
 */
import { query, transaction, migrateQuery } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';
import { AuditRepository } from '../audit/audit.repository';
import { runWithOrgContext } from '../events/events.org-context';
import { getDbsCheck } from './dbs.service';
import {
  DBS_CERTIFICATE_RETENTION_MONTHS,
  DbsCertificateMetadataInput,
  DbsCheck,
  DbsRecruitmentDecision,
} from './dbs.types';
import { DBS_CERTIFICATE_RETENTION_JOB, handleRetentionStall } from './dbs.certificateRetentionAlert';
import { recordJobCompletion, recordJobStart } from '../../shared/jobs/heartbeat';

/** Whether the purge ran on its nightly sweep or because somebody asked. */
export type DbsPurgeTrigger = 'scheduled' | 'manual';

export interface DbsCertificatePurgeRun {
  organization_id: string;
  trigger: DbsPurgeTrigger;
  /** Checks whose certificate information was deleted. */
  rows_purged: number;
  /** Individual fields emptied — a reference, an issue date, a note. */
  fields_cleared: number;
  completed_at: string;
}

/**
 * The columns a certificate-metadata read needs, with the dates as text.
 *
 * `date` columns come back from `pg` as `Date` instants at local midnight, and
 * every later `toISOString()`/`toLocaleDateString()` is free to move them a day —
 * which for a retention deadline is the difference between deleting on time and
 * holding information a day too long. `CURRENT_DATE` travels with the row so
 * "today" is the provider's today (the session timezone is set from
 * `organizations.timezone`), and it is compared as text.
 */
const CHECK_COLUMNS = `
  dc.*,
  CURRENT_DATE::text AS today,
  dc.disclosure_date::text AS disclosure_date_text,
  dc.recruitment_decision_on::text AS recruitment_decision_on_text,
  dc.renewal_due_on::text AS renewal_due_on_text`;

async function loadCheckRow(orgId: string, checkId: string): Promise<any> {
  const res = await query(
    `SELECT ${CHECK_COLUMNS} FROM dbs_checks dc WHERE dc.id = $1 AND dc.organization_id = $2`,
    [checkId, orgId],
  );
  if (res.rows.length === 0) throw new AppError(404, 'DBS check not found');
  return res.rows[0];
}

/**
 * Record the certificate metadata a manager read off the paper certificate.
 *
 * PATCH semantics: only the keys present in the request change, and an explicit
 * `null` clears a field — a mistyped reference has to be correctable, which is
 * why the route schema keeps `undefined` and `null` distinct.
 *
 * Nothing here accepts a file, a base64 blob or a URL: the permitted set is a
 * reference, a date, a decision, a renewal marker and a note, and to record
 * anything more is exactly what the handling rules forbid. A test asserts the
 * module has no upload path at all.
 */
export async function recordCertificateMetadata(
  orgId: string,
  userId: string,
  checkId: string,
  input: DbsCertificateMetadataInput,
  ipAddress?: string,
): Promise<DbsCheck> {
  const row = await loadCheckRow(orgId, checkId);
  const today: string = row.today;

  if (input.certificateIssuedOn && input.certificateIssuedOn > today) {
    throw new AppError(400, 'The certificate cannot have been issued in the future. Enter the issue date printed on the certificate.');
  }
  if (input.recruitmentDecisionOn && input.recruitmentDecisionOn > today) {
    throw new AppError(400, 'The recruitment decision cannot have been taken in the future. Enter the date the decision was made.');
  }
  if (input.renewalDueOn) {
    const issuedOn = input.certificateIssuedOn !== undefined ? input.certificateIssuedOn : row.disclosure_date_text;
    if (issuedOn && input.renewalDueOn < issuedOn) {
      throw new AppError(400, 'The renewal date cannot fall before the certificate was issued. Enter the date the check should be reconsidered.');
    }
  }

  // The resulting state, which is what the retention clock is computed from.
  const certificateNumber = input.certificateNumber !== undefined ? input.certificateNumber : row.certificate_number;
  const certificateIssuedOn = input.certificateIssuedOn !== undefined ? input.certificateIssuedOn : row.disclosure_date_text;
  const notes = input.notes !== undefined ? input.notes : row.notes;
  const renewalDueOn = input.renewalDueOn !== undefined ? input.renewalDueOn : row.renewal_due_on_text;
  const decision = input.recruitmentDecision !== undefined ? input.recruitmentDecision : row.recruitment_decision;

  // A decision date without a decision to go with it is not something to guess
  // at, and a real decision dated in the past is a correction, not a new one.
  if (input.recruitmentDecisionOn !== undefined && !decision) {
    throw new AppError(400, 'Record which recruitment decision was taken as well as its date — a date on its own does not say what happened.');
  }

  let decisionOn: string | null = row.recruitment_decision_on_text;
  if (input.recruitmentDecision !== undefined) {
    if (!input.recruitmentDecision) {
      decisionOn = null;
    } else if (input.recruitmentDecision === DbsRecruitmentDecision.PENDING) {
      // A decision not yet taken has no date. Keeping the old one would date a
      // decision nobody has made.
      decisionOn = input.recruitmentDecisionOn ?? null;
    } else if (input.recruitmentDecisionOn !== undefined) {
      decisionOn = input.recruitmentDecisionOn;
    } else if (row.recruitment_decision === input.recruitmentDecision && row.recruitment_decision_on_text) {
      decisionOn = row.recruitment_decision_on_text;
    } else {
      // The decision is being taken now, which is the true date for it.
      decisionOn = today;
    }
  } else if (input.recruitmentDecisionOn !== undefined) {
    decisionOn = input.recruitmentDecisionOn;
  }

  const decisionTaken = !!decision && decision !== DbsRecruitmentDecision.PENDING;
  const holdsCertificateInformation = !!(certificateNumber || certificateIssuedOn || notes);

  // The window is six months from the recruitment decision, and where no decision
  // has been taken yet, six months from today as an outer bound. The arithmetic
  // is done by the database, in the provider's own timezone, so the deadline this
  // write validates is the deadline it stores — one computation, not two that can
  // disagree, and no JavaScript month overflow at a month end.
  let purgeAfter: string | null = null;
  if (holdsCertificateInformation) {
    const windowStarts = decisionTaken ? (decisionOn ?? today) : today;
    const deadline = await query(
      `SELECT ($1::date + make_interval(months => $2::int))::date::text AS deadline`,
      [windowStarts, DBS_CERTIFICATE_RETENTION_MONTHS],
    );
    const deadlineDay: string = deadline.rows[0].deadline;

    // Refused rather than stored-and-swept, and refused rather than extended.
    // A deadline in the past means the provider should already have deleted this,
    // and the two alternatives are both worse: storing it holds information the
    // rules say must be gone, and quietly re-dating it to six months from today
    // would break the ceiling the whole module exists to enforce. So the write is
    // refused with the dates named and the way forward — record the decision this
    // certificate actually belongs to (a re-check decision, for instance) and the
    // window runs from that date.
    if (deadlineDay <= today) {
      throw new AppError(
        400,
        `The recruitment decision recorded on ${decisionOn ?? today} puts this certificate's information past its retention date (${deadlineDay}), and certificate information may not be kept longer than ${DBS_CERTIFICATE_RETENTION_MONTHS} months after the decision. Record the decision this certificate belongs to — a re-check of a current certificate, for example — and the window runs from that date.`,
      );
    }

    purgeAfter = deadlineDay;
  }

  const updated = await query(
    `UPDATE dbs_checks
        SET certificate_number = $3::text,
            disclosure_date = $4::date,
            notes = $5::text,
            recruitment_decision = $6::text,
            recruitment_decision_on = $7::date,
            -- A cleared decision clears who took it; a decision that is only being
            -- re-stated keeps the name already on the record.
            recruitment_decision_by = CASE WHEN $6::text IS NULL THEN NULL
                                           ELSE COALESCE($8::uuid, recruitment_decision_by) END,
            renewal_due_on = $9::date,
            purge_after = $10::date,
            -- A previous purge stamp survives a save that holds no certificate
            -- information: correcting a renewal date on a record whose detail has
            -- already been deleted must not erase the evidence that it was deleted.
            certificate_purged_at = CASE
              WHEN $3::text IS NULL AND $4::date IS NULL AND $5::text IS NULL THEN certificate_purged_at
              ELSE NULL END,
            updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING id, purge_after, certificate_purged_at`,      [
        checkId, orgId, certificateNumber, certificateIssuedOn, notes,
        decision ?? null, decisionOn, userId, renewalDueOn, purgeAfter,
      ],
  );

  AuditRepository.log({
    user_id: userId,
    action: 'dbs.check.certificate_recorded',
    entity_type: 'dbs_check',
    entity_id: checkId,
    old_data: {
      certificate_number: row.certificate_number,
      disclosure_date: row.disclosure_date_text,
      recruitment_decision: row.recruitment_decision,
      recruitment_decision_on: row.recruitment_decision_on_text,
      renewal_due_on: row.renewal_due_on_text,
    },
    new_data: {
      certificate_number: certificateNumber,
      disclosure_date: certificateIssuedOn,
      recruitment_decision: decision ?? null,
      recruitment_decision_on: decisionOn,
      renewal_due_on: renewalDueOn,
      purge_after: updated.rows[0]?.purge_after ?? null,
      retention_months: DBS_CERTIFICATE_RETENTION_MONTHS,
    },
    ip_address: ipAddress,
  });

  // Read back through the service, so the response is the same shape the list
  // and the single-check read return — one spelling of a check for the screen.
  return getDbsCheck(orgId, checkId);
}

/**
 * Delete the certificate information on every check whose date has passed.
 *
 * One transaction, because a partial purge is the worst outcome available: some
 * checks deleted and others not, with nothing to say which. The `UPDATE` is its
 * own idempotency guard — `certificate_purged_at IS NULL` re-evaluates under the
 * row lock, so a second run (a retry, or a manual purge racing the sweep)
 * purges nothing and reports nothing, rather than double-counting.
 *
 * `provider_reference` and `application_reference` are deliberately **not**
 * cleared. They identify the *application* rather than the certificate, they are
 * meaningless outside the provider's own account, and phase 2's reconciliation
 * needs them after the result has been acted on and its detail deleted.
 */
export async function runDbsCertificatePurge(options: {
  organizationId: string;
  trigger: DbsPurgeTrigger;
  /** The administrator who asked for a manual run. Absent for the sweep. */
  triggeredBy?: string | null;
}): Promise<DbsCertificatePurgeRun> {
  const { organizationId, trigger, triggeredBy = null } = options;

  const run = await transaction(async (client) => {
    // The count of fields has to come from the CTE, not from RETURNING: RETURNING
    // yields the *new* row, where the fields are already NULL, so a count taken
    // there reports zero cleared while the delete plainly happened.
    const purged = await client.query(
      `WITH due AS (
         SELECT id,
                (certificate_number IS NOT NULL)::int
              + (disclosure_date IS NOT NULL)::int
              + (notes IS NOT NULL)::int AS fields_held
           FROM dbs_checks
          WHERE organization_id = $1
            AND purge_after IS NOT NULL
            AND purge_after <= NOW()
            AND certificate_purged_at IS NULL
            -- Only rows that actually hold something. A check whose deadline has
            -- passed with nothing on it is left unstamped: marking it purged would
            -- report a deletion that never happened, and the reference a pending
            -- application is polled by would be one row away from being cleared.
            AND (certificate_number IS NOT NULL OR disclosure_date IS NOT NULL OR notes IS NOT NULL)
       )
       UPDATE dbs_checks d
          SET certificate_number = NULL,
              disclosure_date = NULL,
              notes = NULL,
              certificate_purged_at = NOW(),
              updated_at = NOW()
         FROM due
        WHERE d.id = due.id
        RETURNING d.id, d.staff_id, due.fields_held`,
      [organizationId],
    );

    const fieldsCleared = purged.rows.reduce((sum, r) => sum + Number(r.fields_held || 0), 0);
    const completedAt = new Date().toISOString();

    // Audited per check, so the trail names the records rather than a total.
    if (trigger === 'manual' && triggeredBy) {
      for (const row of purged.rows) {
        await AuditRepository.log({
          user_id: triggeredBy,
          action: 'dbs.check.certificate_purged',
          entity_type: 'dbs_check',
          entity_id: row.id,
          old_data: { certificate_fields_cleared: Number(row.fields_held || 0) },
          new_data: {
            certificate_information_held: false,
            retention_months: DBS_CERTIFICATE_RETENTION_MONTHS,
            trigger,
          },
        });
      }
    }

    return {
      organization_id: organizationId,
      trigger,
      rows_purged: purged.rows.length,
      fields_cleared: fieldsCleared,
      completed_at: completedAt,
    } satisfies DbsCertificatePurgeRun;
  });

  if (run.rows_purged > 0) {
    logger.info(run, 'DBS certificate information purged under the six-month retention rule');
  }
  return run;
}

/**
 * The nightly sweep.
 *
 * Discovery runs on the superuser connection because a job has no request and
 * therefore no RLS context; everything per-organisation then runs inside
 * `runWithOrgContext`, so the reads and writes are scoped to one provider by the
 * policies rather than by the query text alone. Only providers with something to
 * do are visited — a due backlog or an alert still open — so an organisation with
 * nothing to purge and nothing to clear gets no run and no log line, and the runs
 * that do happen are the ones worth reading.
 *
 * One provider failing does not stop the others: bad data in one tenant must not
 * hold up every other tenant's deletion, and the failure is logged with the
 * organisation that caused it.
 *
 * The order inside each organisation is purge first, then judge: a provider with
 * a backlog that the purge cleared in the same run is compliant, not stalled, and
 * must not be told otherwise. So the stall alert
 * (`certificate.over_retention` on Mission Control) is evaluated from what is
 * *still held after the purge* — zero dismisses any alert left by an earlier run,
 * non-zero keeps it (or raises it). The nudge rides on the purge run so they
 * cannot drift apart: the job that fixed the problem is the same job that decides
 * the problem is gone.
 *
 * Discovery also includes organisations that still have an undismissed
 * over-retention alert. Without that, an org whose backlog was cleared by some
 * other route — a manual purge, a corrected decision date — would keep a warning
 * nobody ever revisits, because the due-rows query would no longer return it.
 */
export async function runScheduledDbsCertificatePurges(): Promise<{
  orgs: number;
  purged: number;
  fieldsCleared: number;
  failed: number;
  flagged: number;
}> {
  // The heartbeat is stamped by the run itself, and stamped even when the run found
  // nothing: "no provider needs a purge tonight" and "this job has not run since
  // Tuesday" look identical from outside, and only one of them is fine. A throw out of
  // the sweep is recorded as a completed-but-failed run, which is a different fact from
  // a job that never started — see `readStaleJobs`. The stamp is best-effort: it can
  // never turn a working sweep into a failing one.
  await recordJobStart(DBS_CERTIFICATE_RETENTION_JOB).catch(() => {});
  try {
    const summary = await runDbsCertificateRetentionSweep();
    await recordJobCompletion(DBS_CERTIFICATE_RETENTION_JOB, summary, null);
    return summary;
  } catch (err: any) {
    await recordJobCompletion(DBS_CERTIFICATE_RETENTION_JOB, null, err?.message || 'DBS certificate retention sweep threw');
    throw err;
  }
}

async function runDbsCertificateRetentionSweep(): Promise<{
  orgs: number;
  purged: number;
  fieldsCleared: number;
  failed: number;
  flagged: number;
}> {
  const orgs = await migrateQuery(
    `SELECT DISTINCT id FROM (
       SELECT organization_id AS id
         FROM dbs_checks
        WHERE purge_after IS NOT NULL
          AND purge_after <= NOW()
          AND certificate_purged_at IS NULL
          AND (certificate_number IS NOT NULL OR disclosure_date IS NOT NULL OR notes IS NOT NULL)
       UNION
       -- A provider whose backlog was cleared by something other than this sweep
       -- still carries the alert; it has to be visited once more to withdraw it.
       SELECT organization_id AS id
         FROM mission_control_alerts
        WHERE alert_type = 'certificate.over_retention'
          AND dismissed = FALSE
     ) due_orgs`,
  );

  const summary = { orgs: orgs.rows.length, purged: 0, fieldsCleared: 0, failed: 0, flagged: 0 };
  for (const org of orgs.rows) {
    try {
      // Do everything for this org in one RLS-scoped context so the purge, the
      // post-purge count and the stall handling (alert + in-app notification) all
      // see the same tenant. `query`, transaction and the patched `pool.query`
      // (used by NotificationsController) all pick up the ALS client inside
      // runWithOrgContext.
      await runWithOrgContext(org.id, async () => {
        // Purge first. Judging the provider before its own purge has run would
        // raise "the nightly purge has not caught up" on every org that simply has
        // something due — the normal case, and the alarm would mean nothing.
        try {
          const run = await runDbsCertificatePurge({ organizationId: org.id, trigger: 'scheduled' });
          summary.purged += run.rows_purged;
          summary.fieldsCleared += run.fields_cleared;
        } catch (err: any) {
          // A purge that cannot run is exactly the stall this module exists to
          // surface, so keep going and let the post-purge count raise the alert
          // instead of leaving the failure in a log nobody reads.
          summary.failed += 1;
          logger.error({ err: err.message, orgId: org.id }, 'DBS certificate retention purge failed for organisation');
        }

        // What is *still* held past its date after the purge. Zero means caught up
        // (so any alert from an earlier run is withdrawn); non-zero means either
        // the purge failed or it genuinely could not clear the row.
        const heldRow = await query(
          `SELECT COUNT(*)::int AS n
           FROM dbs_checks
           WHERE organization_id = $1
             AND purge_after IS NOT NULL
             AND purge_after <= NOW()
             AND certificate_purged_at IS NULL
             AND (certificate_number IS NOT NULL OR disclosure_date IS NOT NULL OR notes IS NOT NULL)`,
          [org.id],
        );
        const heldAfter = Number(heldRow.rows[0]?.n ?? 0);

        if (heldAfter > 0) summary.flagged += 1;
        await handleRetentionStall(org.id, heldAfter);
      });
    } catch (err: any) {
      summary.failed += 1;
      logger.error({ err: err.message, orgId: org.id }, 'DBS certificate retention sweep failed for organisation');
    }
  }
  return summary;
}
