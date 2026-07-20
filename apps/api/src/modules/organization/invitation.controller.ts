import { Request, Response } from 'express';
import pool from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import { randomUUID } from 'crypto';
import { AppError } from '../../shared/middleware/error.middleware';

export class InvitationController {
  static async invite(req: Request, res: Response) {
    const { email, role, location_id } = req.body;
    const organizationId = req.user!.organizationId;

    if (!organizationId) {
      throw new AppError(403, 'Only organization admins can invite staff.');
    }

    // Check for existing pending invitation
    const existing = await pool.query(
      'SELECT id FROM invitations WHERE organization_id = $1 AND email = $2 AND status = $3',
      [organizationId, email, 'pending']
    );
    if (existing.rows.length > 0) {
      throw new AppError(400, 'An invitation has already been sent to this email.');
    }

    // Check if user is already a member of this org
    const member = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
      [email, organizationId]
    );
    if (member.rows.length > 0) {
      throw new AppError(400, 'This user is already a member of your organization.');
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO invitations (organization_id, email, role, location_id, token, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [organizationId, email, role, location_id || null, token, expiresAt]
    );

    const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [organizationId]);
    const orgName = orgResult.rows[0]?.name || 'CareDesk Organization';

    await EmailService.sendInviteEmail(email, orgName, token);

    res.status(201).json({ message: 'Invitation sent successfully' });
  }

  static async getInvitations(req: Request, res: Response) {
    const organizationId = req.user!.organizationId;
    const result = await pool.query(
      'SELECT id, email, role, status, created_at FROM invitations WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    res.json(result.rows);
  }

  static async validate(req: Request, res: Response) {
    const { token } = req.query;

    if (!token) {
      throw new AppError(400, 'Token is required');
    }

    const result = await pool.query(
      'SELECT i.id, i.email, i.role, i.organization_id, o.name as organization_name FROM invitations i JOIN organizations o ON o.id = i.organization_id WHERE i.token = $1 AND i.status = $2 AND i.expires_at > NOW()',
      [token, 'pending']
    );

    if (result.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired invitation');
    }

    const invitation = result.rows[0];
    res.json({
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization_name,
    });
  }

  static async accept(req: Request, res: Response) {
    const { token } = req.body;

    if (!token) {
      throw new AppError(400, 'Token is required');
    }

    const result = await pool.query(
      'SELECT * FROM invitations WHERE token = $1 AND status = $2 AND expires_at > NOW()',
      [token, 'pending']
    );

    if (result.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired invitation');
    }

    const invitation = result.rows[0];
    await pool.query(
      'UPDATE invitations SET status = $1 WHERE id = $2',
      ['accepted', invitation.id]
    );

    res.json({ message: 'Invitation accepted' });
  }

  static async cancel(req: Request, res: Response) {
    const { id } = req.params;
    const organizationId = req.user!.organizationId;

    const result = await pool.query('SELECT * FROM invitations WHERE id = $1 AND organization_id = $2', [id, organizationId]);
    if (result.rows.length === 0) throw new AppError(404, 'Invitation not found');

    await pool.query('UPDATE invitations SET status = $1 WHERE id = $2', ['cancelled', id]);
    res.json({ message: 'Invitation cancelled' });
  }

  static async resend(req: Request, res: Response) {
    const { id } = req.params;
    const organizationId = req.user!.organizationId;

    const result = await pool.query(
      'SELECT * FROM invitations WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Invitation not found');
    }

    const invitation = result.rows[0];
    const newToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE invitations SET token = $1, expires_at = $2 WHERE id = $3',
      [newToken, expiresAt, id]
    );

    const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [organizationId]);
    const orgName = orgResult.rows[0]?.name || 'CareDesk Organization';

    await EmailService.sendInviteEmail(invitation.email, orgName, newToken);

    res.json({ message: 'Reminder sent' });
  }
}
