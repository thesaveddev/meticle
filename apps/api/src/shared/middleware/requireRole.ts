import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { UserRole } from '@caredesk/shared';

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
