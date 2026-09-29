/**
 * Recording the things the medicines-in-care rules depend on.
 *
 * Separate from `emedication.controller.ts` because this is a different kind of
 * endpoint: those record a dose, these record the *standing* that makes a dose
 * lawful — who is responsible, who is assessed, who has authorised what. Mixing
 * them put a "who is your responsible clinician" form on the same page as a MAR
 * chart, which invites the reader to think they are the same size of decision.
 *
 * Everything here is ORG_ADMIN or MANAGER. That is not a tidiness choice: a
 * care worker who could record their own competence assessment could mark
 * themselves competent, and a self-assessment is not an assessment.
 */

import { Request, Response } from 'express'
import { AppError } from '../../shared/middleware/error.middleware'
import { query, migrateQuery } from '../../shared/database'
import {
  assertCanAddMedicine,
  currentResponsibleClinician,
  getMedicationReadiness,
  resolveOrganisationFramework,
  revokeCompetence,
  CompetenceScope,
} from './medicationRules'
import { listMedicationFrameworks, differentiatingRules, NO_FRAMEWORK_NOTE } from './medicationFrameworks'

const orgId = (req: Request): string => {
  const id = req.user?.organizationId
  if (!id) throw new AppError(403, 'Organization context required')
  return id
}

/**
 * The scopes a competence can be recorded in.
 *
 * Wider than the ones the administration rules check, because the same table
 * records an assessor for self-administration assessments, which no write path
 * consults. A rule that is recorded but not enforced is a different thing from
 * a rule that is neither, and keeping them in one table is what lets the
 * readiness report say which is which.
 */
const VALID_SCOPES: Array<CompetenceScope | 'self_administration_assessment'> = [
  'administration',
  'controlled_drugs',
  'measuring_and_injecting',
  'self_administration_assessment',
]

export class MedicationGovernanceController {
  /**
   * The framework this provider operates under, and what it requires.
   *
   * Readable by any authenticated user in the organisation, not just managers.
   * A care worker who is about to be refused a dose is the person who most needs
   * to know which framework refused them and what the rule says — and the
   * refusal message is the same text.
   */
  static async getFramework(req: Request, res: Response) {
    const oid = orgId(req)
    const { framework, isFallback, note, source } = await resolveOrganisationFramework(oid)
    res.json({
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
        verified_against_primary_source: framework.verifiedAgainstPrimarySource,
        source_note: framework.sourceNote,
        note: framework.note,
      },
      resolved_from: source,
      is_fallback: isFallback,
      fallback_note: note ?? null,
      // The rules, split. A reader who sees nine identical rules and one
      // different one has learned something; a reader shown ten undifferentiated
      // rows has not.
      rules: framework.rules,
      what_differs_here: differentiatingRules(framework),
      all_frameworks: listMedicationFrameworks().map((f) => ({
        id: f.id, name: f.name, nation: f.nation, regulator: f.regulator, inspected_by: f.inspectedBy,
        note: f.note, source_note: f.sourceNote, verified_against_primary_source: f.verifiedAgainstPrimarySource,
      })),
    })
  }

  /** Where this provider stands against its framework, rule by rule. */
  static async getReadiness(req: Request, res: Response) {
    res.json(await getMedicationReadiness(orgId(req)))
  }

  /* ── The responsible clinician ────────────────────────────────────────── */

  static async listResponsibleClinicians(req: Request, res: Response) {
    const result = await query(
      `SELECT rc.*, COALESCE(sp.first_name || ' ' || sp.last_name, 'Unnamed') AS staff_name
       FROM medication_responsible_clinicians rc
       JOIN staff_profiles sp ON sp.id = rc.staff_id
       WHERE rc.organization_id = $1
       ORDER BY rc.ended_at NULLS FIRST, rc.appointed_at DESC`,
      [orgId(req)],
    )
    res.json(result.rows)
  }

  /**
   * Appoint the named responsible clinician.
   *
   * Ending the previous one is done in the same statement rather than left to
   * the caller, because two current responsible clinicians is a state a provider
   * should not be able to be in by forgetting to close one. The history is
   * kept: `ended_at` is set, the row stays, and "who was accountable when" is
   * exactly the question an inspection opens with.
   */
  static async appointResponsibleClinician(req: Request, res: Response) {
    const oid = orgId(req)
    const { staff_id, profession, registration_number, ends_at, notes } = req.body as {
      staff_id: string
      profession: 'registered_nurse' | 'registered_pharmacist'
      registration_number?: string
      ends_at?: string
      notes?: string
    }
    if (!staff_id || !profession) {
      throw new AppError(400, 'staff_id and profession are required')
    }
    if (profession !== 'registered_nurse' && profession !== 'registered_pharmacist') {
      // Checked here as well as by the CHECK constraint, so the refusal is a
      // sentence about the profession rather than a 500 from the database.
      throw new AppError(400, 'profession must be registered_nurse or registered_pharmacist. Those are the two the frameworks name.')
    }

    const staff = await query(
      `SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND u.organization_id = $2`,
      [staff_id, oid],
    )
    if (!staff.rows[0]) throw new AppError(404, 'Staff member not found in this organisation')

    const result = await migrateQuery(
      `UPDATE medication_responsible_clinicians
       SET ended_at = NOW()
       WHERE organization_id = $1 AND ended_at IS NULL`,
      [oid],
    )
    const created = await migrateQuery(
      `INSERT INTO medication_responsible_clinicians
         (organization_id, staff_id, profession, registration_number, ends_at, appointed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [oid, staff_id, profession, registration_number || null, ends_at || null, req.user!.userId, notes || null],
    )
    res.status(201).json({
      ...created.rows[0],
      previous_appointments_ended: result.rowCount ?? 0,
    })
  }

  static async endResponsibleClinician(req: Request, res: Response) {
    const result = await migrateQuery(
      `UPDATE medication_responsible_clinicians SET ended_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND ended_at IS NULL`,
      [req.params.id, orgId(req)],
    )
    if (!result.rowCount) throw new AppError(404, 'No current appointment with that id')
    res.json({ ended: true })
  }

  /* ── Competence ──────────────────────────────────────────────────────── */

  static async listCompetences(req: Request, res: Response) {
    const result = await query(
      `SELECT c.*, COALESCE(s.first_name || ' ' || s.last_name, 'Unnamed') AS staff_name,
              COALESCE(a.first_name || ' ' || a.last_name, 'Unnamed') AS assessor_name,
              (c.expires_at IS NOT NULL AND c.expires_at < CURRENT_DATE) AS is_expired
       FROM medication_competences c
       JOIN staff_profiles s ON s.id = c.staff_id
       JOIN staff_profiles a ON a.id = c.assessed_by
       WHERE c.organization_id = $1
       ORDER BY s.last_name NULLS FIRST, c.scope, c.assessed_at DESC`,
      [orgId(req)],
    )
    res.json(result.rows)
  }

  /**
   * Record a competence assessment.
   *
   * `assessed_by` is required and is not allowed to be the person being
   * assessed. A person who signs off their own medication competence is not
   * assessed, and the frameworks do not describe that as an assessment — but
   * making it a database CHECK would have stopped a manager recording an
   * external assessor's name, so the constraint is here, in the one place that
   * can explain why.
   */
  static async recordCompetence(req: Request, res: Response) {
    const oid = orgId(req)
    const { staff_id, scope, framework, assessed_by, assessed_at, expires_at, reference, notes } = req.body as {
      staff_id: string
      scope: string
      framework?: string
      assessed_by?: string
      assessed_at?: string
      expires_at?: string | null
      reference?: string
      notes?: string
    }
    if (!staff_id || !scope) throw new AppError(400, 'staff_id and scope are required')
    if (!VALID_SCOPES.includes(scope as CompetenceScope)) {
      throw new AppError(400, `scope must be one of ${VALID_SCOPES.join(', ')}`)
    }

    // Defaults the assessor to the caller, which is a manager, and refuses the
    // self-assessment case explicitly rather than allowing it by default.
    const assessor = assessed_by || (await EMedicationControllerStaffId(req, oid))
    if (!assessor) throw new AppError(400, 'assessed_by is required, and there is no staff profile to default it to')
    if (assessor === staff_id) {
      throw new AppError(400, 'A staff member cannot be the assessor for their own medication competence. Record who assessed it instead.')
    }

    const staffCheck = await query(
      `SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1 AND u.organization_id = $2`,
      [staff_id, oid],
    )
    if (!staffCheck.rows[0]) throw new AppError(404, 'Staff member not found in this organisation')

    const { framework: orgFramework } = await resolveOrganisationFramework(oid)
    const usedFramework = framework || orgFramework.id

    const result = await migrateQuery(
      `INSERT INTO medication_competences
         (organization_id, staff_id, scope, framework, assessed_by, assessed_at, expires_at, reference, notes)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), $7, $8, $9)
       RETURNING *`,
      [oid, staff_id, scope, usedFramework, assessor, assessed_at || null, expires_at || null, reference || null, notes || null],
    )

    // The old boolean is kept in step, because other code still reads it and a
    // staff record that says "not competent" next to a recorded assessment is
    // its own small confusion. Written only when the assessment is for the
    // general administration scope, which is what that column has always meant.
    if (scope === 'administration') {
      await migrateQuery('UPDATE staff_profiles SET medication_competent = TRUE WHERE id = $1', [staff_id])
    }

    res.status(201).json(result.rows[0])
  }

  /**
   * Revoke a competence.
   *
   * Rows are not deleted, so the history of who was cleared to do what stays
   * on the record, and the readiness report stops counting them because the
   * revocation is appended to the notes rather than to a status column the
   * rules would have to learn to read.
   */
  static async revokeCompetence(req: Request, res: Response) {
    const oid = orgId(req)
    const reason = (req.body as { reason?: string }).reason
    if (!reason) throw new AppError(400, 'A reason is required to revoke a competence, and it is stored with the revocation')
    const done = await revokeCompetence(oid, req.params.id, req.user!.userId, reason)
    if (!done) throw new AppError(404, 'Competence not found in this organisation, or already revoked')
    res.json({ revoked: true })
  }

  /* ── Covert administration ────────────────────────────────────────────── */

  static async listCovertAuthorizations(req: Request, res: Response) {
    const result = await query(
      `SELECT c.*, COALESCE(p.first_name || ' ' || p.last_name, 'Unnamed') AS person_name
       FROM medication_covert_authorizations c
       LEFT JOIN people p ON p.id = c.person_id
       WHERE c.organization_id = $1
       ORDER BY c.ended_at NULLS FIRST, c.authorised_at DESC`,
      [orgId(req)],
    )
    res.json(result.rows)
  }

  /**
   * Record a covert administration authorisation.
   *
   * The `authority` is the whole point of this endpoint, so the error message
   * for the wrong one is specific. A Scottish provider sending an English
   * best-interests record gets told which instrument this framework uses,
   * because the most likely thing that has happened is that somebody has given
   * them a template from the wrong country.
   */
  static async createCovertAuthorization(req: Request, res: Response) {
    const oid = orgId(req)
    const { person_id, authority, medicines, protocol_reference, review_due, notes } = req.body as {
      person_id: string
      authority: string
      medicines: string
      protocol_reference?: string
      review_due?: string
      notes?: string
    }
    if (!person_id || !authority) throw new AppError(400, 'person_id and authority are required')
    if (!medicines || !medicines.trim()) {
      throw new AppError(400, 'medicines is required. A covert authorisation has to name the medicine it covers — a blanket one is what these frameworks exist to prevent.')
    }

    const { framework } = await resolveOrganisationFramework(oid)
    const expected = framework.nation === 'scotland' ? 'mental_welfare_act_s19' : 'mental_capacity_act_best_interests'
    if (authority !== expected) {
      throw new AppError(
        400,
        `This service operates under ${framework.name}, which expects covert administration to rest on the ${framework.covertAuthority.instrument}. ` +
          `Record the authority as "${expected}". ${framework.covertAuthority.requires}`,
      )
    }

    const result = await migrateQuery(
      `INSERT INTO medication_covert_authorizations
         (organization_id, person_id, framework, authority, protocol_reference, medicines, authorised_by, review_due, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [oid, person_id, framework.id, authority, protocol_reference || null, medicines, req.user!.userId, review_due || null, notes || null],
    )
    res.status(201).json(result.rows[0])
  }

  static async endCovertAuthorization(req: Request, res: Response) {
    const result = await migrateQuery(
      `UPDATE medication_covert_authorizations SET ended_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND ended_at IS NULL`,
      [req.params.id, orgId(req)],
    )
    if (!result.rowCount) throw new AppError(404, 'No current authorisation with that id')
    res.json({ ended: true })
  }

  /* ── Medication reviews ───────────────────────────────────────────────── */

  static async listReviews(req: Request, res: Response) {
    const result = await query(
      `SELECT r.*, COALESCE(p.first_name || ' ' || p.last_name, 'Unnamed') AS person_name
       FROM medication_reviews r
       LEFT JOIN people p ON p.id = r.person_id
       WHERE r.organization_id = $1
       ORDER BY r.reviewed_at DESC LIMIT 200`,
      [orgId(req)],
    )
    res.json(result.rows)
  }

  static async createReview(req: Request, res: Response) {
    const oid = orgId(req)
    const { person_id, next_review_due, conducted_by, outcome, notes, reviewed_at } = req.body as {
      person_id: string
      next_review_due?: string
      conducted_by?: string
      outcome?: string
      notes?: string
      reviewed_at?: string
    }
    if (!person_id) throw new AppError(400, 'person_id is required')

    const { framework } = await resolveOrganisationFramework(oid)

    // The next review date is derived from the framework when the caller does
    // not state one, because the interval is the framework's and not the
    // typist's. A caller who states a later one is allowed to: some services
    // review more often than the minimum, and that is their judgement.
    const derived =
      next_review_due ||
      (framework.medicationReviewIntervalMonths
        ? new Date(Date.now() + framework.medicationReviewIntervalMonths * 30.44 * 86400000).toISOString().slice(0, 10)
        : null)

    const result = await migrateQuery(
      `INSERT INTO medication_reviews
         (organization_id, person_id, framework, reviewed_at, next_review_due, reviewed_by, conducted_by, outcome, notes)
       VALUES ($1, $2, $3, COALESCE($4, NOW()), $5, $6, $7, $8, $9)
       RETURNING *`,
      [oid, person_id, framework.id, reviewed_at || null, derived, req.user!.userId, conducted_by || null, outcome || null, notes || null],
    )
    res.status(201).json(result.rows[0])
  }

  /**
   * Check a medicine against the framework without saving it.
   *
   * Exists because the rules that block a prescription can be checked by the
   * person writing it rather than discovered by the person trying to give it.
   * Returns the rule text rather than a boolean, for the same reason the
   * refusals do.
   */
  static async checkMedicine(req: Request, res: Response) {
    const { name, is_prn, prn_indication, is_covert, person_id } = req.body as {
      name: string
      is_prn?: boolean
      prn_indication?: string
      is_covert?: boolean
      person_id?: string
    }
    if (!name) throw new AppError(400, 'name is required')
    try {
      await assertCanAddMedicine(orgId(req), {
        name,
        isPrn: !!is_prn,
        prnIndication: prn_indication,
        isCovert: !!is_covert,
        personId: person_id,
      })
      res.json({ allowed: true })
    } catch (err) {
      if (err instanceof AppError) {
        res.status(200).json({ allowed: false, reason: err.message })
        return
      }
      throw err
    }
  }
}

/** The caller's own staff profile, used to default the assessor. */
async function EMedicationControllerStaffId(req: Request, oid: string): Promise<string | null> {
  const result = await query(
    `SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
     WHERE sp.user_id = $1 AND u.organization_id = $2`,
    [req.user!.userId, oid],
  )
  return result.rows[0]?.id ?? null
}

export { NO_FRAMEWORK_NOTE }
