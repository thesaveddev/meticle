import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { requireRole } from '../../shared/middleware/requireRole';
import { requireSupportedLivingOnly, requireDomiciliaryOnly } from '../../shared/middleware/requireServiceType';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

const dashboardRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER, UserRole.COMPLIANCE_OFFICER];

router.get('/stats', requireSupportedLivingOnly, requireRole(...dashboardRoles), asyncHandler(DashboardController.getStats));
router.get('/compliance', requireSupportedLivingOnly, requireRole(...dashboardRoles), asyncHandler(DashboardController.getComplianceSnapshot));
router.get('/today-rota', requireSupportedLivingOnly, requireRole(...dashboardRoles), asyncHandler(DashboardController.getTodayRota));
router.get('/widgets', requireSupportedLivingOnly, requireRole(...dashboardRoles), asyncHandler(DashboardController.getWidgets));
router.get('/review-scheduler', requireSupportedLivingOnly, requireRole(...dashboardRoles), asyncHandler(DashboardController.getReviewScheduler));
router.get('/domiciliary', requireDomiciliaryOnly, requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(DashboardController.getDomiciliarySummary));
router.get('/live-map', requireDomiciliaryOnly, requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DashboardController.getLiveMap));

export default router;
