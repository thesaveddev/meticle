import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { IncidentsRepository } from './incidents.repository';
import { publishDomainEvent } from '../events/events.outbox';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { logWarn } from '../../shared/utils/logger';
import logger from '../../shared/utils/logger';
import { query } from '../../shared/database';
import { UserRole } from '@meticle/shared';

export class IncidentsController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static getUserId(req: Request): string | undefined {
    return req.user?.userId;
  }

  static isAdmin(req: Request): boolean {
    return req.user?.role === UserRole.ORG_ADMIN;
  }

  static async requireVisibleIncident(req: Request): Promise<any> {
    const incident = await IncidentsRepository.findById(
      req.params.id,
      IncidentsController.getOrgId(req),
      IncidentsController.isAdmin(req)
    );
    if (!incident) throw new AppError(404, 'Incident not found');
    return incident;
  }

  static async notifyOnCreate(req: Request, incident: any) {
    const orgId = IncidentsController.getOrgId(req);
    const urgent = incident.severity === 'high' || incident.severity === 'critical' || incident.is_cqc_reportable;
    try {
      const admins = await query(
        `SELECT id FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND ($2::uuid IS NULL OR id != $2::uuid)`,
        [orgId, IncidentsController.getUserId(req) || null]
      );
      const managers = urgent
        ? await query(
            `SELECT id FROM users WHERE organization_id = $1 AND role = 'MANAGER' AND ($2::uuid IS NULL OR id != $2::uuid)`,
            [orgId, IncidentsController.getUserId(req) || null]
          )
        : { rows: [] as Array<{ id: string }> };
      const targets = new Set<string>([...admins.rows, ...managers.rows].map((r) => r.id));
      const verb = incident.is_near_miss ? 'Near miss' : 'Incident';
      const title = urgent ? `${verb} reported (${incident.severity})` : `${verb} reported`;
      const message = `${incident.title}${incident.location ? ` at ${incident.location}` : ''} — ${incident.severity} severity${incident.is_cqc_reportable ? ', CQC reportable' : ''}.`;
      for (const id of targets) {
        NotificationsController.createNotification(id, title, message, urgent ? 'warning' : 'info')
          .catch(logWarn('incident notification'));
      }
    } catch (err) {
      logger.error({ err }, 'Failed to notify admins of new incident');
    }
  }

  static async getStats(req: Request, res: Response) {
    const data = await IncidentsRepository.getStats(IncidentsController.getOrgId(req), IncidentsController.isAdmin(req));
    res.json(data);
  }

  static async list(req: Request, res: Response) {
    const { status, category_id, severity, is_near_miss, date_from, date_to, limit, offset } = req.query;
    const data = await IncidentsRepository.findAll(IncidentsController.getOrgId(req), {
      status: status as string, category_id: category_id as string,
      severity: severity as string, is_near_miss: is_near_miss as string,
      date_from: date_from as string, date_to: date_to as string,
      include_confidential: IncidentsController.isAdmin(req),
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(data);
  }

  static async getById(req: Request, res: Response) {
    const incident = await IncidentsRepository.findById(req.params.id, IncidentsController.getOrgId(req), IncidentsController.isAdmin(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    const involved = await IncidentsRepository.getInvolvedResidents(req.params.id);
    const actions = await IncidentsRepository.getActions(req.params.id);
    const attachments = await IncidentsRepository.getAttachments(req.params.id);
    res.json({ ...incident, involved, actions, attachments });
  }

  static async create(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const userId = IncidentsController.getUserId(req) || '';
    const incident = await IncidentsRepository.create(orgId, req.body, userId);
    publishDomainEvent({
      organizationId: orgId,
      eventName: 'incident.created',
      aggregateType: 'incident',
      aggregateId: incident.id,
      correlationId: incident.id,
      payload: {
        id: incident.id,
        title: incident.title,
        description: incident.description,
        category_id: incident.category_id,
        incident_date: incident.incident_date,
        incident_time: incident.incident_time,
        location: incident.location,
        severity: incident.severity,
        is_cqc_reportable: incident.is_cqc_reportable,
        is_near_miss: incident.is_near_miss,
        is_confidential: incident.is_confidential,
        reported_by: incident.reported_by,
      },
    }).catch(logWarn('publish incident.created'));
    AuditRepository.log({
      user_id: userId || undefined,
      action: 'create',
      entity_type: 'incident',
      entity_id: incident.id,
      new_data: { title: incident.title, severity: incident.severity, is_near_miss: incident.is_near_miss, is_confidential: incident.is_confidential },
      ip_address: req.ip,
    }).catch(logWarn('audit incident create'));
    await IncidentsController.notifyOnCreate(req, incident);
    res.status(201).json(incident);
  }

  static async update(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const before = await IncidentsRepository.findById(req.params.id, IncidentsController.getOrgId(req), true);
    const incident = await IncidentsRepository.update(req.params.id, req.body, IncidentsController.getOrgId(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req),
      action: 'update',
      entity_type: 'incident',
      entity_id: incident.id,
      old_data: { status: before?.status, severity: before?.severity },
      new_data: { status: incident.status, severity: incident.severity },
      ip_address: req.ip,
    }).catch(logWarn('audit incident update'));
    res.json(incident);
  }

  static async deleteIncident(req: Request, res: Response) {
    const incident = await IncidentsRepository.delete(req.params.id, IncidentsController.getOrgId(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req),
      action: 'delete',
      entity_type: 'incident',
      entity_id: req.params.id,
      ip_address: req.ip,
    }).catch(logWarn('audit incident delete'));
    res.status(204).send();
  }

  static async addInvolvedResident(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    const record = await IncidentsRepository.addInvolvedResident(req.params.id, req.body);
    AuditRepository.log({
      user_id: user.userId,
      action: 'involved_add',
      entity_type: 'incident',
      entity_id: req.params.id,
      new_data: { person_id: record.person_id, involvement_type: record.involvement_type },
      ip_address: req.ip,
    }).catch(logWarn('audit incident involved add'));
    res.status(201).json(record);
  }

  static async removeInvolvedResident(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    await IncidentsRepository.removeInvolvedResident(req.params.involvedId);
    AuditRepository.log({
      user_id: user.userId,
      action: 'involved_remove',
      entity_type: 'incident',
      entity_id: req.params.id,
      ip_address: req.ip,
    }).catch(logWarn('audit incident involved remove'));
    res.status(204).send();
  }

  static async getActions(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const actions = await IncidentsRepository.getActions(req.params.id);
    res.json(actions);
  }

  static async createAction(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    const action = await IncidentsRepository.createAction(req.params.id, req.body);
    AuditRepository.log({
      user_id: user.userId,
      action: 'action_create',
      entity_type: 'incident',
      entity_id: req.params.id,
      new_data: { action: action.action, assigned_to: action.assigned_to, due_date: action.due_date },
      ip_address: req.ip,
    }).catch(logWarn('audit incident action create'));
    res.status(201).json(action);
  }

  static async completeAction(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    const action = await IncidentsRepository.completeAction(req.params.actionId);
    if (!action) throw new AppError(404, 'Action not found');
    AuditRepository.log({
      user_id: user.userId,
      action: 'action_complete',
      entity_type: 'incident',
      entity_id: req.params.id,
      new_data: { action_id: action.id },
      ip_address: req.ip,
    }).catch(logWarn('audit incident action complete'));
    res.json(action);
  }

  static async updateAction(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    const action = await IncidentsRepository.updateAction(req.params.actionId, req.body);
    if (!action) throw new AppError(404, 'Action not found');
    AuditRepository.log({
      user_id: user.userId,
      action: 'action_update',
      entity_type: 'incident',
      entity_id: req.params.id,
      new_data: { action_id: action.id, status: action.status },
      ip_address: req.ip,
    }).catch(logWarn('audit incident action update'));
    res.json(action);
  }

  static async deleteAction(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    const actionId = req.params.actionId;
    await IncidentsRepository.deleteAction(actionId);
    AuditRepository.log({
      user_id: user.userId,
      action: 'action_delete',
      entity_type: 'incident',
      entity_id: req.params.id,
      ip_address: req.ip,
    }).catch(logWarn('audit incident action delete'));
    res.status(204).send();
  }

  static async getAttachments(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const attachments = await IncidentsRepository.getAttachments(req.params.id);
    res.json(attachments);
  }

  static async uploadAttachment(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const attachment = await IncidentsRepository.addAttachment(req.params.id, {
      file_name: req.file.originalname,
      file_url: '/files/private/' + req.file.filename,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      uploaded_by: user.userId,
    });
    AuditRepository.log({
      user_id: user.userId,
      action: 'attachment_upload',
      entity_type: 'incident',
      entity_id: req.params.id,
      new_data: { attachment_id: attachment.id, file_name: attachment.file_name },
      ip_address: req.ip,
    }).catch(logWarn('audit incident attachment upload'));
    res.status(201).json(attachment);
  }

  static async deleteAttachment(req: Request, res: Response) {
    const user = req.user!;
    await IncidentsController.requireVisibleIncident(req);
    const attachmentId = req.params.attachmentId;
    await IncidentsRepository.deleteAttachment(attachmentId);
    AuditRepository.log({
      user_id: user.userId,
      action: 'attachment_delete',
      entity_type: 'incident',
      entity_id: req.params.id,
      new_data: { attachment_id: attachmentId },
      ip_address: req.ip,
    }).catch(logWarn('audit incident attachment delete'));
    res.status(204).send();
  }

  static async getTimeline(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const timeline = await IncidentsRepository.getTimeline(req.params.id);
    res.json(timeline);
  }

  static async getCategories(req: Request, res: Response) {
    const data = await IncidentsRepository.findCategories(IncidentsController.getOrgId(req));
    res.json(data);
  }

  static async createCategory(req: Request, res: Response) {
    const cat = await IncidentsRepository.createCategory(IncidentsController.getOrgId(req), req.body);
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req),
      action: 'create',
      entity_type: 'incident_category',
      entity_id: cat.id,
      new_data: { name: cat.name, severity: cat.severity, is_cqc_reportable: cat.is_cqc_reportable },
      ip_address: req.ip,
    }).catch(logWarn('audit incident category create'));
    res.status(201).json(cat);
  }

  static async updateCategory(req: Request, res: Response) {
    const cat = await IncidentsRepository.updateCategory(req.params.id, IncidentsController.getOrgId(req), req.body);
    if (!cat) throw new AppError(404, 'Category not found');
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req),
      action: 'update',
      entity_type: 'incident_category',
      entity_id: cat.id,
      new_data: { name: cat.name, severity: cat.severity, is_cqc_reportable: cat.is_cqc_reportable, is_active: cat.is_active },
      ip_address: req.ip,
    }).catch(logWarn('audit incident category update'));
    res.json(cat);
  }

  static async deleteCategory(req: Request, res: Response) {
    const cat = await IncidentsRepository.deleteCategory(req.params.id, IncidentsController.getOrgId(req));
    if (!cat) throw new AppError(404, 'Category not found');
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req),
      action: 'delete',
      entity_type: 'incident_category',
      entity_id: req.params.id,
      ip_address: req.ip,
    }).catch(logWarn('audit incident category delete'));
    res.status(204).send();
  }
}
