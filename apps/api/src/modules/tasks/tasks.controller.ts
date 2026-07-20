import { Request, Response } from 'express';
import { TaskRepository } from './tasks.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { AuditRepository } from '../audit/audit.repository';
import pool from '../../shared/database';

export class TaskController {
  static async list(req: Request, res: Response) {
    const tasks = await TaskRepository.findAll(req.user!.organizationId!, req.query as any);
    res.json(tasks);
  }

  static async create(req: Request, res: Response) {
    const user = req.user!;
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

  static async update(req: Request, res: Response) {
    const task = await TaskRepository.update(req.params.id, req.user!.organizationId!, req.body);
    if (!task) throw new AppError(404, 'Task not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'task', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(task);
  }

  static async delete(req: Request, res: Response) {
    const deleted = await TaskRepository.delete(req.params.id, req.user!.organizationId!);
    if (!deleted) throw new AppError(404, 'Task not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'task', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Task deleted' });
  }
}
