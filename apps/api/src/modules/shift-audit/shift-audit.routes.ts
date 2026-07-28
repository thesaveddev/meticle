import { Router } from 'express';
import { ShiftAuditController } from './shift-audit.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get(
  '/daily',
  requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER),
  asyncHandler(ShiftAuditController.getDailyAudit)
);

router.post(
  '/send-emails',
  requireRole(UserRole.ORG_ADMIN),
  asyncHandler(ShiftAuditController.triggerAuditEmails)
);

export default router;
