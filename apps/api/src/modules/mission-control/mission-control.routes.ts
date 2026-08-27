import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { requireRole } from '../../shared/middleware/requireRole';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { MissionControlController } from './mission-control.controller';
import { UserRole } from '@meticle/shared';

const router = Router();
router.use(authenticate);

const mcRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER];
const writeRoles = [UserRole.ORG_ADMIN, UserRole.MANAGER];

router.get('/summary', requireRole(...mcRoles), asyncHandler(MissionControlController.getSummary));
router.get('/alerts', requireRole(...mcRoles), asyncHandler(MissionControlController.getAlerts));
router.get('/alerts/history', requireRole(...mcRoles), asyncHandler(MissionControlController.getAlertHistory));
router.get('/trends', requireRole(...mcRoles), asyncHandler(MissionControlController.getTrends));
router.patch('/alerts/batch-dismiss', requireRole(...writeRoles), asyncHandler(MissionControlController.batchDismiss));
router.patch('/alerts/:id/dismiss', requireRole(...writeRoles), asyncHandler(MissionControlController.dismissAlert));
router.patch('/alerts/:id/assign', requireRole(...writeRoles), asyncHandler(MissionControlController.assignAlert));
router.patch('/alerts/type/:alertType/dismiss', requireRole(...writeRoles), asyncHandler(MissionControlController.dismissByType));

export default router;