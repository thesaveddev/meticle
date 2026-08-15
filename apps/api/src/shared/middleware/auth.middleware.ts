import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@meticle/shared';
import { isTokenBlacklisted } from './tokenBlacklist';
import { query, requestDBStorage } from '../database';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
};

/**
 * Set RLS session variables on a pg client (typically the request-scoped client
 * from ALS). Must be called after the JWT is decoded and before any
 * tenant-scoped queries. Also used by the event outbox worker to run background
 * consumers with an org context.
 */
export async function setRlsSessionVars(
  client: { query: (text: string, params?: any[]) => Promise<any> },
  decoded: AuthUser
) {
  const promises: Promise<any>[] = [];
  if (decoded.organizationId) {
    promises.push(
      client.query(`SELECT set_config('app.current_org_id', $1, false)`, [decoded.organizationId])
    );
  }
  promises.push(
    client.query(`SELECT set_config('app.current_user_id', $1, false)`, [decoded.userId])
  );
  promises.push(
    client.query(`SELECT set_config('app.current_user_role', $1, false)`, [decoded.role])
  );
  await Promise.all(promises);
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ statusCode: 401, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ statusCode: 401, message: 'Token has been revoked. Please log in again.' });
    }
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;

    // Set RLS session variables on the request-scoped client so that all
    // subsequent queries in this request are scoped to the user's org.
    const ctx = requestDBStorage.getStore();
    if (ctx) {
      await setRlsSessionVars(ctx.client, decoded);
    }

    // Verify user still exists, is active, and role hasn't changed
    const result = await query(
      'SELECT id, status, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ statusCode: 401, message: 'User no longer exists' });
    }
    const user = result.rows[0];
    if (user.status === 'deactivated') {
      return res.status(403).json({ statusCode: 403, message: 'Your account has been deactivated' });
    }
    if (user.role !== decoded.role) {
      return res.status(401).json({ statusCode: 401, message: 'Your permissions have changed. Please log in again.' });
    }

    // Subscription enforcement — exempt auth, billing, mfa, health, onboarding, learning, and platform admin
    const subExemptPaths = ['/auth', '/billing', '/mfa', '/health', '/onboarding', '/platform-admin', '/learn'];
    const isExempt = subExemptPaths.some(p => req.originalUrl.startsWith(p));
    if (!isExempt && decoded.organizationId) {
      const orgResult = await query(
        `SELECT subscription_status, trial_ends_at FROM organizations WHERE id = $1`,
        [decoded.organizationId]
      );
      if (orgResult.rows.length > 0) {
        const org = orgResult.rows[0];
        const status = org.subscription_status;
        const trialEnded = org.trial_ends_at && new Date(org.trial_ends_at) < new Date();
        let blocked = false;
        if (status === 'active' || status === 'past_due') {
          // past_due is a grace period — Stripe is retrying; keep access so teams aren't hard-locked
          blocked = false;
        } else if (status === 'trial' || !status) {
          blocked = !!trialEnded;
        } else {
          blocked = true;
        }
        if (blocked) {
          return res.status(403).json({ statusCode: 403, message: 'Your subscription is no longer active. Please update your billing information.', redirect: '/billing' });
        }
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ statusCode: 401, message: 'Invalid token' });
  }
};
