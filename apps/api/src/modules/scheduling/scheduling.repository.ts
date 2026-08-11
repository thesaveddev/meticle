import { query, transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

export class SchedulingRepository {
  static async checkLocationStaffCap(locationId: string, date: Date, additionalStaff: number, excludeShiftId?: string, shiftType?: string) {
    const locResult = await query('SELECT minimum_staff_per_day, min_day_staff, min_night_staff, min_sleep_staff FROM locations WHERE id = $1', [locationId]);
    const minStaff = parseInt(locResult.rows[0]?.minimum_staff_per_day) || 0;
    const minDay = parseInt(locResult.rows[0]?.min_day_staff) || 1;
    const minNight = parseInt(locResult.rows[0]?.min_night_staff) || 1;
    const minSleep = parseInt(locResult.rows[0]?.min_sleep_staff) || 0;

    // Check overall cap
    if (minStaff > 0) {
      let countQuery = `SELECT COUNT(DISTINCT sa.staff_id) as cnt
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.location_id = $1 AND s.start_time::date = $2::date`;
      const params: any[] = [locationId, date.toISOString()];
      if (excludeShiftId) {
        countQuery += ' AND sa.shift_id != $3';
        params.push(excludeShiftId);
      }
      const staffCount = await query(countQuery, params);
      const currentAssigned = parseInt(staffCount.rows[0]?.cnt) || 0;
      if (currentAssigned + additionalStaff > minStaff) {
        throw new AppError(409, `Location requires a maximum of ${minStaff} staff per day. Current: ${currentAssigned}, adding: ${additionalStaff}`);
      }
    }

    // Check shift-type-specific cap
    if (shiftType) {
      const typeMin = shiftType === 'sleep' ? minSleep : (shiftType === 'wake_night' ? minNight : minDay);
      if (typeMin > 0) {
        let typeCountQuery = `SELECT COUNT(DISTINCT sa.staff_id) as cnt
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE s.location_id = $1 AND s.start_time::date = $2::date AND s.shift_type = $3`;
        const typeParams: any[] = [locationId, date.toISOString(), shiftType];
        if (excludeShiftId) {
          typeCountQuery += ' AND sa.shift_id != $4';
          typeParams.push(excludeShiftId);
        }
        const typeStaffCount = await query(typeCountQuery, typeParams);
        const currentTypeAssigned = parseInt(typeStaffCount.rows[0]?.cnt) || 0;
        if (currentTypeAssigned + additionalStaff > typeMin) {
          throw new AppError(409, `Location requires a maximum of ${typeMin} ${shiftType} staff per day. Current: ${currentTypeAssigned}, adding: ${additionalStaff}`);
        }
      }
    }
  }

  static async createShift(data: any) {
    const { location_id, department_id, start_time, end_time, assigned_staff_ids = [], person_id, shift_type } = data;
    return transaction(async (client) => {
      // Check staff cap per location per day (including shift-type-specific caps)
      if (assigned_staff_ids.length > 0) {
        const date = new Date(start_time);
        const locResult = await client.query('SELECT minimum_staff_per_day, min_day_staff, min_night_staff, min_sleep_staff FROM locations WHERE id = $1', [location_id]);
        const minStaff = parseInt(locResult.rows[0]?.minimum_staff_per_day) || 0;
        const minDay = parseInt(locResult.rows[0]?.min_day_staff) || 1;
        const minNight = parseInt(locResult.rows[0]?.min_night_staff) || 1;
        const minSleep = parseInt(locResult.rows[0]?.min_sleep_staff) || 0;

        if (minStaff > 0) {
          const staffCount = await client.query(
            `SELECT COUNT(DISTINCT sa.staff_id) as cnt FROM shift_assignments sa
             JOIN shifts s ON sa.shift_id = s.id
             WHERE s.location_id = $1 AND s.start_time::date = $2::date`,
            [location_id, date.toISOString()]
          );
          const currentAssigned = parseInt(staffCount.rows[0]?.cnt) || 0;
          if (currentAssigned + assigned_staff_ids.length > minStaff) {
            throw new AppError(409, `Location requires a maximum of ${minStaff} staff per day. Current: ${currentAssigned}, adding: ${assigned_staff_ids.length}`);
          }
        }

        // Check shift-type-specific cap
        const st = shift_type || 'day';
        const typeMin = st === 'sleep' ? minSleep : (st === 'wake_night' ? minNight : minDay);
        if (typeMin > 0) {
          const typeStaffCount = await client.query(
            `SELECT COUNT(DISTINCT sa.staff_id) as cnt FROM shift_assignments sa
             JOIN shifts s ON sa.shift_id = s.id
             WHERE s.location_id = $1 AND s.start_time::date = $2::date AND s.shift_type = $3`,
            [location_id, date.toISOString(), st]
          );
          const currentTypeAssigned = parseInt(typeStaffCount.rows[0]?.cnt) || 0;
          if (currentTypeAssigned + assigned_staff_ids.length > typeMin) {
            throw new AppError(409, `Location requires a maximum of ${typeMin} ${st} staff per day. Current: ${currentTypeAssigned}, adding: ${assigned_staff_ids.length}`);
          }
        }
      }

      const status = assigned_staff_ids.length > 0 ? 'filled' : 'open';
      const result = await client.query(
        'INSERT INTO shifts (location_id, department_id, start_time, end_time, status, person_id, shift_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [location_id, department_id || null, start_time, end_time, status, person_id || null, shift_type || 'day']
      );
      const shift = result.rows[0];
      for (const staffId of assigned_staff_ids) {
        await client.query(
          'INSERT INTO shift_assignments (shift_id, staff_id) VALUES ($1, $2)',
          [shift.id, staffId]
        );
      }
      return shift;
    });
  }

  static async getShifts(filters: any) {
    const { start_date, end_date, location_id, organization_id, managed_location_ids } = filters;
    let sql = `SELECT s.*, l.name as location_name, su.first_name as su_first_name, su.last_name as su_last_name
      FROM shifts s JOIN locations l ON s.location_id = l.id
      LEFT JOIN people su ON s.person_id = su.id
      WHERE s.end_time > $1 AND s.start_time < $2 AND l.organization_id = $3`;
    const params: any[] = [start_date, end_date, organization_id];
    let paramIdx = 4;
    if (location_id) {
      sql += ` AND s.location_id = $${paramIdx}`;
      params.push(location_id);
      paramIdx++;
    } else if (managed_location_ids && managed_location_ids.length > 0) {
      sql += ` AND s.location_id = ANY($${paramIdx}::uuid[])`;
      params.push(managed_location_ids);
      paramIdx++;
    }
    sql += ' ORDER BY s.start_time';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getShiftById(id: string) {
    const result = await query(
      `SELECT s.*, l.name as location_name, su.first_name as su_first_name, su.last_name as su_last_name
       FROM shifts s JOIN locations l ON s.location_id = l.id
       LEFT JOIN people su ON s.person_id = su.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async updateShift(id: string, data: any) {
    const { location_id, department_id, start_time, end_time, status, person_id, shift_type } = data;
    const result = await query(
      `UPDATE shifts SET
        location_id = COALESCE($1, location_id),
        department_id = COALESCE($2, department_id),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time),
        status = COALESCE($5, status),
        person_id = CASE WHEN $6::uuid IS NOT NULL THEN $6::uuid ELSE person_id END,
        shift_type = COALESCE($7, shift_type)
       WHERE id = $8 RETURNING *`,
      [location_id, department_id, start_time, end_time, status, person_id, shift_type, id]
    );
    return result.rows[0] || null;
  }

  static async deleteShift(id: string) {
    await query('DELETE FROM shifts WHERE id = $1', [id]);
  }

  static async assignStaff(shiftId: string, staffId: string, isOvertimeOverride?: boolean) {
    return transaction(async (client) => {
      const shiftResult = await client.query(
        `SELECT s.*, l.name as location_name, l.organization_id
         FROM shifts s JOIN locations l ON s.location_id = l.id
         WHERE s.id = $1`,
        [shiftId]
      );
      const shift = shiftResult.rows[0];
      if (!shift) throw new AppError(404, 'Shift not found');

      // Check staff cap per location per day
      const locResult2 = await client.query('SELECT minimum_staff_per_day, min_day_staff, min_night_staff, min_sleep_staff FROM locations WHERE id = $1', [shift.location_id]);
      const minStaff = parseInt(locResult2.rows[0]?.minimum_staff_per_day) || 0;
      const minDay = parseInt(locResult2.rows[0]?.min_day_staff) || 1;
      const minNight = parseInt(locResult2.rows[0]?.min_night_staff) || 1;
      const minSleep = parseInt(locResult2.rows[0]?.min_sleep_staff) || 0;
      if (minStaff > 0) {
        const staffCount = await client.query(
          `SELECT COUNT(DISTINCT sa.staff_id) as cnt FROM shift_assignments sa
           JOIN shifts s ON sa.shift_id = s.id
           WHERE s.location_id = $1 AND s.start_time::date = $2::date AND sa.staff_id != $3`,
          [shift.location_id, shift.start_time, staffId]
        );
        const currentAssigned = parseInt(staffCount.rows[0]?.cnt) || 0;
        if (currentAssigned + 1 > minStaff) {
          throw new AppError(409, `Location requires a maximum of ${minStaff} staff per day. Currently ${currentAssigned} staff assigned.`);
        }
      }
      // Check shift-type-specific cap
      const st = shift.shift_type || 'day';
      const typeMin = st === 'sleep' ? minSleep : (st === 'wake_night' ? minNight : minDay);
      if (typeMin > 0) {
        const typeStaffCount = await client.query(
          `SELECT COUNT(DISTINCT sa.staff_id) as cnt FROM shift_assignments sa
           JOIN shifts s ON sa.shift_id = s.id
           WHERE s.location_id = $1 AND s.start_time::date = $2::date AND s.shift_type = $3 AND sa.staff_id != $4`,
          [shift.location_id, shift.start_time, st, staffId]
        );
        const currentTypeAssigned = parseInt(typeStaffCount.rows[0]?.cnt) || 0;
        if (currentTypeAssigned + 1 > typeMin) {
          throw new AppError(409, `Location requires a maximum of ${typeMin} ${st} staff per day. Currently ${currentTypeAssigned} ${st} staff assigned.`);
        }
      }

      // Verify staff compliance meets org minimum
      await this.checkStaffCompliance(shift.organization_id, staffId, client);

      // Verify staff is not on leave during shift
      const leaveResult = await client.query(
        `SELECT id FROM leave_requests WHERE staff_id = $1 AND status = 'approved'
         AND start_date <= $3::date AND end_date >= $2::date LIMIT 1`,
        [staffId, shift.start_time, shift.end_time]
      );
      if (leaveResult.rows.length > 0) throw new AppError(409, 'Staff member is on approved leave during this shift');

      const hasConflict = await this.checkStaffShiftConflict(staffId, shift.start_time, shift.end_time);
      if (hasConflict) throw new AppError(409, 'Staff member already assigned to a shift during this time');

      const alreadyAssigned = await client.query(
        'SELECT id FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2',
        [shiftId, staffId]
      );
      if (alreadyAssigned.rows.length > 0) throw new AppError(409, 'Staff member is already assigned to this shift');

      const isOvertime = isOvertimeOverride !== undefined ? isOvertimeOverride : await this.checkOvertimeExceeded(staffId, shift.start_time, shift.end_time);

      const result = await client.query(
        'INSERT INTO shift_assignments (shift_id, staff_id, is_overtime) VALUES ($1, $2, $3) RETURNING *',
        [shiftId, staffId, isOvertime]
      );
      await client.query("UPDATE shifts SET status = 'filled' WHERE id = $1", [shiftId]);
      return { ...result.rows[0], is_overtime: isOvertime };
    });
  }

  static async unassignStaff(shiftId: string, staffId: string) {
    return transaction(async (client) => {
      const shiftResult = await client.query(
        `SELECT s.*, l.minimum_staff_per_day
         FROM shifts s JOIN locations l ON s.location_id = l.id
         WHERE s.id = $1`,
        [shiftId]
      );
      const shift = shiftResult.rows[0];
      if (!shift) throw new AppError(404, 'Shift not found');

      // Check if we'd fall below minimum staffing for this location on this day
      if (shift.minimum_staff_per_day > 0) {
        const staffOnDay = await client.query(
          `SELECT COUNT(DISTINCT sa.staff_id) as cnt
           FROM shift_assignments sa
           JOIN shifts s2 ON sa.shift_id = s2.id
           WHERE s2.location_id = $1 AND s2.start_time::date = $2::date
             AND sa.staff_id != $3`,
          [shift.location_id, shift.start_time, staffId]
        );
        if (parseInt(staffOnDay.rows[0]?.cnt || '0') < shift.minimum_staff_per_day) {
          throw new AppError(409, `Cannot unassign: location requires a minimum of ${shift.minimum_staff_per_day} staff on this day`);
        }
      }

      const result = await client.query(
        'DELETE FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2 RETURNING *',
        [shiftId, staffId]
      );
      const remaining = await client.query(
        'SELECT COUNT(*) FROM shift_assignments WHERE shift_id = $1',
        [shiftId]
      );
      if (parseInt(remaining.rows[0].count) === 0) {
        await client.query("UPDATE shifts SET status = 'open' WHERE id = $1", [shiftId]);
      }
      return result.rows[0];
    });
  }

  static async getShiftAssignments(shiftId: string) {
    const result = await query(
      `SELECT sa.*, sp.first_name, sp.last_name, sp.profile_picture_url
       FROM shift_assignments sa
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE sa.shift_id = $1`,
      [shiftId]
    );
    return result.rows;
  }

  /** Batch fetch assignments for multiple shifts — single query */
  static async getAssignmentsBatch(shiftIds: string[]) {
    if (shiftIds.length === 0) return {};
    const result = await query(
      `SELECT sa.*, sp.first_name, sp.last_name, sp.profile_picture_url
       FROM shift_assignments sa
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE sa.shift_id = ANY($1::uuid[])`,
      [shiftIds]
    );
    const byShift: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!byShift[row.shift_id]) byShift[row.shift_id] = [];
      byShift[row.shift_id].push(row);
    }
    return byShift;
  }

  static async getAvailableStaff(orgId: string, startTime: string, endTime: string) {
    const result = await query(
      `WITH org_min AS (
         SELECT COALESCE(minimum_compliance_percent, 100) as min_pct FROM organizations WHERE id = $1
       ),
       staff_compliance AS (
         SELECT sp.id as staff_id,
           COUNT(cr.id) FILTER (WHERE cr.status = 'complete') as completed_count,
           COUNT(cr.id) as total_count
         FROM staff_profiles sp
         LEFT JOIN compliance_records cr ON cr.staff_id = sp.id
         JOIN users u ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.status = 'active'
         GROUP BY sp.id
       )
       SELECT u.id as user_id, sp.id as staff_id, sp.first_name, sp.last_name, u.role,
               sp.contracted_hours_weekly, sp.max_hours_weekly, l.name as location_name,
               CASE WHEN sc.total_count > 0
                 THEN ROUND((sc.completed_count::DECIMAL / sc.total_count) * 100)
                 ELSE 100
               END as compliance_pct
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN locations l ON sp.location_id = l.id
        LEFT JOIN staff_compliance sc ON sc.staff_id = sp.id
        CROSS JOIN org_min
        WHERE u.organization_id = $1 AND u.status = 'active'
         AND u.id NOT IN (
           SELECT lr2.staff_id FROM leave_requests lr2
           JOIN staff_profiles sp2 ON lr2.staff_id = sp2.id
           WHERE sp2.user_id = u.id AND lr2.status IN ('approved')
           AND lr2.start_date <= $3::date AND lr2.end_date >= $2::date
         )
         AND (sc.total_count IS NULL OR (sc.completed_count::DECIMAL / sc.total_count * 100) >= org_min.min_pct)
       ORDER BY sp.first_name`,
      [orgId, startTime, endTime]
    );
    return result.rows;
  }

  static async getStaffList(orgId: string) {
    const result = await query(
      `WITH staff_compliance AS (
         SELECT sp.id as staff_id,
           COUNT(cr.id) FILTER (WHERE cr.status = 'complete') as completed_count,
           COUNT(cr.id) as total_count
         FROM staff_profiles sp
         LEFT JOIN compliance_records cr ON cr.staff_id = sp.id
         JOIN users u ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.status = 'active'
         GROUP BY sp.id
       )
       SELECT u.id as user_id, sp.id as staff_id, sp.first_name, sp.last_name, u.role,
               sp.contracted_hours_weekly, sp.max_hours_weekly, l.name as location_name, sp.location_id,
               CASE WHEN sc.total_count > 0
                 THEN ROUND((sc.completed_count::DECIMAL / sc.total_count) * 100)
                 ELSE 100
               END as compliance_pct
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN locations l ON sp.location_id = l.id
        LEFT JOIN staff_compliance sc ON sc.staff_id = sp.id
        WHERE u.organization_id = $1 AND u.status = 'active'
        ORDER BY sp.first_name`,
       [orgId]
    );
    return result.rows;
  }

  static async getMinStaffCounts(orgId: string) {
    const result = await query(
      `SELECT id as location_id, name, minimum_staff_per_day,
              min_day_staff, min_night_staff, min_sleep_staff
       FROM locations WHERE organization_id = $1`,
      [orgId]
    );
    return result.rows;
  }

  static async getOpenShifts(orgId: string, locationId?: string, dateFrom?: string, dateTo?: string) {
    const defaultFrom = new Date();
    defaultFrom.setHours(0, 0, 0, 0);
    const defaultTo = new Date(defaultFrom);
    defaultTo.setDate(defaultTo.getDate() + 14);
    // Shift window starts at the beginning of today so overtime posted for today shows
    // even when its start time has already passed. Passing a date range overrides it.
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : defaultFrom;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : defaultTo;
    let sql = `
      SELECT s.*, l.name as location_name, d.name as department_name,
        su.first_name as su_first_name, su.last_name as su_last_name,
        (SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id) as staff_count
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN people su ON s.person_id = su.id
      WHERE l.organization_id = $1
        AND s.status IN ('open', 'pending')
        AND s.start_time >= $2
        AND s.start_time <= $3`;
    const params: any[] = [orgId, from.toISOString(), to.toISOString()];
    let idx = 4;
    if (locationId) { sql += ` AND s.location_id = $${idx++}`; params.push(locationId); }
    sql += ' ORDER BY s.start_time';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getUnclaimedOpenShifts(orgId: string) {
    const now = new Date();
    const result = await query(
      `SELECT s.*, l.name as location_name, l.manager_id, d.name as department_name,
              su.first_name as su_first_name, su.last_name as su_last_name,
              EXTRACT(EPOCH FROM (s.start_time - $2::timestamp)) / 3600 as hours_until_start
       FROM shifts s
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN people su ON s.person_id = su.id
       WHERE l.organization_id = $1
         AND s.status = 'open'
         AND s.start_time > $2
         AND NOT EXISTS (SELECT 1 FROM shift_assignments sa2 WHERE sa2.shift_id = s.id)
       ORDER BY s.start_time`,
      [orgId, now.toISOString()]
    );
    return result.rows;
  }

  static async getUnclaimedShiftsNearWindow(orgId: string) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const result = await query(
      `SELECT s.*, l.name as location_name, l.manager_id,
              u.email as manager_email, u.id as manager_user_id
       FROM shifts s
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN users u ON l.manager_id = u.id
       WHERE l.organization_id = $1
         AND s.status = 'open'
         AND s.start_time BETWEEN $2 AND $3
         AND s.unclaimed_notified_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM shift_assignments sa2 WHERE sa2.shift_id = s.id)
       ORDER BY s.start_time`,
      [orgId, now.toISOString(), windowEnd.toISOString()]
    );
    return result.rows;
  }

  static async markUnclaimedNotified(shiftIds: string[]) {
    if (shiftIds.length === 0) return;
    await query(
      `UPDATE shifts SET unclaimed_notified_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])`,
      [shiftIds]
    );
  }

  static async getMyClaims(orgId: string, staffProfileId: string) {
    const result = await query(
      `SELECT sa.id as assignment_id, sa.status as assignment_status, sa.created_at as claimed_at, sa.is_overtime,
              s.id as shift_id, s.start_time, s.end_time, s.status as shift_status, s.shift_type,
              l.name as location_name, d.name as department_name,
              su.first_name as su_first_name, su.last_name as su_last_name,
              sp.id as staff_id, sp.first_name, sp.last_name
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN people su ON s.person_id = su.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE sa.staff_id = $1 AND l.organization_id = $2
       ORDER BY s.start_time DESC`,
      [staffProfileId, orgId]
    );
    return result.rows;
  }

  static async getPendingClaims(orgId: string, managedLocationIds?: string[]) {
    let sql = `SELECT sa.id as assignment_id, sa.status as assignment_status, sa.created_at as claimed_at,
              s.id as shift_id, s.start_time, s.end_time, s.status as shift_status, s.shift_type,
              l.id as location_id, l.name as location_name,
              su.first_name as su_first_name, su.last_name as su_last_name,
              sp.id as staff_id, sp.first_name, sp.last_name
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN people su ON s.person_id = su.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE l.organization_id = $1 AND sa.status = 'pending'`;
    const params: any[] = [orgId];
    if (managedLocationIds && managedLocationIds.length > 0) {
      sql += ` AND l.id = ANY($${params.length + 1}::uuid[])`;
      params.push(managedLocationIds);
    }
    sql += ' ORDER BY sa.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  /** All claims org-wide for admins/managers: pending, rejected, and approved overtime claims (not the routine roster). */
  static async getAllClaims(orgId: string, managedLocationIds?: string[]) {
    let sql = `SELECT sa.id as assignment_id, sa.status as assignment_status, sa.created_at as claimed_at, sa.is_overtime,
              s.id as shift_id, s.start_time, s.end_time, s.status as shift_status, s.shift_type,
              l.id as location_id, l.name as location_name, d.name as department_name,
              su.first_name as su_first_name, su.last_name as su_last_name,
              sp.id as staff_id, sp.first_name, sp.last_name
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN people su ON s.person_id = su.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE l.organization_id = $1
         AND (sa.status IN ('pending', 'rejected') OR (sa.status = 'assigned' AND s.shift_type IS NOT NULL))`;
    const params: any[] = [orgId];
    if (managedLocationIds && managedLocationIds.length > 0) {
      sql += ` AND l.id = ANY($${params.length + 1}::uuid[])`;
      params.push(managedLocationIds);
    }
    sql += ' ORDER BY sa.created_at DESC LIMIT 500';
    const result = await query(sql, params);
    return result.rows;
  }

  static async checkStaffShiftConflict(staffId: string, startTime: string, endTime: string) {
    const result = await query(
      `SELECT sa.id FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       WHERE sa.staff_id = $1
         AND s.status IN ('filled', 'pending')
         AND s.start_time < $3::timestamptz AND s.end_time > $2::timestamptz
       LIMIT 1`,
      [staffId, startTime, endTime]
    );
    return result.rows.length > 0;
  }

  static async checkRestPeriod(staffId: string, startTime: string, endTime: string) {
    const result = await query(
      `SELECT s.start_time, s.end_time FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       WHERE sa.staff_id = $1 AND s.status IN ('filled', 'pending')
         AND (
           (s.end_time > $2::timestamptz - INTERVAL '11 hours' AND s.end_time <= $2::timestamptz)
           OR (s.start_time >= $3::timestamptz AND s.start_time < $3::timestamptz + INTERVAL '11 hours')
         )
       LIMIT 1`,
      [staffId, startTime, endTime]
    );
    return result.rows[0] || null;
  }

  static async checkOvertimeExceeded(staffId: string, startTime: string, endTime: string) {
    const staffResult = await query(
      'SELECT contracted_hours_weekly, max_hours_weekly FROM staff_profiles WHERE id = $1',
      [staffId]
    );
    const contractedHours = parseFloat(staffResult.rows[0]?.contracted_hours_weekly) || 40;
    // Use max_hours_weekly if set (visa restriction); it's the hard ceiling
    const hoursLimit = staffResult.rows[0]?.max_hours_weekly
      ? parseFloat(staffResult.rows[0].max_hours_weekly)
      : contractedHours;

    const shiftDate = new Date(startTime);
    const day = shiftDate.getDay();
    const diff = shiftDate.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(shiftDate);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const hoursResult = await query(
      `SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (s.end_time::timestamptz - s.start_time::timestamptz)) / 3600
      ), 0) as total_hours
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.staff_id = $1
        AND s.status IN ('filled', 'pending')
        AND s.start_time::timestamptz >= $2::timestamptz
        AND s.end_time::timestamptz <= $3::timestamptz
        AND sa.status != 'rejected'`,
      [staffId, weekStart.toISOString(), weekEnd.toISOString()]
    );

    const currentHours = parseFloat(hoursResult.rows[0]?.total_hours) || 0;
    const shiftDuration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3600000;

    return (currentHours + shiftDuration) > hoursLimit;
  }

  static async getStaffComplianceForShift(orgId: string, shiftId: string) {
    const result = await query(
      `WITH assigned_ct AS (
         SELECT COUNT(*) as cnt FROM shift_assignments WHERE shift_id = $1
       )
       SELECT l.id as location_id, l.name, l.minimum_staff_per_day,
              COALESCE(ac.cnt, 0) as assigned_count
       FROM locations l
       JOIN shifts s ON s.location_id = l.id
       CROSS JOIN assigned_ct ac
       WHERE s.id = $1`,
      [shiftId]
    );
    return result.rows[0] || null;
  }

  static async getStaffIdByUserId(userId: string) {
    const result = await query('SELECT id, location_id, first_name, last_name FROM staff_profiles WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  /** Verify staff compliance meets the organization's minimum compliance threshold. */
  private static async checkStaffCompliance(orgId: string, staffId: string, client?: any) {
    const exec = client ? (sql: string, params: any[]) => client.query(sql, params) : query;
    const orgResult = await exec(
      'SELECT minimum_compliance_percent FROM organizations WHERE id = $1',
      [orgId]
    );
    const minCompliance = orgResult.rows[0]?.minimum_compliance_percent ?? 100;
    const staffCompResult = await exec(
      `SELECT COUNT(cr.id) FILTER (WHERE cr.status = 'complete') as completed_count,
              COUNT(cr.id) as total_count
       FROM compliance_records cr
       WHERE cr.staff_id = $1`,
      [staffId]
    );
    const completed = parseInt(staffCompResult.rows[0]?.completed_count) || 0;
    const total = parseInt(staffCompResult.rows[0]?.total_count) || 0;
    if (total > 0) {
      const pct = (completed / total) * 100;
      if (pct < minCompliance) {
        throw new AppError(400, `Staff compliance (${Math.round(pct)}%) is below the organisation minimum (${minCompliance}%)`);
      }
    }
  }

  static async claimOpenShift(shiftId: string, staffId: string, orgId: string) {
    const shift = await this.getShiftById(shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');
    if (shift.status !== 'open') throw new AppError(409, 'Shift is not available for claiming');

    // Check compliance before allowing claim
    await this.checkStaffCompliance(orgId, staffId);

    const alreadyAssigned = await query(
      'SELECT id FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2',
      [shiftId, staffId]
    );
    if (alreadyAssigned.rows.length > 0) throw new AppError(409, 'Already assigned to this shift');

    const hasConflict = await this.checkStaffShiftConflict(staffId, shift.start_time, shift.end_time);
    if (hasConflict) throw new AppError(409, 'You already have a shift during this time');

    const conflictingRest = await this.checkRestPeriod(staffId, shift.start_time, shift.end_time);
    if (conflictingRest) {
      throw new AppError(409, 'Insufficient rest period: you need at least 11 hours between shifts');
    }

    const orgResult = await query('SELECT overtime_requires_approval FROM organizations WHERE id = $1', [orgId]);
    const requiresApproval = orgResult.rows[0]?.overtime_requires_approval !== false;

    if (requiresApproval) {
      return transaction(async (client) => {
        const current = await client.query("SELECT status FROM shifts WHERE id = $1 FOR UPDATE", [shiftId]);
        if (current.rows.length === 0 || current.rows[0].status !== 'open') throw new AppError(409, 'Shift is not available for claiming');
        await client.query("UPDATE shifts SET status = 'pending' WHERE id = $1", [shiftId]);
        const assignment = await client.query(
          "INSERT INTO shift_assignments (shift_id, staff_id, status, is_overtime) VALUES ($1, $2, 'pending', true) RETURNING *",
          [shiftId, staffId]
        );
        return { ...assignment.rows[0], requires_approval: true };
      });
    } else {
      const assignment = await this.assignStaff(shiftId, staffId, true);
      return { ...assignment, requires_approval: false };
    }
  }

  static async approveOvertimeClaim(shiftId: string, staffId: string) {
    // Check compliance before approving
    const shift = await this.getShiftById(shiftId);
    if (shift) {
      await this.checkStaffCompliance(shift.organization_id, staffId);
    }

    return transaction(async (client) => {
      const assignment = await client.query(
        "UPDATE shift_assignments SET status = 'assigned' WHERE shift_id = $1 AND staff_id = $2 AND status = 'pending' RETURNING *",
        [shiftId, staffId]
      );
      if (assignment.rows.length === 0) throw new AppError(404, 'Pending claim not found');
      await client.query("UPDATE shifts SET status = 'filled' WHERE id = $1", [shiftId]);
      return assignment.rows[0];
    });
  }

  static async rejectOvertimeClaim(shiftId: string, staffId: string) {
    return transaction(async (client) => {
      const assignment = await client.query(
        "UPDATE shift_assignments SET status = 'rejected' WHERE shift_id = $1 AND staff_id = $2 AND status = 'pending' RETURNING *",
        [shiftId, staffId]
      );
      if (assignment.rows.length === 0) throw new AppError(404, 'Pending claim not found');
      await client.query("UPDATE shifts SET status = 'open' WHERE id = $1", [shiftId]);
      return assignment.rows[0];
    });
  }

  static async swapOvertimeClaim(shiftId: string, currentStaffId: string, newStaffId: string) {
    return transaction(async (client) => {
      const assignment = await client.query(
        "UPDATE shift_assignments SET staff_id = $1 WHERE shift_id = $2 AND staff_id = $3 AND status IN ('assigned', 'pending') RETURNING *",
        [newStaffId, shiftId, currentStaffId]
      );
      if (assignment.rows.length === 0) throw new AppError(404, 'Overtime claim not found');
      return assignment.rows[0];
    });
  }

  static async createTemplate(data: any) {
    const { name, start_time, end_time, organization_id } = data;
    const result = await query(
      'INSERT INTO shift_templates (name, start_time, end_time, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, start_time, end_time, organization_id]
    );
    return result.rows[0];
  }

  static async getTemplates(orgId: string) {
    const result = await query('SELECT * FROM shift_templates WHERE organization_id = $1 ORDER BY name', [orgId]);
    return result.rows;
  }

  static async getMyShifts(userId: string, startDate: string, endDate: string) {
    const result = await query(
      `SELECT s.*, l.name as location_name, sa.status as assignment_status,
              su.first_name as su_first_name, su.last_name as su_last_name
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN people su ON s.person_id = su.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE sp.user_id = $1 AND s.start_time >= $2 AND s.end_time <= $3
       ORDER BY s.start_time`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }

  static async getStaffShifts(staffProfileId: string, startDate: string, endDate: string) {
    const result = await query(
      `SELECT s.*, l.name as location_name, sa.status as assignment_status,
              su.first_name as su_first_name, su.last_name as su_last_name
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN people su ON s.person_id = su.id
       WHERE sa.staff_id = $1 AND s.start_time >= $2 AND s.end_time <= $3
       ORDER BY s.start_time`,
      [staffProfileId, startDate, endDate]
    );
    return result.rows;
  }

  static async getApprovedOvertimeClaims(orgId: string, managedLocationIds: string[]) {
    const result = await query(
      `SELECT sa.id as assignment_id, sa.status as assignment_status, sa.created_at as claimed_at,
              s.id as shift_id, s.start_time, s.end_time, s.status as shift_status, s.shift_type,
              l.id as location_id, l.name as location_name,
              su.first_name as su_first_name, su.last_name as su_last_name,
              sp.id as staff_id, sp.first_name, sp.last_name
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       LEFT JOIN people su ON s.person_id = su.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       WHERE l.organization_id = $1 AND sa.status = 'assigned' AND s.shift_type IS NOT NULL
         AND l.id = ANY($2::uuid[])
       ORDER BY sa.created_at DESC`,
      [orgId, managedLocationIds]
    );
    return result.rows;
  }

  static async revokeOvertimeClaim(shiftId: string, staffId: string) {
    return transaction(async (client) => {
      const assignment = await client.query(
        "UPDATE shift_assignments SET status = 'rejected' WHERE shift_id = $1 AND staff_id = $2 AND status = 'assigned' RETURNING *",
        [shiftId, staffId]
      );
      if (assignment.rows.length === 0) throw new AppError(404, 'Approved overtime claim not found');
      await client.query("UPDATE shifts SET status = 'open' WHERE id = $1", [shiftId]);
      return assignment.rows[0];
    });
  }

  /** Admin/manager: cancel an overtime claim (pending or approved) and return the shift to the pool. */
  static async cancelOvertimeClaim(shiftId: string, staffId: string) {
    return transaction(async (client) => {
      const assignment = await client.query(
        "UPDATE shift_assignments SET status = 'rejected' WHERE shift_id = $1 AND staff_id = $2 AND status IN ('pending', 'assigned') RETURNING *",
        [shiftId, staffId]
      );
      if (assignment.rows.length === 0) throw new AppError(404, 'Overtime claim not found');
      const remaining = await client.query(
        "SELECT COUNT(*) as cnt FROM shift_assignments WHERE shift_id = $1 AND status IN ('pending', 'assigned') AND id != $2",
        [shiftId, assignment.rows[0].id]
      );
      if (parseInt(remaining.rows[0]?.cnt) === 0) {
        await client.query("UPDATE shifts SET status = 'open' WHERE id = $1", [shiftId]);
      }
      return assignment.rows[0];
    });
  }

  /** Admin/manager: convert an overtime claim to a regular rostered shift (is_overtime=false). Pending claims are approved as regular. */
  static async convertOvertimeClaim(shiftId: string, staffId: string) {
    return transaction(async (client) => {
      const assignment = await client.query(
        "UPDATE shift_assignments SET status = 'assigned', is_overtime = FALSE WHERE shift_id = $1 AND staff_id = $2 AND status IN ('pending', 'assigned') RETURNING *",
        [shiftId, staffId]
      );
      if (assignment.rows.length === 0) throw new AppError(404, 'Overtime claim not found');
      await client.query("UPDATE shifts SET status = 'filled' WHERE id = $1", [shiftId]);
      return assignment.rows[0];
    });
  }

  // --- Manager location scoping ---

  /** Returns location IDs the user manages — all locations for ORG_ADMIN, their own location for MANAGER. */
  static async getManagedLocationIds(userId: string, role: string, orgId: string) {
    if (role === 'ORG_ADMIN' || role === 'SUPER_ADMIN') {
      const result = await query('SELECT id FROM locations WHERE organization_id = $1', [orgId]);
      return result.rows.map((r: any) => r.id);
    }
    const directIds: string[] = [];
    if (role === 'MANAGER') {
      const profileRes = await query('SELECT location_id FROM staff_profiles WHERE user_id = $1', [userId]);
      if (profileRes.rows[0]?.location_id) {
        const locRes = await query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [profileRes.rows[0].location_id, orgId]);
        directIds.push(...locRes.rows.map((r: any) => r.id));
      }
      const locRes = await query('SELECT id FROM locations WHERE manager_id = $1 AND organization_id = $2', [userId, orgId]);
      directIds.push(...locRes.rows.map((r: any) => r.id));
    }
    // Check delegations: if user is a delegate for an active delegation, inherit primary manager's locations
    const delegations = await query(
      `SELECT primary_manager_id FROM manager_delegations
       WHERE delegate_manager_id = $1
         AND is_active = true
         AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
      [userId]
    );
    for (const del of delegations.rows) {
      const delegateLocations = await this.getManagedLocationIds(del.primary_manager_id, 'MANAGER', orgId);
      directIds.push(...delegateLocations);
    }
    // Deduplicate
    return [...new Set(directIds)];
  }

  /** Checks if user can edit shifts at the given location. Throws if not. */
  static async requireCanEditLocation(userId: string, role: string, orgId: string, locationId: string) {
    if (role === 'ORG_ADMIN' || role === 'SUPER_ADMIN') return;
    // Check delegations - a delegate inherits the primary manager's edit permissions
    const isDelegate = await query(
      `SELECT 1 FROM manager_delegations
       WHERE delegate_manager_id = $1 AND is_active = true
         AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [userId]
    );
    const managedIds = await this.getManagedLocationIds(userId, role, orgId);
    if (!managedIds.includes(locationId)) {
      throw new AppError(403, 'You can only edit shifts at locations you manage');
    }
  }

  // --- Shift Swaps ---

  static async createSwapRequest(fromStaffId: string, toStaffId: string, shiftId: string, toShiftId?: string, reason?: string) {
    const result = await query(
      `INSERT INTO shift_swaps (shift_id, from_staff_id, to_staff_id, to_shift_id, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [shiftId, fromStaffId, toStaffId, toShiftId || null, reason || null]
    );
    return result.rows[0];
  }

  static async respondToSwapRequest(swapId: string, accepted: boolean) {
    return transaction(async (client) => {
      const swap = await client.query("SELECT * FROM shift_swaps WHERE id = $1 FOR UPDATE", [swapId]);
      if (swap.rows.length === 0) throw new AppError(404, 'Swap request not found');
      if (swap.rows[0].status !== 'pending') throw new AppError(409, 'Swap request already responded to');

      if (accepted) {
        await client.query("UPDATE shift_swaps SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = $1", [swapId]);
        const { shift_id, from_staff_id, to_staff_id, to_shift_id } = swap.rows[0];

        // Remove from_staff from the original shift
        await client.query(
          "DELETE FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2",
          [shift_id, from_staff_id]
        );

        if (to_shift_id) {
          // Remove to_staff from their chosen shift
          await client.query(
            "DELETE FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2",
            [to_shift_id, to_staff_id]
          );
          // Assign from_staff to the target shift
          await client.query(
            "INSERT INTO shift_assignments (shift_id, staff_id) VALUES ($1, $2)",
            [to_shift_id, from_staff_id]
          );
        } else {
          // Legacy: check if to_staff has conflicting shift and exchange
          const origShift = await client.query("SELECT start_time, end_time, location_id FROM shifts WHERE id = $1", [shift_id]);
          if (origShift.rows.length > 0) {
            const { start_time, end_time } = origShift.rows[0];
            const toStaffOtherShift = await client.query(
              `SELECT sa.shift_id FROM shift_assignments sa
               JOIN shifts s ON sa.shift_id = s.id
               WHERE sa.staff_id = $1
                 AND s.start_time < $3 AND s.end_time > $2
                 AND sa.shift_id != $4
               LIMIT 1`,
              [to_staff_id, start_time, end_time, shift_id]
            );
            if (toStaffOtherShift.rows.length > 0) {
              const exchangedShiftId = toStaffOtherShift.rows[0].shift_id;
              await client.query(
                "DELETE FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2",
                [exchangedShiftId, to_staff_id]
              );
              await client.query(
                "INSERT INTO shift_assignments (shift_id, staff_id) VALUES ($1, $2)",
                [exchangedShiftId, from_staff_id]
              );
            }
          }
        }

        // Assign to_staff to the original shift
        await client.query(
          "INSERT INTO shift_assignments (shift_id, staff_id) VALUES ($1, $2)",
          [shift_id, to_staff_id]
        );

        return { ...swap.rows[0], status: 'accepted' };
      } else {
        await client.query("UPDATE shift_swaps SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE id = $1", [swapId]);
        return { ...swap.rows[0], status: 'declined' };
      }
    });
  }

  static async getSwapRequestsForStaff(staffProfileId: string) {
    const result = await query(
      `SELECT sw.*, s.start_time, s.end_time, s.shift_type,
              l.name as location_name,
              fp.first_name as from_first_name, fp.last_name as from_last_name,
              tp.first_name as to_first_name, tp.last_name as to_last_name
       FROM shift_swaps sw
       JOIN shifts s ON sw.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       JOIN staff_profiles fp ON sw.from_staff_id = fp.id
       JOIN staff_profiles tp ON sw.to_staff_id = tp.id
       WHERE sw.from_staff_id = $1 OR sw.to_staff_id = $1
       ORDER BY sw.created_at DESC`,
      [staffProfileId]
    );
    return result.rows;
  }

  static async getPendingSwapRequests(toStaffId: string) {
    const result = await query(
      `SELECT sw.*, s.start_time, s.end_time, s.shift_type,
              l.name as location_name,
              fp.first_name as from_first_name, fp.last_name as from_last_name
       FROM shift_swaps sw
       JOIN shifts s ON sw.shift_id = s.id
       JOIN locations l ON s.location_id = l.id
       JOIN staff_profiles fp ON sw.from_staff_id = fp.id
       WHERE sw.to_staff_id = $1 AND sw.status = 'pending'
       ORDER BY sw.created_at DESC`,
      [toStaffId]
    );
    return result.rows;
  }

  static async getEligibleSwapStaff(shiftId: string, orgId: string) {
    const shift = await this.getShiftById(shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');
    const result = await query(
      `SELECT sp.id as staff_id, sp.first_name, sp.last_name,
              sp.contracted_hours_weekly, sp.max_hours_weekly,
              COALESCE(cr.compliance_pct, 100) as compliance_pct
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN (
         SELECT staff_id,
           COUNT(*) FILTER (WHERE status = 'complete')::float / NULLIF(COUNT(*), 0) * 100 as compliance_pct
         FROM compliance_records GROUP BY staff_id
       ) cr ON cr.staff_id = sp.id
       WHERE u.organization_id = $1 AND u.status = 'active'
         AND (sp.location_id = $3 OR sp.location_id IS NULL OR $3 IS NULL)
         AND sp.id != ALL(
           SELECT staff_id FROM shift_assignments WHERE shift_id = $2
         )
         AND sp.id NOT IN (
           SELECT staff_id FROM leave_requests
           WHERE status = 'approved'
             AND start_date <= $4::date AND end_date >= $5::date
         )
       ORDER BY sp.first_name`,
      [orgId, shiftId, shift.location_id, shift.end_time, shift.start_time]
    );
    return result.rows;
  }

  static async getLastShiftDate(orgId: string, locationId?: string) {
    let q = `SELECT MAX(s.end_time) as last_date FROM shifts s JOIN locations l ON s.location_id = l.id WHERE l.organization_id = $1 AND s.end_time > NOW()`
    const params: any[] = [orgId]
    if (locationId) {
      q += ` AND s.location_id = $2`
      params.push(locationId)
    }
    const result = await query(q, params)
    return result.rows[0]?.last_date || null
  }

  static async sendToAgency(shiftId: string, orgId: string, data: { agency_id: string; agency_cost?: string; agency_contact_name?: string; agency_contact_phone?: string; agency_shift_reference?: string; agency_notes?: string }) {
    // If no cost provided, auto-calculate from agency rate for this shift type
    let cost = data.agency_cost;
    if (!cost || cost === '') {
      const shift = await this.getShiftById(shiftId);
      if (shift) {
        const hours = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3600000;
        const shiftType = shift.shift_type || 'day';
        const rateRes = await query(
          `SELECT rate_per_hour FROM agency_rates
           WHERE agency_id = $1 AND shift_type = $2
             AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
           ORDER BY effective_from DESC LIMIT 1`,
          [data.agency_id, shiftType]
        );
        if (rateRes.rows[0]) {
          cost = (parseFloat(rateRes.rows[0].rate_per_hour) * hours).toFixed(2);
        }
      }
    }
    const result = await query(
      `UPDATE shifts s SET
        agency_id = $1, agency_cost = $2, agency_contact_name = $3,
        agency_contact_phone = $4, agency_shift_reference = $7, agency_notes = $8,
        agency_sent_at = CURRENT_TIMESTAMP,
        agency_covered = false, status = 'filled'
       FROM locations l
       WHERE s.location_id = l.id AND l.organization_id = $6 AND s.id = $5 RETURNING s.*`,
      [data.agency_id, cost || null, data.agency_contact_name || null, data.agency_contact_phone || null, shiftId, orgId, data.agency_shift_reference || null, data.agency_notes || null]
    );
    return result.rows[0] || null;
  }

  static async updateAgencyCoverage(shiftId: string, orgId: string, covered: boolean) {
    const result = await query(
      `UPDATE shifts s SET agency_covered = $1
       FROM locations l
       WHERE s.location_id = l.id AND l.organization_id = $3 AND s.id = $2
       AND s.agency_id IS NOT NULL
       RETURNING s.*`,
      [covered, shiftId, orgId]
    );
    return result.rows[0] || null;
  }
}
