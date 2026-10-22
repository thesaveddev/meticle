/**
 * Workflow planner (P0-3) — pure. Severity in, task list out.
 *
 * Critical routes to people, not to a queue: acknowledge within the hour and
 * triage the same day. Lower levels get room to breathe. Every task carries an
 * idempotency key (`<incidentId>:<kind>`) so a retried start converges instead
 * of duplicating, and an unacknowledged task falls back to the next role up.
 */

export type WorkflowKind = 'acknowledge' | 'triage' | 'investigate' | 'action' | 'verify' | 'report';

export interface PlannedTask {
  kind: WorkflowKind;
  title: string;
  owner_role: string;
  due_hours: number;
  fallback_to: string | null;
}

export function planForSeverity(level: string): PlannedTask[] {
  switch (level) {
    case 'critical':
      return [
        { kind: 'acknowledge', title: 'Acknowledge critical incident', owner_role: 'MANAGER', due_hours: 1, fallback_to: 'ORG_ADMIN' },
        { kind: 'triage', title: 'Triage and contain', owner_role: 'MANAGER', due_hours: 4, fallback_to: 'ORG_ADMIN' },
        { kind: 'investigate', title: 'Investigate root cause', owner_role: 'MANAGER', due_hours: 24, fallback_to: 'ORG_ADMIN' },
        { kind: 'report', title: 'External reporting assessment', owner_role: 'ORG_ADMIN', due_hours: 24, fallback_to: null },
      ];
    case 'high':
      return [
        { kind: 'acknowledge', title: 'Acknowledge incident', owner_role: 'MANAGER', due_hours: 4, fallback_to: 'ORG_ADMIN' },
        { kind: 'triage', title: 'Triage and contain', owner_role: 'MANAGER', due_hours: 24, fallback_to: 'ORG_ADMIN' },
        { kind: 'investigate', title: 'Investigate root cause', owner_role: 'MANAGER', due_hours: 72, fallback_to: null },
      ];
    case 'medium':
      return [
        { kind: 'acknowledge', title: 'Acknowledge incident', owner_role: 'MANAGER', due_hours: 24, fallback_to: null },
        { kind: 'investigate', title: 'Investigate and record actions', owner_role: 'MANAGER', due_hours: 168, fallback_to: null },
      ];
    default:
      return [
        { kind: 'acknowledge', title: 'Acknowledge incident', owner_role: 'MANAGER', due_hours: 48, fallback_to: null },
      ];
  }
}

export function taskKey(incidentId: string, kind: string): string {
  return `${incidentId}:${kind}`;
}
