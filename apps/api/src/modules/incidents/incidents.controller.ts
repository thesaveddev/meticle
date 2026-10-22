import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { IncidentsRepository } from './incidents.repository';
import { publishDomainEvent } from '../events/events.outbox';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { sendPushToUser } from '../notifications/push.service';
import { logWarn } from '../../shared/utils/logger';
import logger from '../../shared/utils/logger';
import { query } from '../../shared/database';
import { IncidentFormsRepository } from '../incident-forms/incident-forms.repository';
import { evaluateForm } from '../incident-forms/incident-forms.evaluate';
import { IncidentSeverityRepository } from '../incident-severity/incident-severity.repository';
import { IncidentWorkflowRepository } from '../incident-workflow/incident-workflow.repository';
import { suggestActions } from './incident-actions.suggest';

/** Reporter's severity guess → engine harm input when no form answer says otherwise. */
function mapSeverityToHarm(severity: string): string {
  switch (severity) {
    case 'critical': return 'severe';
    case 'high': return 'moderate';
    case 'medium': return 'minor';
    default: return 'none';
  }
}
import { UserRole, micaRecordPath, type MicaRecordRef } from '@meticle/shared';

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

  static isReporter(req: Request): boolean {
    return req.user?.role === UserRole.CARE_WORKER;
  }

  static isManagerRole(req: Request): boolean {
    return req.user?.role === UserRole.ORG_ADMIN || req.user?.role === UserRole.MANAGER;
  }

  /**
   * Support workers may open an incident and follow the ones they raised, but
   * they must not be able to read the organisation's whole incident history.
   * Everyone else keeps the full view.
   */
  static async requireVisibleIncident(req: Request): Promise<any> {
    const incident = await IncidentsRepository.findById(
      req.params.id,
      IncidentsController.getOrgId(req),
      IncidentsController.isAdmin(req)
    );
    if (!incident) throw new AppError(404, 'Incident not found');
    if (IncidentsController.isReporter(req) && incident.reported_by !== req.user!.userId) {
      throw new AppError(403, 'You can only view incidents you reported');
    }
    return incident;
  }

  static async notifyOnCreate(req: Request, incident: any) {
    const orgId = IncidentsController.getOrgId(req);
    const urgent = incident.severity === 'high' || incident.severity === 'critical' || incident.is_cqc_reportable;
    try {
      const admins = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) AS name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND ($2::uuid IS NULL OR u.id != $2::uuid)`,
        [orgId, IncidentsController.getUserId(req) || null]
      );
      const managers = urgent
        ? await query(
            `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) AS name
             FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
             WHERE u.organization_id = $1 AND u.role = 'MANAGER' AND ($2::uuid IS NULL OR u.id != $2::uuid)`,
            [orgId, IncidentsController.getUserId(req) || null]
          )
        : { rows: [] as Array<{ id: string; email: string; name: string }> };

      const targets = new Set<string>([...admins.rows, ...managers.rows].map((r) => r.id));
      const verb = incident.is_near_miss ? 'Near miss' : 'Incident';
      const title = urgent ? `${verb} reported (${incident.severity})` : `${verb} reported`;
      const message = `${incident.title}${incident.location ? ` at ${incident.location}` : ''} — ${incident.severity} severity${incident.is_cqc_reportable ? ', CQC reportable' : ''}.`;

      // The incident the reader is being told about. One link for all three
      // channels below: the incident's detail page is named by its route, so every
      // one of these lands on the record rather than on the directory the reader
      // would then have to search — which is the whole point of telling them.
      const incidentLink: MicaRecordRef = { kind: 'incident', id: incident.id };
      const incidentPath = micaRecordPath(incidentLink);

      // Send in-app notifications
      const targetIds = Array.from(targets);
      await Promise.all(
        targetIds.map((id: string) =>
          NotificationsController.createNotification(id, title, message, urgent ? 'warning' : 'info', incidentPath)
            .catch(logWarn('incident notification'))
        )
      );

      // Send push notifications and emails to managers
      const reporterResult = await query(
        `SELECT COALESCE(sp.first_name, u.email) AS name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
        [IncidentsController.getUserId(req) || null]
      );
      const reporterName = reporterResult.rows[0]?.name || 'A staff member';

      const allManagers = [...admins.rows, ...managers.rows];
      await Promise.all(
        allManagers.map(async (m) => {
          try {
            await sendPushToUser(m.id, {
              type: 'incident_reported',
              title,
              body: message,
              url: incidentPath,
            }, 'incidents');
            await EmailService.sendIncidentReportedEmail(
              m.email, m.name, reporterName, incident.title,
              incident.location || 'N/A', incident.description || '',
              EmailService.recordUrl(incidentLink)
            );
          } catch { /* notification failure should not block */ }
        })
      );
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
      reportedBy: IncidentsController.isReporter(req) ? req.user!.userId : undefined,
    });
    res.json(data);
  }

  static async getById(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const incident = await IncidentsRepository.findById(req.params.id, IncidentsController.getOrgId(req), IncidentsController.isAdmin(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    const involved = await IncidentsRepository.getInvolvedResidents(req.params.id);
    const actions = await IncidentsRepository.getActions(req.params.id);
    const attachments = await IncidentsRepository.getAttachments(req.params.id);
    res.json({ ...incident, involved, actions, attachments });
  }

  /**
   * The fields a support worker is allowed to supply when raising a concern.
   * Investigation and regulatory fields are decided during triage by a manager,
   * so accepting them here would let the first person to file an incident set
   * its own CQC reportability, status and root cause.
   */
  private static readonly REPORTER_FIELDS = [
    'title', 'description', 'witnesses', 'incident_date', 'incident_time', 'location',
    'severity', 'category_id', 'is_near_miss', 'is_confidential', 'client_submission_id',
    'person_ids', 'visit_id', 'form_key', 'form_answers', 'reopens_incident_id',
  ] as const;

  static sanitiseForReporter(body: any): any {
    const permitted: Record<string, unknown> = {};
    for (const field of IncidentsController.REPORTER_FIELDS) {
      if (body?.[field] !== undefined) permitted[field] = body[field];
    }
    return permitted;
  }

  static async create(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const userId = IncidentsController.getUserId(req) || '';
    const payload = IncidentsController.isReporter(req)
      ? IncidentsController.sanitiseForReporter(req.body)
      : req.body;
    const incident = await IncidentsRepository.create(orgId, payload, userId);
    const wasCreated = incident.was_created !== false;
    delete incident.was_created;
    // An idempotent retry returns the original incident, so it must not repeat
    // notifications, audits or domain events for the same staff submission.
    if (!wasCreated) {
      res.status(200).json(incident);
      return;
    }
    // Awaited so the event is recorded before the request is reported as done:
    // the insert auto-commits on this connection, so without the await a client
    // (and a test) could observe 201 while the event is still in flight.
    await publishDomainEvent({
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
    // P1a submit wiring: the report names its form version, the server
    // re-validates (never trusts the client's evaluate), appends answers,
    // assesses severity deterministically and starts the workflow. Each engine
    // step is best-effort: a form/severity/workflow failure is logged and the
    // incident still exists — an unassessed report beats a lost one.
    let linked = incident;
    try {
      // Only run the form/severity/workflow engine when the report carries
      // form data. Reports without it (older clients, existing tests) keep
      // their submitted severity and skip assessment — running the engine on
      // empty answers would downgrade every such report to a default level.
      const hasFormPayload = (payload as { form_key?: unknown }).form_key !== undefined
        || (payload as { form_answers?: unknown }).form_answers !== undefined;
      if (!hasFormPayload) throw new Error('skip-engine-no-form-data');
      const formKey = String((payload as { form_key?: unknown }).form_key ?? 'general');
      const rawAnswers = ((payload as { form_answers?: unknown }).form_answers ?? {}) as Record<string, unknown>;
      await IncidentFormsRepository.ensureStarter(orgId, userId).catch(() => {});
      const form = await IncidentFormsRepository.getPublishedByKey(orgId, formKey).catch(() => null);
      const versionId = form?.version?.id as string | undefined;
      if (form && versionId) {
        const fields = (form.fields ?? []) as Parameters<typeof evaluateForm>[0];
        const evaluated = evaluateForm(fields, rawAnswers);
        const kept: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rawAnswers)) {
          if (!evaluated.cleared.includes(k)) kept[k] = v;
        }
        await IncidentsRepository.saveAnswers(orgId, incident.id, versionId, userId, kept).catch(logWarn('incident answers'));
        const categoryName = (incident as { category_name?: string }).category_name ?? (incident as { category_id?: string }).category_id;
        const severityInputs = {
          ...kept,
          category: (kept.category as string | undefined) ?? categoryName ?? '',
          harm_level: (kept.harm_level as string | undefined) ?? mapSeverityToHarm(String(incident.severity ?? 'medium')),
          urgency: (kept.urgency as string | undefined) ?? 'routine',
        };
        const { assessment, result } = await IncidentSeverityRepository.assess(orgId, userId, incident.id, severityInputs as never);
        publishDomainEvent({
          organizationId: orgId, eventName: 'incident.severity_changed', aggregateType: 'incident',
          aggregateId: incident.id, correlationId: incident.id,
          payload: { level: result.level, provisional: result.provisional, assessment_id: assessment.id, automatic: true },
        }).catch(logWarn('publish incident.severity_changed'));
        await IncidentWorkflowRepository.start(orgId, userId, incident.id, result.level).catch(logWarn('incident workflow start'));
        linked = (await IncidentsRepository.setEngineLink(incident.id, orgId, versionId, assessment.id).catch(() => null)) ?? incident;
        // The assessed level is the triage truth; the reporter's guess stays in
        // the audit trail (create log above) rather than on the directory.
        if (result.level && result.level !== incident.severity) {
          linked = (await IncidentsRepository.update(incident.id, { severity: result.level }, orgId).catch(() => null)) ?? linked;
        }
      }
    } catch (err) {
      if ((err as Error)?.message !== 'skip-engine-no-form-data') logWarn('incident engine wiring')(err);
    }
    await IncidentsController.notifyOnCreate(req, linked);
    res.status(201).json(linked);
  }

  /** Severity history for the workflow board. Visibility-gated by the route. */
  static async getAssessments(req: Request, res: Response) {
    const oid = IncidentsController.getOrgId(req);
    res.json(await IncidentSeverityRepository.history(oid, String(req.params.id)));
  }

  /** Workflow + tasks + events for the board. Visibility-gated by the route. */
  static async getWorkflow(req: Request, res: Response) {
    const found = await IncidentWorkflowRepository.getByIncident(IncidentsController.getOrgId(req), String(req.params.id));
    if (!found) throw new AppError(404, 'Workflow not found');
    res.json(found);
  }

  /**
   * Submit a draft for triage. Idempotent: a retry after a successful submit
   * returns the submitted row rather than erroring, so a double-press on a
   * slow connection cannot wedge the report. A reporter may submit only
   * their own draft; managers may submit any.
   */
  static async submit(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const incident = await IncidentsController.requireVisibleIncident(req);
    if (incident.status === 'submitted') {
      res.json(incident);
      return;
    }
    const moved = await IncidentsRepository.transitionStatus(incident.id, orgId, 'submitted', ['draft', 'reported']);
    if (!moved) throw new AppError(409, `Only a draft can be submitted (current status: ${incident.status})`);
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.submitted', aggregateType: 'incident',
      aggregateId: incident.id, correlationId: incident.id, payload: { id: incident.id },
    }).catch(logWarn('publish incident.submitted'));
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: 'submit', entity_type: 'incident',
      entity_id: incident.id, old_data: { status: incident.status }, new_data: { status: 'submitted' }, ip_address: req.ip,
    }).catch(logWarn('audit incident submit'));
    res.json(moved);
  }

  /**
   * Reopen a closed or resolved incident when new facts emerge. The reason is
   * required and recorded — a reopen without a reason is indistinguishable
   * from a mistake. The same row continues (history preserved, open actions
   * intact) and the workflow trail gets a reopen event.
   */
  static async reopen(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const userId = IncidentsController.getUserId(req) || '';
    const incident = await IncidentsController.requireVisibleIncident(req);
    const reason = String((req.body as { reason?: unknown }).reason ?? '').trim();
    const moved = await IncidentsRepository.transitionStatus(incident.id, orgId, 'reopened', ['closed', 'resolved']);
    if (!moved) throw new AppError(409, `Only a closed or resolved incident can be reopened (current status: ${incident.status})`);
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.reopened', aggregateType: 'incident',
      aggregateId: incident.id, correlationId: incident.id, payload: { id: incident.id, reason },
    }).catch(logWarn('publish incident.reopened'));
    AuditRepository.log({
      user_id: userId || undefined, action: 'reopen', entity_type: 'incident',
      entity_id: incident.id, old_data: { status: incident.status }, new_data: { status: 'reopened', reason }, ip_address: req.ip,
    }).catch(logWarn('audit incident reopen'));
    const wf = await IncidentWorkflowRepository.getByIncident(orgId, incident.id).catch(() => null);
    if (wf) {
      await query(
        `INSERT INTO incident_workflow_events (organization_id, workflow_id, event, from_state, to_state, actor_id, reason)
         VALUES ($1,$2,'reopened',$3,'reopened',$4,$5)`,
        [orgId, (wf.workflow as { id: string }).id, incident.status, userId || null, reason]
      ).catch(logWarn('workflow reopen event'));
    }
    res.json(moved);
  }

  /** Duplicate candidates for the merge review. Heuristic; manager decides. */
  static async getDuplicates(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    res.json(await IncidentsRepository.findDuplicates(IncidentsController.getOrgId(req), String(req.params.id)));
  }

  static async createLink(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    await IncidentsController.requireVisibleIncident(req);
    const { linked_incident_id, link_type, reason } = req.body as { linked_incident_id: string; link_type: string; reason?: string };
    if (linked_incident_id === req.params.id) throw new AppError(400, 'An incident cannot be linked to itself');
    const link = await IncidentsRepository.createLink(orgId, String(req.params.id), linked_incident_id, link_type, reason, IncidentsController.getUserId(req) || '');
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.linked', aggregateType: 'incident',
      aggregateId: String(req.params.id), correlationId: String(req.params.id),
      payload: { id: req.params.id, linked_incident_id, link_type },
    }).catch(logWarn('publish incident.linked'));
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: 'link', entity_type: 'incident',
      entity_id: String(req.params.id), new_data: { linked_incident_id, link_type, reason }, ip_address: req.ip,
    }).catch(logWarn('audit incident link'));
    res.status(201).json(link);
  }

  static async getLinks(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    res.json(await IncidentsRepository.getLinks(IncidentsController.getOrgId(req), String(req.params.id)));
  }

  /**
   * Draft corrective actions (§13.5 step 7): rules propose from the
   * incident's facts, the AI triage's recommendations join with provenance,
   * and a manager approves each draft into real work. Re-running converges
   * on the same drafts instead of multiplying them.
   */
  static async suggestActions(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const userId = IncidentsController.getUserId(req) || '';
    const incident = await IncidentsController.requireVisibleIncident(req);
    const inv = await IncidentsRepository.getInvestigation(orgId, incident.id).catch(() => null);
    const triage = (incident as { ai_triage?: { actions_recommended?: unknown } }).ai_triage;
    const drafts = suggestActions({
      category: (incident as { category_name?: string }).category_name ?? (incident as { category_id?: string }).category_id ?? '',
      severity: incident.severity,
      isCqcReportable: incident.is_cqc_reportable,
      isNearMiss: incident.is_near_miss,
      investigationSummary: (inv as { summary?: string } | null)?.summary,
      aiRecommended: triage?.actions_recommended,
    });
    const suggestions = await IncidentsRepository.proposeSuggestions(orgId, incident.id, userId, drafts);
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.actions_suggested', aggregateType: 'incident',
      aggregateId: incident.id, correlationId: incident.id, payload: { id: incident.id, count: suggestions.length },
    }).catch(logWarn('publish incident.actions_suggested'));
    AuditRepository.log({
      user_id: userId || undefined, action: 'actions_suggest', entity_type: 'incident',
      entity_id: incident.id, new_data: { count: suggestions.length }, ip_address: req.ip,
    }).catch(logWarn('audit actions suggest'));
    res.status(201).json(suggestions);
  }

  static async getSuggestions(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    res.json(await IncidentsRepository.listSuggestions(IncidentsController.getOrgId(req), String(req.params.id)));
  }

  static async decideSuggestion(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    await IncidentsController.requireVisibleIncident(req);
    const { decision, reason } = req.body as { decision: 'approved' | 'rejected'; reason?: string };
    const result = await IncidentsRepository.decideSuggestion(orgId, String(req.params.suggestionId), IncidentsController.getUserId(req) || '', decision, reason);
    if (!result) throw new AppError(404, 'Suggestion not found');
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.suggestion_decided', aggregateType: 'incident',
      aggregateId: String(req.params.id), correlationId: String(req.params.id),
      payload: { id: req.params.id, decision, action_id: (result.action as { id?: string } | null)?.id || null },
    }).catch(logWarn('publish incident.suggestion_decided'));
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: `suggestion_${decision}`, entity_type: 'incident',
      entity_id: String(req.params.id), new_data: { suggestion_id: req.params.suggestionId, reason }, ip_address: req.ip,
    }).catch(logWarn('audit suggestion decide'));
    res.json(result);
  }

  static async deleteLink(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const removed = await IncidentsRepository.deleteLink(IncidentsController.getOrgId(req), String(req.params.linkId));
    if (!removed) throw new AppError(404, 'Link not found');
    res.status(204).send();
  }

  // === Closeout (P3-P5): investigation, verification, reporting, close ===

  static async startInvestigation(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const incident = await IncidentsController.requireVisibleIncident(req);
    const { lead_id, summary } = req.body as { lead_id?: string; summary?: string };
    const { investigation, duplicate } = await IncidentsRepository.startInvestigation(orgId, incident.id, IncidentsController.getUserId(req) || '', lead_id, summary);
    if (!duplicate) {
      publishDomainEvent({
        organizationId: orgId, eventName: 'incident.investigation_started', aggregateType: 'incident',
        aggregateId: incident.id, correlationId: incident.id, payload: { id: incident.id, lead_id: lead_id || null },
      }).catch(logWarn('publish incident.investigation_started'));
      AuditRepository.log({
        user_id: IncidentsController.getUserId(req), action: 'investigation_start', entity_type: 'incident',
        entity_id: incident.id, new_data: { lead_id: lead_id || null }, ip_address: req.ip,
      }).catch(logWarn('audit investigation start'));
    }
    res.status(duplicate ? 200 : 201).json(investigation);
  }

  static async getInvestigation(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const found = await IncidentsRepository.getInvestigation(IncidentsController.getOrgId(req), String(req.params.id));
    if (!found) throw new AppError(404, 'No investigation for this incident');
    res.json(found);
  }

  static async addInvestigationNote(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    await IncidentsController.requireVisibleIncident(req);
    const inv = await IncidentsRepository.getInvestigation(orgId, String(req.params.id));
    if (!inv) throw new AppError(404, 'No investigation for this incident');
    const { note } = req.body as { note: string };
    const created = await IncidentsRepository.addInvestigationNote(orgId, inv.id, IncidentsController.getUserId(req) || '', note);
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: 'investigation_note', entity_type: 'incident',
      entity_id: String(req.params.id), new_data: { investigation_id: inv.id }, ip_address: req.ip,
    }).catch(logWarn('audit investigation note'));
    res.status(201).json(created);
  }

  static async completeInvestigation(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    await IncidentsController.requireVisibleIncident(req);
    const inv = await IncidentsRepository.getInvestigation(orgId, String(req.params.id));
    if (!inv) throw new AppError(404, 'No investigation for this incident');
    const { summary } = req.body as { summary?: string };
    const done = await IncidentsRepository.completeInvestigation(orgId, inv.id, IncidentsController.getUserId(req) || '', summary);
    if (!done) throw new AppError(409, 'This investigation is already complete');
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.investigation_completed', aggregateType: 'incident',
      aggregateId: String(req.params.id), correlationId: String(req.params.id), payload: { id: req.params.id },
    }).catch(logWarn('publish incident.investigation_completed'));
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: 'investigation_complete', entity_type: 'incident',
      entity_id: String(req.params.id), ip_address: req.ip,
    }).catch(logWarn('audit investigation complete'));
    res.json(done);
  }

  static async verifyAction(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    await IncidentsController.requireVisibleIncident(req);
    const { effectiveness, notes } = req.body as { effectiveness: string; notes?: string };
    const updated = await IncidentsRepository.verifyAction(orgId, String(req.params.actionId), IncidentsController.getUserId(req) || '', effectiveness, notes);
    if (!updated) throw new AppError(404, 'Action not found');
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: 'action_verify', entity_type: 'incident',
      entity_id: String(req.params.id), new_data: { action_id: req.params.actionId, effectiveness, notes }, ip_address: req.ip,
    }).catch(logWarn('audit action verify'));
    res.json(updated);
  }

  static async createReportingAssessment(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    await IncidentsController.requireVisibleIncident(req);
    const { reportable, channel, reference, reported_at } = req.body as { reportable: boolean; channel?: string; reference?: string; reported_at?: string };
    const created = await IncidentsRepository.createReportingAssessment(orgId, String(req.params.id), IncidentsController.getUserId(req) || '', { reportable, channel, reference, reported_at });
    AuditRepository.log({
      user_id: IncidentsController.getUserId(req), action: 'reporting_assess', entity_type: 'incident',
      entity_id: String(req.params.id), new_data: { reportable, channel, reference }, ip_address: req.ip,
    }).catch(logWarn('audit reporting assess'));
    res.status(201).json(created);
  }

  static async getReportingAssessments(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    res.json(await IncidentsRepository.listReportingAssessments(IncidentsController.getOrgId(req), String(req.params.id)));
  }

  /**
   * Guarded closure. The 409 names every blocker — an open investigation,
   * completed-but-unverified actions, a missing reporting decision on a
   * CQC-reportable incident — so a manager knows exactly what stands in the
   * way. Open (incomplete) actions survive closure and stay assigned.
   */
  static async close(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const userId = IncidentsController.getUserId(req) || '';
    const incident = await IncidentsController.requireVisibleIncident(req);
    if (incident.status === 'closed') {
      res.json(incident);
      return;
    }
    const checked = await IncidentsRepository.closeBlockers(orgId, incident.id);
    if (!checked) throw new AppError(404, 'Incident not found');
    if (checked.blockers.length > 0) throw new AppError(409, `Cannot close: ${checked.blockers.join('; ')}`);
    const { summary } = req.body as { summary?: string };
    const moved = await IncidentsRepository.transitionStatus(incident.id, orgId, 'closed',
      ['reported', 'submitted', 'triaging', 'investigating', 'actioning', 'verifying', 'reopened', 'resolved']);
    if (!moved) throw new AppError(409, `Only a triaged incident can be closed (current status: ${incident.status})`);
    publishDomainEvent({
      organizationId: orgId, eventName: 'incident.closed', aggregateType: 'incident',
      aggregateId: incident.id, correlationId: incident.id,
      payload: { id: incident.id, open_actions_carried: checked.openActions },
    }).catch(logWarn('publish incident.closed'));
    AuditRepository.log({
      user_id: userId || undefined, action: 'close', entity_type: 'incident',
      entity_id: incident.id, old_data: { status: incident.status },
      new_data: { status: 'closed', summary: summary || undefined, open_actions_carried: checked.openActions }, ip_address: req.ip,
    }).catch(logWarn('audit incident close'));
    const wf = await IncidentWorkflowRepository.getByIncident(orgId, incident.id).catch(() => null);
    if (wf) {
      await query(
        `INSERT INTO incident_workflow_events (organization_id, workflow_id, event, from_state, to_state, actor_id, reason)
         VALUES ($1,$2,'closed',$3,'closed',$4,$5)`,
        [orgId, (wf.workflow as { id: string }).id, incident.status, userId || null, (summary || '').slice(0, 500) || null]
      ).catch(logWarn('workflow close event'));
    }
    res.json(moved);
  }

  static async update(req: Request, res: Response) {
    await IncidentsController.requireVisibleIncident(req);
    const before = await IncidentsRepository.findById(req.params.id, IncidentsController.getOrgId(req), true);
    const incident = await IncidentsRepository.update(req.params.id, req.body, IncidentsController.getOrgId(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    try {
      await AuditRepository.log({
        user_id: IncidentsController.getUserId(req),
        action: 'update',
        entity_type: 'incident',
        entity_id: incident.id,
        old_data: { status: before?.status, severity: before?.severity },
        new_data: { status: incident.status, severity: incident.severity },
        ip_address: req.ip,
      });
    } catch (err) {
      logWarn('audit incident update')(err);
    }
    res.json(incident);
  }

  static async deleteIncident(req: Request, res: Response) {
    const incident = await IncidentsRepository.delete(req.params.id, IncidentsController.getOrgId(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    // Audit log is awaited so it commits inside the same request boundary as
    // the response. CQC auditors expect a delete to leave a durable trail
    // before the client treats the action as complete.
    try {
      await AuditRepository.log({
        user_id: IncidentsController.getUserId(req),
        action: 'delete',
        entity_type: 'incident',
        entity_id: req.params.id,
        ip_address: req.ip,
      });
    } catch (err) {
      logWarn('audit incident delete')(err);
    }
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
