import { query } from '../../shared/database';
import logger from '../../shared/utils/logger';

const SENSITIVE_FIELDS = new Set([
  'password', 'password_hash', 'newPassword', 'confirmPassword',
  'nhs_number', 'nhsNumber', 'ni_number', 'niNumber',
  'date_of_birth', 'dateOfBirth',
  'phone', 'telephone', 'mobile',
  'address_line1', 'addressLine1', 'address_line2', 'addressLine2',
  'city', 'postcode', 'address',
  'bank_account', 'bankAccount', 'sort_code', 'sortCode',
  'national_insurance', 'nationalInsurance',
  'mfa_secret', 'mfaSecret', 'backup_codes', 'backupCodes',
  'token', 'refreshToken', 'mfaToken', 'secret',
]);

function redactAuditData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactAuditData);

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactAuditData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export class AuditRepository {
  static async log(data: {
    user_id?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    old_data?: any;
    new_data?: any;
    ip_address?: string;
  }) {
    try {
      const { user_id, action, entity_type, entity_id, old_data, new_data, ip_address } = data;
      await query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [user_id, action, entity_type, entity_id, redactAuditData(old_data), redactAuditData(new_data), ip_address]
      );
    } catch (err) {
      logger.error({ err }, 'Audit log failed');
    }
  }

  static async getLogs(filters: any) {
    const { action, entity_type, entity_id, user_id, person_id, limit: limitParam } = filters || {};
    let sql = `SELECT al.*, u.email as user_email, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id LEFT JOIN staff_profiles sp ON u.id = sp.user_id`;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (action) { conditions.push(`al.action = $${idx++}`); params.push(action); }
    if (entity_type) { conditions.push(`al.entity_type = $${idx++}`); params.push(entity_type); }
    if (entity_id) { conditions.push(`al.entity_id = $${idx++}`); params.push(entity_id); }
    if (user_id) { conditions.push(`al.user_id = $${idx++}`); params.push(user_id); }
    if (person_id) {
      conditions.push(`(
        al.entity_id = $${idx}
        OR al.entity_id IN (SELECT id FROM daily_notes WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM care_plans WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM risk_assessments WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM family_contacts WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM care_assessments WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM body_map_entries WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM memory_book_entries WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_goals WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM clinical_scores WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_documents WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_wellbeing WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_communication_log WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_capacity_assessments WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_care_pathways WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_time_away WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM person_discharge_checklist WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM health_observations WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM bowel_movements WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM dental_records WHERE person_id = $${idx})
        OR al.entity_id IN (SELECT id FROM fluid_intake WHERE person_id = $${idx})
      )`);
      params.push(person_id);
      idx++;
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const limit = Math.min(parseInt(limitParam) || 100, 500);
    sql += ' ORDER BY al.created_at DESC LIMIT $' + idx;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  }
}
