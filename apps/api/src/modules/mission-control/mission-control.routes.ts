import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { requireRole } from '../../shared/middleware/requireRole';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { MissionControlController } from './mission-control.controller';
import { UserRole } from '@meticle/shared';
import { requireSupportedLivingOnly, requireDomiciliaryOnly } from '../../shared/middleware/requireServiceType';

const router = Router();
router.use(authenticate);

const mcRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER];
const writeRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER];

router.get('/summary', requireSupportedLivingOnly, requireRole(...mcRoles), asyncHandler(MissionControlController.getSummary));
router.get('/homecare-summary', requireDomiciliaryOnly, requireRole(...mcRoles), asyncHandler(MissionControlController.getHomecareSummary));
router.get('/alerts', requireSupportedLivingOnly, requireRole(...mcRoles), asyncHandler(MissionControlController.getAlerts));
router.get('/alerts/history', requireSupportedLivingOnly, requireRole(...mcRoles), asyncHandler(MissionControlController.getAlertHistory));
router.get('/trends', requireSupportedLivingOnly, requireRole(...mcRoles), asyncHandler(MissionControlController.getTrends));
router.patch('/alerts/batch-dismiss', requireSupportedLivingOnly, requireRole(...writeRoles), asyncHandler(MissionControlController.batchDismiss));
router.patch('/alerts/:id/dismiss', requireSupportedLivingOnly, requireRole(...writeRoles), asyncHandler(MissionControlController.dismissAlert));
router.patch('/alerts/:id/assign', requireSupportedLivingOnly, requireRole(...writeRoles), asyncHandler(MissionControlController.assignAlert));
router.patch('/alerts/type/:alertType/dismiss', requireSupportedLivingOnly, requireRole(...writeRoles), asyncHandler(MissionControlController.dismissByType));

export default router;