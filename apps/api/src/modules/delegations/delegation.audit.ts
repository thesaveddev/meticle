import { query } from '../../shared/database';
import { logWarn } from '../../shared/utils/logger';

export const logDelegationAction = async (
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string
) => {
  try {
    // Find active delegation where this user is the delegate
    const del = await query(
      `SELECT id, primary_manager_id FROM manager_delegations
       WHERE delegate_manager_id = $1 AND is_active = true
         AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (del.rows.length === 0) return;
    await query(
      `INSERT INTO delegation_audit_logs (delegation_id, delegate_user_id, primary_manager_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [del.rows[0].id, userId, del.rows[0].primary_manager_id, action, entityType || null, entityId || null, details || null]
    );
  } catch { /* audit logging is non-critical */ }
};
