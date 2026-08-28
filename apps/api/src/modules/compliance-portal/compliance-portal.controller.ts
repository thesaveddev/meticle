import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../../shared/database';
import { CompliancePortalRepository } from './compliance-portal.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
import { EmailService } from '../../shared/utils/email.service';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret + '_portal';
};

export class CompliancePortalController {
  // === Admin: Create Portal Access ===
  static async createPortalAccess(req: Request, res: Response) {
    const user = req.user!;
    const { location_id, officer_name, email, expires_hours } = req.body;

    if (!location_id || !officer_name || !email) {
      throw new AppError(400, 'location_id, officer_name, and email are required');
    }

    // Verify location belongs to org
    const locResult = await query(
      `SELECT id, name FROM locations WHERE id = $1 AND organization_id = $2`,
      [location_id, user.organizationId]
    );
    if (locResult.rows.length === 0) throw new AppError(404, 'Location not found');

    // Create token record first (without JWT)
    const tokenRecord = await CompliancePortalRepository.createToken({
      organization_id: user.organizationId!,
      location_id,
      officer_name,
      email,
      expires_hours: expires_hours || 72,
      created_by: user.userId,
    });

    // Generate JWT using the record ID
    const jwtPayload = {
      portalId: tokenRecord.id,
      officer_name,
      email,
      orgId: user.organizationId,
      locationId: location_id,
      locationName: locResult.rows[0].name,
      expiresAt: tokenRecord.expires_at,
      isPortal: true as const,
    };
    const token = jwt.sign(jwtPayload, getJwtSecret(), {
      expiresIn: `${expires_hours || 72}h`,
    });

    // Store the JWT in the record for later retrieval
    await query(`UPDATE compliance_portal_tokens SET jwt_token = $1 WHERE id = $2`, [token, tokenRecord.id]);

    // Build portal URL
    const baseUrl = process.env.PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const portalUrl = `${baseUrl}/portal/login?token=${token}`;

    AuditRepository.log({
      user_id: user.userId,
      action: 'create_portal_access',
      entity_type: 'compliance_portal_token',
      entity_id: tokenRecord.id,
      new_data: { officer_name, email, location_id, expires_hours },
      ip_address: req.ip,
    }).catch(() => {});

    // Send portal access email to the compliance officer
    const emailLocationName = locResult.rows[0].name;
    const emailOrgResult = await query('SELECT name FROM organizations WHERE id = $1', [user.organizationId]);
    const emailOrgName = emailOrgResult.rows[0]?.name || 'your organization';
    const emailBody = `<p>Hi ${officer_name},</p>` +
      `<p>You have been granted read-only access to the compliance portal for <strong>${emailLocationName}</strong> at <strong>${emailOrgName}</strong>.</p>` +
      `<p>This access allows you to review:</p>` +
      `<ul><li>Staff compliance records and training status</li>` +
      `<li>Open incidents and their resolution status</li>` +
      `<li>Nutrition and dietary information for all residents</li>` +
      `<li>Medication administration records (MAR)</li>` +
      `<li>Active policies and care plans</li></ul>` +
      `<p>This link expires in <strong>${expires_hours || 72} hours</strong> and is unique to you. Do not share it.</p>` +
      `<p><a href="${portalUrl}" style="display:inline-block;padding:10px 20px;background-color:#0F4C81;color:#ffffff;text-decoration:none;border-radius:4px;">Access Compliance Portal</a></p>`;
    EmailService.sendEmail(email, `${emailOrgName} — Compliance Audit Access for ${emailLocationName}`, emailBody).catch(() => {});

    res.status(201).json({
      token,
      portalUrl,
      expiresAt: tokenRecord.expires_at,
      officerName: officer_name,
      locationName: locResult.rows[0].name,
    });
  }

  // === Admin: List Portal Access ===
  static async listPortalAccess(req: Request, res: Response) {
    const tokens = await CompliancePortalRepository.listTokens(req.user!.organizationId!);
    res.json(tokens);
  }

  // === Admin: Revoke Portal Access ===
  static async revokePortalAccess(req: Request, res: Response) {
    const revoked = await CompliancePortalRepository.revokeToken(
      req.params.id, req.user!.organizationId!
    );
    if (!revoked) throw new AppError(404, 'Portal token not found');
    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'revoke_portal_access',
      entity_type: 'compliance_portal_token',
      entity_id: req.params.id,
      ip_address: req.ip,
    }).catch(() => {});
    // Notify the compliance officer that access has been revoked
    const locResult = await query('SELECT name FROM locations WHERE id = $1', [revoked.location_id]);
    const locName = locResult.rows[0]?.name || 'the location';
    const orgInfo = await query('SELECT name FROM organizations WHERE id = $1', [revoked.organization_id]);
    const orgN = orgInfo.rows[0]?.name || 'your organization';
    EmailService.sendEmail(
      revoked.email,
      `${orgN} — Compliance Portal Access Revoked`,
      `<p>Hi ${revoked.officer_name},</p>
       <p>Your access to the compliance portal for <strong>${locName}</strong> at <strong>${orgN}</strong> has been revoked by the organization administrator.</p>
       <p>If you believe this was done in error, please contact the organization directly.</p>`
    ).catch(() => {});
    res.json({ message: 'Portal access revoked' });
  }

  // === Portal: Verify Token ===
  static async verifyToken(req: Request, res: Response) {
    const user = req.portalUser!;
    res.json({
      valid: true,
      officerName: user.officerName,
      locationName: user.locationName,
      expiresAt: user.expiresAt,
    });
  }

  // === Portal: Dashboard ===
  static async getDashboard(req: Request, res: Response) {
    const user = req.portalUser!;
    const overview = await CompliancePortalRepository.getComplianceOverview(
      user.orgId, user.locationId
    );
    res.json(overview);
  }

  // === Portal: Person Detail ===
  static async getPersonDetail(req: Request, res: Response) {
    const user = req.portalUser!;
    const detail = await CompliancePortalRepository.getPersonDetail(
      user.orgId, user.locationId, req.params.personId
    );
    if (!detail) throw new AppError(404, 'Person not found at this location');
    res.json(detail);
  }

  // === Portal: Medication Detail ===
  static async getMedicationDetail(req: Request, res: Response) {
    const user = req.portalUser!;
    const detail = await CompliancePortalRepository.getMedicationDetail(
      user.orgId, user.locationId, req.params.personId
    );
    res.json(detail);
  }
}
