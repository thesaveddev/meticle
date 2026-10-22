import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { IncidentWorkflowRepository } from './incident-workflow.repository';
import { AuditRepository } from '../audit/audit.repository';
import { publishDomainEvent } from '../events/events.outbox';

function orgId(req: Request): string {
  const v = req.user?.organizationId;
  if (!v) throw new AppError(403, 'Organization context required');
  return v;
}

export class IncidentWorkflowController {
  static async start(req: Request, res: Response) {
    const oid = orgId(req);
    const { incident_id, severity_level, idempotency_key } = req.body as { incident_id?: string; severity_level?: string; idempotency_key?: string };
    if (!incident_id) throw new AppError(400, 'incident_id is required');
    const { workflow, tasks, duplicate } = await IncidentWorkflowRepository.start(oid, req.user!.userId, String(incident_id), String(severity_level ?? 'medium'), idempotency_key ?? null);
    AuditRepository.log({ user_id: req.user!.userId, action: duplicate ? 'read' : 'create', entity_type: 'incident_workflow', entity_id: workflow.id, new_data: { incident_id }, ip_address: req.ip }).catch(() => {});
    if (!duplicate) publishDomainEvent({ organizationId: oid, eventName: 'workflow.task_due', aggregateType: 'incident_workflow', aggregateId: workflow.id }).catch(() => {});
    res.status(duplicate ? 200 : 201).json({ workflow, tasks, duplicate });
  }

  static async taskAction(req: Request, res: Response) {
    const oid = orgId(req);
    const { id, action } = req.params;
    if (!['ack', 'complete', 'extend'].includes(action)) throw new AppError(400, 'Unknown action');
    const result = await IncidentWorkflowRepository.transition(oid, req.user!.userId, String(id), action as never, (req.body as { reason?: string }).reason);
    if (!result) throw new AppError(404, 'Task not found');
    AuditRepository.log({ user_id: req.user!.userId, action, entity_type: 'incident_workflow_task', entity_id: String(id), ip_address: req.ip }).catch(() => {});
    res.json(result.task);
  }

  static async getByIncident(req: Request, res: Response) {
    const found = await IncidentWorkflowRepository.getByIncident(orgId(req), String(req.params.incidentId));
    if (!found) throw new AppError(404, 'Workflow not found');
    res.json(found);
  }

  static async sweep(req: Request, res: Response) {
    const escalated = await IncidentWorkflowRepository.sweepOverdue(orgId(req));
    if (escalated.length > 0) publishDomainEvent({ organizationId: orgId(req), eventName: 'workflow.escalated', payload: { count: escalated.length } }).catch(() => {});
    res.json({ escalated });
  }
}
