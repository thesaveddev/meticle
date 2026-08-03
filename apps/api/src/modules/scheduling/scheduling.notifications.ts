import { query } from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';
import { SchedulingRepository } from './scheduling.repository';

const NOTIFICATION_WINDOW_MINUTES = 15;

export class SchedulingNotificationService {
  /** Check for shifts starting soon and email assigned staff their daily plan. */
  static async sendShiftStartNotifications() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 20 * 60 * 1000);

    const shiftsResult = await query(
      `SELECT s.id, s.start_time, s.end_time, s.location_id, l.name as location_name,
              sp.id as staff_id, sp.first_name, sp.last_name, u.email, u.organization_id
       FROM shifts s
       JOIN shift_assignments sa ON sa.shift_id = s.id
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN locations l ON s.location_id = l.id
       WHERE s.start_notification_sent_at IS NULL
         AND s.status NOT IN ('cancelled', 'completed')
         AND sa.status IN ('assigned', 'accepted')
         AND s.start_time BETWEEN $1 AND $2
         AND u.status = 'active'
       ORDER BY u.organization_id, sp.id, s.start_time`,
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
        const incidents = await this.getIncidentsForDay(staff.organization_id, date);
        const appointments = await this.getAppointmentsForStaff(staff.staff_id, date);

        if (staff.email) {
          await EmailService.sendShiftStartEmail(
            staff.email,
            `${staff.first_name} ${staff.last_name}`,
            date,
            shifts,
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

  private static async getIncidentsForDay(organizationId: string, date: string) {
    const result = await query(
      `SELECT id, title, severity, status, incident_date
       FROM incidents
       WHERE organization_id = $1 AND incident_date = $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [organizationId, date]
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
}
