import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@caredesk/shared';
import { isTokenBlacklisted } from './tokenBlacklist';
import { query } from '../database';

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

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
    }
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;

    // Verify user still exists, is active, and role hasn't changed
    const result = await query(
      'SELECT id, status, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    const user = result.rows[0];
    if (user.status === 'deactivated') {
      return res.status(403).json({ message: 'Your account has been deactivated' });
    }
    if (user.role !== decoded.role) {
      // Role changed — issue new token by requiring re-login
      return res.status(401).json({ message: 'Your permissions have changed. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
