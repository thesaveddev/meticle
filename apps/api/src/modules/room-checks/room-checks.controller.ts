import { Request, Response } from 'express';
import { RoomCheckRepository } from './room-checks.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
import pool from '../../shared/database';
import { UserRole } from '@meticle/shared';

export class RoomCheckController {
  /**
   * room_checks.checked_by points at staff_profiles, not users, so the
   * performer has to be resolved from the signed-in user. Without it a safety
   * check is unowned, which is not usable as inspection evidence.
   */
  private static async staffProfileId(userId: string): Promise<string | null> {
    const result = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
    return result.rows[0]?.id || null;
  }

  static async list(req: Request, res: Response) {
    const checks = await RoomCheckRepository.findAll(req.user!.organizationId!, req.query as any);
    res.json(checks);
  }

  static async create(req: Request, res: Response) {
    const user = req.user!;
    const photo_url = req.file ? '/files/private/' + req.file.filename : undefined;
    // Always attribute the check to the signed-in user rather than trusting a
    // supplied checked_by, so a check cannot be recorded in someone else's name.
    const checked_by = await RoomCheckController.staffProfileId(user.userId);
    const check = await RoomCheckRepository.create(user.organizationId!, { ...req.body, checked_by, photo_url });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'room_check', entity_id: check.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(check);
  }

  static async update(req: Request, res: Response) {
    const user = req.user!;
    // Editing someone else's safety record would falsify the evidence trail, so
    // a support worker may only amend the check they performed themselves.
    if (user.role === UserRole.CARE_WORKER) {
      const existing = await RoomCheckRepository.findById(req.params.id, user.organizationId!);
      if (!existing) throw new AppError(404, 'Room check not found');
      const mine = await RoomCheckController.staffProfileId(user.userId);
      if (!mine || existing.checked_by !== mine) {
        throw new AppError(403, 'You can only change a room check you recorded');
      }
    }
    const check = await RoomCheckRepository.update(req.params.id, user.organizationId!, req.body);
    if (!check) throw new AppError(404, 'Room check not found');
    AuditRepository.log({ user_id: user.userId, action: 'update', entity_type: 'room_check', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json(check);
  }

  static async delete(req: Request, res: Response) {
    const deleted = await RoomCheckRepository.delete(req.params.id, req.user!.organizationId!);
    if (!deleted) throw new AppError(404, 'Room check not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'room_check', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Room check deleted' });
  }
}
