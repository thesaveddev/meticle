import { query } from '../../shared/database';
import { decryptRowForOrg } from '../../shared/utils/encrypted-columns';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';
import { DBS_CERTIFICATE_RETENTION_MONTHS, DbsCheck, DbsLevel, DbsStatus, DbsSubmitRequest, DbsStats, DbsWorkforce } from './dbs.types';
import { getVettingScheme } from '../compliance/compliance.vetting';

/**
 * The check a person is subject to, and the name we would give it.
 *
 * A DBS is the England and Wales scheme. Scotland runs the PVG scheme through
 * Disclosure Scotland and Northern Ireland runs AccessNI — neither can be
 * applied for through the DBS online service, and a certificate issued under the
 * wrong scheme is not evidence their regulator accepts.
 *
 * So this module is England and Wales only, and says so rather than minting a
 * DBS for a Scottish worker. That is a refusal with a route attached: the
 * message names the scheme that applies to them instead of only denying.
 */
/**
 * Exported so the Update Service workflow can apply the same four-nations rule.
 *
 * A PVG or AccessNI worker is not refused here because they cannot have an
 * Update Service subscription — the point is the same one that guards a check:
 * minting a DBS-shaped record for a worker whose regulator does not accept a DBS
 * is the defect this module exists to remove, and the re-check workflow is a
 * second door into it.
 */
export async function requireDbsApplicableNation(staffId: string): Promise<void> {
  const result = await query(
    `SELECT COALESCE(sp.vetting_scheme, o.vetting_scheme) AS vetting_scheme
     FROM staff_profiles sp
     JOIN users u ON sp.user_id = u.id
     JOIN organizations o ON o.id = u.organization_id
     WHERE sp.id = $1`,
    [staffId]
  );
  const scheme = getVettingScheme(result.rows[0]?.vetting_scheme);
  if (scheme.nation !== 'england' && scheme.nation !== 'wales') {
    throw new AppError(
      400,
      `A DBS check does not apply to this member of staff. They are registered in ${scheme.nation === 'scotland' ? 'Scotland' : 'Northern Ireland'}, where the ${scheme.checkName} scheme applies instead — request that check and upload it to their record.`,
    );
  }
}

// --- Provider abstraction ---

/**
 * The seam a vetting partner plugs into.
 *
 * Exported so a test can supply a stub of its own. This module deliberately
 * ships none — see the note on `provider` below.
 */
export interface DbsProvider {
  submitCheck(staff: { first_name: string; last_name: string; email: string; birth_date?: string; address?: string; postcode?: string }, level: DbsLevel, workforce: DbsWorkforce): Promise<{ provider_reference: string; application_reference: string }>;
  getStatus(providerReference: string): Promise<{ status: DbsStatus; certificate_number?: string; disclosure_date?: string }>;
  cancelCheck(providerReference: string): Promise<void>;
}

/**
 * Null until configuration supplies an adapter, and with no default on purpose.
 *
 * There used to be a default here, and it was a mock that answered `CLEAR` with
 * a fabricated certificate number. Because `setDbsProvider` was never called
 * from any code path, that mock *was* the production provider: an administrator
 * clicking Submit on a real staff record got a cleared DBS check, and a
 * three-year "approved" document to go with it, with no check having happened.
 * A background check is a safeguarding control, so the failure mode has to be a
 * refusal, not a plausible-looking result.
 *
 * The guards in `submitDbsCheck` and `pollDbsStatus` re-read configuration
 * rather than trusting this variable, so a stray `setDbsProvider` call added to
 * some future code path cannot re-arm submission on its own.
 */
let provider: DbsProvider | null = null;

export function setDbsProvider(p: DbsProvider | null) {
  provider = p;
}

/**
 * The one place a provider is chosen, read from configuration at boot.
 *
 * No partner adapter is implemented yet — they are phase 2 of
 * `docs/DBS_INTEGRATION_PLAN.md` — so today every key resolves to `null` and
 * says so in the log. Reading configuration at all is what lets the refusal
 * below name what is missing, and what lets a test prove the module stays
 * closed when nothing is set.
 */
export function resolveDbsProvider(env: NodeJS.ProcessEnv = process.env): DbsProvider | null {
  const key = (env.DBS_PROVIDER || '').trim();
  if (!key) return null;
  logger.warn(
    `DBS_PROVIDER is set to "${key}", but no vetting partner adapter is implemented yet, so DBS submission stays closed. See docs/DBS_INTEGRATION_PLAN.md phase 2.`,
  );
  return null;
}

provider = resolveDbsProvider();

/**
 * Whether this deployment can submit a check at all, and the sentence saying so.
 *
 * Exported because the compliance screen has to say the same thing the refusal
 * says. A hard-coded sentence in the UI drifts from the refusal the first time
 * either changes, and a button whose explanation contradicts the error it
 * produces is worse than no explanation — so the screen renders this message
 * and there is one place to edit when a partner is signed.
 */
export function describeDbsSubmission(env: NodeJS.ProcessEnv = process.env): { available: boolean; message: string } {
  const configured = (env.DBS_PROVIDER || '').trim();
  if (!configured) {
    return {
      available: false,
      message: 'DBS checks cannot be submitted: this deployment has no vetting partner configured. MeticleCare does not submit checks yet — record the certificate metadata on the staff record instead.',
    };
  }
  if (!provider) {
    return {
      available: false,
      message: `DBS checks cannot be submitted: DBS_PROVIDER is set to "${configured}", but no adapter for it is built yet. Record the certificate metadata on the staff record instead.`,
    };
  }
  return { available: true, message: `DBS checks are submitted to ${configured}.` };
}

/**
 * Refuse unless a partner is configured *and* an adapter exists for it.
 *
 * The two halves fail differently and the message says which, because "there is
 * no integration here" and "the integration is configured but not built" are
 * different sentences to put in front of a provider. Both sentences live in
 * `describeDbsSubmission` above, so the refusal and the screen that predicts it
 * cannot disagree.
 */
function requireConfiguredProvider(): DbsProvider {
  const submission = describeDbsSubmission();
  if (!submission.available || !provider) {
    throw new AppError(503, submission.message);
  }
  return provider;
}

// --- Status helpers ---

const STATUS_ORDER: Record<DbsStatus, number> = {
  [DbsStatus.DRAFT]: 0,
  [DbsStatus.SUBMITTED]: 1,
  [DbsStatus.IN_PROGRESS]: 2,
  [DbsStatus.AWAITING_IDENTITY]: 3,
  [DbsStatus.CLEAR]: 4,
  [DbsStatus.DISCLOSURE]: 4,
  [DbsStatus.CANCELLED]: -1,
  [DbsStatus.ERROR]: -1,
};

// --- Repository ---

export async function createDbsCheck(orgId: string, data: DbsSubmitRequest): Promise<DbsCheck> {
  const sp = await query(
    `SELECT sp.user_id, sp.first_name, sp.last_name, sp.birth_date
     FROM staff_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = $1 AND u.organization_id = $2`,
    [data.staff_id, orgId]
  );
  if (sp.rows.length === 0) throw new AppError(404, 'Staff member not found');
  // `sp.birth_date` is encrypted; `createDbsCheck` stores nothing of it, but the
  // row is normalised here so a future use of this result cannot pick up
  // ciphertext by accident.
  decryptRowForOrg('staff_profiles', sp.rows[0], orgId);

  // Refuse at the point of creation, not at submission. A draft DBS check for a
  // Scottish worker is a row that looks like progress and can never complete.
  await requireDbsApplicableNation(data.staff_id);

  const user = await query('SELECT email FROM users WHERE id = $1', [sp.rows[0].user_id]);

  const result = await query(
    `INSERT INTO dbs_checks (organization_id, staff_id, level, workforce, status, cost_pence, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [orgId, data.staff_id, data.level, data.workforce, DbsStatus.DRAFT, data.cost_pence || null, data.notes || null]
  );
  return result.rows[0];
}

export async function submitDbsCheck(orgId: string, checkId: string): Promise<DbsCheck> {
  const check = await query('SELECT * FROM dbs_checks WHERE id = $1 AND organization_id = $2', [checkId, orgId]);
  if (check.rows.length === 0) throw new AppError(404, 'DBS check not found');
  const c = check.rows[0];
  if (c.status !== DbsStatus.DRAFT) throw new AppError(400, `Cannot submit check in status: ${c.status}`);

  // Re-checked at submission, because a person can be moved to another nation
  // between creating a draft and sending it.
  await requireDbsApplicableNation(c.staff_id);

  // Refused before the staff record is decrypted. Their name, date of birth,
  // address and postcode must not leave the process on the way to a provider
  // that is not there.
  const activeProvider = requireConfiguredProvider();

  const sp = await query(
    `SELECT sp.first_name, sp.last_name, sp.birth_date, sp.address, sp.postal_code, u.email
     FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1`,
    [c.staff_id]
  );
  // Decrypted before it leaves the process. This is the one read path where the
  // values are sent to a third-party provider, so ciphertext going out by
  // omission would be both useless to them and a disclosure in its own right.
  const staff = decryptRowForOrg('staff_profiles', sp.rows[0], orgId)!;

  const providerResult = await activeProvider.submitCheck(staff, c.level, c.workforce);

  const result = await query(
    `UPDATE dbs_checks SET status = $1, submitted_at = NOW(), provider_reference = $2, application_reference = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [DbsStatus.SUBMITTED, providerResult.provider_reference, providerResult.application_reference, checkId]
  );
  return result.rows[0];
}

/**
 * The check columns the API returns.
 *
 * Listed rather than `dc.*` because the date columns have to travel as text.
 * `pg` parses a `date` into a `Date` at local midnight, and the first
 * `toISOString()` or `toLocaleDateString()` on it is free to move the day — which
 * on a certificate issue date or a retention deadline is the difference between
 * a correct record and an incorrect one. `date` columns are therefore sent as
 * `YYYY-MM-DD`, and the two values that are really instants (`purge_after`,
 * `certificate_purged_at`) are also rendered as the day they fell on **in the
 * provider's own timezone**, because that is the day a person reads on a screen.
 */
const CHECK_SELECT = `
  dc.id, dc.organization_id, dc.staff_id, dc.level, dc.workforce, dc.status,
  dc.application_reference, dc.provider_reference, dc.certificate_number,
  dc.disclosure_date::text AS disclosure_date,
  dc.recruitment_decision, dc.recruitment_decision_on::text AS recruitment_decision_on,
  dc.recruitment_decision_by, dc.renewal_due_on::text AS renewal_due_on,
  dc.cost_pence, dc.notes,
  dc.requested_at, dc.submitted_at, dc.completed_at, dc.created_at, dc.updated_at,
  dc.purge_after, dc.certificate_purged_at,
  (dc.purge_after AT TIME ZONE current_setting('TimeZone'))::date::text AS purge_after_on,
  (dc.certificate_purged_at AT TIME ZONE current_setting('TimeZone'))::date::text AS certificate_purged_on,
  -- Whole days, rounded up, so a deadline later today counts as 1 rather than 0.
  CASE WHEN dc.purge_after IS NULL THEN NULL
       ELSE CEIL(EXTRACT(EPOCH FROM (dc.purge_after - NOW())) / 86400)::int END AS days_until_purge`;

export async function getDbsChecks(orgId: string): Promise<DbsCheck[]> {
  const result = await query(
    `SELECT ${CHECK_SELECT}, sp.first_name || ' ' || sp.last_name as staff_name
     FROM dbs_checks dc
     JOIN staff_profiles sp ON dc.staff_id = sp.id
     WHERE dc.organization_id = $1
     ORDER BY dc.created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function getDbsCheck(orgId: string, checkId: string): Promise<DbsCheck> {
  const result = await query(
    `SELECT ${CHECK_SELECT}, sp.first_name || ' ' || sp.last_name as staff_name
     FROM dbs_checks dc
     JOIN staff_profiles sp ON dc.staff_id = sp.id
     WHERE dc.id = $1 AND dc.organization_id = $2`,
    [checkId, orgId]
  );
  if (result.rows.length === 0) throw new AppError(404, 'DBS check not found');
  return result.rows[0];
}

export async function updateDbsStatus(orgId: string, checkId: string, status: DbsStatus, certificateNumber?: string): Promise<DbsCheck> {
  const check = await getDbsCheck(orgId, checkId);
  const newOrder = STATUS_ORDER[status];
  const curOrder = STATUS_ORDER[check.status];
  if (newOrder < curOrder && status !== DbsStatus.CANCELLED && status !== DbsStatus.ERROR) {
    throw new AppError(400, `Cannot move from ${check.status} to ${status}`);
  }

  const updates: string[] = ['status = $1', 'updated_at = NOW()'];
  const params: any[] = [status];

  if (status === DbsStatus.CLEAR || status === DbsStatus.DISCLOSURE) {
    updates.push('completed_at = NOW()');
    // Pushed unconditionally so the retention expressions below can name it; the
    // COALESCE keeps an existing reference when the caller supplies none.
    params.push(certificateNumber || null);
    updates.push(`certificate_number = COALESCE($${params.length}::text, certificate_number)`);
    // A completed check holds certificate information, and information with no
    // retention date is information held indefinitely — the one thing the DBS
    // handling rules are clearest about. So the clock starts here too, on the
    // same rule as `recordCertificateMetadata`: six months from the recruitment
    // decision where one is recorded, otherwise from the completion itself. A
    // fresh reference also clears a previous purge stamp, because a new
    // certificate is new information entitled to its own window.
    updates.push(
      `purge_after = CASE
         WHEN $${params.length}::text IS NOT NULL
           THEN COALESCE(recruitment_decision_on, CURRENT_DATE) + make_interval(months => ${DBS_CERTIFICATE_RETENTION_MONTHS})
         WHEN purge_after IS NULL AND notes IS NOT NULL
           THEN COALESCE(recruitment_decision_on, CURRENT_DATE) + make_interval(months => ${DBS_CERTIFICATE_RETENTION_MONTHS})
         ELSE purge_after END`,
    );
    updates.push(`certificate_purged_at = CASE WHEN $${params.length}::text IS NOT NULL THEN NULL ELSE certificate_purged_at END`);
  }

  params.push(checkId);
  const result = await query(
    `UPDATE dbs_checks SET ${updates.join(', ')} WHERE id = $${params.length} AND organization_id = $${params.length + 1} RETURNING *`,
    [...params, orgId]
  );

  // A result deliberately does NOT create a `documents` row.
  //
  // It used to. On `clear` this inserted a DBS document with `status =
  // 'approved'` and a three-year expiry, which is how a mock provider's
  // invented result became "evidence" in the compliance record — a check that
  // nothing verified, indistinguishable in the UI from a certificate a manager
  // had read. A check result is a fact about a check; a document is something a
  // person uploaded and an approver accepted. Keeping the two apart is also
  // what lets certificate metadata be purged on the DBS timetable (six months,
  // per `docs/DBS_INTEGRATION_PLAN.md` §6) without touching the record of the
  // recruitment decision.
  return result.rows[0];
}

export async function pollDbsStatus(orgId: string, checkId: string): Promise<DbsCheck> {
  const check = await getDbsCheck(orgId, checkId);
  if (!check.provider_reference) throw new AppError(400, 'Check has not been submitted yet');
  if (check.status === DbsStatus.CLEAR || check.status === DbsStatus.DISCLOSURE || check.status === DbsStatus.CANCELLED) {
    return check;
  }

  const activeProvider = requireConfiguredProvider();
  const providerStatus = await activeProvider.getStatus(check.provider_reference);
  return updateDbsStatus(orgId, checkId, providerStatus.status, providerStatus.certificate_number);
}

export async function getDbsStats(orgId: string): Promise<DbsStats> {
  // The certificate columns come along because the retention counters below need
  // to know which checks are still holding information, and how much of it is
  // past its date.
  const all = await query(
    `SELECT status, certificate_number, disclosure_date, notes, completed_at, purge_after, certificate_purged_at
       FROM dbs_checks WHERE organization_id = $1`,
    [orgId],
  );
  const rows = all.rows;
  const stats: DbsStats = {
    total: rows.length, clear: 0, in_progress: 0, awaiting_identity: 0, submitted: 0, draft: 0, cancelled: 0, error: 0,
    expiring_soon: 0, expired: 0, cost_total_pounds: 0,
    certificate_retention_months: DBS_CERTIFICATE_RETENTION_MONTHS,
    certificate_details_held: 0,
    certificate_details_purged: 0,
    certificate_purge_due: 0,
    submission: describeDbsSubmission(),
  };

  for (const r of rows) {
    if (r.status === DbsStatus.CLEAR || r.status === DbsStatus.DISCLOSURE) stats.clear++;
    else if (r.status === DbsStatus.IN_PROGRESS) stats.in_progress++;
    else if (r.status === DbsStatus.AWAITING_IDENTITY) stats.awaiting_identity++;
    else if (r.status === DbsStatus.SUBMITTED) stats.submitted++;
    else if (r.status === DbsStatus.DRAFT) stats.draft++;
    else if (r.status === DbsStatus.CANCELLED) stats.cancelled++;
    else if (r.status === DbsStatus.ERROR) stats.error++;

    // Certificate information still held, and whether the retention deadline for
    // it has passed. `certificate_purge_due` is the alarm rather than a statistic:
    // anything above zero means the nightly purge has not run, so the provider is
    // holding information the DBS rules say it should no longer have.
    const holdsCertificateInformation = !!(r.certificate_number || r.disclosure_date || r.notes);
    if (holdsCertificateInformation) {
      stats.certificate_details_held++;
      if (r.purge_after && new Date(r.purge_after).getTime() <= Date.now()) stats.certificate_purge_due++;
    }
    if (r.certificate_purged_at) stats.certificate_details_purged++;

    if (r.completed_at) {
      const expiry = new Date(r.completed_at);
      expiry.setFullYear(expiry.getFullYear() + 3);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
      if (daysUntilExpiry < 0) stats.expired++;
      else if (daysUntilExpiry <= 30) stats.expiring_soon++;
    }
  }

  const costs = await query('SELECT COALESCE(SUM(cost_pence), 0) as total FROM dbs_checks WHERE organization_id = $1', [orgId]);
  stats.cost_total_pounds = Math.round(Number(costs.rows[0]?.total || 0) / 100);
  return stats;
}
