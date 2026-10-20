export enum DbsStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_PROGRESS = 'in_progress',
  AWAITING_IDENTITY = 'awaiting_identity',
  CLEAR = 'clear',
  DISCLOSURE = 'disclosure',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

export enum DbsLevel {
  STANDARD = 'standard',
  ENHANCED = 'enhanced',
  ENHANCED_WITH_BARRED = 'enhanced_with_barred',
}

export enum DbsWorkforce {
  ADULT = 'adult',
  CHILD = 'child',
  BOTH = 'both',
}

/**
 * Six months after the recruitment decision.
 *
 * The period the DBS handling rules give: certificate information is kept only
 * for the purpose it was obtained for, and normally no longer than six months
 * after the decision. A calendar interval rather than a day count, because "six
 * months" is what the guidance says and six months of thirty days would quietly
 * be five. Declared here rather than beside the purge so the API, the purge and
 * the compliance screen all read one number.
 */
export const DBS_CERTIFICATE_RETENTION_MONTHS = 6;

/**
 * The decision taken on a disclosure.
 *
 * Named a *recruitment* decision because that is what the DBS handling rules
 * call it, and because that is the act it belongs to: a disclosure is not a
 * compliance flag, it is something a person assessed and then hired or did not
 * hire on. It is also the fact that decides when the certificate information
 * must be deleted (six months from here), so it cannot be an afterthought.
 */
export enum DbsRecruitmentDecision {
  /** Not taken yet — the disclosure is in hand and being considered. */
  PENDING = 'pending',
  PROCEED = 'proceed',
  PROCEED_WITH_CONDITIONS = 'proceed_with_conditions',
  NOT_PROCEED = 'not_proceed',
  WITHDRAWN = 'withdrawn',
}

/**
 * A DBS check, as the API returns it.
 *
 * Two halves that the retention rule treats differently, and the field names say
 * which is which:
 *
 *   - the *check* — level, workforce, status and times, cost, and the
 *     recruitment decision taken on it. These survive a certificate purge.
 *   - the *certificate information* — `certificate_number`, the issue date
 *     (`disclosure_date`, the column's historical name) and `notes`. These are
 *     audit metadata the DBS model policy permits, and they are deleted six
 *     months after the recruitment decision.
 *
 * `certificate_purged_on` is why the fields above can be empty without looking
 * like data loss, and `days_until_purge` is the countdown the screen shows.
 */
export interface DbsCheck {
  id: string;
  organization_id: string;
  staff_id: string;
  staff_name?: string;
  level: DbsLevel;
  workforce: DbsWorkforce;
  status: DbsStatus;
  application_reference?: string;
  provider_reference?: string;
  /** Certificate reference. Deleted by the retention purge. */
  certificate_number?: string | null;
  /** The certificate's issue date, as `YYYY-MM-DD`. Deleted by the retention purge. */
  disclosure_date?: string | null;
  /** The decision taken on the disclosure. Survives the purge. */
  recruitment_decision?: DbsRecruitmentDecision | null;
  /** When it was taken, as `YYYY-MM-DD`. Survives the purge. */
  recruitment_decision_on?: string | null;
  /** Who took it. Survives the purge. */
  recruitment_decision_by?: string | null;
  /** When the provider wants the check reconsidered, as `YYYY-MM-DD`. Survives the purge. */
  renewal_due_on?: string | null;
  /** The day the certificate information is due to be deleted, in the provider's own timezone. */
  purge_after_on?: string | null;
  /** Whole days until `purge_after`; negative once the deadline has passed. Null when nothing is held. */
  days_until_purge?: number | null;
  /** The day the certificate information was deleted, if it has been. */
  certificate_purged_on?: string | null;
  certificate_purged_at?: string | null;
  requested_at: string;
  completed_at?: string;
  submitted_at?: string;
  cost_pence?: number;
  /** The provider's own note. Deleted by the retention purge, because free text is where a certificate number gets pasted. */
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** What `PATCH /dbs/checks/:id/certificate` accepts. Only provided keys change. */
export interface DbsCertificateMetadataInput {
  certificateNumber?: string | null;
  /** The certificate's issue date, `YYYY-MM-DD`. */
  certificateIssuedOn?: string | null;
  recruitmentDecision?: DbsRecruitmentDecision | null;
  recruitmentDecisionOn?: string | null;
  renewalDueOn?: string | null;
  notes?: string | null;
}

export interface DbsProviderConfig {
  apiKey?: string;
  apiUrl?: string;
  organisationId?: string;
  username?: string;
  password?: string;
}

export interface DbsSubmitRequest {
  staff_id: string;
  level: DbsLevel;
  workforce: DbsWorkforce;
  cost_pence?: number;
  notes?: string;
}

// ── DBS Update Service (docs/DBS_INTEGRATION_PLAN.md phase 3) ────────────────
//
// Types for the re-check workflow: a subscription the individual holds, the
// status checks the provider performs against it with their consent, and the
// renewal marker a `changed` result raises. Deliberately separate from
// `DbsCheck` above, because an Update Service check is not an application —
// there is nothing to submit and no provider to submit it to.

export enum UpdateServiceConsentMethod {
  WRITTEN = 'written',
  EMAIL = 'email',
  VERBAL = 'verbal',
  ONLINE_FORM = 'online_form',
}

export enum UpdateServiceIdentityMethod {
  MANUAL_DOCUMENT_CHECK = 'manual_document_check',
  DIGITAL_IDENTITY_SERVICE = 'digital_identity_service',
}

export enum UpdateServiceStatus {
  ACTIVE = 'active',
  WITHDRAWN = 'withdrawn',
  LAPSED = 'lapsed',
}

/** What the Update Service said when the provider checked. */
export enum UpdateServiceCheckOutcome {
  /** The certificate stands as issued. */
  NO_CHANGE = 'no_change',
  /** Information not on the certificate the provider holds — a new certificate is needed. */
  CHANGED = 'changed',
  /** The check could not be completed. Recorded so the attempt is visible, and still due. */
  UNABLE_TO_CHECK = 'unable_to_check',
}

/**
 * How urgent a subscription is, resolved from its due date and the provider's
 * own warning window (`organizations.compliance_warning_days`, default 14).
 * Computed, never stored: a stored state goes stale the day it is written.
 */
export type UpdateServiceDueState = 'current' | 'due_soon' | 'overdue' | 'not_active';

export interface UpdateServiceSubscription {
  id: string;
  organization_id: string;
  staff_id: string;
  /** The staff member's user id — what a staff-profile link is addressed by. */
  staff_user_id: string;
  staff_name: string;
  staff_email: string;
  level: DbsLevel;
  workforce: DbsWorkforce;
  update_service_id: string;
  certificate_reference?: string | null;
  certificate_issued_on?: string | null;
  consent_given_on: string;
  consent_method: UpdateServiceConsentMethod;
  consent_recorded_by?: string | null;
  /** Who recorded it, for the consent line an inspection asks about. */
  consent_recorded_by_name?: string | null;
  consent_withdrawn_on?: string | null;
  consent_withdrawn_reason?: string | null;
  paper_certificate_seen_on: string;
  identity_verified_on: string;
  identity_method: UpdateServiceIdentityMethod;
  check_interval_months: number;
  next_check_due_on: string;
  last_checked_on?: string | null;
  renewal_due_on?: string | null;
  renewal_note?: string | null;
  renewal_completed_on?: string | null;
  status: UpdateServiceStatus;
  created_at: string;
  updated_at: string;
  /** Days until the next check, from `CURRENT_DATE` in the provider's own timezone. Negative when overdue. */
  days_until_check: number;
  days_until_renewal?: number | null;
  checks_recorded: number;
  due_state: UpdateServiceDueState;
}

export interface UpdateServiceCheck {
  id: string;
  organization_id: string;
  subscription_id: string;
  checked_on: string;
  outcome: UpdateServiceCheckOutcome;
  level: DbsLevel;
  workforce: DbsWorkforce;
  checked_by?: string | null;
  /** Who performed it, for a history a manager reads without a second lookup. */
  checked_by_name?: string | null;
  notes?: string | null;
  next_check_due_on: string;
  created_at: string;
}

export interface UpdateServiceSubscriptionDetail extends UpdateServiceSubscription {
  checks: UpdateServiceCheck[];
}

export interface UpdateServiceStats {
  total: number;
  active: number;
  due_soon: number;
  overdue: number;
  withdrawn: number;
  /** Subscriptions whose renewal marker is set and due. */
  renewals_due: number;
  checks_last_30_days: number;
  /** Checks that came back `changed` — the ones that made work. */
  changes_found: number;
}

export interface DbsStats {
  total: number;
  clear: number;
  in_progress: number;
  awaiting_identity: number;
  submitted: number;
  draft: number;
  cancelled: number;
  error: number;
  expiring_soon: number;
  expired: number;
  cost_total_pounds: number;
  /** How long certificate information may be held after the recruitment decision. */
  certificate_retention_months: number;
  /** Checks still holding a certificate reference, issue date or note. */
  certificate_details_held: number;
  /** Checks whose certificate information the retention purge has deleted. */
  certificate_details_purged: number;
  /**
   * Checks past their purge date that still hold certificate information.
   *
   * Non-zero is the alarm: the nightly sweep has not run, so the provider is
   * holding information the DBS rules say it should not have. It is a count
   * rather than a boolean because it is also a work item.
   */
  certificate_purge_due: number;
  /**
   * Whether this deployment can submit a check at all, and why not.
   *
   * The compliance screen renders the message verbatim, so the screen and the
   * API cannot disagree about whether submission is open — and there is one
   * sentence to change when a partner is signed.
   */
  submission: { available: boolean; message: string };
}
