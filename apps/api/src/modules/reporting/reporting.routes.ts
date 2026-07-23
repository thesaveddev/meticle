import { Router } from 'express';
import { ReportingController } from './reporting.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@caredesk/shared';

const router = Router();

router.use(authenticate);

router.get('/compliance-audit', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getComplianceAudit));
router.get('/staffing-stats', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getStaffingStats));
router.get('/export/:type', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.exportReport));

export default router;
