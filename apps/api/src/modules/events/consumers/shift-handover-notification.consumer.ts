import { EventConsumer, DomainEvent } from '../events.consumers';
import { NotificationsController } from '../../notifications/notifications.controller';
import { micaRecordPath } from '@meticle/shared';
import logger from '../../../shared/utils/logger';

/**
 * Tells the outgoing support worker that their handover was acknowledged.
 *
 * This is the row blueprint §10 asks for under "Handover acknowledged by named
 * staff → Outgoing support worker". It matters because the worker who wrote the
 * handover is the one person who cannot see the acknowledgement happen: they
 * have gone off shift by the time the incoming worker reads it, and a handover
 * nobody confirms is exactly the risk the record exists to close.
 *
 * The link opens the shift on the rota week it belongs to, which is where the
 * handover itself lives — the same record the rota grid and the shift detail
 * dialog show.
 */
export const ShiftHandoverNotificationConsumer: EventConsumer = {
  name: 'shift-handover-notification',

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventName !== 'shift.handover_acknowledged') {
      logger.warn({ eventName: event.eventName }, 'shift-handover-notification: unhandled event');
      return;
    }

    const p = event.payload as Record<string, unknown>;
    const authorId = typeof p.author_id === 'string' ? p.author_id : '';
    const shiftId = typeof p.shift_id === 'string' ? p.shift_id : '';
    const week = typeof p.week === 'string' ? p.week : '';
    if (!authorId || !shiftId) {
      logger.warn({ eventId: event.id }, 'shift.handover_acknowledged without an author or shift; nothing to notify');
      return;
    }

    const acknowledgedBy = typeof p.acknowledged_by_name === 'string' && p.acknowledged_by_name
      ? p.acknowledged_by_name
      : 'A colleague';
    const location = typeof p.location_name === 'string' && p.location_name ? ` at ${p.location_name}` : '';

    // Idempotent per event: the outbox marks the consumer row processed, and a
    // retried event re-inserts a duplicate notification only if that row was
    // lost — a tolerated, rare duplication rather than a lost notification.
    await NotificationsController.createNotification(
      authorId,
      'Handover acknowledged',
      `${acknowledgedBy} acknowledged your shift handover${location}.`,
      'info',
      micaRecordPath({ kind: 'shift', id: shiftId, week })
    ).catch((err) =>
      logger.warn({ err: err?.message, eventId: event.id }, 'handover acknowledgement notification failed; continuing'),
    );
  },
};
