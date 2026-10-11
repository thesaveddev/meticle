import { EventConsumer, DomainEvent } from '../events.consumers';
import { NotificationsController } from '../../notifications/notifications.controller';
import { query } from '../../../shared/database';
import logger from '../../../shared/utils/logger';
import { STOCK_USAGE_CTES } from '../../emedication/medication-alert.service';

export const DEFAULT_STOCK_LOW_NOTIFICATION_DAYS_THRESHOLD = 7;

/**
 * Notifies every MANAGER and ORG_ADMIN when a current stock line is projected
 * to run out within the organisation's configured urgency window (or is empty), through
 * the same notification channel every module uses (delegation fan-out,
 * preference gating, socket push to the bell icon).
 *
 * The Mission Control alert from MissionControlAlertConsumer covers the
 * dashboard aggregate; this consumer makes the warning reach the manager's
 * inbox without anyone having to open Mission Control. The `general`
 * notification type is preference-gated, so a manager who switched reordered
 * warnings off does not keep getting them.
 *
 * Idempotent per event: the outbox marks the consumer row 'processed', so a
 * retried event re-inserts a duplicate notification only if that row was
 * lost — a tolerated, rare duplication rather than a lost alert.
 */
export const MedicationStockLowNotificationConsumer: EventConsumer = {
  name: 'medication-stock-low-notification',

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventName !== 'medication.stock_low') {
      logger.warn({ eventName: event.eventName }, 'medication-stock-low-notification: unhandled event');
      return;
    }
    const orgId = event.organizationId;
    const stockId = String(event.aggregateId || event.payload.stock_id || '');
    if (!stockId) return;

    // Honor the existing general-notification preference before claiming the
    // line, so a later re-enable can still produce its first warning.
    const recipients = await query(
      `SELECT u.id FROM users u
       LEFT JOIN notification_preferences np
         ON np.user_id = u.id AND np.notification_type = 'general'
       WHERE u.organization_id = $1 AND u.status = 'active'
         AND u.role IN ('ORG_ADMIN', 'MANAGER')
         AND COALESCE(np.enabled, TRUE) = TRUE`,
      [orgId],
    );
    if (recipients.rows.length === 0) return;

    // Claim one notification for this low-stock cycle. Both the urgency check
    // and claim happen in one statement, so a concurrent batch worker cannot
    // race a stale event into a duplicate bell notification.
    const claimed = await query(
      `WITH ${STOCK_USAGE_CTES}, eligible AS (
         SELECT s.id, s.organization_id, s.person_id, s.medication_name, s.dosage,
                s.unit, s.quantity_unit, s.quantity, s.reorder_level,
                COALESCE(o.stock_low_alert_days_threshold, ${DEFAULT_STOCK_LOW_NOTIFICATION_DAYS_THRESHOLD})::int AS alert_days_threshold,
                COALESCE(u.given_28d, 0)::int AS given_28d,
                u.daily_usage,
                CASE WHEN u.daily_usage > 0
                     THEN ROUND((s.quantity / u.daily_usage)::numeric, 1)::float8
                     ELSE NULL END AS days_until_empty,
                p.first_name || ' ' || p.last_name AS person_name,
                l.name AS location_name
         FROM emedication_stock s
         JOIN organizations o ON o.id = s.organization_id
         LEFT JOIN usage u
           ON u.organization_id = s.organization_id
          AND u.person_id IS NOT DISTINCT FROM s.person_id
          AND u.med_key = LOWER(TRIM(s.medication_name))
          AND u.dosage_key = LOWER(TRIM(COALESCE(s.dosage, '')))
         LEFT JOIN people p ON p.id = s.person_id
         LEFT JOIN locations l ON l.id = p.location_id
         WHERE s.id = $1 AND s.organization_id = $2
           AND s.status = 'active'
           AND s.reorder_level > 0
           AND s.quantity <= s.reorder_level
           AND s.last_stock_low_notified_at IS NULL
       )
       UPDATE emedication_stock s
       SET last_stock_low_notified_at = NOW()
       FROM eligible e
       WHERE s.id = e.id
         AND (e.quantity <= 0 OR (e.daily_usage > 0 AND e.days_until_empty <= e.alert_days_threshold))
       RETURNING e.*`,
      [stockId, orgId],
    );
    const line = claimed.rows[0];
    if (!line) return; // not urgent yet, no longer low, or already notified this cycle

    const med = String(line.medication_name || 'Medication');
    const dosage = typeof line.dosage === 'string' && line.dosage ? ` ${line.dosage}` : '';
    const quantity = Number(line.quantity ?? 0);
    const reorder = Number(line.reorder_level ?? 0);
    const quantityUnit = formatStockUnit(line.quantity_unit, quantity);
    const location = typeof line.location_name === 'string' && line.location_name
      ? ` at ${line.location_name}`
      : '';
    const person = typeof line.person_name === 'string' && line.person_name
      ? ` for ${line.person_name}`
      : '';
    const urgency = quantity <= 0
      ? 'Already out of stock.'
      : `About ${line.days_until_empty} day${Number(line.days_until_empty) === 1 ? '' : 's'} of stock left at the recent rate (${line.given_28d} doses in 28 days).`;

    const title = `Stock low: ${med}${dosage}`;
    const message = `${urgency} ${quantity} ${quantityUnit} remaining of ${med}${dosage} (reorder at ${reorder})${person}${location}. Please arrange a delivery.`;

    // `general` type also preserves existing preference and delegation fan-out.
    for (const row of recipients.rows) {
      await NotificationsController.createNotification(
        row.id, title, message, 'general',
      ).catch((err) =>
        logger.warn(
          { err: err?.message, eventId: event.id, userId: row.id },
          'stock-low notification failed; continuing',
        ),
      );
    }
  },
};

/** Normalize persisted quantity-unit labels for readable notification copy. */
function formatStockUnit(value: unknown, quantity: number): string {
  const normalized = String(value || 'units').trim().toLowerCase().replace(/\s+/g, ' ');
  const canonical: Record<string, string> = {
    tablet: 'tablet', tablets: 'tablet', 'tablet(s)': 'tablet',
    capsule: 'capsule', capsules: 'capsule', 'capsule(s)': 'capsule',
    patch: 'patch', patches: 'patch', 'patch(es)': 'patch',
    ml: 'mL', mls: 'mL', milliliter: 'mL', milliliters: 'mL', millilitre: 'mL', millilitres: 'mL',
    dose: 'dose', doses: 'dose', 'dose(s)': 'dose',
    unit: 'unit', units: 'unit', 'unit(s)': 'unit',
    bottle: 'bottle', bottles: 'bottle', 'bottle(s)': 'bottle',
    vial: 'vial', vials: 'vial', 'vial(s)': 'vial',
    sachet: 'sachet', sachets: 'sachet', 'sachet(s)': 'sachet',
    inhaler: 'inhaler', inhalers: 'inhaler', 'inhaler(s)': 'inhaler',
  };
  const label = canonical[normalized] || normalized;
  // mL is invariant; ordinary countable units pluralize when quantity != 1.
  return label === 'mL' || quantity === 1 ? label : `${label}s`;
}
