import { Request, Response } from 'express';
import { MarketplaceRepository } from './marketplace.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { query } from '../../shared/database';

export class MarketplaceController {
  static async getAvailableShifts(req: Request, res: Response) {
    const shifts = await MarketplaceRepository.getAvailableShifts(req.user!.organizationId!);
    res.json(shifts);
  }

  /** The caller's own `staff_profiles` row, or null when they have none yet. */
  private static async ownStaffProfileId(userId: string, orgId: string): Promise<string | null> {
    const result = await query(
      `SELECT sp.id FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.user_id = $1 AND u.organization_id = $2 AND u.status = 'active'`,
      [userId, orgId]
    );
    return result.rows[0]?.id ?? null;
  }

  static async applyForShift(req: Request, res: Response) {
    const { shiftId } = req.params;
    const { staffId: requestedStaffId, notes } = req.body;
    const orgId = req.user!.organizationId;

    const shift = await MarketplaceRepository.getShiftById(shiftId, orgId!);
    if (!shift) throw new AppError(404, 'Shift not found');

    // Who is applying. A care worker applies as themselves, and the client does
    // not get to name the staff id: the web page used to post a placeholder,
    // which the uuid validator rejected on every click, so the only action on
    // the page was a guaranteed 400. The caller's own profile is something the
    // server can look up and the browser cannot be trusted to know.
    const selfId = await MarketplaceController.ownStaffProfileId(req.user!.userId, orgId!);
    const staffId = requestedStaffId ?? selfId;
    if (!staffId) {
      throw new AppError(
        400,
        'Your account has no staff profile yet. An administrator needs to add one before you can apply for shifts.'
      );
    }

    // The staff member must belong to the caller's organization — otherwise a
    // cross-org staff_id could be written into this org's shift assignment.
    const staff = await query(
      `SELECT sp.id, sp.user_id FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1 AND u.organization_id = $2 AND u.status = 'active'`,
      [staffId, orgId]
    );
    if (staff.rows.length === 0) throw new AppError(400, 'Staff member not found in your organisation');
    if (req.user!.role === 'CARE_WORKER' && staff.rows[0].user_id !== req.user!.userId) {
      throw new AppError(403, 'Care workers can only apply for shifts on their own behalf');
    }

    const application = await MarketplaceRepository.applyForShift(shiftId, staffId, notes);
    res.status(201).json(application);
  }

  static async publishShift(req: Request, res: Response) {
    const { shiftId } = req.params;
    const shift = await MarketplaceRepository.publishShift(shiftId, req.user!.organizationId!);
    if (!shift) throw new AppError(404, 'Shift not found');
    res.json(shift);
  }
}
