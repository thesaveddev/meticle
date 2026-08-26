import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, requestDBStorage } from '../../shared/database';

export interface PortalUser {
  portalId: string;
  officerName: string;
  email: string;
  orgId: string;
  locationId: string;
  locationName: string;
  expiresAt: string;
  isPortal: true;
}

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalUser;
    }
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
};

export const authenticatePortal = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ statusCode: 401, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret() + '_portal') as PortalUser;

    // Verify token hasn't expired server-side
    if (new Date(decoded.expiresAt) < new Date()) {
      return res.status(401).json({ statusCode: 401, message: 'Portal access has expired. Please request a new link.' });
    }

    // Verify token still exists in DB and hasn't been revoked
    const result = await query(
      `SELECT id, expires_at, revoked FROM compliance_portal_tokens
       WHERE id = $1 AND organization_id = $2`, [decoded.portalId, decoded.orgId]
    );
    if (result.rows.length === 0 || result.rows[0].revoked) {
      return res.status(401).json({ statusCode: 401, message: 'Portal access has been revoked.' });
    }
    if (new Date(result.rows[0].expires_at) < new Date()) {
      return res.status(401).json({ statusCode: 401, message: 'Portal access has expired.' });
    }

    // Log access
    await query(
      `UPDATE compliance_portal_tokens SET accessed_at = NOW() WHERE id = $1`, [decoded.portalId]
    ).catch(() => {});

    // Set RLS for the org
    const ctx = requestDBStorage.getStore();
    if (ctx) {
      await ctx.client.query(`SELECT set_config('app.current_org_id', $1, false)`, [decoded.orgId]);
      await ctx.client.query(`SELECT set_config('app.current_user_id', $1, false)`, [decoded.portalId]);
      await ctx.client.query(`SELECT set_config('app.current_user_role', $1, false)`, ['COMPLIANCE_OFFICER']);
    }

    req.portalUser = decoded;
    next();
  } catch {
    return res.status(401).json({ statusCode: 401, message: 'Invalid portal token' });
  }
};

/**
 * Middleware that restricts a portal user to a specific location.
 * Reads locationId from the token and injects a WHERE clause helper.
 */
export const restrictToLocation = (req: Request, _res: Response, next: NextFunction) => {
  if (req.portalUser) {
    (req as any).locationFilter = req.portalUser.locationId;
  }
  next();
};
