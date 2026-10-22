import { query } from '../../shared/database';
import { assessSeverity, hashInputs, type SeverityInputs } from './incident-severity.assess';

const DEFAULT_WEIGHTS = { harm: 40, potential: 25, urgency: 20, recurrence: 10, vulnerability: 5 };

export class IncidentSeverityRepository {
  static async activeRules(orgId: string) {
    const r = await query(
      `SELECT * FROM incident_severity_rules WHERE organization_id = $1 AND status = 'active' ORDER BY version DESC LIMIT 1`,
      [orgId],
    );
    return r.rows[0] ?? null;
  }

  static async ensureDefaults(orgId: string, userId: string) {
    const existing = await query(`SELECT 1 FROM incident_severity_rules WHERE organization_id = $1`, [orgId]);
    if (existing.rows.length) return;
    await query(
      `INSERT INTO incident_severity_rules (organization_id, version, status, dimensions, weights, escalation_conditions, effective_from, approved_by)
       VALUES ($1, 1, 'active', '{}'::jsonb, $2::jsonb, '[]'::jsonb, CURRENT_TIMESTAMP, $3)`,
      [orgId, JSON.stringify(DEFAULT_WEIGHTS), userId],
    );
  }

  static async assess(orgId: string, userId: string, incidentId: string, inputs: SeverityInputs) {
    await this.ensureDefaults(orgId, userId);
    const rules = await this.activeRules(orgId);
    const result = assessSeverity(inputs, { weights: rules?.weights ?? DEFAULT_WEIGHTS, escalation_conditions: rules?.escalation_conditions ?? [] });
    const inputsHash = hashInputs(inputs as Record<string, unknown>);
    const prev = (
      await query(`SELECT id FROM incident_severity_assessments WHERE incident_id = $1 AND organization_id = $2 ORDER BY created_at DESC LIMIT 1`, [incidentId, orgId])
    ).rows[0];
    const row = (
      await query(
        `INSERT INTO incident_severity_assessments (organization_id, incident_id, rules_version, inputs_hash, dimensions, score, level, provisional, explanation, missing, decided_by, supersedes_id)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12) RETURNING *`,
        [orgId, incidentId, rules?.version ?? 1, inputsHash, JSON.stringify(result.dimensions), result.score, result.level, result.provisional, JSON.stringify(result.explanation), JSON.stringify(result.missing), userId, prev?.id ?? null],
      )
    ).rows[0];
    return { assessment: row, result };
  }

  static async override(orgId: string, userId: string, assessmentId: string, level: string, reason: string) {
    const current = (await query(`SELECT * FROM incident_severity_assessments WHERE id = $1 AND organization_id = $2`, [assessmentId, orgId])).rows[0];
    if (!current) return null;
    const row = (
      await query(
        `INSERT INTO incident_severity_assessments (organization_id, incident_id, rules_version, inputs_hash, dimensions, score, level, provisional, explanation, missing, decided_by, override_reason, supersedes_id)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,false,$8::jsonb,$9::jsonb,$10,$11,$12) RETURNING *`,
        [orgId, current.incident_id, current.rules_version, current.inputs_hash, JSON.stringify(current.dimensions), current.score, level, JSON.stringify([...(current.explanation as unknown[]), { rule: 'override', detail: reason }]), JSON.stringify(current.missing), userId, reason, current.id],
      )
    ).rows[0];
    return row;
  }

  static async history(orgId: string, incidentId: string) {
    return (await query(`SELECT * FROM incident_severity_assessments WHERE incident_id = $1 AND organization_id = $2 ORDER BY created_at ASC`, [incidentId, orgId])).rows;
  }
}
