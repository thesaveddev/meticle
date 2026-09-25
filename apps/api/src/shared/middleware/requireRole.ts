import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { UserRole } from '@meticle/shared';

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, `Insufficient permissions. Required role: ${roles.join(' or ')}`));
    }
    next();
  };
};

/**
 * Allows a request through when the caller is acting on their own record, or
 * holds one of the listed roles. Use this for endpoints a person must be able
 * to reach for themselves (their own profile, pay, availability) so that the
 * role check cannot lock the owner out of their own data.
 */
export const requireSelfOrRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    if (req.params.userId && req.params.userId === req.user.userId) return next();
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, `Insufficient permissions. Required role: ${roles.join(' or ')}`));
    }
    next();
  };
};
