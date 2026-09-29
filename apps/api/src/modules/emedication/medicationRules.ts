/**
 * Enforcing the medicines-in-care rules, at the point a dose is recorded.
 *
 * This is the file that makes `medicationFrameworks.ts` a control rather than a
 * list. The registry says what each nation requires; this decides whether the
 * write happens.
 *
 * Every refusal carries the framework's own words. That is deliberate and it is
 * the reason `MedicationRule.requirement` exists: the sentence a care worker
 * or a manager reads at 7am has to say what is missing and why, in the
 * framework's terms, because "403 Forbidden" teaches nobody anything and gets
 * worked around. Each message names the thing to record.
 *
 * Two decisions about what to enforce, both of which are visible in the code:
 *
 *   - ORG_ADMIN is not exempt. The old competence check skipped the role,
 *     which meant an administrator could give a medicine with no competence of
 *     any kind. Administrators do administer in real services, so the right
 *     answer is that they record their own competence like everyone else, not
 *     that they are waved through.
 *
 *   - A `recorded` rule never blocks a dose here. Covert authorisation, PRN
 *     indication and the medication review are checked differently from the
 *     competence and witness rules, and the difference is in the framework
 *     data rather than in an `if`. Adding a rule that blocks means setting its
 *     enforcement to `blocked` in the registry, where the readiness screen will
 *     start reporting it, rather than hiding a refusal in a repository.
 *
 *   - General competence and a responsible clinician are required for *any*
 *     record. A witness, a PRN reason and a covert authorisation are required
 *     only where a dose was actually attempted. Both halves matter: dropping
 *     the first would let an unassessed person write the MAR, and applying the
 *     second to a `pending` row would train staff to invent a witness for a
 *     dose nobody gave.
 *
 * ── A note on RLS, which is a bug this file had on its first pass ─────────
 *
 * Every read in this file uses `migrateQuery`, not the RLS-scoped `query`, and
 * that is not a shortcut. The first version used `query`, and it was wrong in
 * a way that would have shipped silently: the rules evaluate as the *requesting
 * user*, so a care worker asking "is there a responsible clinician?" was
 * subjected to the RLS policy on `medication_responsible_clinicians`, which
 * admits ORG_ADMIN and MANAGER. The answer came back empty, the rule read as
 * unmet, and every care worker was permanently refused every dose — the people
 * the rule exists to protect were the only ones it locked out, and managers
 * testing it saw it work perfectly.
 *
 * These reads are policy evaluation, not a client reading data. The row is
 * read, the rule is decided, and the response to the client says only whether
 * the dose is allowed. The manager-only RLS policies stay on the tables, because
 * the governance endpoints genuinely are manager-only; what they must not do is
 * decide whether a care worker can give a paracetamol.
 */

import { migrateQuery } from '../../shared/database'
import { AppError } from '../../shared/middleware/error.middleware'
import logger from '../../shared/utils/logger'
import {
  frameworkForRegulator,
  getMedicationFramework,
  MedicationFramework,
  MedicationRule,
  differentiatingRules,
  NO_FRAMEWORK_NOTE,
} from './medicationFrameworks'

/** Scopes a dose can require. Named after what they authorise, not after a course. */
export type CompetenceScope = 'administration' | 'controlled_drugs' | 'measuring_and_injecting'

export type AdministrationContext = {
  organizationId: string
  staffProfileId: string
  /** The person the medicines are for. Needed for the covert check. */
  personId?: string | null
  medicineName: string
  isControlledDrug: boolean
  isPrn: boolean
  isCovert: boolean
  /** Supplied by the caller; a witness who gave the dose is not a witness. */
  witnessStaffId?: string | null
  prnReason?: string | null
  /**
   * What the dose is being recorded as.
   *
   * This decides which rules apply, and the distinction is not cosmetic.
   * `pending` and `missed` are records about a dose, not administrations of one,
   * and demanding a witness for a dose that was never given would train staff
   * to invent one. `given`, `refused` and `omitted` all mean somebody stood
   * there with the medicine, and all three attract the full set.
   */
  status?: string
}

/** Statuses that mean an attempt to administer actually happened. */
const ADMINISTRATION_STATUSES = ['given', 'refused', 'omitted']

/**
 * Which framework this organisation is operating under.
 *
 * The stored override wins over `organizations.regulator`, because somebody
 * deliberately set it. The regulator wins otherwise, because it is already
 * recorded and a second copy of the same fact is only able to disagree with the
 * first. An unknown override value falls back rather than throwing, so a bad
 * write cannot lock a provider out of their own medicines.
 */
export async function resolveOrganisationFramework(
  organizationId: string,
): Promise<{ framework: MedicationFramework; isFallback: boolean; note?: string; source: 'override' | 'regulator' }> {
  const result = await migrateQuery(
    'SELECT medication_framework, regulator FROM organizations WHERE id = $1',
    [organizationId],
  )
  const row = result.rows[0] ?? {}
  if (row.medication_framework) {
    return {
      framework: getMedicationFramework(row.medication_framework),
      isFallback: false,
      source: 'override',
    }
  }
  const resolved = frameworkForRegulator(row.regulator)
  return { ...resolved, source: 'regulator' }
}

/** A rule, with the note attached, for the refusal message. */
const ruleText = (framework: MedicationFramework, ruleId: string): MedicationRule => {
  const rule = framework.rules.find((r) => r.id === ruleId)
  if (!rule) throw new Error(`Unknown medication rule ${ruleId} in ${framework.id}`)
  return rule
}

const refuse = (framework: MedicationFramework, ruleId: string, detail?: string): never => {
  const rule = ruleText(framework, ruleId)
  throw new AppError(403, `${rule.requirement}${detail ? ` ${detail}` : ''}`)
}

/**
 * A current, in-date competence for a scope, if there is one.
 *
 * Expired means expired. `expires_at IS NULL` is a competence with no expiry
 * set, which is accepted — providers do assess people for the run of their
 * employment — but it is counted separately on readiness, because "we have
 * never re-assessed this person" and "we re-assessed them in March" should not
 * look the same on a screen a manager reads before an inspection.
 */
export async function findCompetence(
  organizationId: string,
  staffProfileId: string,
  scope: CompetenceScope,
): Promise<{ id: string; expires_at: string | null; assessed_at: string; no_expiry: boolean } | null> {
  const result = await migrateQuery(
    `SELECT id, expires_at::text, assessed_at, expires_at IS NULL AS no_expiry
     FROM medication_competences
     WHERE organization_id = $1
       AND staff_id = $2
       AND scope = $3
       AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
     ORDER BY assessed_at DESC
     LIMIT 1`,
    [organizationId, staffProfileId, scope],
  )
  return result.rows[0] ?? null
}

/** The organisation's current named responsible clinician, if there is one. */
export async function currentResponsibleClinician(
  organizationId: string,
): Promise<{ id: string; profession: string; name: string } | null> {
  const result = await migrateQuery(
    `SELECT rc.id, rc.profession,
            COALESCE(sp.first_name || ' ' || sp.last_name, 'Unnamed') AS name
     FROM medication_responsible_clinicians rc
     JOIN staff_profiles sp ON sp.id = rc.staff_id
     WHERE rc.organization_id = $1
       AND rc.ended_at IS NULL
       AND (rc.ends_at IS NULL OR rc.ends_at >= NOW())
     ORDER BY rc.appointed_at DESC
     LIMIT 1`,
    [organizationId],
  )
  return result.rows[0] ?? null
}

/**
 * A usable covert authorisation for a person under a given framework.
 *
 * Returns the row it found or the reason it did not, because the reason is the
 * useful half: "you have one, but it was made under the Mental Capacity Act and
 * this is a Scottish service" is a fixable problem, and "you have none" is a
 * different one. A Scottish provider whose only covert record is an English
 * best-interests determination has a real gap, and this is where it surfaces.
 */
export async function findCovertAuthorization(
  organizationId: string,
  personId: string,
  framework: MedicationFramework,
  medicineName: string,
): Promise<
  | { ok: true; id: string }
  | { ok: false; reason: 'none' | 'wrong_authority' | 'not_specific' | 'overdue_review' | 'ended' }
> {
  const result = await migrateQuery(
    `SELECT id, authority, medicines, review_due, ended_at
     FROM medication_covert_authorizations
     WHERE organization_id = $1 AND person_id = $2
     ORDER BY authorised_at DESC`,
    [organizationId, personId],
  )
  if (result.rows.length === 0) return { ok: false, reason: 'none' }

  const wantedAuthority =
    framework.nation === 'scotland' ? 'mental_welfare_act_s19' : 'mental_capacity_act_best_interests'

  for (const row of result.rows) {
    if (row.ended_at) continue
    if (row.review_due && new Date(row.review_due) < new Date()) continue
    // Scope. A blanket authorisation covering every medicine is the thing these
    // frameworks exist to prevent, so an empty medicines list is not usable —
    // it is an authorisation that has not been made specific yet.
    if (!row.medicines || !String(row.medicines).trim()) continue
    // The named medicine has to be within the listed ones. Substring, so
    // "morphine 10mg" matches an authorisation listing "morphine", and case
    // insensitive because a prescriber's capitalisation is not a refusal.
    const listed = String(row.medicines)
      .split(/[,;\n]/)
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean)
    if (!listed.some((m: string) => medicineName.toLowerCase().includes(m) || m.includes(medicineName.toLowerCase()))) {
      continue
    }
    if (row.authority !== wantedAuthority) return { ok: false, reason: 'wrong_authority' }
    return { ok: true, id: row.id }
  }
  return { ok: false, reason: 'not_specific' }
}

const COVERT_REASONS: Record<string, string> = {
  none: 'There is no covert authorisation recorded for this person.',
  wrong_authority:
    'The covert authorisation on file was made under a different legal instrument from the one this framework uses.',
  not_specific:
    'The covert authorisation on file does not name this medicine, so it cannot be relied on for this dose.',
  overdue_review: 'The covert authorisation on file is past its review date.',
  ended: 'The covert authorisation on file has been ended.',
}

/**
 * Everything that has to be true before a dose is recorded.
 *
 * Returns the competence id and framework so the caller can stamp the dose with
 * them — which is the other half of the point. A dose that was permitted should
 * be able to show afterwards *why* it was permitted, under which framework, and
 * on whose authority, because that is what an inspector asks and what a
 * medication review reads.
 *
 * The order is deliberate and it is the least obvious part of this file:
 * competence, then the medicine-specific rules, then the responsible clinician
 * last. The first checks are about the individual and about the prescription;
 * the last is about the organisation. Refusing for a missing organisation-wide
 * appointment would tell a care worker on a round that the service is not
 * correctly set up, which is true and is not something they can do anything
 * about mid-round.
 */
export async function assertCanAdminister(
  ctx: AdministrationContext,
): Promise<{ frameworkId: string; competenceId: string; responsibleClinicianId: string | null }> {
  const { framework, isFallback } = await resolveOrganisationFramework(ctx.organizationId)
  const attempted = ADMINISTRATION_STATUSES.includes(ctx.status ?? 'given')

  // 1. The person, not the medicine. General competence first, because it is
  //    the gate every other one sits behind.
  const competence = await findCompetence(ctx.organizationId, ctx.staffProfileId, 'administration')
  if (!competence) {
    refuse(
      framework,
      'staff_competence_current',
      'No current medication competence assessment is recorded for you.',
    )
  }

  // 2. Controlled drugs need their own competence. This is the check that makes
  //    `is_controlled_drug` mean something: before it, the flag was recorded on
  //    the medicine and used to draw a table, and nothing about administering
  //    one differed from administering an oral tablet.
  //
  //    Scoped to an attempt. A dose logged as `pending` or `missed` is a record
  //    that nothing was given, and refusing those writes would leave a real gap
  //    in the MAR — the opposite of what the rule is for.
  if (ctx.isControlledDrug && attempted) {
    const cdCompetence = await findCompetence(ctx.organizationId, ctx.staffProfileId, 'controlled_drugs')
    if (!cdCompetence) {
      refuse(
        framework,
        'controlled_drug_competence',
        'This is a controlled drug and you have no current controlled-drugs competence recorded.',
      )
    }

    // 3. A witness, who is not the person who gave it.
    if (framework.controlledDrugWitnessing.required) {
      if (!ctx.witnessStaffId) {
        refuse(
          framework,
          'controlled_drug_witnessed',
          'No witness was recorded for this controlled drug.',
        )
      }
      if (ctx.witnessStaffId === ctx.staffProfileId) {
        refuse(
          framework,
          'controlled_drug_witnessed',
          'The witness recorded is the same person giving the dose, which is not a witness.',
        )
      }
      if (framework.controlledDrugWitnessing.witnessMustBeCompetent) {
        const witnessCompetence = await findCompetence(ctx.organizationId, ctx.witnessStaffId!, 'controlled_drugs')
        if (!witnessCompetence) {
          refuse(
            framework,
            'controlled_drug_witnessed',
            'The person recorded as witnessing this controlled drug has no current controlled-drugs competence.',
          )
        }
      }
    }
  }

  // 4. PRN. Two separate rules and they are separate because they fail at
  //    different times: the indication belongs on the prescription, the reason
  //    belongs on the dose. A PRN medicine with no indication is caught when it
  //    is added; a PRN dose with no reason is caught here.
  if (attempted && ctx.isPrn && !ctx.prnReason?.trim()) {
    refuse(
      framework,
      'prn_reason_recorded_when_given',
      'This medicine is recorded as "as needed", so the reason has to be recorded with the dose.',
    )
  }

  // 5. Covert. Checked against the framework's own instrument, which is the
  //    rule that cannot be shared across the three.
  if (attempted && ctx.isCovert) {
    if (!ctx.personId) {
      refuse(framework, 'covert_administration_authorised', 'A covert dose has to be recorded against a person.')
    }
    const authorisation = await findCovertAuthorization(ctx.organizationId, ctx.personId!, framework, ctx.medicineName)
    if (!authorisation.ok) {
      const detail = framework.nation === 'scotland'
        ? `For this service the instrument is the ${framework.covertAuthority.instrument}, and a record made under a different instrument does not satisfy it.`
        : `For this service the instrument is the ${framework.covertAuthority.instrument}.`
      refuse(framework, 'covert_administration_authorised', `${COVERT_REASONS[authorisation.reason]} ${detail}`)
    }
  }

  // 6. The organisation, last. See the note on this function.
  const clinician = await currentResponsibleClinician(ctx.organizationId)
  if (!clinician) {
    refuse(
      framework,
      'responsible_clinician_named',
      `${isFallback ? NO_FRAMEWORK_NOTE + ' ' : ''}No registered nurse or pharmacist is recorded as responsible for medicines at this service.`,
    )
  }

  return {
    frameworkId: framework.id,
    competenceId: competence!.id,
    responsibleClinicianId: clinician!.id,
  }
}

/**
 * Whether a medicine can be added to a record, which is a different set of
 * checks from administering one.
 *
 * Split out rather than folded into `assertCanAdminister` because the PRN
 * indication is a property of the prescription and the other rules are not: you
 * can be refused a prescription for a PRN medicine with no indication by a
 * manager, hours before anyone tries to give it, and finding that out at
 * 2am on a round is the wrong time.
 */
export async function assertCanAddMedicine(
  organizationId: string,
  input: { name: string; isPrn: boolean; prnIndication?: string | null; isCovert?: boolean; personId?: string | null },
): Promise<{ frameworkId: string }> {
  const { framework } = await resolveOrganisationFramework(organizationId)

  if (input.isPrn && framework.requiresPrnIndication && !input.prnIndication?.trim()) {
    refuse(
      framework,
      'prn_indication_stated',
      `"${input.name}" is recorded as "as needed", so it needs an indication and a maximum for 24 hours before it can be added.`,
    )
  }

  // A medicine cannot be marked covert at the point it is added unless an
  // authorisation already exists for it. Checking here means a chart cannot
  // accumulate medicines that are covert-but-unauthorised while nobody is
  // looking at the rule.
  if (input.isCovert) {
    if (!input.personId) {
      refuse(framework, 'covert_administration_authorised', 'A covert medicine has to be recorded against a person.')
    }
    const authorisation = await findCovertAuthorization(organizationId, input.personId!, framework, input.name)
    if (!authorisation.ok) {
      refuse(
        framework,
        'covert_administration_authorised',
        `${COVERT_REASONS[authorisation.reason]} This service uses the ${framework.covertAuthority.instrument}.`,
      )
    }
  }

  return { frameworkId: framework.id }
}

/* ── Readiness ────────────────────────────────────────────────────────────── */

export type RuleStatus = {
  rule: MedicationRule
  met: boolean
  /** A sentence saying what is missing, in the provider's terms. Never a code. */
  detail: string
  /** How many people or records are affected, where that is meaningful. */
  count?: number
}

/**
 * Where this provider stands against the framework it actually operates under.
 *
 * Returns both the rules that gate a dose and the rules that are only
 * reported, and says which is which in every row, because a manager who cannot
 * tell the difference will read a warning as a guarantee or a guarantee as a
 * warning. Both mistakes lead to the same place: an inspection.
 */
export async function getMedicationReadiness(organizationId: string) {
  const { framework, isFallback, note, source } = await resolveOrganisationFramework(organizationId)

  const [clinician, adminCompetent, cdCompetent, prnMissing, covertProblems, reviewsOverdue, unexpiring, backfilled] =
    await Promise.all([
      currentResponsibleClinician(organizationId),
      migrateQuery(
        `SELECT COUNT(*)::int AS c FROM medication_competences
         WHERE organization_id = $1 AND scope = 'administration'
           AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`,
        [organizationId],
      ),
      migrateQuery(
        `SELECT COUNT(*)::int AS c FROM medication_competences
         WHERE organization_id = $1 AND scope = 'controlled_drugs'
           AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`,
        [organizationId],
      ),
      // Medicines that predate migration 135 and have no indication. Listed
      // rather than blocked: they are already on somebody's chart and a
      // clinician has to go and add the indication, not a constraint.
      migrateQuery(
        `SELECT COUNT(*)::int AS c FROM emedication_items i
         JOIN emedication_records r ON r.id = i.emedication_record_id
         WHERE r.organization_id = $1 AND i.is_prn = TRUE
           AND (i.prn_indication IS NULL OR btrim(i.prn_indication) = '')`,
        [organizationId],
      ),
      // Covert medicines with no usable authorisation, split by why, because
      // "wrong statutory instrument" and "no authorisation" are different
      // conversations and the second is much the more common in Scotland.
      migrateQuery(
        `SELECT COUNT(*)::int AS c FROM medication_covert_authorizations
         WHERE organization_id = $1 AND ended_at IS NULL AND (medicines IS NULL OR btrim(medicines) = '')`,
        [organizationId],
      ),
      (async () => {
        if (!framework.medicationReviewIntervalMonths) return { rows: [{ c: 0 }] }
        return migrateQuery(
          `SELECT COUNT(DISTINCT r.person_id)::int AS c
           FROM medication_reviews r
           JOIN emedication_records er ON er.person_id = r.person_id AND er.organization_id = $1
           WHERE r.organization_id = $1
             AND (r.next_review_due IS NULL OR r.next_review_due < CURRENT_DATE)`,
          [organizationId],
        )
      })(),
      migrateQuery(
        `SELECT COUNT(*)::int AS c FROM medication_competences
         WHERE organization_id = $1 AND expires_at IS NULL`,
        [organizationId],
      ),
      // How much of the assurance rests on a tick box carried over at upgrade
      // rather than on an assessment somebody entered. A provider reading
      // "12 staff competent" should be able to see that 9 of those 12 are
      // inherited claims with no assessor and no date.
      migrateQuery(
        `SELECT COUNT(*)::int AS c FROM medication_competences
         WHERE organization_id = $1 AND record_source = 'backfilled_from_staff_flag'`,
        [organizationId],
      ),
    ])

  const num = (r: { rows: Array<Record<string, unknown>> }) => Number(r.rows[0]?.c ?? 0)

  const statuses: RuleStatus[] = framework.rules.map((rule) => {
    switch (rule.id) {
      case 'responsible_clinician_named':
        return {
          rule,
          met: !!clinician,
          detail: clinician
            ? `${clinician.name} is recorded as responsible, as a ${clinician.profession.replace(/_/g, ' ')}.`
            : 'No registered nurse or pharmacist is recorded as responsible for medicines at this service.',
        }
      case 'staff_competence_current':
        return {
          rule,
          met: num(adminCompetent) > 0,
          count: num(adminCompetent),
          detail: `${num(adminCompetent)} staff member(s) hold a current medication competence assessment.`,
        }
      case 'controlled_drug_competence':
        return {
          rule,
          met: num(cdCompetent) > 0,
          count: num(cdCompetent),
          detail: `${num(cdCompetent)} staff member(s) hold a current controlled-drugs competence assessment.`,
        }
      case 'controlled_drug_witnessed':
        return {
          rule,
          met: framework.controlledDrugWitnessing.required,
          detail: framework.controlledDrugWitnessing.required
            ? 'A witness is required for every controlled drug, and is stored on the dose.'
            : 'This framework does not require a witness.',
        }
      case 'prn_indication_stated': {
        const missing = num(prnMissing)
        return {
          rule,
          met: missing === 0,
          count: missing,
          detail:
            missing === 0
              ? 'Every "as needed" medicine states what it is for.'
              : `${missing} existing "as needed" medicine(s) have no indication recorded. They predate the rule and can still be given; a clinician needs to add the indication to the prescription.`,
        }
      }
      case 'prn_reason_recorded_when_given':
        return {
          rule,
          met: true,
          detail: 'A dose of an "as needed" medicine is refused without a recorded reason.',
        }
      case 'covert_administration_authorised': {
        const blank = num(covertProblems)
        return {
          rule,
          met: blank === 0,
          count: blank,
          detail:
            blank === 0
              ? `Every covert authorisation names the medicines it covers, under the ${framework.covertAuthority.instrument}.`
              : `${blank} covert authorisation(s) do not name the medicines they cover, so they cannot be used. A covert decision has to be about a specific medicine.`,
        }
      }
      case 'structured_medication_review':
        return {
          rule,
          met: num(reviewsOverdue) === 0,
          count: num(reviewsOverdue),
          detail:
            num(reviewsOverdue) === 0
              ? 'No medication review is overdue.'
              : `${num(reviewsOverdue)} person(s) with medicines on file are past their medication review date. This does not stop a dose being recorded — refusing would push staff back onto paper — but it is the kind of thing an inspector asks about.`,
        }
      case 'self_administration_assessed':
        return {
          rule,
          met: true,
          detail: 'Self-administration is recorded as an assessed decision with a review date, not a flag on the chart.',
        }
      default:
        return { rule, met: false, detail: 'This rule has not been checked.' }
    }
  })

  const blocked = statuses.filter((s) => s.rule.enforcement === 'blocked')
  const recorded = statuses.filter((s) => s.rule.enforcement === 'recorded')

  return {
    framework: {
      id: framework.id,
      name: framework.name,
      nation: framework.nation,
      regulator: framework.regulator,
      inspected_by: framework.inspectedBy,
      covert_authority: framework.covertAuthority,
      medication_review_interval_months: framework.medicationReviewIntervalMonths,
      controlled_drug_witnessing: framework.controlledDrugWitnessing,
      requires_prn_indication: framework.requiresPrnIndication,
      // False on every entry. Returned so it is visible in the product rather
      // than only in a source file nobody opens.
      verified_against_primary_source: framework.verifiedAgainstPrimarySource,
      source_note: framework.sourceNote,
    },
    framework_source: source,
    is_fallback: isFallback,
    fallback_note: note ?? null,
    // The split, stated. A manager has to be able to tell a control from a
    // warning without reading the code, and "enforced" on its own is ambiguous
    // in the wrong direction.
    blocking_rules_total: blocked.length,
    blocking_rules_met: blocked.filter((s) => s.met).length,
    recorded_rules_total: recorded.length,
    recorded_rules_met: recorded.filter((s) => s.met).length,
    rules: statuses,
    what_differs_here: differentiatingRules(framework),
    // Said out loud, because a provider comparing their setup against a list of
    // guarantees deserves to know which of them are ours.
    assurance: `This is a list of what the software checks, not a statement that this service complies with ${framework.name}. The framework names are not verified against a primary source (see framework.source_note).`,
    stats: {
      competent_staff: num(adminCompetent),
      controlled_drug_competent_staff: num(cdCompetent),
      // Surfaced rather than hidden: a competence with no expiry is accepted by
      // the rules, and a provider should be able to see how many of their
      // staff are in that state before an inspector does.
      competences_without_expiry: num(unexpiring),
      // And the same for the ones carried over from the old boolean at upgrade.
      // These have no assessor and no scope, and a provider who believes they
      // have assessed their staff needs to be able to see that these are not
      // assessments they recorded.
      competences_backfilled_from_staff_flag: num(backfilled),
    },
  }
}

/**
 * Drop a staff member's competence, so the audit trail records who decided it
 * and when rather than the row quietly disappearing.
 *
 * Expiry is the other half and is a row update, not a delete: an assessment
 * that lapsed on its own date is a different fact from one somebody revoked.
 */
export async function revokeCompetence(
  organizationId: string,
  competenceId: string,
  revokedBy: string,
  reason: string,
): Promise<boolean> {
  try {
    const result = await migrateQuery(
      `UPDATE medication_competences
       SET notes = COALESCE(notes || E'\\n', '') || $3
       WHERE id = $1 AND organization_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM medication_competences x
           WHERE x.id = $1 AND x.notes LIKE '%Revoked%'
         )`,
      [competenceId, organizationId, `[Revoked by ${revokedBy}: ${reason}]`],
    )
    return (result.rowCount ?? 0) > 0
  } catch (err) {
    // A revocation that fails must not be reported as done.
    logger.error({ err, competenceId }, 'Failed to revoke medication competence')
    return false
  }
}
