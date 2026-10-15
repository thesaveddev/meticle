import { EventConsumer, DomainEvent } from '../events.consumers';
import { NotificationsController } from '../../notifications/notifications.controller';
import { micaRecordPath } from '@meticle/shared';
import logger from '../../../shared/utils/logger';

/**
 * Notifies the person Mica assigned work to, through the same notification
 * channel every module uses (delegation fan-out, preference gating, socket
 * push) — so a task Mica created mid-sentence surfaces in the assignee's
 * bell icon andMission Control without anyone remembering to mention it.
 *
 * Idempotent per event: the outbox marks the consumer row 'processed', and a
 * retried event re-inserts a duplicate notification only if the consumer row
 * was lost — a tolerated, rare duplication rather than a lost notification.
 */
export const MicaAssignmentNotificationConsumer: EventConsumer = {
  name: 'mica-assignment-notification',

  async handle(event: DomainEvent): Promise<void> {
    const p = event.payload as Record<string, unknown>;
    const orgId = event.organizationId;

    const notifyUserIds = [p.assigned_user_id, p.created_by]
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    // De-duplicate: the creator may also be the assignee.
    const unique = [...new Set(notifyUserIds)];
    if (unique.length === 0) return;

    if (event.eventName === 'mica.task_confirmed') {
      const when = p.due_date ? ` due ${String(p.due_date).slice(0, 10)}` : '';
      const title = `New task from Mica: ${String(p.title || 'Untitled')}`;
      const message = `Mica created a task (“${String(p.title)}”) on your behalf${when}.`;
      // The record this names, so the bell entry opens it. The event's own aggregate
      // is the task (`mica.events.ts` sets it from `payload.task_id`), which is the
      // id Mica just printed in the carer's reply; `aggregateId` is the fallback for
      // an event published by hand with only the aggregate set.
      const taskId = typeof p.task_id === 'string' && p.task_id ? p.task_id : event.aggregateId;
      const link = taskId ? micaRecordPath({ kind: 'task', id: taskId }) : undefined;
      for (const uid of unique) {
        await NotificationsController.createNotification(uid, title, message, 'general', link).catch((err) =>
          logger.warn({ err: err?.message, eventId: event.id }, 'mica task notification failed; continuing'),
        );
      }
      return;
    }

    if (event.eventName === 'mica.appointment_confirmed') {
      const start = p.start_time ? String(p.start_time) : '';
      const when = start
        ? ` on ${start.slice(0, 10)} at ${start.slice(11, 16)}`
        : '';
      const title = `New appointment from Mica: ${String(p.title || 'Untitled')}`;
      const message = `Mica booked an appointment (“${String(p.title)}”)${when}.`;
      const appointmentId = typeof p.appointment_id === 'string' && p.appointment_id
        ? p.appointment_id
        : event.aggregateId;
      const link = appointmentId ? micaRecordPath({ kind: 'appointment', id: appointmentId }) : undefined;
      for (const uid of unique) {
        await NotificationsController.createNotification(uid, title, message, 'general', link).catch((err) =>
          logger.warn({ err: err?.message, eventId: event.id }, 'mica appointment notification failed; continuing'),
        );
      }
      return;
    }

    logger.warn({ eventName: event.eventName }, 'mica-assignment-notification: unhandled event');
  },
};
