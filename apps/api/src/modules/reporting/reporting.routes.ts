import { Router } from 'express';
import { ReportingController } from './reporting.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/reports', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.listReports));
router.get('/overview', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getOverview));
router.get('/filter-options', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getFilterOptions));
router.get('/data/:reportId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.getReportData));
router.get('/export/:reportId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(ReportingController.exportReport));

export default router;
