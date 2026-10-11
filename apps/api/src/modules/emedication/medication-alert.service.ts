import pool, { migrateQuery } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { EmailService } from '../../shared/utils/email.service';
import { runWithOrgContext } from '../events/events.org-context';

/**
 * Days-until-empty projection for reorder urgency, byte-for-byte the same
 * arithmetic the Mica `get_medication_round` tool uses (same 28-day given-dose
 * rate, same 4dp rounding, same run-out division) so an email and a Mica
 * answer can never disagree about the same stock line.
 *
 *   - `daily_usage`  — given doses/day over the last 28 days for that
 *                      org + person + medication/dosage key (null when the
 *                      line had no recent usage — no rate may be invented).
 *   - `days_until_empty` — quantity ÷ that rate, 1dp (null without usage).
 *   - `incoming_quantity` — future-dated delivery pipeline for the line,
 *                      so a low line already being restocked reads differently
 *                      from one that is simply about to run out.
 *
 * PRN usage can inflate the rate — accepted, erring towards ordering earlier
 * is the safe side. Kept in one fragment because the Mica tool and this
 * sweep consume the identical expressions; the fragment is interpolated as a
 * CTE list and joined by (organization_id, person_id, med/dosage key).
 */
export const STOCK_USAGE_CTES = `
  usage AS (
    SELECT r.organization_id,
           r.person_id,
           LOWER(TRIM(mi.name)) AS med_key,
           LOWER(TRIM(COALESCE(mi.dosage, ''))) AS dosage_key,
           COUNT(a.id)::int AS given_28d,
           ROUND((COUNT(a.id)::float8 / 28.0)::numeric, 4)::float8 AS daily_usage
    FROM emedication_administrations a
    JOIN emedication_items mi ON mi.id = a.emedication_item_id
    JOIN emedication_records r ON r.id = mi.emedication_record_id
    WHERE a.status = 'given'
      AND COALESCE(a.administered_time, a.scheduled_time) >= NOW() - interval '28 days'
    GROUP BY 1, 2, 3, 4
  ),
  incoming AS (
    SELECT d.organization_id, d.person_id,
           LOWER(TRIM(di.medication_name)) AS med_key,
           LOWER(TRIM(COALESCE(di.dosage, ''))) AS dosage_key,
           SUM(di.quantity)::float8 AS incoming_quantity,
           MIN(d.delivery_date)::text AS next_delivery_date
    FROM emedication_delivery_items di
    JOIN emedication_deliveries d ON d.id = di.delivery_id
    WHERE d.delivery_date > CURRENT_DATE
    GROUP BY 1, 2, 3, 4
  )`;

export class MedicationAlertService {
  static async notifyReorder(orgId: string, stockItemId: string, stock: { quantity: number; reorder_level: number }) {
    try {
      const setting = await pool.query('SELECT reorder_alert_enabled FROM organizations WHERE id = $1', [orgId]);
      if (!setting.rows[0]?.reorder_alert_enabled) return;

      const result = await pool.query(
        `WITH ${STOCK_USAGE_CTES}
         SELECT s.*, l.name AS location_name,
                COALESCE(u.given_28d, 0) AS given_28d,
                u.daily_usage,
                CASE WHEN u.daily_usage > 0
                     THEN ROUND((s.quantity / u.daily_usage)::numeric, 1)::float8
                     ELSE NULL END AS days_until_empty,
                COALESCE(inc.incoming_quantity, 0) AS incoming_quantity,
                inc.next_delivery_date,
                CASE WHEN s.expiry_date IS NULL THEN NULL
                     ELSE (s.expiry_date - CURRENT_DATE) END AS days_until_expiry,
                CASE WHEN u.daily_usage > 0 AND s.expiry_date IS NOT NULL
                     THEN (s.expiry_date < CURRENT_DATE + CEIL(s.quantity / u.daily_usage)::int)
                     ELSE NULL END AS expired_first,
                COALESCE(manager_user.email, m2.email) AS manager_email,
                COALESCE(sp.first_name || ' ' || sp.last_name, manager_user.email, m2.email) AS manager_name
         FROM emedication_stock s
         LEFT JOIN people su ON su.id = s.person_id
         LEFT JOIN locations l ON l.id = su.location_id
         LEFT JOIN users manager_user ON l.manager_id = manager_user.id
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
         LEFT JOIN usage u
           ON u.organization_id = s.organization_id
          AND u.person_id IS NOT DISTINCT FROM s.person_id
          AND u.med_key = LOWER(TRIM(s.medication_name))
          AND u.dosage_key = LOWER(TRIM(COALESCE(s.dosage, '')))
         LEFT JOIN incoming inc
           ON inc.organization_id = s.organization_id
          AND inc.person_id IS NOT DISTINCT FROM s.person_id
          AND inc.med_key = LOWER(TRIM(s.medication_name))
          AND inc.dosage_key = LOWER(TRIM(COALESCE(s.dosage, '')))
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
          out_of_stock: Number(stock.quantity) <= 0,
          given_28d: item.given_28d ?? 0,
          daily_usage: item.daily_usage ?? null,
          days_until_empty: item.days_until_empty != null ? Number(item.days_until_empty) : null,
          incoming_quantity: item.incoming_quantity != null ? Number(item.incoming_quantity) : null,
          next_delivery_date: item.next_delivery_date ?? null,
          days_until_expiry: item.days_until_expiry != null ? Number(item.days_until_expiry) : null,
          expired_first: item.expired_first === true ? true : item.expired_first === false ? false : null,
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

  /**
   * Periodic stock-reorder sweep.
   *
   * notifyReorder() covers the transaction path — a stock line crossing its
   * reorder level the moment a browser records an administration. But a line
   * can end up low without any transaction: a delivery never logged, an
   * under-level line inherited from before the toggle existed, or the
   * crossing email landing while the manager was off shift. This sweep is the
   * safety net that makes "at reorder level" an ongoing state a manager is
   * reminded about, not a one-time event they had to be online to see — the
   * gap the user hit: they had to ask Mica to learn that stock was low.
   *
   * Dedupe: per stock line, re-warn at most once per
   * organizations.stock_reorder_alert_frequency_hours (default 24h), tracked
   * on emedication_stock.last_reorder_alerted_at. Everything the per-
   * transaction path sends is reused — same email template, same manager
   * resolution (location manager, then any manager at that location) — so
   * both paths produce the same warning for the same problem.
   *
   * Returns the number of emails queued so the interval logs only when it did
   * something, in the same shape as sendLateMedAlerts().
   */
  static async sendStockReorderAlerts(): Promise<number> {
    // Discovery rides the migrate (superuser) pool: it only reads org ids, and
    // the app-pool role is RLS-gated with no session context outside a request
    // — the same pattern sendLateMedAlerts already uses for its cross-org
    // discovery. Everything org-specific runs inside runWithOrgContext below.
    const orgs = await migrateQuery(
      `SELECT DISTINCT o.id, o.stock_reorder_alert_frequency_hours
       FROM organizations o
       JOIN emedication_stock es ON es.organization_id = o.id
       WHERE o.reorder_alert_enabled = TRUE
         AND es.status = 'active'
         AND es.quantity <= COALESCE(es.reorder_level, 10)
         AND (es.last_reorder_alerted_at IS NULL
              OR es.last_reorder_alerted_at <= NOW()
                 - (COALESCE(o.stock_reorder_alert_frequency_hours, 24) || ' hours')::interval)`);

    let emails = 0;
    for (const { id: orgId, stock_reorder_alert_frequency_hours: freqHours } of orgs.rows) {
      try {
        emails += await runWithOrgContext(orgId, async () => {
          const due = (await migrateQuery(
            `WITH ${STOCK_USAGE_CTES}
             SELECT s.id AS stock_id, s.medication_name, s.dosage, s.unit,
                    s.quantity, s.reorder_level, s.quantity_unit,
                    (s.quantity <= 0) AS out_of_stock,
                    COALESCE(u.given_28d, 0) AS given_28d,
                    u.daily_usage,
                    CASE WHEN u.daily_usage > 0
                         THEN ROUND((s.quantity / u.daily_usage)::numeric, 1)::float8
                         ELSE NULL END AS days_until_empty,
                    COALESCE(inc.incoming_quantity, 0) AS incoming_quantity,
                    inc.next_delivery_date,
                    CASE WHEN s.expiry_date IS NULL THEN NULL
                         ELSE (s.expiry_date - CURRENT_DATE) END AS days_until_expiry,
                    CASE WHEN u.daily_usage > 0 AND s.expiry_date IS NOT NULL
                         THEN (s.expiry_date < CURRENT_DATE + CEIL(s.quantity / u.daily_usage)::int)
                         ELSE NULL END AS expired_first,
                    s.expiry_date,
                    su.location_id, l.name AS location_name,
                    COALESCE(lm.email, m2.email) AS manager_email,
                    COALESCE(sp.first_name || ' ' || sp.last_name, lm.email, m2.email) AS manager_name,
                    COALESCE(su.first_name || ' ' || su.last_name, 'Shared stock') AS person_name
             FROM emedication_stock s
             LEFT JOIN people su ON su.id = s.person_id
             LEFT JOIN usage u
               ON u.organization_id = s.organization_id
              AND u.person_id IS NOT DISTINCT FROM s.person_id
              AND u.med_key = LOWER(TRIM(s.medication_name))
              AND u.dosage_key = LOWER(TRIM(COALESCE(s.dosage, '')))
             LEFT JOIN incoming inc
               ON inc.organization_id = s.organization_id
              AND inc.person_id IS NOT DISTINCT FROM s.person_id
              AND inc.med_key = LOWER(TRIM(s.medication_name))
              AND inc.dosage_key = LOWER(TRIM(COALESCE(s.dosage, '')))
             LEFT JOIN locations l ON l.id = su.location_id
             -- "lm": the usage CTE owns the "u" alias in this statement.
             LEFT JOIN users lm ON l.manager_id = lm.id
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
             WHERE s.organization_id = $1
               AND s.status = 'active'
               AND s.quantity <= COALESCE(s.reorder_level, 10)
               AND (s.last_reorder_alerted_at IS NULL
                    OR s.last_reorder_alerted_at <= NOW()
                       - (COALESCE($2, 24) || ' hours')::interval)
             ORDER BY s.quantity ASC, s.medication_name
             LIMIT 20`,
            [orgId, freqHours])).rows;

          let sent = 0;
          for (const item of due) {
            if (!item.manager_email) continue;
            await EmailService.sendStockReorderEmail(item.manager_email, item.manager_name || 'Location Manager', {
              medication_name: item.medication_name,
              dosage: item.dosage,
              unit: item.unit,
              quantity: (typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity),
              reorder_level: (typeof item.reorder_level === 'string' ? parseFloat(item.reorder_level) : item.reorder_level),
              quantity_unit: item.quantity_unit,
              location_name: item.location_name,
              person_name: item.person_name,
              out_of_stock: item.out_of_stock === true,
              given_28d: item.given_28d,
              daily_usage: item.daily_usage,
              days_until_empty: item.days_until_empty !== null && item.days_until_empty !== undefined ? Number(item.days_until_empty) : null,
              incoming_quantity: item.incoming_quantity !== null && item.incoming_quantity !== undefined ? Number(item.incoming_quantity) : null,
              next_delivery_date: item.next_delivery_date ?? null,
              days_until_expiry: item.days_until_expiry !== null && item.days_until_expiry !== undefined ? Number(item.days_until_expiry) : null,
              expired_first: item.expired_first === true ? true : item.expired_first === false ? false : null,
            });
            sent++;
          }

          // Mark every due line swept, including ones with no recipient: a
          // line with no manager should not retry hot every 5 minutes either.
          if (due.length > 0) {
            await migrateQuery(
              'UPDATE emedication_stock SET last_reorder_alerted_at = NOW() WHERE id = ANY($1::uuid[])',
              [due.map((d: any) => d.stock_id)]);
          }
          return sent;
        });
      } catch (err: any) {
        logger.error({ err: err.message, orgId }, 'Stock reorder sweep failed for organisation');
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
