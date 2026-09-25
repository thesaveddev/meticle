import { Request, Response } from 'express';
import { TaskRepository } from './tasks.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { AuditRepository } from '../audit/audit.repository';
import pool from '../../shared/database';
import { UserRole } from '@meticle/shared';

async function assertTaskReferencesInOrg(orgId: string, data: any) {
  if (data.assigned_to) {
    const staff = await pool.query(
      `SELECT 1 FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND u.organization_id = $2 AND u.status = 'active'`,
      [data.assigned_to, orgId]
    );
    if (!staff.rows.length) throw new AppError(400, 'Assigned staff member not found in your organisation');
  }
  if (data.person_id) {
    const person = await pool.query('SELECT 1 FROM people WHERE id = $1 AND organization_id = $2', [data.person_id, orgId]);
    if (!person.rows.length) throw new AppError(400, 'Person not found in your organisation');
  }
}

export class TaskController {
  static async list(req: Request, res: Response) {
    const tasks = await TaskRepository.findAll(req.user!.organizationId!, req.query as any);
    res.json(tasks);
  }

  static async getById(req: Request, res: Response) {
    const task = await TaskRepository.findById(req.params.id, req.user!.organizationId!);
    if (!task) throw new AppError(404, 'Task not found');
    res.json(task);
  }

  static async create(req: Request, res: Response) {
    const user = req.user!;
    await assertTaskReferencesInOrg(user.organizationId!, req.body);
    const task = await TaskRepository.create(user.organizationId!, { ...req.body, created_by: user.userId });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'task', entity_id: task.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    if (task.assigned_to) {
      try {
        const staffRes = await pool.query('SELECT user_id FROM staff_profiles WHERE id = $1', [task.assigned_to]);
        if (staffRes.rows[0]?.user_id) {
          NotificationsController.createNotification(staffRes.rows[0].user_id, 'New Task Assigned', `You have been assigned: "${task.title}" (${task.priority})`, 'general').catch(() => {});
        }
      } catch { /* notification non-critical */ }
    }
    res.status(201).json(task);
  }

  /**
   * Fields a support worker may change on a task. They can move it through its
   * states and record what happened, but they cannot retitle it, reassign it,
   * re-prioritise it or move its due date — those are allocation decisions.
   */
  private static readonly COMPLETER_FIELDS = ['status', 'notes'] as const;

  static sanitiseForCompleter(body: any): any {
    const permitted: Record<string, unknown> = {};
    for (const field of TaskController.COMPLETER_FIELDS) {
      if (body?.[field] !== undefined) permitted[field] = body[field];
    }
    return permitted;
  }

  static async update(req: Request, res: Response) {
    const user = req.user!;
    const isCompleter = user.role === UserRole.CARE_WORKER;
    const body = isCompleter ? TaskController.sanitiseForCompleter(req.body) : req.body;
    if (isCompleter && Object.keys(body).length === 0) {
      throw new AppError(403, 'You can only change a task status or add a note');
    }
    await assertTaskReferencesInOrg(user.organizationId!, body);
    const task = await TaskRepository.update(req.params.id, user.organizationId!, body);
    if (!task) throw new AppError(404, 'Task not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'task', entity_id: req.params.id, new_data: body, ip_address: req.ip }).catch(() => {});
    res.json(task);
  }

  static async delete(req: Request, res: Response) {
    const deleted = await TaskRepository.delete(req.params.id, req.user!.organizationId!);
    if (!deleted) throw new AppError(404, 'Task not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'task', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Task deleted' });
  }
}
