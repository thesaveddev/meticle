import { query } from '../../shared/database';

export interface FormFieldInput {
  field_key: string;
  label: string;
  help?: string | null;
  type?: string;
  section?: string | null;
  ordering?: number;
  required?: boolean;
  validation?: Record<string, unknown>;
  options?: unknown[];
  defaults?: unknown;
  visibility?: unknown;
  requiredness?: unknown;
  readonly_conditions?: unknown;
  repeating?: unknown;
  hidden_policy?: string;
  sensitivity?: string;
  analytics_mapping?: string | null;
  severity_deps?: unknown;
}

/** Built-in starter library (§3): one general form so every org can file from day one. */
const STARTER_FIELDS: FormFieldInput[] = [
  { field_key: 'category', label: 'Category', type: 'select', section: 'What happened', ordering: 1, required: true, options: ['falls', 'medication', 'safeguarding', 'behaviour', 'equipment', 'other'] },
  { field_key: 'occurred_at', label: 'When did it happen', type: 'datetime', section: 'What happened', ordering: 2, required: true },
  { field_key: 'location', label: 'Where did it happen', type: 'text', section: 'What happened', ordering: 3, required: true, validation: { maxLength: 300 } },
  { field_key: 'description', label: 'What happened', type: 'textarea', section: 'What happened', ordering: 4, required: true, validation: { minLength: 10, maxLength: 5000 } },
  { field_key: 'harm_level', label: 'Actual harm', type: 'radio', section: 'Harm', ordering: 5, required: true, options: ['none', 'minor', 'moderate', 'severe', 'death', 'unknown'] },
  { field_key: 'witnesses', label: 'Witnesses', type: 'textarea', section: 'People', ordering: 6, hidden_policy: 'retain_excluded', validation: { maxLength: 2000 } },
  { field_key: 'immediate_action', label: 'Immediate action taken', type: 'textarea', section: 'Response', ordering: 7, validation: { maxLength: 2000 } },
];

export class IncidentFormsRepository {
  static async getPublishedByKey(orgId: string, key: string) {
    const def = await query(
      `SELECT * FROM incident_form_definitions WHERE organization_id = $1 AND key = $2 AND status = 'published' ORDER BY version DESC LIMIT 1`,
      [orgId, key],
    );
    if (!def.rows.length) return null;
    // Definitions carry their published snapshots in the versions table.
    const ver = await query(
      `SELECT * FROM incident_form_versions WHERE definition_id = $1 ORDER BY version DESC LIMIT 1`,
      [def.rows[0].id],
    );
    const fields = ver.rows.length
      ? (await query(`SELECT * FROM incident_field_definitions WHERE form_version_id = $1 ORDER BY ordering ASC`, [ver.rows[0].id])).rows
      : [];
    return { definition: def.rows[0], version: ver.rows[0] ?? null, fields };
  }

  static async getVersionWithFields(orgId: string, versionId: string) {
    const ver = await query(`SELECT * FROM incident_form_versions WHERE id = $1 AND organization_id = $2`, [versionId, orgId]);
    if (!ver.rows.length) return null;
    const fields = (await query(`SELECT * FROM incident_field_definitions WHERE form_version_id = $1 ORDER BY ordering ASC`, [versionId])).rows;
    return { version: ver.rows[0], fields };
  }

  static async createDraft(orgId: string, userId: string, input: { key: string; name: string; fields: FormFieldInput[] }) {
    const def = (
      await query(
        `INSERT INTO incident_form_definitions (organization_id, key, name, status, version, created_by)
         VALUES ($1, $2, $3, 'draft', 1, $4)
         ON CONFLICT (organization_id, key, version) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [orgId, input.key, input.name, userId],
      )
    ).rows[0];
    const ver = (
      await query(
        `INSERT INTO incident_form_versions (organization_id, definition_id, version, snapshot, created_by)
         VALUES ($1, $2, 1, '{}'::jsonb, $3) RETURNING *`,
        [orgId, def.id, userId],
      )
    ).rows[0];
    await this.replaceFields(orgId, ver.id, input.fields);
    return { definition: def, version: ver, fields: await this.listFields(ver.id) };
  }

  static async publish(orgId: string, definitionId: string, userId: string) {
    const def = (await query(`SELECT * FROM incident_form_definitions WHERE id = $1 AND organization_id = $2`, [definitionId, orgId])).rows[0];
    if (!def) return null;
    await query(
      `UPDATE incident_form_definitions SET status = 'published', effective_from = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [definitionId],
    );
    // Freeze an immutable snapshot of the draft's fields at publish time.
    const fields = await this.listFieldsByDefinition(orgId, definitionId);
    const latest = (await query(`SELECT COALESCE(MAX(version), 0)::int AS v FROM incident_form_versions WHERE definition_id = $1`, [definitionId])).rows[0].v as number;
    const ver = (
      await query(
        `INSERT INTO incident_form_versions (organization_id, definition_id, version, snapshot, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
        [orgId, definitionId, latest + 1, JSON.stringify({ fields }), userId],
      )
    ).rows[0];
    for (const f of fields) {
      await query(
        `INSERT INTO incident_field_definitions (organization_id, form_version_id, field_key, label, help, type, section, ordering, required, validation, options, defaults, visibility, requiredness, readonly_conditions, repeating, hidden_policy, sensitivity, analytics_mapping, severity_deps)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,$20::jsonb)`,
        [orgId, ver.id, f.field_key, f.label, f.help ?? null, f.type, f.section ?? null, f.ordering ?? 0, f.required ?? false, JSON.stringify(f.validation ?? {}), JSON.stringify(f.options ?? []), JSON.stringify(f.defaults ?? null), JSON.stringify(f.visibility ?? null), JSON.stringify(f.requiredness ?? null), JSON.stringify(f.readonly_conditions ?? null), JSON.stringify(f.repeating ?? null), f.hidden_policy ?? 'clear', f.sensitivity ?? 'standard', f.analytics_mapping ?? null, JSON.stringify(f.severity_deps ?? null)],
      );
    }
    void userId;
    return { definition: { ...def, status: 'published' }, version: ver };
  }

  static async listFields(versionId: string) {
    return (await query(`SELECT * FROM incident_field_definitions WHERE form_version_id = $1 ORDER BY ordering ASC`, [versionId])).rows;
  }

  private static async listFieldsByDefinition(orgId: string, definitionId: string) {
    // Draft fields live on the earliest version row until first publish freezes them.
    const ver = (await query(`SELECT * FROM incident_form_versions WHERE definition_id = $1 AND organization_id = $2 ORDER BY version ASC LIMIT 1`, [definitionId, orgId])).rows[0];
    if (!ver) return [];
    return (await query(`SELECT * FROM incident_field_definitions WHERE form_version_id = $1 ORDER BY ordering ASC`, [ver.id])).rows;
  }

  private static async replaceFields(orgId: string, versionId: string, fields: FormFieldInput[]) {
    await query(`DELETE FROM incident_field_definitions WHERE form_version_id = $1 AND organization_id = $2`, [versionId, orgId]);
    let order = 1;
    for (const f of fields) {
      await query(
        `INSERT INTO incident_field_definitions (organization_id, form_version_id, field_key, label, help, type, section, ordering, required, validation, options, defaults, visibility, requiredness, readonly_conditions, repeating, hidden_policy, sensitivity, analytics_mapping, severity_deps)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,$20::jsonb)`,
        [orgId, versionId, f.field_key, f.label, f.help ?? null, f.type ?? 'text', f.section ?? null, f.ordering ?? order++, f.required ?? false, JSON.stringify(f.validation ?? {}), JSON.stringify(f.options ?? []), JSON.stringify(f.defaults ?? null), JSON.stringify(f.visibility ?? null), JSON.stringify(f.requiredness ?? null), JSON.stringify(f.readonly_conditions ?? null), JSON.stringify(f.repeating ?? null), f.hidden_policy ?? 'clear', f.sensitivity ?? 'standard', f.analytics_mapping ?? null, JSON.stringify(f.severity_deps ?? null)],
      );
    }
  }

  /** Lazily seeds the starter library so a fresh org can file before configuring anything. */
  static async ensureStarter(orgId: string, userId: string) {
    const existing = await query(`SELECT 1 FROM incident_form_definitions WHERE organization_id = $1 AND key = 'general'`, [orgId]);
    if (existing.rows.length) return;
    const created = await this.createDraft(orgId, userId, { key: 'general', name: 'General incident report', fields: STARTER_FIELDS });
    await this.publish(orgId, created.definition.id, userId);
  }
}
