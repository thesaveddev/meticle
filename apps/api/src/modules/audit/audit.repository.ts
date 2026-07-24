import { query } from '../../shared/database';
import logger from '../../shared/utils/logger';

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
        [user_id, action, entity_type, entity_id, old_data, new_data, ip_address]
      );
    } catch (err) {
      logger.error({ err }, 'Audit log failed');
    }
  }

  static async getLogs(filters: any) {
    const { action, entity_type, entity_id, user_id, service_user_id, limit: limitParam } = filters || {};
    let sql = `SELECT al.*, u.email as user_email, COALESCE(sp.first_name || ' ' || sp.last_name, u.email) as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id LEFT JOIN staff_profiles sp ON u.id = sp.user_id`;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (action) { conditions.push(`al.action = $${idx++}`); params.push(action); }
    if (entity_type) { conditions.push(`al.entity_type = $${idx++}`); params.push(entity_type); }
    if (entity_id) { conditions.push(`al.entity_id = $${idx++}`); params.push(entity_id); }
    if (user_id) { conditions.push(`al.user_id = $${idx++}`); params.push(user_id); }
    if (service_user_id) {
      conditions.push(`(
        al.entity_id = $${idx}
        OR al.entity_id IN (SELECT id FROM daily_notes WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM care_plans WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM risk_assessments WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM family_contacts WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM care_assessments WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM body_map_entries WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM memory_book_entries WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM service_user_goals WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM clinical_scores WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM service_user_documents WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM su_wellbeing WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM su_communication_log WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM su_capacity_assessments WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM su_care_pathways WHERE service_user_id = $${idx})
        OR al.entity_id IN (SELECT id FROM su_discharge_checklist WHERE service_user_id = $${idx})
      )`);
      params.push(service_user_id);
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
