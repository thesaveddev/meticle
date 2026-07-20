import { query } from '../../shared/database';

export class ReportingRepository {
  static async getComplianceAudit() {
    const result = await query(`
      SELECT 
        s.first_name, 
        s.last_name, 
        d.type as document_type, 
        d.expiry_date, 
        d.status as document_status,
        CASE WHEN d.expiry_date < CURRENT_DATE THEN 'EXPIRED' ELSE 'VALID' END as status
      FROM staff_profiles s
      LEFT JOIN documents d ON s.id = d.staff_id
      ORDER BY s.last_name, s.first_name
    `);
    return result.rows;
  }

  static async getStaffingStats() {
    const result = await query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM shifts 
      GROUP BY status
    `);
    return result.rows;
  }
}
