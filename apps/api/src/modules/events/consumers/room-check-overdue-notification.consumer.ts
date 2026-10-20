/**
 * Tells the staff on shift that a room in their service has no room check today.
 *
 * This is blueprint §10's "Room check overdue → Support worker, manager → Room
 * check", and the last row of §9.9 that had no producer at all. The sweep
 * (`modules/room-checks/roomCheckOverdue.ts`) decides *which* rooms are overdue;
 * this turns that into the one message a support worker can act on, addressed to
 * the people actually rostered at that location today.
 *
 * In-app rather than email. The check is recorded on a screen, in minutes, by
 * somebody standing in the building — an inbox is the wrong place for it. The type
 * is `compliance`, so the worker's own notification preferences still apply, which
 * is the same contract every other preference-bearing notification keeps.
 *
 * The link opens the room checks page, which is where a check is recorded and where
 * the manager sees the same gap.
 */
import { EventConsumer, DomainEvent } from '../events.consumers';
import { NotificationsController } from '../../notifications/notifications.controller';
import logger from '../../../shared/utils/logger';

const ROOM_CHECKS_LINK = '/room-checks';

export const RoomCheckOverdueNotificationConsumer: EventConsumer = {
  name: 'room-check-overdue-notification',

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventName !== 'room_check.overdue') {
      logger.warn({ eventName: event.eventName }, 'room-check-overdue-notification: unhandled event');
      return;
    }

    const p = event.payload as Record<string, unknown>;
    const room = typeof p.room_number === 'string' ? p.room_number.trim() : '';
    const location = typeof p.location_name === 'string' ? p.location_name.trim() : '';
    const rostered = (Array.isArray(p.rostered) ? p.rostered : []).filter(
      (person): person is { user_id: string } =>
        !!person && typeof (person as { user_id?: unknown }).user_id === 'string',
    );

    if (!room) {
      // The sweep cannot raise this without a room; a malformed event is logged
      // rather than thrown, because the outbox would otherwise retry it forever.
      logger.warn({ eventId: event.id }, 'room_check.overdue without a room; nothing to notify');
      return;
    }

    const where = location ? ` at ${location}` : '';
    for (const person of rostered) {
      await NotificationsController.createNotification(
        person.user_id,
        'Room check overdue',
        `${room}${where} has no room check recorded today. Record its cleanliness and safety check so the room's record is complete.`,
        'compliance',
        ROOM_CHECKS_LINK,
      ).catch((err) =>
        logger.warn(
          { err: err?.message, eventId: event.id, userId: person.user_id },
          'room-check-overdue notification failed; continuing',
        ),
      );
    }
  },
};
