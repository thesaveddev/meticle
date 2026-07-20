import { query } from '../../shared/database';

export interface StaffProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  employment_status: string;
  birth_date?: Date;
  created_at: Date;
}

export class StaffRepository {
  static async createProfile(data: Partial<StaffProfileRow>): Promise<StaffProfileRow> {
    const { user_id, first_name, last_name, employment_status, birth_date } = data;
    const result = await query(
      'INSERT INTO staff_profiles (user_id, first_name, last_name, employment_status, birth_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, first_name, last_name, employment_status, birth_date]
    );
    return result.rows[0];
  }

  static async getProfileByUserId(userId: string): Promise<StaffProfileRow | null> {
    const result = await query('SELECT * FROM staff_profiles WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  static async addQualification(staffId: string, name: string, issueDate?: string, expiryDate?: string) {
    return query(
      'INSERT INTO qualifications (staff_id, name, issue_date, expiry_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [staffId, name, issueDate, expiryDate]
    );
  }

  static async addSkill(staffId: string, name: string) {
    return query('INSERT INTO skills (staff_id, name) VALUES ($1, $2) RETURNING *', [staffId, name]);
  }

  static async getSkills(staffId: string) {
    const result = await query('SELECT * FROM skills WHERE staff_id = $1 ORDER BY name', [staffId]);
    return result.rows;
  }

  static async deleteSkill(skillId: string) {
    return query('DELETE FROM skills WHERE id = $1', [skillId]);
  }

  static async addEmergencyContact(staffId: string, name: string, relationship: string, phone: string) {
    return query(
      'INSERT INTO emergency_contacts (staff_id, name, relationship, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [staffId, name, relationship, phone]
    );
  }

  static async getEmergencyContacts(staffId: string) {
    const result = await query('SELECT * FROM emergency_contacts WHERE staff_id = $1 ORDER BY name', [staffId]);
    return result.rows;
  }

  static async deleteEmergencyContact(contactId: string) {
    return query('DELETE FROM emergency_contacts WHERE id = $1', [contactId]);
  }
  static async updateDepartment(staffId: string, departmentId: string | null) {
    return query('UPDATE staff_profiles SET department_id = $1 WHERE id = $2 RETURNING *', [departmentId, staffId]);
  }

  static async getStaffByDepartment(departmentId: string) {
    const result = await query(
      `SELECT sp.*, u.email, u.role, u.status as user_status
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.department_id = $1
       ORDER BY sp.first_name, sp.last_name`,
      [departmentId]
    );
    return result.rows;
  }

  static async savePreferences(userId: string, data: any) {
    const { availability, preferred_locations, min_pay_rate, max_travel_distance } = data;
    return query(
      `INSERT INTO carer_preferences (user_id, availability, preferred_locations, min_pay_rate, max_travel_distance)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
       availability = EXCLUDED.availability,
       preferred_locations = EXCLUDED.preferred_locations,
       min_pay_rate = EXCLUDED.min_pay_rate,
       max_travel_distance = EXCLUDED.max_travel_distance,
       updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, JSON.stringify(availability), preferred_locations, min_pay_rate, max_travel_distance]
    );
  }
}
