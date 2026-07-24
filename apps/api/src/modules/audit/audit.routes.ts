import { Router } from 'express';
import { AuditController } from './audit.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@meticle/shared';
import { asyncHandler } from '../../shared/middleware/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/logs', requireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), asyncHandler(AuditController.getLogs));

export default router;
