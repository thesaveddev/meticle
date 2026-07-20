import { Router } from 'express';
import { InsightsController } from './insights.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';

const router = Router();

router.use(authenticate);

router.get('/overview', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(InsightsController.getOverview));
router.get('/staffing', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(InsightsController.getStaffing));
router.get('/compliance', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(InsightsController.getCompliance));
router.get('/leave', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(InsightsController.getLeave));
router.get('/rota', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(InsightsController.getRota));

export default router;
