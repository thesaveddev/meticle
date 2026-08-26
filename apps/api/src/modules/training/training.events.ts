import { publishDomainEvent } from '../events/events.outbox';

export interface TrainingExpiringPayload {
  record_id: string;
  module_id: string;
  module_name: string;
  staff_id: string;
  staff_name: string;
  expires_at: string;
  days_remaining: number;
}

/**
 * Publish `training.expiring` when a training record is within its expiry
 * warning window.
 */
export async function publishTrainingExpiringEvent(args: {
  organizationId: string;
  recordId: string;
  moduleId: string;
  moduleName: string;
  staffId: string;
  staffName: string;
  expiresAt: string;
  daysRemaining: number;
}): Promise<{ id: string }> {
  const payload: TrainingExpiringPayload = {
    record_id: args.recordId,
    module_id: args.moduleId,
    module_name: args.moduleName,
    staff_id: args.staffId,
    staff_name: args.staffName,
    expires_at: args.expiresAt,
    days_remaining: args.daysRemaining,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'training.expiring',
    aggregateType: 'training_record',
    aggregateId: args.recordId,
    payload: payload as unknown as Record<string, unknown>,
  });
}