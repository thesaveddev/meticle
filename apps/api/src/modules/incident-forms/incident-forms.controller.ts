import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { IncidentFormsRepository } from './incident-forms.repository';
import { evaluateForm } from './incident-forms.evaluate';
import { AuditRepository } from '../audit/audit.repository';
import { publishDomainEvent } from '../events/events.outbox';

function orgId(req: Request): string {
  const v = req.user?.organizationId;
  if (!v) throw new AppError(403, 'Organization context required');
  return v;
}

export class IncidentFormsController {
  /** Published form + fields. Seeds the starter library on first use. */
  static async getByKey(req: Request, res: Response) {
    const oid = orgId(req);
    await IncidentFormsRepository.ensureStarter(oid, req.user!.userId).catch(() => {});
    const found = await IncidentFormsRepository.getPublishedByKey(oid, String(req.params.key));
    if (!found) throw new AppError(404, 'Form not found');
    res.json(found);
  }

  static async createDraft(req: Request, res: Response) {
    const oid = orgId(req);
    const { key, name, fields } = req.body as { key: string; name: string; fields: unknown[] };
    const created = await IncidentFormsRepository.createDraft(oid, req.user!.userId, {
      key,
      name,
      fields: (fields ?? []) as never[],
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'incident_form', entity_id: created.definition.id, new_data: { key }, ip_address: req.ip }).catch(() => {});
    res.status(201).json(created);
  }

  static async publish(req: Request, res: Response) {
    const oid = orgId(req);
    const result = await IncidentFormsRepository.publish(oid, String(req.params.id), req.user!.userId);
    if (!result) throw new AppError(404, 'Form not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'publish', entity_type: 'incident_form', entity_id: String(req.params.id), ip_address: req.ip }).catch(() => {});
    publishDomainEvent({ organizationId: oid, eventName: 'incident.form_published', aggregateType: 'incident_form', aggregateId: String(req.params.id) }).catch(() => {});
    res.json(result);
  }

  /**
   * Answers → visible/required/invalid. Any authenticated user may call it:
   * a support worker needs it to file at all. All validation re-runs
   * server-side on submit; this is the UX mirror, not the gate.
   */
  static async evaluate(req: Request, res: Response) {
    const oid = orgId(req);
    const { form_version_id, key, answers } = req.body as { form_version_id?: string; key?: string; answers?: Record<string, unknown> };
    const safeAnswers = (answers ?? {}) as Record<string, unknown>;
    let fields: Array<{ field_key: string; required?: boolean | null; type?: string | null; options?: unknown; validation?: Record<string, unknown> | null; visibility?: never; requiredness?: never; hidden_policy?: string | null }> = [];
    if (form_version_id) {
      const found = await IncidentFormsRepository.getVersionWithFields(oid, String(form_version_id));
      if (!found) throw new AppError(404, 'Form version not found');
      fields = found.fields as never;
    } else if (key) {
      await IncidentFormsRepository.ensureStarter(oid, req.user!.userId).catch(() => {});
      const found = await IncidentFormsRepository.getPublishedByKey(oid, String(key));
      if (!found) throw new AppError(404, 'Form not found');
      fields = found.fields as never;
    } else {
      throw new AppError(400, 'form_version_id or key is required');
    }
    res.json(evaluateForm(fields as never, safeAnswers));
  }
}
