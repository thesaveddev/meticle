import { query, transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

export class IncidentsRepository {
  static async findCategories(orgId: string) {
    const result = await query(
      'SELECT * FROM incident_categories WHERE organization_id = $1 ORDER BY name',
      [orgId]
    );
    return result.rows;
  }

  static async createCategory(orgId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_categories (organization_id, name, severity, is_cqc_reportable, is_active)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE)) RETURNING *`,
      [orgId, data.name, data.severity || 'medium', data.is_cqc_reportable || false, data.is_active ?? true]
    );
    return result.rows[0];
  }

  static async updateCategory(id: string, orgId: string, data: any) {
    const result = await query(
      `UPDATE incident_categories SET name = COALESCE($1, name), severity = COALESCE($2, severity),
       is_cqc_reportable = COALESCE($3, is_cqc_reportable), is_active = COALESCE($4, is_active)
       WHERE id = $5 AND organization_id = $6 RETURNING *`,
      [data.name, data.severity, data.is_cqc_reportable, data.is_active, id, orgId]
    );
    return result.rows[0] || null;
  }

  static async deleteCategory(id: string, orgId: string) {
    const result = await query(
      'DELETE FROM incident_categories WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  static async findAll(orgId: string, opts: {
    status?: string; category_id?: string; severity?: string; is_near_miss?: string;
    date_from?: string; date_to?: string; include_confidential?: boolean;
    limit?: number; offset?: number;
    reportedBy?: string;
  } = {}) {
    let sql = `SELECT i.*, to_char(i.incident_time, 'HH24:MI') AS incident_time, ic.name AS category_name, sp.first_name AS reported_by_first, sp.last_name AS reported_by_last,
                      (SELECT COUNT(*)::int FROM incident_actions ia WHERE ia.incident_id = i.id AND ia.completed_at IS NULL) AS open_actions
               FROM incidents i
               LEFT JOIN incident_categories ic ON i.category_id = ic.id
               LEFT JOIN staff_profiles sp ON i.reported_by = sp.user_id
               WHERE i.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (!opts.include_confidential) { sql += ` AND i.is_confidential = FALSE`; }
    // A support worker sees only what they raised, so filing a concern never
    // exposes them to the organisation's whole incident history.
    if (opts.reportedBy) { sql += ` AND i.reported_by = $${idx}`; params.push(opts.reportedBy); idx++; }
    if (opts.status === 'open') {
      sql += ` AND i.status IN ('reported', 'submitted', 'triaging', 'investigating', 'actioning', 'verifying', 'reopened')`;
    } else if (opts.status) {
      sql += ` AND i.status = $${idx}`; params.push(opts.status); idx++;
    }
    if (opts.category_id) { sql += ` AND i.category_id = $${idx}`; params.push(opts.category_id); idx++; }
    if (opts.severity) { sql += ` AND i.severity = $${idx}`; params.push(opts.severity); idx++; }
    if (opts.is_near_miss) { sql += ` AND i.is_near_miss = $${idx}`; params.push(opts.is_near_miss === 'true'); idx++; }
    if (opts.date_from) { sql += ` AND i.incident_date >= $${idx}`; params.push(opts.date_from); idx++; }
    if (opts.date_to) { sql += ` AND i.incident_date <= $${idx}`; params.push(opts.date_to); idx++; }
    sql += ' ORDER BY i.incident_date DESC, i.created_at DESC';
    if (opts.limit) { sql += ` LIMIT $${idx}`; params.push(opts.limit); idx++; }
    if (opts.offset) { sql += ` OFFSET $${idx}`; params.push(opts.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId?: string, includeConfidential = true) {
    const result = await query(
      `SELECT i.*, to_char(i.incident_time, 'HH24:MI') AS incident_time,
              ic.name AS category_name, sp.first_name AS reported_by_first, sp.last_name AS reported_by_last,
              hv.id AS linked_visit_id, hv.label AS linked_visit_label, hv.visit_type AS linked_visit_type,
              hv.status AS linked_visit_status, hv.scheduled_start AS linked_visit_scheduled_start,
              hv.scheduled_end AS linked_visit_scheduled_end,
              vp.first_name || ' ' || vp.last_name AS linked_visit_person_name
       FROM incidents i
       LEFT JOIN incident_categories ic ON i.category_id = ic.id
       LEFT JOIN staff_profiles sp ON i.reported_by = sp.user_id
       LEFT JOIN homecare_visits hv ON hv.id = i.visit_id AND hv.organization_id = i.organization_id
       LEFT JOIN people vp ON vp.id = hv.person_id AND vp.organization_id = i.organization_id
       WHERE i.id = $1${orgId ? ' AND i.organization_id = $2' : ''}${includeConfidential ? '' : ' AND i.is_confidential = FALSE'}`,
      orgId ? [id, orgId] : [id]
    );
    return result.rows[0] || null;
  }

  static async create(orgId: string, data: any, reportedBy: string) {
    return transaction(async client => {
      const parameters = [orgId, data.category_id, data.title, data.description, data.incident_date, data.incident_time, data.location, data.severity || 'medium', data.status, data.is_cqc_reportable || false, data.is_near_miss || false, data.is_confidential || false, data.root_cause, data.outcomes, data.investigation_notes, data.lessons_learned, data.cqc_reference, data.reported_to_cqc_at, reportedBy, data.client_submission_id || null, data.witnesses || null];
      const inserted = await client.query(
        `INSERT INTO incidents (organization_id, category_id, title, description, incident_date, incident_time, location, severity, status, is_cqc_reportable, is_near_miss, is_confidential, root_cause, outcomes, investigation_notes, lessons_learned, cqc_reference, reported_to_cqc_at, reported_by, client_submission_id, witnesses)
         VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, COALESCE($9, 'reported'), $10, COALESCE($11, FALSE), COALESCE($12, FALSE), $13, $14, $15, $16, $17, $18, $19, $20, $21)
         ON CONFLICT (organization_id, reported_by, client_submission_id) WHERE client_submission_id IS NOT NULL
         DO NOTHING
         RETURNING *, TRUE AS was_created`,
        parameters
      );
      let incident = inserted.rows[0];
      if (!incident && data.client_submission_id) {
        const existing = await client.query(
          `SELECT *, FALSE AS was_created FROM incidents
           WHERE organization_id = $1 AND reported_by = $2 AND client_submission_id = $3
           FOR UPDATE`,
          [orgId, reportedBy, data.client_submission_id]
        );
        incident = existing.rows[0];
      }
      if (!incident) throw new AppError(409, 'Could not resolve this incident submission; retry the same report');


      // Associations are created only alongside the first insert and in the
      // same transaction. A retry returns the original incident unchanged,
      // including its links, without duplicating involved-person rows.
      if (incident.was_created) {
        const personIds = Array.isArray(data.person_ids) ? [...new Set(data.person_ids)] : [];
        if (personIds.length > 0) {
          const people = await client.query(
            'SELECT id FROM people WHERE organization_id = $1 AND id = ANY($2::uuid[])',
            [orgId, personIds]
          );
          if (people.rows.length !== personIds.length) {
            throw new AppError(400, 'One or more linked people were not found in this organisation');
          }
          for (const personId of personIds) {
            await client.query(
              `INSERT INTO incident_involved_residents (incident_id, person_id, involvement_type)
               VALUES ($1, $2, 'affected')`,
              [incident.id, personId]
            );
          }
        }

        if (data.visit_id) {
          const visit = await client.query(
            'SELECT id FROM homecare_visits WHERE id = $1 AND organization_id = $2',
            [data.visit_id, orgId]
          );
          if (!visit.rows[0]) throw new AppError(400, 'Linked visit was not found in this organisation');
          const linkedVisit = await client.query(
            'UPDATE incidents SET visit_id = $1 WHERE id = $2 RETURNING visit_id',
            [data.visit_id, incident.id]
          );
          incident.visit_id = linkedVisit.rows[0].visit_id;
        }

        // A follow-up report names the closed incident it continues. The
        // target must be in this organisation; a retry reuses the first
        // insert's lineage rather than re-validating it.
        if (data.reopens_incident_id) {
          const target = await client.query(
            'SELECT id FROM incidents WHERE id = $1 AND organization_id = $2',
            [data.reopens_incident_id, orgId]
          );
          if (!target.rows[0]) throw new AppError(404, 'Incident to reopen was not found');
          const lined = await client.query(
            'UPDATE incidents SET reopened_of = $1 WHERE id = $2 RETURNING reopened_of',
            [data.reopens_incident_id, incident.id]
          );
          incident.reopened_of = lined.rows[0].reopened_of;
        }
      }

      return incident;
    });
  }

  /** Names the report's form version and current severity head. Engines own history; this moves the pointer. */
  static async setEngineLink(id: string, orgId: string, formVersionId: string | null, assessmentId: string | null) {
    const result = await query(
      `UPDATE incidents SET form_version_id = $1, current_severity_assessment_id = $2 WHERE id = $3 AND organization_id = $4 RETURNING *`,
      [formVersionId, assessmentId, id, orgId]
    );
    return result.rows[0] || null;
  }

  /** Appends form answers (cleared fields already dropped by evaluate). */
  static async saveAnswers(orgId: string, incidentId: string, formVersionId: string, userId: string, answers: Record<string, unknown>) {
    for (const [fieldKey, value] of Object.entries(answers)) {
      if (value === undefined) continue;
      await query(
        `INSERT INTO incident_answers (organization_id, incident_id, form_version_id, field_key, value, created_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
        [orgId, incidentId, formVersionId, fieldKey, JSON.stringify(value ?? null), userId]
      );
    }
  }

  static async update(id: string, data: any, orgId?: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'organization_id') {
        fields.push(`${key} = $${idx}`);
        params.push(value);
        idx++;
      }
    }
    if (fields.length === 0) return null;
    params.push(id);
    if (orgId) { params.push(orgId); }
    const result = await query(
      `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${idx}${orgId ? ` AND organization_id = $${idx + 1}` : ''} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    const result = await query(
      'DELETE FROM incidents WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  /**
   * Lifecycle transition with the guard in the WHERE clause: the update only
   * lands when the row is currently in one of the expected states, so two
   * managers racing a submit/reopen cannot both win — the loser gets zero
   * rows and the controller answers 409 instead of silently overwriting.
   */
  static async transitionStatus(id: string, orgId: string, to: string, from: string[]) {
    const result = await query(
      `UPDATE incidents SET status = $1 WHERE id = $2 AND organization_id = $3
       AND status = ANY($4::text[]) RETURNING *`,
      [to, id, orgId, from]
    );
    return result.rows[0] || null;
  }

  /** Follow-up report lineage: the new row continues a closed incident. */
  static async setReopenedOf(id: string, orgId: string, reopenedOf: string) {
    const target = await query(
      'SELECT id FROM incidents WHERE id = $1 AND organization_id = $2',
      [reopenedOf, orgId]
    );
    if (!target.rows[0]) throw new AppError(404, 'Incident to reopen was not found');
    const result = await query(
      'UPDATE incidents SET reopened_of = $1 WHERE id = $2 AND organization_id = $3 RETURNING *',
      [reopenedOf, id, orgId]
    );
    return result.rows[0] || null;
  }

  /**
   * Duplicate candidates: same category, filed within 7 days either side,
   * newest first. A heuristic, not a verdict — the manager decides via links.
   */
  static async findDuplicates(orgId: string, incidentId: string) {
    const result = await query(
      `SELECT i.id, i.title, i.status, i.severity, i.incident_date, i.location,
              ic.name AS category_name
       FROM incidents i
       LEFT JOIN incident_categories ic ON ic.id = i.category_id
       WHERE i.organization_id = $1 AND i.id != $2
         AND i.category_id IS NOT DISTINCT FROM (SELECT category_id FROM incidents WHERE id = $2)
         AND ABS(i.incident_date - (SELECT incident_date FROM incidents WHERE id = $2)) <= 7
       ORDER BY i.incident_date DESC LIMIT 10`,
      [orgId, incidentId]
    );
    return result.rows;
  }

  static async createLink(orgId: string, incidentId: string, linkedId: string, linkType: string, reason: string | undefined, userId: string) {
    for (const id of [incidentId, linkedId]) {
      const found = await query('SELECT id FROM incidents WHERE id = $1 AND organization_id = $2', [id, orgId]);
      if (!found.rows[0]) throw new AppError(404, 'Linked incident was not found');
    }
    try {
      const result = await query(
        `INSERT INTO incident_links (organization_id, incident_id, linked_incident_id, link_type, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [orgId, incidentId, linkedId, linkType, reason || null, userId]
      );
      return result.rows[0];
    } catch (err: any) {
      if (err?.code === '23505') throw new AppError(409, 'These incidents are already linked this way');
      throw err;
    }
  }

  static async getLinks(orgId: string, incidentId: string) {
    const result = await query(
      `SELECT l.*, i.title AS linked_title, i.status AS linked_status, i.severity AS linked_severity
       FROM incident_links l
       JOIN incidents i ON i.id = l.linked_incident_id
       WHERE l.organization_id = $1 AND l.incident_id = $2
       ORDER BY l.created_at DESC`,
      [orgId, incidentId]
    );
    return result.rows;
  }

  static async deleteLink(orgId: string, linkId: string) {
    const result = await query(
      'DELETE FROM incident_links WHERE id = $1 AND organization_id = $2 RETURNING id',
      [linkId, orgId]
    );
    return result.rows[0] || null;
  }

  // === Closeout (P3-P5) ===

  /** At most one investigation per incident; a retry returns the open one. */
  static async startInvestigation(orgId: string, incidentId: string, userId: string, leadId?: string, summary?: string) {
    const existing = await query(
      'SELECT * FROM incident_investigations WHERE organization_id = $1 AND incident_id = $2',
      [orgId, incidentId]
    );
    if (existing.rows[0]) return { investigation: existing.rows[0], duplicate: true };
    const result = await query(
      `INSERT INTO incident_investigations (organization_id, incident_id, lead_id, summary, started_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, incidentId, leadId || null, summary || null, userId]
    );
    return { investigation: result.rows[0], duplicate: false };
  }

  static async getInvestigation(orgId: string, incidentId: string) {
    const inv = (await query(
      `SELECT inv.*, sp.first_name AS lead_first, sp.last_name AS lead_last
       FROM incident_investigations inv
       LEFT JOIN staff_profiles sp ON sp.user_id = inv.lead_id
       WHERE inv.organization_id = $1 AND inv.incident_id = $2`,
      [orgId, incidentId]
    )).rows[0];
    if (!inv) return null;
    const notes = (await query(
      `SELECT n.*, COALESCE(sp.first_name, u.email) AS author
       FROM incident_investigation_notes n
       LEFT JOIN users u ON u.id = n.created_by
       LEFT JOIN staff_profiles sp ON sp.user_id = n.created_by
       WHERE n.organization_id = $1 AND n.investigation_id = $2 ORDER BY n.created_at ASC`,
      [orgId, inv.id]
    )).rows;
    return { ...inv, notes };
  }

  static async addInvestigationNote(orgId: string, investigationId: string, userId: string, note: string) {
    const inv = (await query(
      'SELECT * FROM incident_investigations WHERE id = $1 AND organization_id = $2',
      [investigationId, orgId]
    )).rows[0];
    if (!inv) throw new AppError(404, 'Investigation not found');
    if (inv.status !== 'open') throw new AppError(409, 'This investigation is complete; findings are immutable');
    const result = await query(
      `INSERT INTO incident_investigation_notes (organization_id, investigation_id, note, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, investigationId, note, userId]
    );
    return result.rows[0];
  }

  static async completeInvestigation(orgId: string, investigationId: string, userId: string, summary?: string) {
    const result = await query(
      `UPDATE incident_investigations SET status = 'complete', summary = COALESCE($3, summary),
       completed_by = $4, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND organization_id = $2 AND status = 'open' RETURNING *`,
      [investigationId, orgId, summary || null, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Verification is the check after the doing: only a completed action can be
   * verified, and the rating says whether the fix worked. Re-verification
   * overwrites (the action row is working state) but every verification is
   * audited, so the trail stays answerable.
   */
  static async verifyAction(orgId: string, actionId: string, userId: string, effectiveness: string, notes?: string) {
    const action = (await query(
      `SELECT ia.* FROM incident_actions ia JOIN incidents i ON i.id = ia.incident_id
       WHERE ia.id = $1 AND i.organization_id = $2`,
      [actionId, orgId]
    )).rows[0];
    if (!action) return null;
    if (!action.completed_at) throw new AppError(409, 'Only a completed action can be verified');
    const result = await query(
      `UPDATE incident_actions SET verified_by = $2, verified_at = CURRENT_TIMESTAMP,
       effectiveness = $3, effectiveness_notes = $4 WHERE id = $1 RETURNING *`,
      [actionId, userId, effectiveness, notes || null]
    );
    return result.rows[0];
  }

  static async createReportingAssessment(orgId: string, incidentId: string, userId: string, data: { reportable: boolean; channel?: string; reference?: string; reported_at?: string }) {
    const result = await query(
      `INSERT INTO incident_reporting_assessments (organization_id, incident_id, reportable, channel, reference, reported_at, decided_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, incidentId, data.reportable, data.channel || 'CQC', data.reference || null, data.reported_at || null, userId]
    );
    return result.rows[0];
  }

  static async listReportingAssessments(orgId: string, incidentId: string) {
    const result = await query(
      `SELECT r.*, COALESCE(sp.first_name, u.email) AS decided_by_name
       FROM incident_reporting_assessments r
       LEFT JOIN users u ON u.id = r.decided_by
       LEFT JOIN staff_profiles sp ON sp.user_id = r.decided_by
       WHERE r.organization_id = $1 AND r.incident_id = $2 ORDER BY r.created_at DESC`,
      [orgId, incidentId]
    );
    return result.rows;
  }

  /**
   * Suggested (draft) actions. Re-running suggest converges: identical text
   * for the same incident is one draft, never two, via the unique pair.
   */
  static async proposeSuggestions(orgId: string, incidentId: string, userId: string, suggestions: Array<{ action: string; dueInDays: number; ruleKey: string; source: string }>) {
    for (const s of suggestions) {
      await query(
        `INSERT INTO incident_action_suggestions (organization_id, incident_id, action, due_date, source, rule_key, created_by)
         VALUES ($1, $2, $3, CURRENT_DATE + ($4 || ' days')::interval, $5, $6, $7)
         ON CONFLICT (incident_id, action) DO NOTHING`,
        [orgId, incidentId, s.action.slice(0, 500), s.dueInDays, s.source, s.ruleKey, userId]
      );
    }
    return IncidentsRepository.listSuggestions(orgId, incidentId);
  }

  static async listSuggestions(orgId: string, incidentId: string) {
    const result = await query(
      `SELECT s.*, COALESCE(sp.first_name, u.email) AS decided_by_name
       FROM incident_action_suggestions s
       LEFT JOIN users u ON u.id = s.decided_by
       LEFT JOIN staff_profiles sp ON sp.user_id = s.decided_by
       WHERE s.organization_id = $1 AND s.incident_id = $2 ORDER BY s.created_at ASC`,
      [orgId, incidentId]
    );
    return result.rows;
  }

  /**
   * A draft becomes work only here. Approving inserts the real action and
   * marks the draft; rejecting records the reason. Decided drafts are final.
   */
  static async decideSuggestion(orgId: string, suggestionId: string, userId: string, decision: 'approved' | 'rejected', reason?: string) {
    const suggestion = (await query(
      'SELECT * FROM incident_action_suggestions WHERE id = $1 AND organization_id = $2',
      [suggestionId, orgId]
    )).rows[0];
    if (!suggestion) return null;
    if (suggestion.status !== 'proposed') throw new AppError(409, 'This suggestion was already decided');
    let action: unknown = null;
    if (decision === 'approved') {
      const created = await query(
        `INSERT INTO incident_actions (incident_id, action, assigned_to, due_date)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [suggestion.incident_id, suggestion.action, suggestion.assigned_to, suggestion.due_date]
      );
      action = created.rows[0];
    }
    const updated = (await query(
      `UPDATE incident_action_suggestions SET status = $1, decided_by = $2, decided_at = CURRENT_TIMESTAMP,
       decision_reason = $3 WHERE id = $4 RETURNING *`,
      [decision, userId, reason || null, suggestionId]
    )).rows[0];
    return { suggestion: updated, action };
  }

  /**
   * Everything close checks, in one place so the endpoint and the UI read
   * the same blockers: an open investigation, completed-but-unverified
   * actions, and a missing external-reporting decision on a reportable
   * incident. Open (incomplete) actions do not block — they survive closure
   * and stay assigned.
   */
  static async closeBlockers(orgId: string, incidentId: string) {
    const incident = (await query('SELECT * FROM incidents WHERE id = $1 AND organization_id = $2', [incidentId, orgId])).rows[0];
    if (!incident) return null;
    const openInv = (await query(
      `SELECT id FROM incident_investigations WHERE organization_id = $1 AND incident_id = $2 AND status = 'open' LIMIT 1`,
      [orgId, incidentId]
    )).rows[0];
    const unverified = (await query(
      `SELECT COUNT(*)::int AS n FROM incident_actions
       WHERE incident_id = $1 AND completed_at IS NOT NULL AND verified_at IS NULL`,
      [incidentId]
    )).rows[0].n as number;
    const openActions = (await query(
      `SELECT COUNT(*)::int AS n FROM incident_actions
       WHERE incident_id = $1 AND completed_at IS NULL AND status != 'cancelled'`,
      [incidentId]
    )).rows[0].n as number;
    const reporting = (await query(
      'SELECT id FROM incident_reporting_assessments WHERE organization_id = $1 AND incident_id = $2 LIMIT 1',
      [orgId, incidentId]
    )).rows[0];
    const blockers: string[] = [];
    if (openInv) blockers.push('Investigation is still open');
    if (unverified > 0) blockers.push(`${unverified} completed action${unverified > 1 ? 's are' : ' is'} not yet verified`);
    if (incident.is_cqc_reportable && !reporting) blockers.push('CQC-reportable incident needs a reporting assessment');
    return { incident, blockers, openActions: openActions as number };
  }

  static async getInvolvedResidents(incidentId: string) {
    const result = await query(
      `SELECT iir.*, su.first_name, su.last_name, su.room_number
       FROM incident_involved_residents iir
       LEFT JOIN people su ON iir.person_id = su.id
       WHERE iir.incident_id = $1 ORDER BY iir.created_at`,
      [incidentId]
    );
    return result.rows;
  }

  static async addInvolvedResident(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_involved_residents (incident_id, person_id, involvement_type, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [incidentId, data.person_id, data.involvement_type || 'affected', data.notes]
    );
    return result.rows[0];
  }

  static async removeInvolvedResident(id: string) {
    await query('DELETE FROM incident_involved_residents WHERE id = $1', [id]);
  }

  static async getActions(incidentId: string) {
    const result = await query(
      `SELECT ia.*, sp.first_name AS assigned_first, sp.last_name AS assigned_last
       FROM incident_actions ia
       LEFT JOIN staff_profiles sp ON ia.assigned_to = sp.user_id
       WHERE ia.incident_id = $1 ORDER BY ia.created_at`,
      [incidentId]
    );
    return result.rows;
  }

  static async createAction(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_actions (incident_id, action, assigned_to, due_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [incidentId, data.action, data.assigned_to, data.due_date]
    );
    return result.rows[0];
  }

  private static readonly ACTION_UPDATE_COLUMNS = ['action', 'assigned_to', 'due_date', 'completed_at', 'status'] as const;

  static async updateAction(id: string, data: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (IncidentsRepository.ACTION_UPDATE_COLUMNS as readonly string[]).includes(key)) {
        fields.push(`${key} = $${idx}`);
        params.push(value);
        idx++;
      }
    }
    if (fields.length === 0) return null;
    params.push(id);
    const result = await query(
      `UPDATE incident_actions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async completeAction(id: string) {
    const result = await query(
      `UPDATE incident_actions SET completed_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async deleteAction(id: string) {
    await query('DELETE FROM incident_actions WHERE id = $1', [id]);
  }

  static async getAttachments(incidentId: string) {
    const result = await query(
      `SELECT ia.*, sp.first_name AS uploaded_first, sp.last_name AS uploaded_last
       FROM incident_attachments ia
       LEFT JOIN staff_profiles sp ON ia.uploaded_by = sp.user_id
       WHERE ia.incident_id = $1 ORDER BY ia.created_at DESC`,
      [incidentId]
    );
    return result.rows;
  }

  static async addAttachment(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_attachments (incident_id, file_name, file_url, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [incidentId, data.file_name, data.file_url, data.file_type, data.file_size, data.uploaded_by]
    );
    return result.rows[0];
  }

  static async deleteAttachment(id: string) {
    await query('DELETE FROM incident_attachments WHERE id = $1', [id]);
  }

  static async getStats(orgId: string, includeConfidential = true) {
    const scope = includeConfidential ? '' : ' AND is_confidential = FALSE';
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'reported')::int AS reported,
        COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE is_cqc_reportable = TRUE AND status != 'closed')::int AS pending_cqc,
        COUNT(*) FILTER (WHERE is_near_miss = TRUE)::int AS near_misses,
        COUNT(*) FILTER (WHERE is_confidential = TRUE)::int AS confidential
      FROM incidents WHERE organization_id = $1${scope}
    `, [orgId]);

    const actions = await query(`
      SELECT
        COUNT(*)::int AS total_actions,
        COUNT(*) FILTER (WHERE ia.completed_at IS NULL AND ia.status != 'cancelled')::int AS open_actions,
        COUNT(*) FILTER (WHERE ia.completed_at IS NULL AND ia.status != 'cancelled' AND ia.due_date < CURRENT_DATE)::int AS overdue_actions
      FROM incident_actions ia
      JOIN incidents i ON ia.incident_id = i.id
      WHERE i.organization_id = $1${scope}
    `, [orgId]);

    return { ...result.rows[0], ...actions.rows[0] };
  }

  static async getTimeline(incidentId: string) {
    const result = await query(
      `SELECT created_at, 'incident.created' AS event, 'Incident reported' AS title, NULL::text AS detail
       FROM incidents WHERE id = $1
       UNION ALL
       SELECT al.created_at, 'audit.' || al.action AS event,
              CASE al.action
                WHEN 'create' THEN 'Incident created'
                WHEN 'update' THEN 'Incident updated'
                WHEN 'status' THEN 'Status changed'
                WHEN 'delete' THEN 'Incident removed'
                WHEN 'action_create' THEN 'Action added'
                WHEN 'action_update' THEN 'Action updated'
                WHEN 'action_complete' THEN 'Action completed'
                WHEN 'action_delete' THEN 'Action removed'
                WHEN 'involved_add' THEN 'Person linked'
                WHEN 'involved_remove' THEN 'Person unlinked'
                WHEN 'attachment_upload' THEN 'Evidence attached'
                WHEN 'attachment_delete' THEN 'Evidence removed'
                ELSE 'Change recorded'
              END AS title,
              COALESCE(sp.first_name || ' ' || sp.last_name, u.email, 'System') AS detail
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE al.entity_type = 'incident' AND al.entity_id = $1
       ORDER BY created_at DESC
      `,
      [incidentId]
    );
    return result.rows;
  }
}
