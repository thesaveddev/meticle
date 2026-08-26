import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../../shared/database';
import { CompliancePortalRepository } from './compliance-portal.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

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

    const tokenRecord = await CompliancePortalRepository.createToken({
      organization_id: user.organizationId!,
      location_id,
      officer_name,
      email,
      expires_hours: expires_hours || 72,
      created_by: user.userId,
    });

    // Generate JWT
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
