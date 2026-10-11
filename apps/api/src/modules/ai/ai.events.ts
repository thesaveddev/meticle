import { publishDomainEvent } from '../events/events.outbox';

export interface MicaTaskConfirmedPayload {
  task_id: string;
  title: string;
  priority: string;
  due_date: string | null;
  /** staff_profiles.id of the assignee, when the task was assigned. */
  assigned_to: string | null;
  /** users.id behind the assignee — the consumer notifies this account. */
  assigned_user_id: string | null;
  person_id: string | null;
  created_by: string;
  source: 'voice' | 'text' | 'manual';
}

export interface MicaAppointmentConfirmedPayload {
  appointment_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  staff_id: string | null;
  assigned_user_id: string | null;
  person_id: string | null;
  created_by: string;
  source: 'voice' | 'text' | 'manual';
}

/**
 * Mica-confirmed writes are domain events, not inline notifications: the
 * confirm endpoint must stay fast (voice reply is still being spoken) and the
 * notification must survive a worker restart, so the confirm path inserts an
 * outbox row and the events worker delivers the consumer side effects.
 */
export async function publishMicaTaskConfirmedEvent(args: {
  organizationId: string;
  payload: MicaTaskConfirmedPayload;
}): Promise<{ id: string }> {
  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'mica.task_confirmed',
    aggregateType: 'task',
    aggregateId: args.payload.task_id,
    payload: args.payload as unknown as Record<string, unknown>,
  });
}

export async function publishMicaAppointmentConfirmedEvent(args: {
  organizationId: string;
  payload: MicaAppointmentConfirmedPayload;
}): Promise<{ id: string }> {
  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'mica.appointment_confirmed',
    aggregateType: 'appointment',
    aggregateId: args.payload.appointment_id,
    payload: args.payload as unknown as Record<string, unknown>,
  });
}
