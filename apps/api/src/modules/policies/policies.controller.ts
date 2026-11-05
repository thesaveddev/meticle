import { Request, Response } from 'express';
import { PolicyRepository } from './policies.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { UserRole } from '@meticle/shared';
import { NotificationsController } from '../notifications/notifications.controller';
import { TaskRepository } from '../tasks/tasks.repository';
import { AuditRepository } from '../audit/audit.repository';
import { EmailService } from '../../shared/utils/email.service';
import pool from '../../shared/database';

export class PolicyController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static async list(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const { category, search } = req.query as any;
    await PolicyRepository.ensureDefaults(orgId);
    const policies = await PolicyRepository.findAll(orgId, category, search);
    res.json(policies);
  }

  static async getById(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    res.json(policy);
  }

  static async create(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.create({ ...req.body, organization_id: orgId, updated_by: req.user!.userId });
    // The first snapshot, so the version history starts at v1 rather than at
    // the first edit: what the policy said on the day it was created matters.
    await PolicyRepository.createVersion({
      organization_id: orgId, policy_id: policy.id, version: policy.version,
      title: policy.title, category: policy.category, content: policy.content,
      status: policy.status, what_changed: null, created_by: req.user!.userId,
    }).catch(() => {});
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'policy', entity_id: policy.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.status(201).json(policy);
  }

  static async update(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const before = await PolicyRepository.findById(req.params.id, orgId);
    if (!before) throw new AppError(404, 'Policy not found');
    const policy = await PolicyRepository.update(req.params.id, { ...req.body, updated_by: req.user!.userId }, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'policy', entity_id: policy.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    const versionChanged = typeof req.body.version === 'string' && req.body.version !== before.version;
    const contentChanged = (typeof req.body.content === 'string' && req.body.content !== before.content)
      || (typeof req.body.title === 'string' && req.body.title !== before.title)
      || (typeof req.body.category === 'string' && req.body.category !== before.category);
    const publishedNow = req.body.status === 'published' && before.status !== 'published';
    let readRequestsSent = 0;
    if (versionChanged || contentChanged) {
      await PolicyRepository.createVersion({
        organization_id: orgId, policy_id: policy.id, version: policy.version,
        title: policy.title, category: policy.category, content: policy.content,
        status: policy.status, what_changed: req.body.what_changed, created_by: req.user!.userId,
      }).catch(() => {});
    }
    // Publishing — a first publish or a new published version — asks the whole
    // staff to read it again (5.10: "Version 1.1 published / Staff will be
    // asked to read it again"). Best effort: the save already succeeded and a
    // notification failure must never fail it.
    if (publishedNow || (versionChanged && policy.status === 'published')) {
      try {
        readRequestsSent = await PolicyController.askToRead(orgId, policy, {
          mode: 'all',
          message: `“${policy.title}” has been updated — please read the new version.`,
          excludeUserId: req.user!.userId,
          senderName: await PolicyController.senderName(orgId, req.user!.userId),
        });
      } catch { /* read requests non-critical */ }
    }
    res.json({ ...policy, readRequestsSent });
  }

  static async delete(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    await PolicyRepository.delete(req.params.id, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'policy', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Policy deleted' });
  }

  static async getCategories(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const categories = await PolicyRepository.getCategories(orgId);
    res.json(categories);
  }

  static async seedStandard(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const result = await PolicyRepository.seedStandardPolicies(orgId);
    res.json(result);
  }

  /**
   * Any signed-in staff member may acknowledge a policy in their own name —
   * that is the whole point (blueprint §9.7): the acknowledgement is
   * attributed to the caller, never to a supplied user id.
   */
  static async acknowledge(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const ack = await PolicyRepository.acknowledge(req.params.id, orgId, req.user!.userId);
    res.status(201).json(ack);
  }

  /**
   * Managers read the whole list; anyone else reads only their own row, so a
   * support worker can see what they have acknowledged without seeing the
   * organisation's reading history.
   */
  /** Version history for one policy, newest version first. */
  static async versions(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    res.json(await PolicyRepository.versions(req.params.id, orgId));
  }

  private static async senderName(orgId: string, userId: string): Promise<string> {
    try {
      const result = await pool.query(
        `SELECT COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.id = $1 AND u.organization_id = $2`,
        [userId, orgId]
      );
      return result.rows[0]?.name || 'Your manager';
    } catch {
      return 'Your manager';
    }
  }

  /**
   * One notification plus one task per recipient, then one email each:
   * "They'll get a message and a task, and sign when they've read it."
   * Recipients without a staff profile get the notification and the email but
   * no task, because tasks are assigned to staff profiles, not users.
   */
  private static async askToRead(
    orgId: string,
    policy: { id: string; title: string },
    options: { mode: 'all' | 'unsigned' | 'selected'; user_ids?: string[]; read_by?: string | null; message?: string; excludeUserId?: string; senderName: string },
  ): Promise<number> {
    const audience = await PolicyRepository.readAudience(orgId);
    let recipients = audience.filter((person) => person.user_id !== options.excludeUserId);
    if (options.mode === 'selected') {
      const wanted = new Set(options.user_ids || []);
      recipients = recipients.filter((person) => wanted.has(person.user_id));
    } else if (options.mode === 'unsigned') {
      const acked = new Set((await PolicyRepository.acknowledgements(policy.id, orgId)).map((row: any) => row.user_id));
      recipients = recipients.filter((person) => !acked.has(person.user_id));
    }
    const link = `/policies/${policy.id}`;
    const message = options.message || `Please read the “${policy.title}” policy${options.read_by ? ` by ${options.read_by}` : ''}.`;
    for (const person of recipients) {
      try {
        await NotificationsController.createNotification(
          person.user_id,
          `Please read — ${policy.title}`,
          message,
          'general',
          link,
        );
      } catch { /* per-recipient notification non-critical */ }
      if (person.staff_profile_id) {
        try {
          await TaskRepository.create(orgId, {
            title: `Read: ${policy.title}`,
            description: options.message || null,
            assigned_to: person.staff_profile_id,
            priority: 'medium',
            status: 'pending',
            due_date: options.read_by || null,
            created_by: options.excludeUserId || null,
            policy_id: policy.id,
          });
        } catch { /* per-recipient task non-critical */ }
      }
      if (person.email) {
        try {
          await EmailService.sendPolicyReadRequestEmail(
            person.email, person.name, { title: policy.title },
            options.senderName, options.read_by || undefined, options.message,
            EmailService.policyUrl(policy.id),
          );
        } catch { /* per-recipient email non-critical */ }
      }
    }
    return recipients.length;
  }

  /**
   * Email a policy link to addresses the manager typed in (5.10 Share policy).
   * The recipients may not have logins — the mail says so — which is why this
   * takes raw addresses rather than user ids.
   */
  static async share(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const { emails, message } = req.body as { emails: string[]; message?: string };
    const senderName = await PolicyController.senderName(orgId, req.user!.userId);
    let sent = 0;
    const failed: string[] = [];
    for (const email of new Set(emails.map((address) => address.trim().toLowerCase()).filter(Boolean))) {
      try {
        await EmailService.sendPolicySharedEmail(
          email, { title: policy.title, category: policy.category },
          senderName, message, EmailService.policyUrl(policy.id),
        );
        sent++;
      } catch {
        failed.push(email);
      }
    }
    AuditRepository.log({ user_id: req.user!.userId, action: 'share', entity_type: 'policy', entity_id: policy.id, new_data: { emails: sent }, ip_address: req.ip }).catch(() => {});
    res.json({ sent, failed });
  }

  /**
   * Ask staff to read a policy (5.10 Ask staff to read): one notification, one
   * task and one email per recipient. Returns the count the toast reports.
   */
  static async readRequests(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const { mode, user_ids, read_by, message } = req.body as { mode: 'all' | 'unsigned' | 'selected'; user_ids?: string[]; read_by?: string | null; message?: string };
    const requested = await PolicyController.askToRead(orgId, policy, {
      mode, user_ids, read_by: read_by || null, message,
      excludeUserId: req.user!.userId,
      senderName: await PolicyController.senderName(orgId, req.user!.userId),
    });
    AuditRepository.log({ user_id: req.user!.userId, action: 'request_reads', entity_type: 'policy', entity_id: policy.id, new_data: { mode, requested }, ip_address: req.ip }).catch(() => {});
    res.status(201).json({ requested });
  }

  /**
   * Nudge the staff who have not signed yet (5.10 "Reminders sent"): a bell
   * notification each, deliberately no new tasks — the original read request
   * already filed those, and a reminder that duplicates work is noise.
   */
  static async remind(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const audience = (await PolicyRepository.readAudience(orgId))
      .filter((person) => person.user_id !== req.user!.userId);
    const acked = new Set((await PolicyRepository.acknowledgements(policy.id, orgId)).map((row: any) => row.user_id));
    const pending = audience.filter((person) => !acked.has(person.user_id));
    for (const person of pending) {
      try {
        await NotificationsController.createNotification(
          person.user_id,
          `Reminder — please read ${policy.title}`,
          `A gentle nudge: please read the “${policy.title}” policy and use Mark as read.`,
          'general',
          `/policies/${policy.id}`,
        );
      } catch { /* per-recipient notification non-critical */ }
    }
    AuditRepository.log({ user_id: req.user!.userId, action: 'remind_reads', entity_type: 'policy', entity_id: policy.id, new_data: { reminded: pending.length }, ip_address: req.ip }).catch(() => {});
    res.status(201).json({ reminded: pending.length });
  }

  static async acknowledgements(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const rows = await PolicyRepository.acknowledgements(req.params.id, orgId);
    const role = req.user!.role;
    if (role === UserRole.ORG_ADMIN || role === UserRole.MANAGER) return res.json(rows);
    return res.json(rows.filter((row: any) => row.user_id === req.user!.userId));
  }
}
