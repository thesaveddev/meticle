import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { IncidentSeverityRepository } from './incident-severity.repository';
import { AuditRepository } from '../audit/audit.repository';
import { publishDomainEvent } from '../events/events.outbox';

function orgId(req: Request): string {
  const v = req.user?.organizationId;
  if (!v) throw new AppError(403, 'Organization context required');
  return v;
}

export class IncidentSeverityController {
  static async assess(req: Request, res: Response) {
    const oid = orgId(req);
    const { incident_id, answers, inputs } = req.body as { incident_id?: string; answers?: Record<string, unknown>; inputs?: Record<string, unknown> };
    const incidentId = String(incident_id ?? (req.body as { incidentId?: unknown }).incidentId ?? '');
    if (!incidentId) throw new AppError(400, 'incident_id is required');
    const merged = { ...(answers ?? {}), ...(inputs ?? {}) } as never;
    const { assessment, result } = await IncidentSeverityRepository.assess(oid, req.user!.userId, incidentId, merged);
    AuditRepository.log({ user_id: req.user!.userId, action: 'assess', entity_type: 'incident_severity', entity_id: assessment.id, new_data: { incident_id: incidentId, level: result.level }, ip_address: req.ip }).catch(() => {});
    publishDomainEvent({ organizationId: oid, eventName: 'severity.assessed', aggregateType: 'incident', aggregateId: incidentId, payload: { level: result.level, provisional: result.provisional } }).catch(() => {});
    // Catalogue name for the same fact: the blueprint's event catalogue
    // lists `incident.severity_changed`, so both names are published and a
    // consumer listening for either one sees the change.
    publishDomainEvent({ organizationId: oid, eventName: 'incident.severity_changed', aggregateType: 'incident', aggregateId: incidentId, correlationId: incidentId, payload: { level: result.level, provisional: result.provisional, assessment_id: assessment.id } }).catch(() => {});
    res.status(201).json({ assessment, ...result });
  }

  static async override(req: Request, res: Response) {
    const oid = orgId(req);
    const { assessment_id, level, reason } = req.body as { assessment_id?: string; level?: string; reason?: string };
    if (!assessment_id || !level || !reason?.trim()) throw new AppError(400, 'assessment_id, level and reason are required');
    if (!['low', 'medium', 'high', 'critical'].includes(level)) throw new AppError(400, 'Invalid level');
    const row = await IncidentSeverityRepository.override(oid, req.user!.userId, String(assessment_id), level, String(reason).slice(0, 2000));
    if (!row) throw new AppError(404, 'Assessment not found');
    publishDomainEvent({ organizationId: oid, eventName: 'incident.severity_changed', aggregateType: 'incident', aggregateId: String(row.incident_id), correlationId: String(row.incident_id), payload: { level, override_reason: reason, assessment_id: row.id } }).catch(() => {});
    AuditRepository.log({ user_id: req.user!.userId, action: 'override', entity_type: 'incident_severity', entity_id: row.id, new_data: { level, reason }, ip_address: req.ip }).catch(() => {});
    res.status(201).json(row);
  }

  static async history(req: Request, res: Response) {
    const oid = orgId(req);
    const rows = await IncidentSeverityRepository.history(oid, String(req.params.incidentId));
    res.json(rows);
  }
}
