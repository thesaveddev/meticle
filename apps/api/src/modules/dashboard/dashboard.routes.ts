import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/stats', asyncHandler(DashboardController.getStats));
router.get('/compliance', asyncHandler(DashboardController.getComplianceSnapshot));
router.get('/today-rota', asyncHandler(DashboardController.getTodayRota));
router.get('/widgets', asyncHandler(DashboardController.getWidgets));
router.get('/review-scheduler', asyncHandler(DashboardController.getReviewScheduler));

export default router;
