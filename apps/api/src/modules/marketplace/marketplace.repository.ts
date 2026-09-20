import { query } from '../../shared/database';

export class MarketplaceRepository {
  static async getShiftById(shiftId: string, orgId: string) {
    const result = await query(
      `SELECT s.*, l.organization_id
       FROM shifts s JOIN locations l ON l.id = s.location_id
       WHERE s.id = $1 AND l.organization_id = $2`,
      [shiftId, orgId]
    );
    return result.rows[0] || null;
  }

  static async publishShift(shiftId: string, orgId: string) {
    const result = await query(
      `UPDATE shifts SET published_at = CURRENT_TIMESTAMP, status = 'open'
       WHERE id = $1 AND location_id IN (SELECT id FROM locations WHERE organization_id = $2)
       RETURNING *`,
      [shiftId, orgId]
    );
    return result.rows[0];
  }

  static async getAvailableShifts(orgId: string) {
    const result = await query(
      `SELECT s.*, l.name as location_name
       FROM shifts s JOIN locations l ON s.location_id = l.id
       WHERE l.organization_id = $1 AND s.published_at IS NOT NULL AND s.status = 'open'`,
      [orgId]
    );
    return result.rows;
  }

  static async applyForShift(shiftId: string, staffId: string, notes?: string) {
    const result = await query(
      'INSERT INTO shift_assignments (shift_id, staff_id, notes, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [shiftId, staffId, notes, 'assigned']
    );
    return result.rows[0];
  }
}
