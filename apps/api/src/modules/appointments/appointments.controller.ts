import { Request, Response } from 'express';
import { AppointmentRepository } from './appointments.repository';
import { AppError } from '../../shared/middleware/error.middleware';

export class AppointmentController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static async list(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    const { date } = req.query as any;
    const appointments = await AppointmentRepository.findAll(orgId, date);
    res.json(appointments);
  }

  static async getById(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    const appointment = await AppointmentRepository.findById(req.params.id, orgId);
    if (!appointment) throw new AppError(404, 'Appointment not found');
    res.json(appointment);
  }

  static async create(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    const appointment = await AppointmentRepository.create({
      ...req.body,
      status: req.body.status === 'no-show' ? 'no_show' : req.body.status,
      organization_id: orgId,
      created_by: req.user!.userId,
    });
    res.status(201).json(appointment);
  }

  static async update(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    const appointment = await AppointmentRepository.update(req.params.id, {
      ...req.body,
      ...(req.body.status ? { status: req.body.status === 'no-show' ? 'no_show' : req.body.status } : {}),
    }, orgId);
    if (!appointment) throw new AppError(404, 'Appointment not found');
    res.json(appointment);
  }

  static async delete(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    await AppointmentRepository.delete(req.params.id, orgId);
    res.json({ message: 'Appointment deleted' });
  }

  static async getTodayStats(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    const stats = await AppointmentRepository.getTodayStats(orgId);
    res.json(stats);
  }
}
