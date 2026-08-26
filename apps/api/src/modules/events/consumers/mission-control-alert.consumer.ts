import { EventConsumer, DomainEvent } from '../events.consumers';
import { query } from '../../../shared/database';
import logger from '../../../shared/utils/logger';

/**
 * MissionControlAlertConsumer processes every actionable domain event and
 * upserts a row into `mission_control_alerts` so the Mission Control dashboard
 * always reflects the current state without expensive per-request polling.
 *
 * De-duplicates by (organization_id, alert_type, aggregate_id): a second event
 * with the same key updates the row rather than creating a duplicate.
 */
export const MissionControlAlertConsumer: EventConsumer = {
  name: 'mission-control-alert',

  async handle(event: DomainEvent): Promise<void> {
    const alertType = event.eventName;
    const orgId = event.organizationId;
    const aggregateId = event.aggregateId || '';

    switch (alertType) {
      case 'medication.administration_missed': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'critical',
          `Missed medication: ${p.medication_name || 'Unknown'}`,
          `${p.person_name || 'Person'} missed ${p.medication_name} ${p.medication_dosage || ''} scheduled for ${formatTime(p.scheduled_time)}`,
          '/emedication', p.person_id || null, p.record_id || null);
        break;
      }

      case 'medication.administration_late': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'high',
          `Late medication: ${p.medication_name || 'Unknown'}`,
          `${p.person_name || 'Person'} — ${p.medication_name} is ${p.late_minutes}min late (scheduled ${formatTime(p.scheduled_time)})`,
          '/emedication', p.person_id || null, null);
        break;
      }

      case 'medication.stock_low': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'high',
          `Stock low: ${p.medication_name}`,
          `${p.quantity} remaining of ${p.medication_name} (reorder at ${p.reorder_level})${p.location_name ? ' — ' + p.location_name : ''}`,
          '/emedication?tab=stock', p.person_id || null, null);
        break;
      }

      case 'incident.action_overdue': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'high',
          `Action overdue: ${p.incident_title || 'Incident'}`,
          `"${p.action}" was due ${formatDate(p.due_date)}${p.assigned_name ? ' — assigned to ' + p.assigned_name : ''}`,
          `/incidents/${p.incident_id}`, null, p.incident_id || null);
        break;
      }

      case 'shift.unfilled': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'high',
          `Unfilled shift: ${p.location_name || 'Location'}`,
          `${p.shift_type || 'Shift'} starting ${formatTime(p.start_time)} — ${p.hours_until_start}h until start`,
          `/scheduling`, null, null);
        break;
      }

      case 'training.expiring': {
        const p = event.payload as any;
        const severity = p.days_remaining <= 0 ? 'high' : p.days_remaining <= 14 ? 'medium' : 'low';
        await upsertAlert(orgId, alertType, aggregateId, severity,
          `Training expiring: ${p.module_name}`,
          `${p.staff_name} — ${p.module_name} ${p.days_remaining <= 0 ? 'has expired' : `expires in ${p.days_remaining}d (${formatDate(p.expires_at)})`}`,
          `/compliance/training`, null, null);
        break;
      }

      case 'dbs.expiring': {
        const p = event.payload as any;
        const severity = p.days_remaining <= 0 ? 'critical' : p.days_remaining <= 30 ? 'high' : 'medium';
        await upsertAlert(orgId, alertType, aggregateId, severity,
          `DBS expiring: ${p.staff_name}`,
          `${p.dbs_type} ${p.days_remaining <= 0 ? 'has expired' : `expires in ${p.days_remaining}d (${formatDate(p.expiry_date)})`}`,
          `/compliance`, null, null);
        break;
      }

      case 'policy.review_due': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'medium',
          `Policy review due: ${p.title}`,
          `${p.category} policy — review was due ${formatDate(p.review_due_at)} (${p.days_overdue}d ago)`,
          `/policies`, null, p.policy_id || null);
        break;
      }

      case 'care_plan.review_due': {
        const p = event.payload as any;
        await upsertAlert(orgId, alertType, aggregateId, 'medium',
          `Care plan review due: ${p.person_name}`,
          `"${p.title}" (${p.category}) review was due ${formatDate(p.review_date)} (${p.days_overdue}d ago)`,
          `/people/${p.person_id}`, p.person_id || null, p.care_plan_id || null);
        break;
      }

      case 'fluid.intake_below_target': {
        const p = event.payload as any;
        const severity = p.pct_of_target < 50 ? 'high' : 'medium';
        await upsertAlert(orgId, alertType, aggregateId, severity,
          `Low fluid intake: ${p.person_name}`,
          `${p.actual_ml}ml of ${p.target_ml}ml target (${p.pct_of_target}%) on ${formatDate(p.recorded_date)}`,
          `/people/${p.person_id}`, p.person_id || null, null);
        break;
      }

      case 'nutrition.appetite_decline': {
        const p = event.payload as any;
        const consecutiveText = p.consecutive_poor_meals > 1
          ? ` (${p.consecutive_poor_meals} consecutive poor meals)` : '';
        const severity = p.consecutive_poor_meals >= 3 ? 'high' : 'medium';
        await upsertAlert(orgId, alertType, aggregateId, severity,
          `Declining appetite: ${p.person_name}`,
          `${capitalize(p.appetite_level)} appetite for ${p.meal_type} on ${formatDate(p.meal_date)}${consecutiveText}${p.consumed_percent != null ? ` — consumed ${p.consumed_percent}%` : ''}`,
          `/people/${p.person_id}`, p.person_id || null, null);
        break;
      }

      case 'nutrition.refused_meal': {
        const p = event.payload as any;
        const severity = p.consecutive_refusals >= 3 ? 'high' : p.consecutive_refusals >= 2 ? 'medium' : 'low';
        const consecutiveText = p.consecutive_refusals > 1
          ? ` (${p.consecutive_refusals} consecutive refusals)` : '';
        await upsertAlert(orgId, alertType, aggregateId, severity,
          `Refused meal: ${p.person_name}`,
          `${capitalize(p.meal_type)} refused on ${formatDate(p.meal_date)}${consecutiveText}${p.refusal_reason ? ' — ' + p.refusal_reason : ''}`,
          `/people/${p.person_id}`, p.person_id || null, p.meal_id || null);
        break;
      }

      default:
        logger.warn({ eventName: alertType }, 'Unhandled event type in MissionControlAlertConsumer');
    }
  },
};

/** Upsert a mission_control_alert row, deduped by (org, type, aggregate). */
async function upsertAlert(
  orgId: string,
  alertType: string,
  aggregateId: string,
  severity: string,
  title: string,
  message: string,
  link: string,
  personId: string | null,
  referenceId: string | null,
): Promise<void> {
  await query(
    `INSERT INTO mission_control_alerts
       (organization_id, alert_type, aggregate_id, severity, title, message, link, person_id, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (organization_id, alert_type, aggregate_id)
     DO UPDATE SET
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       message = EXCLUDED.message,
       link = EXCLUDED.link,
       person_id = EXCLUDED.person_id,
       reference_id = EXCLUDED.reference_id,
       updated_at = CURRENT_TIMESTAMP,
       dismissed = FALSE`,
    [orgId, alertType, aggregateId || '', severity, title, message, link, personId, referenceId]
  );
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(iso?: string): string {
  if (!iso) return 'unknown';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function formatDate(iso?: string): string {
  if (!iso) return 'unknown';
  try {
    return new Date(iso).toLocaleDateString('en-GB');
  } catch { return iso; }
}
