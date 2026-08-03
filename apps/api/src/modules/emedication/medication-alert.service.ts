import pool from '../../shared/database';
import logger from '../../shared/utils/logger';
import { EmailService } from '../../shared/utils/email.service';

export class MedicationAlertService {
  static async notifyReorder(orgId: string, stockItemId: string, stock: { quantity: number; reorder_level: number }) {
    try {
      const setting = await pool.query('SELECT reorder_alert_enabled FROM organizations WHERE id = $1', [orgId]);
      if (!setting.rows[0]?.reorder_alert_enabled) return;

      const result = await pool.query(
        `SELECT s.*, l.name AS location_name,
                COALESCE(u.email, m2.email) AS manager_email,
                COALESCE(sp.first_name || ' ' || sp.last_name, u.email, m2.email) AS manager_name
         FROM emedication_stock s
         LEFT JOIN people su ON su.id = s.person_id
         LEFT JOIN locations l ON l.id = su.location_id
         LEFT JOIN users u ON l.manager_id = u.id
         LEFT JOIN staff_profiles sp ON l.manager_id = sp.user_id
         LEFT JOIN LATERAL (
           SELECT u3.email
           FROM staff_profiles sp3
           JOIN users u3 ON sp3.user_id = u3.id
           WHERE u3.role = 'MANAGER'
             AND u3.organization_id = s.organization_id
             AND sp3.location_id = su.location_id
           LIMIT 1
         ) m2 ON true
         WHERE s.id = $1 AND s.organization_id = $2`,
        [stockItemId, orgId]);
      const item = result.rows[0];
      if (!item || !item.manager_email) return;

      await EmailService.sendStockReorderEmail(
        item.manager_email,
        item.manager_name || 'Location Manager',
        {
          medication_name: item.medication_name,
          dosage: item.dosage,
          unit: item.unit,
          quantity: stock.quantity,
          reorder_level: stock.reorder_level,
          quantity_unit: item.quantity_unit,
          location_name: item.location_name,
          person_name: item.person_name || 'Shared stock',
        }
      );
      logger.info({ stockItemId, orgId }, 'Stock reorder alert email queued');
    } catch (err: any) {
      logger.error({ err: err.message, stockItemId, orgId }, 'Stock reorder alert email failed');
    }
  }

  static async sendLateMedAlerts(): Promise<number> {
    const orgs = await pool.query(`
      SELECT DISTINCT r.organization_id
      FROM emedication_administrations a
      JOIN emedication_items mi ON a.emedication_item_id = mi.id
      JOIN emedication_records r ON mi.emedication_record_id = r.id
      WHERE a.status = 'pending' AND a.late_alert_sent_at IS NULL`);
    if (orgs.rows.length === 0) return 0;

    let emails = 0;
    for (const { organization_id: orgId } of orgs.rows) {
      try {
        const setting = await pool.query(
          'SELECT late_med_alert_enabled, late_med_alert_delay_minutes FROM organizations WHERE id = $1',
          [orgId]);
        if (!setting.rows[0]?.late_med_alert_enabled) continue;
        const delay = setting.rows[0]?.late_med_alert_delay_minutes ?? 30;

        const overdue = await pool.query(
          `SELECT a.id AS admin_id, a.scheduled_time,
                  mi.name AS medication_name, mi.dosage, mi.unit,
                  su.id AS person_id,
                  su.first_name || ' ' || su.last_name AS person_name,
                  su.location_id, l.name AS location_name
           FROM emedication_administrations a
           JOIN emedication_items mi ON a.emedication_item_id = mi.id
           JOIN emedication_records r ON mi.emedication_record_id = r.id
           JOIN people su ON su.id = r.person_id
           LEFT JOIN locations l ON l.id = su.location_id
           WHERE r.organization_id = $1
             AND r.status = 'active'
             AND mi.is_active = TRUE
             AND a.status = 'pending'
             AND a.late_alert_sent_at IS NULL
             AND a.scheduled_time < CURRENT_TIMESTAMP - ($2 || ' minutes')::interval
           ORDER BY su.location_id, a.scheduled_time`,
          [orgId, delay]);
        if (overdue.rows.length === 0) continue;

        const byLocation = new Map<string, any[]>();
        for (const o of overdue.rows) {
          const key = o.location_id || 'none';
          if (!byLocation.has(key)) byLocation.set(key, []);
          byLocation.get(key)!.push(o);
        }

        for (const [locId, items] of byLocation) {
          const locName = items[0]?.location_name || 'Location';
          const recipients = await MedicationAlertService.getOnDutyStaffEmails(orgId, locId);
          for (const r of recipients) {
            await EmailService.sendLateMedAlertEmail(r.email, r.first_name, locName, items, delay);
            emails++;
          }
          if (recipients.length === 0) {
            logger.warn({ orgId, locId }, 'Late med alert: no on-duty staff found, skipping');
          }
          await pool.query(
            'UPDATE emedication_administrations SET late_alert_sent_at = NOW() WHERE id = ANY($1::uuid[])',
            [items.map((i: any) => i.admin_id)]);
        }
      } catch (err: any) {
        logger.error({ err: err.message, orgId }, 'Late med alert processing failed');
      }
    }
    return emails;
  }

  static async getOnDutyStaffEmails(orgId: string, locationId: string) {
    if (locationId === 'none') return [];
    const onDuty = await pool.query(
      `SELECT DISTINCT u.email, sp.first_name, sp.last_name
       FROM shift_assignments sa
       JOIN staff_profiles sp ON sa.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       JOIN shifts s ON s.id = sa.shift_id
       JOIN locations loc ON loc.id = s.location_id
       WHERE s.location_id = $2
         AND loc.organization_id = $1
         AND s.status NOT IN ('cancelled')
         AND s.start_time <= NOW()
         AND s.end_time >= NOW()
         AND u.status = 'active'`,
      [orgId, locationId]);
    if (onDuty.rows.length > 0) return onDuty.rows;

    const manager = await pool.query(
      `SELECT COALESCE(u.email, m2.email) AS email, sp.first_name, sp.last_name
       FROM locations l
       LEFT JOIN users u ON l.manager_id = u.id
       LEFT JOIN staff_profiles sp ON l.manager_id = sp.user_id
       LEFT JOIN LATERAL (
         SELECT u3.email
         FROM staff_profiles sp3
         JOIN users u3 ON sp3.user_id = u3.id
         WHERE u3.role = 'MANAGER'
           AND u3.organization_id = $1
           AND sp3.location_id = l.id
         LIMIT 1
       ) m2 ON true
       WHERE l.id = $2 AND l.organization_id = $1`,
      [orgId, locationId]);
    if (manager.rows[0]?.email) return manager.rows;
    return [];
  }
}
