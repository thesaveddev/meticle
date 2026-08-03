import { Request, Response } from 'express';
import { MarketplaceRepository } from './marketplace.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { query } from '../../shared/database';

export class MarketplaceController {
  static async getAvailableShifts(req: Request, res: Response) {
    const shifts = await MarketplaceRepository.getAvailableShifts();
    res.json(shifts);
  }

  static async applyForShift(req: Request, res: Response) {
    const { shiftId } = req.params;
    const { staffId, notes } = req.body;
    const orgId = req.user!.organizationId;

    const shift = await MarketplaceRepository.getShiftById(shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');

    // The staff member must belong to the caller's organization — otherwise a
    // cross-org staff_id could be written into this org's shift assignment.
    const staff = await query(
      `SELECT sp.id FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND u.organization_id = $2`,
      [staffId, orgId]
    );
    if (staff.rows.length === 0) throw new AppError(400, 'Staff member not found in your organization');

    const application = await MarketplaceRepository.applyForShift(shiftId, staffId, notes);
    res.status(201).json(application);
  }

  static async publishShift(req: Request, res: Response) {
    const { shiftId } = req.params;
    const shift = await MarketplaceRepository.publishShift(shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');
    res.json(shift);
  }
}
