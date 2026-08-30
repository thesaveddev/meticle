import pool, { query, requestDBStorage, resetRlsSessionVars, migrateQuery } from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';
import { SchedulingRepository } from './scheduling.repository';

/**
 * Shift previews are sent only inside this lead-time window. The lower bound
 * prevents a preview arriving too early; the upper bound gives the five-minute
 * worker enough time to catch the shift once.
 */
const SHIFT_PREVIEW_MIN_LEAD_HOURS = 2;
const SHIFT_PREVIEW_MAX_LEAD_HOURS = 4;

export class SchedulingNotificationService {
  /** Check for upcoming shifts and email assigned staff their daily plan with key info for the shift. */
  static async sendShiftStartNotifications() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + SHIFT_PREVIEW_MIN_LEAD_HOURS * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + SHIFT_PREVIEW_MAX_LEAD_HOURS * 60 * 60 * 1000);

    // Background job context (no authenticated RLS session): enumerate orgs
    // with assigned shifts in the window via the superuser pool.
    const orgsResult = await migrateQuery(
      `SELECT DISTINCT l.organization_id
       FROM shifts s
       JOIN locations l ON s.location_id = l.id
       JOIN shift_assignments sa ON sa.shift_id = s.id
       WHERE s.start_time BETWEEN $1 AND $2
         AND s.start_notification_sent_at IS NULL
         AND s.status NOT IN ('cancelled', 'completed')
         AND sa.status IN ('assigned', 'accepted')`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );

    let sent = 0;
    let shiftsMarked = 0;
    for (const row of orgsResult.rows) {
      const orgId = row.organization_id;
      // Acquire a dedicated client and scope it to this org so all queries
      // (which use the ALS request-scoped client) run against the right tenant.
      const client = await pool.connect();
      try {
        await client.query(`SELECT set_config('app.current_org_id', $1, false)`, [orgId]);
        await client.query(`SELECT set_config('app.current_user_id', $1, false)`, ['00000000-0000-0000-0000-000000000000']);
        await client.query(`SELECT set_config('app.current_user_role', $1, false)`, ['MANAGER']);

        await requestDBStorage.run({ client }, async () => {
          const result = await this.sendForOrg(windowStart, windowEnd);
          sent += result.sent;
          shiftsMarked += result.shifts;
        });
      } catch (err) {
        logger.error({ orgId, err }, 'Failed to send shift preview emails');
      } finally {
        await resetRlsSessionVars(client);
        try { client.release(); } catch { /* already released */ }
      }
    }

    return { sent, shifts: shiftsMarked };
  }

  private static async sendForOrg(windowStart: Date, windowEnd: Date) {
    const shiftsResult = await query(
      `SELECT s.id, s.start_time, s.end_time, s.shift_type, s.location_id, l.name as location_name,
              p.id as person_id, p.first_name as person_first_name, p.last_name as person_last_name, p.room_number as person_room,
              sp.id as staff_id, sp.first_name, sp.last_name, u.email, u.id as user_id
       FROM shifts s
       JOIN shift_assignments sa ON sa.shift_id = s.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN locations l ON s.location_id = l.id
       LEFT JOIN people p ON s.person_id = p.id
       WHERE s.start_notification_sent_at IS NULL
         AND s.status NOT IN ('cancelled', 'completed')
         AND sa.status IN ('assigned', 'accepted')
         AND u.status = 'active'
         AND s.start_time BETWEEN $1 AND $2
       ORDER BY sp.id, s.start_time`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );

    if (shiftsResult.rows.length === 0) return { sent: 0, shifts: 0 };

    // Group by staff + day so each staff gets one daily plan email.
    const grouped = new Map<string, { staff: any; date: string; shifts: any[] }>();
    for (const shift of shiftsResult.rows) {
      const dateStr = new Date(shift.start_time).toISOString().split('T')[0];
      const key = `${shift.staff_id}:${dateStr}`;
      if (!grouped.has(key)) {
        grouped.set(key, { staff: shift, date: dateStr, shifts: [] });
      }
      grouped.get(key)!.shifts.push(shift);
    }

    let sent = 0;
    const notifiedShiftIds = new Set<string>();

    for (const [, group] of grouped) {
      try {
        const { staff, date, shifts } = group;

        // Respect the staff member's 'shift' notification preference.
        const pref = await query(
          `SELECT enabled FROM notification_preferences WHERE user_id = $1 AND notification_type = 'shift'`,
          [staff.user_id]
        );
        if (pref.rows[0]?.enabled === false) continue;

        const locationIds = Array.from(new Set(shifts.map((s: any) => s.location_id).filter(Boolean)));
        const people = await this.getPeopleToLookOutFor(locationIds);
        const incidents = await this.getIncidentsForDay(date);
        const appointments = await this.getAppointmentsForStaff(staff.staff_id, date);

        if (staff.email) {
          await EmailService.sendShiftStartEmail(
            staff.email,
            `${staff.first_name} ${staff.last_name}`,
            date,
            shifts,
            people,
            incidents,
            appointments
          );
          sent++;
        }

        for (const s of shifts) {
          notifiedShiftIds.add(s.id);
        }
      } catch (err) {
        logger.error(err, 'Failed to send daily plan');
      }
    }

    // Mark shifts as notified
    if (notifiedShiftIds.size > 0) {
      await query(
        `UPDATE shifts SET start_notification_sent_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])`,
        [Array.from(notifiedShiftIds)]
      );
    }

    return { sent, shifts: notifiedShiftIds.size };
  }

  /** People at the shift locations with risk/medical info worth flagging before the shift. */
  private static async getPeopleToLookOutFor(locationIds: string[]) {
    if (locationIds.length === 0) return [];
    const result = await query(
      `SELECT id, first_name, last_name, room_number, support_level, allergies, flags, dnacpr_status
       FROM people
       WHERE status = 'active'
         AND location_id = ANY($1::uuid[])
         AND (COALESCE(flags, '[]'::jsonb) <> '[]'::jsonb
              OR COALESCE(allergies, '[]'::jsonb) <> '[]'::jsonb
              OR support_level IS NOT NULL
              OR dnacpr_status IS NOT NULL)
       ORDER BY first_name
       LIMIT 20`,
      [locationIds]
    );
    return result.rows;
  }

  private static async getIncidentsForDay(date: string) {
    const result = await query(
      `SELECT id, title, severity, status, incident_date
       FROM incidents
       WHERE incident_date = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [date]
    );
    return result.rows;
  }

  private static async getAppointmentsForStaff(staffId: string, date: string) {
    const result = await query(
      `SELECT a.id, a.title, a.start_time, a.end_time, a.status,
              su.first_name, su.last_name
       FROM appointments a
       LEFT JOIN people su ON a.person_id = su.id
       WHERE a.staff_id = $1
         AND DATE(a.start_time) = $2
         AND a.status IN ('scheduled', 'confirmed')
       ORDER BY a.start_time
       LIMIT 10`,
      [staffId, date]
    );
    return result.rows;
  }

  /** Check for open shifts starting within 12 hours with no claims — warn the location manager. */
  static async checkUnclaimedShifts() {
    const orgs = await query('SELECT id FROM organizations WHERE status = \'active\'');
    let notified = 0;
    for (const org of orgs.rows) {
      try {
        const shifts = await SchedulingRepository.getUnclaimedShiftsNearWindow(org.id);
        if (shifts.length === 0) continue;
        const notifiedIds: string[] = [];
        for (const shift of shifts) {
          const shiftDate = new Date(shift.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
          const shiftTime = `${new Date(shift.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${new Date(shift.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
          const shiftType = shift.shift_type || 'day';

          if (shift.manager_email) {
            const managerName = `${shift.manager_name || 'Manager'}`;
            await EmailService.sendUnclaimedShiftReminderEmail(
              shift.manager_email,
              managerName,
              shift.location_name,
              shiftDate,
              shiftTime,
              shiftType
            );
            notified++;
          }
          notifiedIds.push(shift.id);
        }
        await SchedulingRepository.markUnclaimedNotified(notifiedIds);
      } catch (err) {
        logger.error({ orgId: org.id, err }, 'Failed to check unclaimed shifts');
      }
    }
    return { notified };
  }
}
