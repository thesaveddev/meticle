import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { requireRole } from '../../shared/middleware/requireRole';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { MissionControlController } from './mission-control.controller';
import { UserRole } from '@meticle/shared';

const router = Router();
router.use(authenticate);

// Mission Control dashboard — accessible to admins, managers, and compliance officers
router.get('/summary', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER), asyncHandler(MissionControlController.getSummary));
router.get('/alerts', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER), asyncHandler(MissionControlController.getAlerts));
router.patch('/alerts/:id/dismiss', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(MissionControlController.dismissAlert));
router.patch('/alerts/type/:alertType/dismiss', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(MissionControlController.dismissByType));

export default router;