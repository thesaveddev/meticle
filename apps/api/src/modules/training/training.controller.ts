import { Request, Response } from 'express';
import { TrainingRepository } from './training.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { requireSameOrgForStaff } from '../../shared/database/tenant';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import pool from '../../shared/database';

export class TrainingController {
  static async getModules(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const modules = await TrainingRepository.getModules(orgId!);
    res.json(modules);
  }

  static async createModule(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const { name, category, description, frequency_days, is_mandatory, requires_competency, cqc_mandated, cqc_mandated_for_roles } = req.body;
    if (!name?.trim()) throw new AppError(400, 'Module name is required');
    const module = await TrainingRepository.createModule({
      organization_id: orgId!, name, category, description,
      frequency_days, is_mandatory, requires_competency, cqc_mandated, cqc_mandated_for_roles
    });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'training_module', entity_id: module.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.status(201).json(module);
  }

  static async updateModule(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const module = await TrainingRepository.updateModule(req.params.id, orgId!, req.body);
    if (!module) throw new AppError(404, 'Module not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'training_module', entity_id: req.params.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    res.json(module);
  }

  static async deleteModule(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const deleted = await TrainingRepository.deleteModule(req.params.id, orgId!);
    if (!deleted) throw new AppError(404, 'Module not found');
    AuditRepository.log({ user_id: user.userId, action: 'delete', entity_type: 'training_module', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Module deleted' });
  }

  static async getRecords(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { moduleId, staffId } = req.query as any;
    const records = await TrainingRepository.getRecords(orgId!, moduleId, staffId);
    res.json(records);
  }

  static async upsertRecord(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const { module_id, staff_id, completed_at, expires_at, status, competency_passed, trainer_name, digital_signature, notes, file_url } = req.body;
    if (!module_id || !staff_id) throw new AppError(400, 'module_id and staff_id are required');
    await requireSameOrgForStaff(user, staff_id);
    const moduleCheck = await pool.query('SELECT 1 FROM training_modules WHERE id = $1 AND organization_id = $2', [module_id, orgId]);
    if (moduleCheck.rows.length === 0) throw new AppError(404, 'Training module not found');
    const record = await TrainingRepository.upsertRecord({
      module_id, staff_id, completed_at, expires_at, status,
      competency_passed, trainer_name, digital_signature, notes, file_url
    });
    AuditRepository.log({ user_id: user.userId, action: status === 'completed' ? 'complete' : 'upsert', entity_type: 'training_record', entity_id: record.id, new_data: req.body, ip_address: req.ip }).catch(() => {});
    // Notify manager when staff completes mandatory training
    if (record.status === 'completed') {
      try {
        const mod = await pool.query('SELECT name, is_mandatory FROM training_modules WHERE id = $1', [module_id]);
        if (mod.rows[0]?.is_mandatory) {
          const locResult = await pool.query(
            `SELECT l.manager_id FROM locations l WHERE l.id = (SELECT location_id FROM staff_profiles WHERE id = $1)`,
            [staff_id]
          );
          if (locResult.rows[0]?.manager_id) {
            const staff = await pool.query('SELECT first_name, last_name FROM staff_profiles WHERE id = $1', [staff_id]);
            const staffName = `${staff.rows[0]?.first_name || ''} ${staff.rows[0]?.last_name || ''}`.trim();
            NotificationsController.createNotification(
              locResult.rows[0].manager_id, 'Training Completed',
              `${staffName} completed "${mod.rows[0].name}" training.`,
              'training'
            ).catch(() => {});
          }
        }
      } catch { /* notification non-critical */ }
    }
    res.status(201).json(record);
  }

  static async deleteRecord(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const deleted = await TrainingRepository.deleteRecord(req.params.id, orgId!);
    if (!deleted) throw new AppError(404, 'Record not found');
    AuditRepository.log({ user_id: user.userId, action: 'delete', entity_type: 'training_record', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Record deleted' });
  }

  static async getMatrix(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const data = await TrainingRepository.getMatrix(orgId!);
    res.json(data);
  }

  static async getExpiring(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const days = parseInt(req.query.days as string) || 30;
    const records = await TrainingRepository.getExpiring(orgId!, days);
    res.json(records);
  }

  static async getDashboard(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const dashboard = await TrainingRepository.getTrainingDashboard(orgId!);
    res.json(dashboard);
  }

  static async autoAssign(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const count = await TrainingRepository.autoAssignByRole(orgId!);
    AuditRepository.log({ user_id: req.user!.userId, action: 'auto_assign', entity_type: 'training_record', entity_id: orgId!, new_data: { count }, ip_address: req.ip }).catch(() => {});
    res.json({ message: `Auto-assigned ${count} training records`, count });
  }

  static async bulkAssign(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;
    const { staffId, moduleIds } = req.body;
    if (!staffId || !moduleIds?.length) throw new AppError(400, 'staffId and moduleIds are required');
    await requireSameOrgForStaff(user, staffId);
    const moduleCheck = await pool.query('SELECT COUNT(*)::int as count FROM training_modules WHERE id = ANY($1) AND organization_id = $2', [moduleIds, orgId]);
    if (moduleCheck.rows[0].count !== moduleIds.length) throw new AppError(404, 'One or more training modules not found');
    const results = await TrainingRepository.bulkAssign(orgId!, staffId, moduleIds);
    AuditRepository.log({ user_id: user.userId, action: 'bulk_assign', entity_type: 'training_record', entity_id: staffId, new_data: { staffId, moduleIds, count: results?.length }, ip_address: req.ip }).catch(() => {});
    res.status(201).json(results);
  }
}
