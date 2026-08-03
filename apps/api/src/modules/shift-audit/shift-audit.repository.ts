import { query, migrateQuery } from '../../shared/database';

export class ShiftAuditRepository {
  static async getShiftsForDate(organizationId: string, date: string) {
    const result = await query(
      `SELECT
        s.id,
        s.start_time,
        s.end_time,
        s.status,
        s.shift_type,
        l.id AS location_id,
        l.name AS location_name,
        l.minimum_staff_per_day,
        su.id AS person_id,
        su.first_name AS su_first_name,
        su.last_name AS su_last_name,
        d.name AS department_name
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      LEFT JOIN people su ON s.person_id = su.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE l.organization_id = $1
        AND s.start_time::date = $2::date
      ORDER BY l.name, s.start_time`,
      [organizationId, date]
    );
    return result.rows;
  }

  static async getShiftAssignments(shiftIds: string[]) {
    if (shiftIds.length === 0) return [];
    const result = await query(
      `SELECT
        sa.shift_id,
        sa.status AS assignment_status,
        sa.is_overtime,
        sp.id AS staff_id,
        sp.first_name,
        sp.last_name,
        u.email,
        u.role AS user_role
      FROM shift_assignments sa
      JOIN staff_profiles sp ON sa.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE sa.shift_id = ANY($1)
      ORDER BY sp.first_name, sp.last_name`,
      [shiftIds]
    );
    return result.rows;
  }

  static async getEmedicationAdministrations(
    personIds: string[],
    date: string
  ) {
    if (personIds.length === 0) return [];
    const result = await query(
      `SELECT
        ea.emedication_item_id,
        ei.name AS medication_name,
        ei.dosage,
        ei.is_prn,
        er.person_id,
        ea.status AS admin_status,
        ea.scheduled_time
      FROM emedication_administrations ea
      JOIN emedication_items ei ON ea.emedication_item_id = ei.id
      JOIN emedication_records er ON ei.emedication_record_id = er.id
      WHERE er.person_id = ANY($1)
        AND ea.scheduled_time::date = $2::date
        AND er.status = 'active'
      ORDER BY er.person_id, ei.name, ea.scheduled_time`,
      [personIds, date]
    );
    return result.rows;
  }

  static async getLocationManagers(organizationId: string) {
    const result = await query(
      `SELECT DISTINCT
        l.id AS location_id,
        l.name AS location_name,
        COALESCE(l.manager_id, (
          SELECT sp2.user_id
          FROM staff_profiles sp2
          JOIN users u2 ON sp2.user_id = u2.id
          WHERE u2.role = 'MANAGER'
            AND u2.organization_id = $1
            AND sp2.location_id = l.id
          LIMIT 1
        )) AS manager_user_id,
        COALESCE(mgr.email, (
          SELECT u3.email
          FROM staff_profiles sp3
          JOIN users u3 ON sp3.user_id = u3.id
          WHERE u3.role = 'MANAGER'
            AND u3.organization_id = $1
            AND sp3.location_id = l.id
          LIMIT 1
        )) AS manager_email,
        COALESCE(
          COALESCE(msp.first_name || ' ' || msp.last_name, ''),
          (SELECT u4.email
           FROM staff_profiles sp4
           JOIN users u4 ON sp4.user_id = u4.id
           WHERE u4.role = 'MANAGER'
             AND u4.organization_id = $1
             AND sp4.location_id = l.id
           LIMIT 1)
        ) AS manager_name
      FROM locations l
      LEFT JOIN users mgr ON l.manager_id = mgr.id
      LEFT JOIN staff_profiles msp ON l.manager_id = msp.user_id
      WHERE l.organization_id = $1`,
      [organizationId]
    );
    return result.rows;
  }

  static async getAllOrgIds(): Promise<string[]> {
    // Background job context (no authenticated RLS session): iterate all orgs
    // with shifts today via the superuser pool.
    const result = await migrateQuery(
      `SELECT DISTINCT l.organization_id
       FROM shifts s
       JOIN locations l ON s.location_id = l.id
       WHERE s.start_time::date = CURRENT_DATE`
    );
    return result.rows.map((r: any) => r.organization_id).filter(Boolean);
  }
}
