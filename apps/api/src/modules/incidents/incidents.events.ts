import { publishDomainEvent } from '../events/events.outbox';

export interface IncidentActionOverduePayload {
  action_id: string;
  incident_id: string;
  incident_title: string;
  action: string;
  assigned_to: string | null;
  assigned_name: string | null;
  due_date: string;
  severity: string;
}

/**
 * Publish `incident.action_overdue` when an incident action item passes its
 * due date without being completed.
 */
export async function publishIncidentActionOverdueEvent(args: {
  organizationId: string;
  actionId: string;
  incidentId: string;
  incidentTitle: string;
  action: string;
  assignedTo: string | null;
  assignedName: string | null;
  dueDate: string;
  severity: string;
}): Promise<{ id: string }> {
  const payload: IncidentActionOverduePayload = {
    action_id: args.actionId,
    incident_id: args.incidentId,
    incident_title: args.incidentTitle,
    action: args.action,
    assigned_to: args.assignedTo,
    assigned_name: args.assignedName,
    due_date: args.dueDate,
    severity: args.severity,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'incident.action_overdue',
    aggregateType: 'incident_action',
    aggregateId: args.actionId,
    payload: payload as unknown as Record<string, unknown>,
  });
}