import { Request, Response } from 'express';
import { FamilyPortalRepository as Repo } from './familyPortal.repository';
import { EmailService } from '../../shared/utils/email.service';
import { AppError } from '../../shared/middleware/error.middleware';

const getOrgId = (req: Request) => (req as any).user?.organization_id || (req as any).user?.organizationId;
const getUserId = (req: Request) => (req as any).user?.id;

export class FamilyPortalController {
  // ── Authenticated: Manage family members ──
  static async listMembers(req: Request, res: Response) {
    const { service_user_id } = req.query;
    if (!service_user_id) throw new AppError(400, 'service_user_id is required');
    const members = await Repo.listMembers(service_user_id as string, getOrgId(req));
    res.json(members);
  }

  static async createMember(req: Request, res: Response) {
    const orgId = getOrgId(req);
    const data = { ...req.body, organization_id: orgId, created_by: getUserId(req) };
    const member = await Repo.createMember(data);

    const suResult = await Repo.getMemberWithServiceUser(member.access_token);
    if (suResult) {
      EmailService.sendFamilyPortalInviteEmail(
        member.email, member.name, suResult.su_first_name + ' ' + suResult.su_last_name,
        member.access_token, suResult.org_name
      ).catch(() => {});
    }

    res.status(201).json(member);
  }

  static async updateMember(req: Request, res: Response) {
    const member = await Repo.updateMember(req.params.id, getOrgId(req), req.body);
    if (!member) throw new AppError(404, 'Family member not found');
    res.json(member);
  }

  static async revokeMember(req: Request, res: Response) {
    const member = await Repo.revokeMember(req.params.id, getOrgId(req));
    if (!member) throw new AppError(404, 'Family member not found');
    res.json(member);
  }

  static async resendInvite(req: Request, res: Response) {
    const member = await Repo.resendInvite(req.params.id, getOrgId(req));
    if (!member) throw new AppError(404, 'Family member not found');

    const suResult = await Repo.getMemberWithServiceUser(member.access_token);
    if (suResult) {
      EmailService.sendFamilyPortalInviteEmail(
        member.email, member.name, suResult.su_first_name + ' ' + suResult.su_last_name,
        member.access_token, suResult.org_name
      ).catch(() => {});
    }

    res.json(member);
  }

  static async refreshToken(req: Request, res: Response) {
    const member = await Repo.refreshToken(req.params.id, getOrgId(req));
    if (!member) throw new AppError(404, 'Family member not found');
    res.json(member);
  }

  static async deleteMember(req: Request, res: Response) {
    await Repo.deleteMember(req.params.id, getOrgId(req));
    res.json({ message: 'Family member removed' });
  }

  // ── Public: Token-based portal access ──
  static async portalGetInfo(req: Request, res: Response) {
    const member = await Repo.validateToken(req.params.token);
    if (!member) throw new AppError(404, 'Invalid or expired portal link');
    await Repo.recordAccess(member.id);
    res.json({
      family_member_name: member.name,
      relationship: member.relationship,
      service_user: {
        id: member.service_user_id,
        first_name: member.su_first_name,
        last_name: member.su_last_name,
        photo_url: member.photo_url,
        date_of_birth: member.date_of_birth,
      },
      organization: { name: member.org_name },
    });
  }

  static async portalGetCareNotes(req: Request, res: Response) {
    const member = await Repo.validateToken(req.params.token);
    if (!member) throw new AppError(404, 'Invalid or expired portal link');
    const notes = await Repo.getCareNotes(member.service_user_id);
    res.json(notes);
  }

  static async portalGetCarePlans(req: Request, res: Response) {
    const member = await Repo.validateToken(req.params.token);
    if (!member) throw new AppError(404, 'Invalid or expired portal link');
    const plans = await Repo.getCarePlans(member.service_user_id);
    res.json(plans);
  }

  static async portalGetGoals(req: Request, res: Response) {
    const member = await Repo.validateToken(req.params.token);
    if (!member) throw new AppError(404, 'Invalid or expired portal link');
    const goals = await Repo.getGoals(member.service_user_id);
    res.json(goals);
  }

  static async portalGetObservations(req: Request, res: Response) {
    const member = await Repo.validateToken(req.params.token);
    if (!member) throw new AppError(404, 'Invalid or expired portal link');
    const observations = await Repo.getRecentObservations(member.service_user_id);
    res.json(observations);
  }
}
