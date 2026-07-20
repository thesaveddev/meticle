import { Request, Response } from 'express';
import { MarketplaceRepository } from './marketplace.repository';
import { AppError } from '../../shared/middleware/error.middleware';

export class MarketplaceController {
  static async getAvailableShifts(req: Request, res: Response) {
    const shifts = await MarketplaceRepository.getAvailableShifts();
    res.json(shifts);
  }

  static async applyForShift(req: Request, res: Response) {
    const { shiftId } = req.params;
    const { staffId, notes } = req.body;

    const shift = await MarketplaceRepository.getShiftById(shiftId);
    if (!shift) throw new AppError(404, 'Shift not found');

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
