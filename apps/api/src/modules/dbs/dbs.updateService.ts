/**
 * DBS Update Service re-checks — phase 3 of `docs/DBS_INTEGRATION_PLAN.md`.
 *
 * The only DBS facility a provider can use without becoming an Umbrella Body is
 * the Update Service: a free status check against the individual's own
 * subscription. It is lawful only when the individual has consented, the
 * provider is entitled to the *same* level and workforce as the certificate it
 * holds, the original paper certificate has been seen and identity has been
 * verified — so those things are recorded here rather than assumed, and a check
 * cannot be recorded without them.
 *
 * What this deliberately does not do: submit, apply, or obtain anything. There
 * is no provider call in this file, no `dbs_checks` row and no `documents` row.
 * A status check records what the person performing it was told; the certificate
 * stays a document a human uploaded, exactly as phase 0 left it.
 *
 * The other half of the workflow is the renewal marker. DBS does not tell
 * providers when a certificate changes, so a re-check that comes back `changed`
 * is the trigger for obtaining a new certificate — `recordUpdateServiceCheck`
 * raises that marker and notifies, and `completeRenewal` clears it when the new
 * certificate's details are recorded.
 *
 * Dates are returned as `YYYY-MM-DD` text rather than as `pg`'s parsed `Date`.
 * A `date` column parsed into a `Date` is an instant at local midnight, and every
 * later `toISOString()` or `toLocaleDateString()` is free to move it a day; the
 * due dates below are the whole point of the feature, so they travel as the day
 * they are.
 */
import { query, migrateQuery } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { runWithOrgContext } from '../events/events.org-context';
import { requireDbsApplicableNation } from './dbs.service';
import { micaRecordPath } from '@meticle/shared';
import {
  DbsLevel,
  DbsWorkforce,
  UpdateServiceCheckOutcome,
  UpdateServiceConsentMethod,
  UpdateServiceDueState,
  UpdateServiceIdentityMethod,
  UpdateServiceStats,
  UpdateServiceStatus,
  UpdateServiceSubscription,
  UpdateServiceSubscriptionDetail,
} from './dbs.types';

/**
 * Fallback warning window, in days, for providers that have never set one.
 *
 * The same 14 days the compliance reminders use and the same column
 * (`organizations.compliance_warning_days`), so "due soon" means the same thing
 * in the DBS panel as it does on the rest of the compliance page.
 */
export const UPDATE_SERVICE_WARNING_FALLBACK_DAYS = 14;

/** How long a subscription that could not be checked stays quiet before nagging again. */
const UNABLE_TO_CHECK_RETRY_DAYS = 1;

/**
 * Where a reminder opens.
 *
 * `/staff/<userId>?tab=compliance&record=<subscriptionId>` — a `staff-compliance`
 * `micaRecordPath`, which is the same staff-record target the web's Update Service
 * rows and the compliance document and training reminders use. One target, so the
 * bell, the inbox and the screen cannot send a manager to three different places for
 * one subscription.
 *
 * Two details are load-bearing, and both were wrong until they were not:
 *
 *  * **`staffUserId` is the *user* id.** `/staff/:userId` reads `:userId` and
 *    `GET /staff/:userId` answers 404 for a `staff_profiles` id. This sweep used to
 *    interpolate `s.staff_id` — the profile id — so every Update Service reminder
 *    opened a page that does not resolve, which looks exactly like a reminder nobody
 *    acted on.
 *  * **The record is the subscription, not a document.** An Update Service
 *    subscription is not a document, so the staff profile's document lookup cannot
 *    open it; `StaffUpdateServicePanel` reads this same id and opens the subscription
 *    itself, which is where the record is read and where a manager sees what is due.
 *
 * The `?tab=` and `?record=` contract resolves in `staffRoutes.ts` because a trailing
 * optional path segment (`/?` optional on the route, greedy on the router) means
 * `/staff/:userId?tab=compliance` is parsed as path `/staff/:userId` with query
 * `tab=compliance`, the same contract every other `?tab=` on the staff profile uses.
 */
const staffCompliancePath = (subscriptionId: string, staffUserId: string) =>
  micaRecordPath({ kind: 'staff-compliance', id: subscriptionId, staffId: staffUserId });

interface SubscribeInput {
  staffId: string;
  level: DbsLevel;
  workforce: DbsWorkforce;
  updateServiceId: string;
  certificateReference?: string | null;
  certificateIssuedOn?: string | null;
  consentGivenOn?: string | null;
  consentMethod: UpdateServiceConsentMethod;
  paperCertificateSeenOn: string;
  identityVerifiedOn: string;
  identityMethod: UpdateServiceIdentityMethod;
  checkIntervalMonths?: number;
  nextCheckDueOn?: string | null;
}

interface RecordCheckInput {
  checkedOn?: string | null;
  outcome: UpdateServiceCheckOutcome;
  level: DbsLevel;
  workforce: DbsWorkforce;
  notes?: string | null;
  nextCheckDueOn?: string | null;
}

interface RenewalMarkerInput {
  renewalDueOn: string | null;
  note?: string | null;
}

interface CompleteRenewalInput {
  certificateReference: string;
  certificateIssuedOn: string;
  nextCheckDueOn?: string | null;
}

/**
 * The subscription columns every read shares, with the derived state computed in
 * the database.
 *
 * `days_until_check` is arithmetic on `CURRENT_DATE` inside the query on purpose:
 * the session timezone is set per request from `organizations.timezone`
 * (migration 149), and for the sweep by `runWithOrgContext`, so "due today" means
 * the provider's today. Doing that subtraction in JavaScript against a `Date`
 * would reintroduce exactly the off-by-one-day the timezone work removed.
 */
const SUBSCRIPTION_COLUMNS = `
  s.id, s.organization_id, s.staff_id, s.level, s.workforce, s.update_service_id,
  s.certificate_reference, s.certificate_issued_on::text AS certificate_issued_on,
  s.consent_given_on::text AS consent_given_on, s.consent_method, s.consent_recorded_by,
  -- Who recorded the consent, by name: "consent was recorded" is a claim that has
  -- to name somebody when an inspector asks, and the id alone only moves the
  -- question to another screen.
  (SELECT TRIM(csp.first_name || ' ' || csp.last_name)
     FROM staff_profiles csp WHERE csp.user_id = s.consent_recorded_by) AS consent_recorded_by_name,
  s.consent_withdrawn_on::text AS consent_withdrawn_on, s.consent_withdrawn_reason,
  s.paper_certificate_seen_on::text AS paper_certificate_seen_on,
  s.identity_verified_on::text AS identity_verified_on, s.identity_method,
  s.check_interval_months, s.next_check_due_on::text AS next_check_due_on,
  s.last_checked_on::text AS last_checked_on, s.renewal_due_on::text AS renewal_due_on,
  s.renewal_note, s.renewal_completed_on::text AS renewal_completed_on,
  s.status, s.created_by, s.created_at, s.updated_at,
  sp.user_id AS staff_user_id,
  TRIM(sp.first_name || ' ' || sp.last_name) AS staff_name,
  u.email AS staff_email,
  (s.next_check_due_on - CURRENT_DATE) AS days_until_check,
  (s.renewal_due_on - CURRENT_DATE) AS days_until_renewal,
  (SELECT COUNT(*)::int FROM dbs_update_service_checks c WHERE c.subscription_id = s.id) AS checks_recorded`;

const SUBSCRIPTION_FROM = `
  FROM dbs_update_service_subscriptions s
  JOIN staff_profiles sp ON sp.id = s.staff_id
  JOIN users u ON u.id = sp.user_id`;

/**
 * The provider's warning window; the compliance column, so one setting covers
 * both the document reminders and the DBS re-check.
 *
 * Deliberately not cached, unlike `ComplianceNotificationService`'s copy: this is
 * one indexed read of one row, and a cache is how a changed window keeps being
 * answered with yesterday's value for the life of the process.
 *
 * The catch is a safety net, not a fallback anyone should rely on — the column is
 * created by migration 151 (and was missing everywhere before it, which the rest
 * of the compliance reminders swallowed in silence). The catch logs rather than
 * defaulting quietly, so a database without the column says so.
 */
async function warningDaysFor(orgId: string): Promise<number> {
  try {
    const res = await query('SELECT compliance_warning_days FROM organizations WHERE id = $1', [orgId]);
    return Number(res.rows[0]?.compliance_warning_days ?? UPDATE_SERVICE_WARNING_FALLBACK_DAYS);
  } catch (err: any) {
    logger.error(
      { err: err.message, orgId },
      'Could not read organizations.compliance_warning_days — using the default warning window',
    );
    return UPDATE_SERVICE_WARNING_FALLBACK_DAYS;
  }
}

/**
 * Resolve a row's urgency.
 *
 * `not_active` rather than `overdue` for a withdrawn subscription: there is no
 * check to do, and colouring a consent decision as a compliance failure would
 * invite a manager to undo it.
 */
export function resolveDueState(
  row: { status: string; days_until_check: number | string | null },
  warningDays: number,
): UpdateServiceDueState {
  if (row.status !== UpdateServiceStatus.ACTIVE) return 'not_active';
  const days = row.days_until_check === null || row.days_until_check === undefined
    ? null
    : Number(row.days_until_check);
  if (days === null || Number.isNaN(days)) return 'current';
  if (days < 0) return 'overdue';
  if (days <= warningDays) return 'due_soon';
  return 'current';
}

type SubscriptionRow = { status: string; days_until_check: number | string | null };

function decorate(row: any, warningDays: number): UpdateServiceSubscription {
  return { ...row, due_state: resolveDueState(row as SubscriptionRow, warningDays) };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listUpdateServiceSubscriptions(
  orgId: string,
  filters: { staffId?: string; status?: string; dueState?: string } = {},
): Promise<UpdateServiceSubscription[]> {
  const params: any[] = [orgId];
  let where = 'WHERE s.organization_id = $1';
  if (filters.staffId) {
    params.push(filters.staffId);
    where += ` AND s.staff_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    where += ` AND s.status = $${params.length}`;
  }

  const res = await query(
    `SELECT ${SUBSCRIPTION_COLUMNS} ${SUBSCRIPTION_FROM} ${where} ORDER BY s.next_check_due_on ASC, staff_name ASC`,
    params,
  );
  const warningDays = await warningDaysFor(orgId);
  const rows = res.rows.map((row: any) => decorate(row, warningDays));

  // The due-state filter is applied here rather than in SQL because the state
  // depends on the provider's window, which comes from a second table. Repeating
  // that window inside the query would let the two answers drift.
  return filters.dueState ? rows.filter((r) => r.due_state === filters.dueState) : rows;
}

/** The checks recorded against one subscription, newest first. */
async function checksFor(orgId: string, subscriptionId: string) {
  const res = await query(
    `SELECT c.id, c.organization_id, c.subscription_id, c.checked_on::text AS checked_on,
            c.outcome, c.level, c.workforce, c.checked_by, c.notes,
            c.next_check_due_on::text AS next_check_due_on, c.created_at,
            TRIM(sp.first_name || ' ' || sp.last_name) AS checked_by_name
     FROM dbs_update_service_checks c
     LEFT JOIN users u ON u.id = c.checked_by
     LEFT JOIN staff_profiles sp ON sp.user_id = u.id
     WHERE c.organization_id = $1 AND c.subscription_id = $2
     ORDER BY c.checked_on DESC, c.created_at DESC`,
    [orgId, subscriptionId],
  );
  return res.rows;
}

async function getOne(orgId: string, id: string): Promise<UpdateServiceSubscription> {
  const res = await query(
    `SELECT ${SUBSCRIPTION_COLUMNS} ${SUBSCRIPTION_FROM} WHERE s.organization_id = $1 AND s.id = $2`,
    [orgId, id],
  );
  if (res.rows.length === 0) throw new AppError(404, 'Update Service subscription not found');
  return decorate(res.rows[0], await warningDaysFor(orgId));
}

export async function getUpdateServiceSubscription(
  orgId: string,
  id: string,
): Promise<UpdateServiceSubscriptionDetail> {
  const subscription = await getOne(orgId, id);
  return { ...subscription, checks: await checksFor(orgId, id) };
}

export async function getUpdateServiceStats(orgId: string): Promise<UpdateServiceStats> {
  const warningDays = await warningDaysFor(orgId);
  const res = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE status = 'withdrawn')::int AS withdrawn,
       COUNT(*) FILTER (WHERE status = 'active' AND next_check_due_on < CURRENT_DATE)::int AS overdue,
       COUNT(*) FILTER (WHERE status = 'active' AND next_check_due_on >= CURRENT_DATE
                          AND next_check_due_on <= CURRENT_DATE + ($2 || ' days')::interval)::int AS due_soon,
       COUNT(*) FILTER (WHERE renewal_due_on IS NOT NULL AND renewal_due_on <= CURRENT_DATE)::int AS renewals_due,
       (SELECT COUNT(*)::int FROM dbs_update_service_checks c
         WHERE c.organization_id = $1 AND c.checked_on >= CURRENT_DATE - 30) AS checks_last_30_days,
       (SELECT COUNT(*)::int FROM dbs_update_service_checks c
         WHERE c.organization_id = $1 AND c.outcome = 'changed') AS changes_found
     FROM dbs_update_service_subscriptions
     WHERE organization_id = $1`,
    [orgId, warningDays],
  );
  return res.rows[0] as UpdateServiceStats;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Record the individual's subscription and the consent that makes a check lawful.
 *
 * Refused for a worker the DBS does not apply to, and refused when an active
 * subscription already exists for them — a second one would be a second consent
 * question for the same certificate, and would let two due dates exist for one
 * person. A withdrawn subscription does not block a new one: consenting again
 * after withdrawing is a legitimate thing to do, and the record of both stays.
 */
export async function subscribeToUpdateService(
  orgId: string,
  userId: string,
  input: SubscribeInput,
  ipAddress?: string,
): Promise<UpdateServiceSubscription> {
  const staff = await query(
    `SELECT sp.id FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = $1 AND u.organization_id = $2`,
    [input.staffId, orgId],
  );
  if (staff.rows.length === 0) throw new AppError(404, 'Staff member not found');

  await requireDbsApplicableNation(input.staffId);

  const existing = await query(
    `SELECT id FROM dbs_update_service_subscriptions
     WHERE staff_id = $1 AND status = 'active'`,
    [input.staffId],
  );
  if (existing.rows.length > 0) {
    throw new AppError(
      409,
      `This member of staff already has an active Update Service subscription (${existing.rows[0].id}). Record a status check against it, or withdraw the consent first.`,
    );
  }

  const interval = input.checkIntervalMonths ?? 12;
  let created: { id: string };
  try {
    const result = await query(
      `INSERT INTO dbs_update_service_subscriptions (
         organization_id, staff_id, level, workforce, update_service_id,
         certificate_reference, certificate_issued_on,
         consent_given_on, consent_method, consent_recorded_by,
         paper_certificate_seen_on, identity_verified_on, identity_method,
         check_interval_months, next_check_due_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date,
               COALESCE($8::date, CURRENT_DATE), $9, $10,
               $11::date, $12::date, $13,
               $14, COALESCE($15::date, (CURRENT_DATE + ($14::int || ' months')::interval)::date), $16)
       RETURNING id`,
      [
        orgId, input.staffId, input.level, input.workforce, input.updateServiceId,
        input.certificateReference ?? null, input.certificateIssuedOn ?? null,
        input.consentGivenOn ?? null, input.consentMethod, userId,
        input.paperCertificateSeenOn, input.identityVerifiedOn, input.identityMethod,
        interval, input.nextCheckDueOn ?? null, userId,
      ],
    );
    created = result.rows[0];
  } catch (err: any) {
    // The partial unique index is the real guard: the check above is a nicer
    // message, this is what holds when two managers subscribe at the same moment.
    if (err?.code === '23505') {
      throw new AppError(409, 'This member of staff already has an active Update Service subscription.');
    }
    throw err;
  }

  AuditRepository.log({
    user_id: userId,
    action: 'dbs.update_service.subscribe',
    entity_type: 'dbs_update_service_subscription',
    entity_id: created.id,
    new_data: {
      staff_id: input.staffId,
      level: input.level,
      workforce: input.workforce,
      consent_method: input.consentMethod,
      consent_given_on: input.consentGivenOn ?? null,
      identity_method: input.identityMethod,
      check_interval_months: interval,
    },
    ip_address: ipAddress,
  });

  return getOne(orgId, created.id);
}

/**
 * Load a subscription that a check or renewal may act on.
 *
 * Both preconditions live here because both are the same question — may this
 * provider do anything at all with this person's subscription? A withdrawn
 * consent refuses with the date, so the manager reading the error knows why
 * rather than being told "not found".
 */
async function requireActive(orgId: string, id: string) {
  const res = await query(
    `SELECT *, next_check_due_on::text AS next_check_due_text,
            last_checked_on::text AS last_checked_text,
            certificate_issued_on::text AS certificate_issued_text,
            renewal_due_on::text AS renewal_due_text
     FROM dbs_update_service_subscriptions
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId],
  );
  if (res.rows.length === 0) throw new AppError(404, 'Update Service subscription not found');
  const row = res.rows[0];
  if (row.status !== UpdateServiceStatus.ACTIVE) {
    if (row.consent_withdrawn_on) {
      throw new AppError(
        409,
        `Consent was withdrawn on ${row.consent_withdrawn_on instanceof Date ? row.consent_withdrawn_on.toISOString().slice(0, 10) : String(row.consent_withdrawn_on).slice(0, 10)}. A status check cannot be recorded without the individual's consent; record a new consent first.`,
      );
    }
    throw new AppError(409, `This subscription is ${row.status} — no status checks can be recorded against it.`);
  }
  if (row.consent_withdrawn_on) {
    throw new AppError(409, 'Consent has been withdrawn for this subscription, so no status check can be recorded.');
  }
  return row;
}

/**
 * Record a status check that has just been performed.
 *
 * The entitlement assertion is required every time, not once at subscription:
 * `level` and `workforce` are compared with the subscription and a difference is
 * refused rather than stored, because a check at a level the certificate does not
 * cover is not a check on it. Consent is enforced by `requireActive` — a
 * withdrawn subscription records nothing.
 *
 * What happens to the due date is the interesting part:
 *
 *   - `no_change` / `changed` — the cadence starts again from the check, or from
 *     a date the manager names.
 *   - `unable_to_check` — the attempt is recorded but the cadence does not
 *     restart: the check still has not happened, so it falls due again tomorrow
 *     rather than in twelve months. That is also why the reminder ledger is keyed
 *     on the due date — a moved due date is a new thing to say.
 *
 * `changed` is the case the whole feature exists for: the certificate the
 * provider holds is no longer the whole picture, so the renewal marker is raised
 * (if not already set) and managers are told now rather than at the next sweep.
 */
export async function recordUpdateServiceCheck(
  orgId: string,
  userId: string,
  id: string,
  input: RecordCheckInput,
  ipAddress?: string,
): Promise<UpdateServiceSubscription> {
  const sub = await requireActive(orgId, id);

  if (input.level !== sub.level || input.workforce !== sub.workforce) {
    throw new AppError(
      400,
      `A status check can only be made at the level and workforce of the certificate held (${sub.level}, ${sub.workforce}). A different level needs the individual's consent again — record a new subscription instead of reusing this one.`,
    );
  }

  const result = await query(
    `WITH target AS (
       SELECT s.*, COALESCE($3::date, CURRENT_DATE) AS checked_on
       FROM dbs_update_service_subscriptions s
       WHERE s.id = $1 AND s.organization_id = $2
     ), ins AS (
       INSERT INTO dbs_update_service_checks (
         organization_id, subscription_id, checked_on, outcome, level, workforce, checked_by, notes, next_check_due_on)
       SELECT organization_id, id, checked_on, $4::varchar, $5, $6, $7, $8,
              CASE WHEN $4::text = 'unable_to_check'
                   THEN (CURRENT_DATE + ($10::int || ' days')::interval)::date
                   ELSE COALESCE($9::date, (checked_on + (check_interval_months || ' months')::interval)::date) END
       FROM target
       RETURNING id, outcome, next_check_due_on
     )
     UPDATE dbs_update_service_subscriptions s
     SET last_checked_on = t.checked_on,
         next_check_due_on = i.next_check_due_on,
         renewal_due_on = CASE WHEN $4::text = 'changed' THEN COALESCE(s.renewal_due_on, t.checked_on) ELSE s.renewal_due_on END,
         updated_at = NOW()
     FROM target t, ins i
     WHERE s.id = t.id
     RETURNING s.id, i.id AS check_id, i.outcome AS check_outcome,
               i.next_check_due_on::text AS next_check_due_text`,
    [
      id, orgId, input.checkedOn ?? null, input.outcome, input.level, input.workforce,
      userId, input.notes ?? null, input.nextCheckDueOn ?? null, UNABLE_TO_CHECK_RETRY_DAYS,
    ],
  );
  const updated = result.rows[0];

  AuditRepository.log({
    user_id: userId,
    action: 'dbs.update_service.check',
    entity_type: 'dbs_update_service_subscription',
    entity_id: id,
    old_data: { next_check_due_on: sub.next_check_due_text, last_checked_on: sub.last_checked_text },
    new_data: {
      check_id: updated.check_id,
      outcome: input.outcome,
      level: input.level,
      workforce: input.workforce,
      next_check_due_on: updated.next_check_due_text,
    },
    ip_address: ipAddress,
  });

  if (input.outcome === UpdateServiceCheckOutcome.CHANGED) {
    await notifyChangeFound(orgId, id);
  }

  return getOne(orgId, id);
}

/**
 * Set or clear the renewal marker.
 *
 * Nothing obliges a provider to wait for a `changed` result to decide a new
 * certificate is needed — a role change or a policy review can raise it — so a
 * manager can set it directly, and clear it if it was set in error. Clearing
 * records no completion date: only `completeRenewal` claims a certificate arrived.
 */
export async function setRenewalMarker(
  orgId: string,
  userId: string,
  id: string,
  input: RenewalMarkerInput,
  ipAddress?: string,
): Promise<UpdateServiceSubscription> {
  const sub = await requireActive(orgId, id);
  await query(
    `UPDATE dbs_update_service_subscriptions
     SET renewal_due_on = $3::date,
         renewal_note = $4,
         updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId, input.renewalDueOn, input.note ?? null],
  );

  AuditRepository.log({
    user_id: userId,
    action: input.renewalDueOn ? 'dbs.update_service.renewal_marked' : 'dbs.update_service.renewal_cleared',
    entity_type: 'dbs_update_service_subscription',
    entity_id: id,
    old_data: { renewal_due_on: sub.renewal_due_text, renewal_note: sub.renewal_note },
    new_data: { renewal_due_on: input.renewalDueOn, renewal_note: input.note ?? null },
    ip_address: ipAddress,
  });

  return getOne(orgId, id);
}

/**
 * The new certificate's details, which is what completes a renewal.
 *
 * The reference and issue date are the metadata the DBS handling rules permit
 * keeping — never a copy or an image of the certificate — and recording them also
 * restarts the check cadence, because the clock on a re-check runs from the
 * certificate in hand.
 */
export async function completeRenewal(
  orgId: string,
  userId: string,
  id: string,
  input: CompleteRenewalInput,
  ipAddress?: string,
): Promise<UpdateServiceSubscription> {
  const sub = await requireActive(orgId, id);
  const result = await query(
    `UPDATE dbs_update_service_subscriptions
     SET certificate_reference = $3,
         certificate_issued_on = $4::date,
         renewal_due_on = NULL,
         renewal_note = NULL,
         renewal_completed_on = CURRENT_DATE,
         next_check_due_on = COALESCE($5::date, (CURRENT_DATE + (check_interval_months || ' months')::interval)::date),
         updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING next_check_due_on::text AS next_check_due_text`,
    [id, orgId, input.certificateReference, input.certificateIssuedOn, input.nextCheckDueOn ?? null],
  );

  AuditRepository.log({
    user_id: userId,
    action: 'dbs.update_service.renewal_completed',
    entity_type: 'dbs_update_service_subscription',
    entity_id: id,
    old_data: {
      certificate_reference: sub.certificate_reference,
      certificate_issued_on: sub.certificate_issued_text,
      renewal_due_on: sub.renewal_due_text,
      next_check_due_on: sub.next_check_due_text,
    },
    new_data: {
      certificate_reference: input.certificateReference,
      certificate_issued_on: input.certificateIssuedOn,
      next_check_due_on: result.rows[0].next_check_due_text,
    },
    ip_address: ipAddress,
  });

  return getOne(orgId, id);
}

/**
 * Withdraw the consent the whole workflow rests on.
 *
 * Never a delete, and never a silent stop: the withdrawal date and reason stay on
 * the record so a provider can show an inspector when consent ended and that no
 * check was recorded after it. Checks are refused from this point on
 * (`requireActive`), the renewal marker is cleared because there is no consent to
 * act on it, and reminders stop with the subscription.
 */
export async function withdrawConsent(
  orgId: string,
  userId: string,
  id: string,
  reason: string,
  ipAddress?: string,
): Promise<UpdateServiceSubscription> {
  const res = await query(
    'SELECT id, status, consent_withdrawn_on FROM dbs_update_service_subscriptions WHERE id = $1 AND organization_id = $2',
    [id, orgId],
  );
  if (res.rows.length === 0) throw new AppError(404, 'Update Service subscription not found');
  if (res.rows[0].consent_withdrawn_on) {
    throw new AppError(409, 'Consent has already been withdrawn for this subscription.');
  }

  await query(
    `UPDATE dbs_update_service_subscriptions
     SET consent_withdrawn_on = CURRENT_DATE,
         consent_withdrawn_reason = $3,
         status = 'withdrawn',
         renewal_due_on = NULL,
         updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [id, orgId, reason],
  );

  AuditRepository.log({
    user_id: userId,
    action: 'dbs.update_service.consent_withdrawn',
    entity_type: 'dbs_update_service_subscription',
    entity_id: id,
    old_data: { status: res.rows[0].status },
    new_data: { status: UpdateServiceStatus.WITHDRAWN, reason },
    ip_address: ipAddress,
  });

  return getOne(orgId, id);
}

// ── Reminders ────────────────────────────────────────────────────────────────

/**
 * Tell the managers, once per due date, that something needs doing.
 *
 * In-app rather than email: a re-check is work a manager does inside the product,
 * on a screen the notification links to, and it is not urgent in the way a missed
 * medication or an unclaimed shift is. `createNotification` also carries it to
 * whoever holds an active delegation for the recipient, so it is not lost to a
 * manager being off shift.
 */
async function notifyManagers(
  orgId: string,
  title: string,
  message: string,
  link: string | undefined,
): Promise<number> {
  const managers = await query(
    `SELECT id FROM users
     WHERE organization_id = $1 AND role IN ('ORG_ADMIN', 'MANAGER') AND status = 'active'`,
    [orgId],
  );
  for (const manager of managers.rows) {
    await NotificationsController.createNotification(
      manager.id, title, message, 'compliance',
      link ?? undefined,
    );
  }
  return managers.rows.length;
}

/** A `changed` status is not a reminder — it is the finding the whole feature exists for. */
async function notifyChangeFound(orgId: string, subscriptionId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT s.id, sp.user_id AS staff_user_id, TRIM(sp.first_name || ' ' || sp.last_name) AS staff_name
       FROM dbs_update_service_subscriptions s
       JOIN staff_profiles sp ON sp.id = s.staff_id
       WHERE s.id = $1 AND s.organization_id = $2`,
      [subscriptionId, orgId],
    );
    const row = res.rows[0];
    if (!row) return;
    await notifyManagers(
      orgId,
      'DBS Update Service check found a change',
      `${row.staff_name}'s Update Service status has changed. A change means the certificate on file is no longer the whole picture, so ask the individual to obtain a new certificate and record it against their staff record.`,
      staffCompliancePath(row.id, row.staff_user_id),
    );
  } catch (err: any) {
    // The check itself has already committed. A failed notification is logged and
    // never becomes an error the person who recorded the check has to deal with.
    logger.error({ err: err.message, orgId, subscriptionId }, 'DBS update service change notification failed');
  }
}  interface SweepRow {
    id: string;
    staff_user_id: string;
    staff_name: string;
    next_check_due_on: string;
    renewal_due_on: string | null;
    days_until_check: number;
    days_until_renewal: number | null;
  }

/**
 * Claim the right to say one thing about one subscription once.
 *
 * The sweep is a timer: it has no idea whether it already ran today, so the
 * sentence has to be claimable exactly once per (subscription, kind, due date).
 * The unique constraint on the ledger is the claim — an insert that returns a row
 * means this sweep is the one that gets to send it.
 */
async function claimReminder(
  orgId: string,
  subscriptionId: string,
  kind: 'check_due' | 'check_overdue' | 'renewal_due',
  dueOn: string,
): Promise<boolean> {
  const res = await query(
    `INSERT INTO dbs_update_service_reminders (organization_id, subscription_id, kind, due_on)
     VALUES ($1, $2, $3, $4::date)
     ON CONFLICT (subscription_id, kind, due_on) DO NOTHING
     RETURNING id`,
    [orgId, subscriptionId, kind, dueOn],
  );
  return res.rows.length > 0;
}

async function sweepOrg(orgId: string, warningDays: number): Promise<number> {
  const due = await query(
    `SELECT s.id, sp.user_id AS staff_user_id,
            TRIM(sp.first_name || ' ' || sp.last_name) AS staff_name,
            s.next_check_due_on::text AS next_check_due_on,
            s.renewal_due_on::text AS renewal_due_on,
            (s.next_check_due_on - CURRENT_DATE) AS days_until_check,
            (s.renewal_due_on - CURRENT_DATE) AS days_until_renewal
     FROM dbs_update_service_subscriptions s
     JOIN staff_profiles sp ON sp.id = s.staff_id
     WHERE s.organization_id = $1
       AND s.status = 'active'
       AND s.consent_withdrawn_on IS NULL
       AND (s.next_check_due_on <= CURRENT_DATE + ($2 || ' days')::interval
            OR (s.renewal_due_on IS NOT NULL AND s.renewal_due_on <= CURRENT_DATE + ($2 || ' days')::interval))`,
    [orgId, warningDays],
  );

  let notified = 0;
  for (const row of due.rows as SweepRow[]) {
    const days = Number(row.days_until_check);

    if (days < 0) {
      // Overdue is its own kind, not a shriller `check_due`: the date it is about
      // is the same, and a provider that has been told once should be told again
      // once it has actually been missed rather than every day in between.
      if (await claimReminder(orgId, row.id, 'check_overdue', row.next_check_due_on)) {
        notified += await notifyManagers(
          orgId,
          'DBS Update Service check overdue',
          `${row.staff_name}'s Update Service status check was due on ${row.next_check_due_on}. The check is free to the provider and the individual's consent is already recorded.`,
          staffCompliancePath(row.id, row.staff_user_id),
        );
      }
    } else if (await claimReminder(orgId, row.id, 'check_due', row.next_check_due_on)) {
      notified += await notifyManagers(
        orgId,
        'DBS Update Service check due',
        `${row.staff_name}'s Update Service status check is due on ${row.next_check_due_on}. Record the result on the staff record's compliance section.`,
        staffCompliancePath(row.id, row.staff_user_id),
      );
    }

    if (row.renewal_due_on && row.days_until_renewal !== null && Number(row.days_until_renewal) <= 0) {
      if (await claimReminder(orgId, row.id, 'renewal_due', row.renewal_due_on)) {
        notified += await notifyManagers(
          orgId,
          'DBS certificate renewal outstanding',
          `A new certificate was needed for ${row.staff_name} by ${row.renewal_due_on}. Record its reference and issue date once it arrives.`,
          staffCompliancePath(row.id, row.staff_user_id),
        );
      }
    }
  }
  return notified;
}

/**
 * Sweep every organisation for subscriptions that are due or overdue.
 *
 * Discovery runs on the superuser connection because a background job has no RLS
 * session context, and everything org-specific then runs inside
 * `runWithOrgContext` so the reads and inserts are scoped to one provider — the
 * same shape as the stock-reorder sweep. One provider failing does not stop the
 * others, and a failure is logged rather than thrown at the timer.
 */
export async function runUpdateServiceReminders(): Promise<{ notified: number }> {
  // Discovery asks only "which providers use this at all" — it does not apply the
  // warning window, because the window lives on `organizations` and reading it
  // here would make one provider's missing or malformed setting able to take the
  // whole sweep (every other provider's reminders) down with it. The window is
  // applied per provider below, where a failure is caught per provider too.
  const orgs = await migrateQuery(
    `SELECT DISTINCT s.organization_id AS id
     FROM dbs_update_service_subscriptions s
     WHERE s.status = 'active' AND s.consent_withdrawn_on IS NULL`,
  );

  let notified = 0;
  for (const org of orgs.rows) {
    try {
      const warningDays = await runWithOrgContext(org.id, () => warningDaysFor(org.id));
      notified += await runWithOrgContext(org.id, () => sweepOrg(org.id, warningDays));
    } catch (err: any) {
      logger.error({ err: err.message, orgId: org.id }, 'DBS update service reminder sweep failed for organisation');
    }
  }
  return { notified };
}
