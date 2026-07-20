import { Request, Response } from 'express';
import { RoomCheckRepository } from './room-checks.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

export class RoomCheckController {
  static async list(req: Request, res: Response) {
    const checks = await RoomCheckRepository.findAll(req.user!.organizationId!, req.query as any);
    res.json(checks);
  }

  static async create(req: Request, res: Response) {
    const user = req.user!;
    const photo_url = req.file ? '/files/private/' + req.file.filename : undefined;
    const check = await RoomCheckRepository.create(user.organizationId!, { ...req.body, photo_url });
    AuditRepository.log({ user_id: user.userId, action: 'create', entity_type: 'room_check', entity_id: check.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(check);
  }

  static async update(req: Request, res: Response) {
    const check = await RoomCheckRepository.update(req.params.id, req.user!.organizationId!, req.body);
    if (!check) throw new AppError(404, 'Room check not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'room_check', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json(check);
  }

  static async delete(req: Request, res: Response) {
    const deleted = await RoomCheckRepository.delete(req.params.id, req.user!.organizationId!);
    if (!deleted) throw new AppError(404, 'Room check not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'room_check', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Room check deleted' });
  }
}
