import { publishDomainEvent } from '../events/events.outbox';

export interface DbsExpiringPayload {
  document_id: string;
  staff_id: string;
  staff_name: string;
  dbs_type: string;
  expiry_date: string;
  days_remaining: number;
}

/**
 * Publish `dbs.expiring` when a DBS document is within its expiry warning window.
 */
export async function publishDbsExpiringEvent(args: {
  organizationId: string;
  documentId: string;
  staffId: string;
  staffName: string;
  dbsType: string;
  expiryDate: string;
  daysRemaining: number;
}): Promise<{ id: string }> {
  const payload: DbsExpiringPayload = {
    document_id: args.documentId,
    staff_id: args.staffId,
    staff_name: args.staffName,
    dbs_type: args.dbsType,
    expiry_date: args.expiryDate,
    days_remaining: args.daysRemaining,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'dbs.expiring',
    aggregateType: 'document',
    aggregateId: args.documentId,
    payload: payload as unknown as Record<string, unknown>,
  });
}