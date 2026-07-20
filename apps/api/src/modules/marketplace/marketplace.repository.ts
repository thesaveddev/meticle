import { query } from '../../shared/database';

export class MarketplaceRepository {
  static async getShiftById(shiftId: string) {
    const result = await query('SELECT * FROM shifts WHERE id = $1', [shiftId]);
    return result.rows[0] || null;
  }

  static async publishShift(shiftId: string) {
    const result = await query(
      "UPDATE shifts SET published_at = CURRENT_TIMESTAMP, status = 'open' WHERE id = $1 RETURNING *",
      [shiftId]
    );
    return result.rows[0];
  }

  static async getAvailableShifts() {
    const result = await query(
      "SELECT s.*, l.name as location_name FROM shifts s JOIN locations l ON s.location_id = l.id WHERE published_at IS NOT NULL AND status = 'open'"
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
