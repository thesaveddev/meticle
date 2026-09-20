import { Request, Response } from 'express';
import { AppointmentRepository } from './appointments.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { query } from '../../shared/database';

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

  private static async assertReferencesInOrg(orgId: string, data: any) {
    if (data.person_id) {
      const person = await query('SELECT 1 FROM people WHERE id = $1 AND organization_id = $2', [data.person_id, orgId]);
      if (!person.rows.length) throw new AppError(400, 'Person not found in your organisation');
    }
    if (data.staff_id) {
      const staff = await query(
        `SELECT 1 FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
         WHERE sp.id = $1 AND u.organization_id = $2 AND u.status = 'active'`,
        [data.staff_id, orgId]
      );
      if (!staff.rows.length) throw new AppError(400, 'Staff member not found in your organisation');
    }
    if (data.location_id) {
      const location = await query('SELECT 1 FROM locations WHERE id = $1 AND organization_id = $2', [data.location_id, orgId]);
      if (!location.rows.length) throw new AppError(400, 'Location not found in your organisation');
    }
  }

  static async create(req: Request, res: Response) {
    const orgId = AppointmentController.getOrgId(req);
    await AppointmentController.assertReferencesInOrg(orgId, req.body);
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
    await AppointmentController.assertReferencesInOrg(orgId, req.body);
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
