/**
 * Tells the staff on a shift that it ended with no handover recorded.
 *
 * This is blueprint §10's "Handover due at shift end → Support worker → Handover",
 * and §9.9's last missing event type. It is the other half of §9.2: the handover
 * record exists and is acknowledged by name, and until now nothing told the person
 * who owed one that the shift had ended without it. The transfer of responsibility
 * for the people in the setting is what a handover *is*, and one that never happened
 * left no trace anyone would notice.
 *
 * The audience is the roster the event carries — the staff on that shift whose place
 * was not rejected, which is exactly the set who may write the handover
 * (`ShiftHandoverRepository.requireCanWrite`). A manager may write one too when the
 * shift had nobody to do it, and that case is deliberately not a notification: a
 * manager is not on the shift, and §10 routes this row to the worker.
 *
 * In-app rather than email. The worker is at the end of their shift and the sentence
 * is short; the daily plan email already covers the shift's own details, and a
 * message about a record that has to be written on a screen is one the screen should
 * carry. The notification type is `shift`, so the staff member's own notification
 * preferences apply to it exactly as they do to the shift preview.
 *
 * The link opens the shift on its rota week, which is where the handover is read and
 * written — the same record the rota grid and the shift detail dialog show.
 */
import { EventConsumer, DomainEvent } from '../events.consumers';
import { NotificationsController } from '../../notifications/notifications.controller';
import { micaRecordPath } from '@meticle/shared';
import logger from '../../../shared/utils/logger';

/** A shift's end time as the reader's clock, for the message. */
function endTimeOf(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'its end time';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return 'its end time';
  return at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export const ShiftHandoverDueNotificationConsumer: EventConsumer = {
  name: 'shift-handover-due-notification',

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventName !== 'shift.handover_due') {
      logger.warn({ eventName: event.eventName }, 'shift-handover-due-notification: unhandled event');
      return;
    }

    const p = event.payload as Record<string, unknown>;
    const shiftId = typeof p.shift_id === 'string' ? p.shift_id : '';
    const week = typeof p.week === 'string' ? p.week : '';
    const rostered = (Array.isArray(p.rostered) ? p.rostered : []).filter(
      (person): person is { user_id: string } =>
        !!person && typeof (person as { user_id?: unknown }).user_id === 'string',
    );

    if (!shiftId || rostered.length === 0) {
      // The sweep only raises this for a shift with staff on it, so this is a
      // malformed event rather than the normal unstaffed case — logged, not thrown,
      // because there is nobody to tell and the outbox should not retry it forever.
      logger.warn({ eventId: event.id }, 'shift.handover_due without a shift or a roster; nothing to notify');
      return;
    }

    const location = typeof p.location_name === 'string' && p.location_name ? ` at ${p.location_name}` : '';
    const shiftType = String(p.shift_type || 'day').replace(/_/g, ' ');
    const endedAt = endTimeOf(p.end_time);

    for (const person of rostered) {
      // Idempotent per event: the outbox records each consumer as processed, so a
      // retry re-notifies only if that row was lost — a tolerated, rare duplication
      // rather than a lost nudge, which is the direction that matters here.
      await NotificationsController.createNotification(
        person.user_id,
        'Handover due at shift end',
        `Your ${shiftType} shift${location} ended at ${endedAt} with no handover recorded. Record what happened, what is outstanding and who is aware, so the next worker takes over knowing it.`,
        'shift',
        micaRecordPath({ kind: 'shift', id: shiftId, week }),
      ).catch((err) =>
        logger.warn(
          { err: err?.message, eventId: event.id, userId: person.user_id },
          'handover-due notification failed; continuing',
        ),
      );
    }
  },
};
