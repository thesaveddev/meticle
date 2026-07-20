import { Router } from 'express';
import { CqcController } from './cqc.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';

const router = Router();

router.get('/readiness', authenticate, asyncHandler(CqcController.getReadiness));
router.get('/frameworks', authenticate, asyncHandler(CqcController.getFrameworks));
router.get('/gap-analysis', authenticate, asyncHandler(CqcController.getGapAnalysis));
router.get('/action-items', authenticate, asyncHandler(CqcController.getActionItems));
router.post('/action-items', authenticate, asyncHandler(CqcController.createActionItem));
router.patch('/action-items/:id', authenticate, asyncHandler(CqcController.updateActionItem));
router.delete('/action-items/:id', authenticate, asyncHandler(CqcController.deleteActionItem));

export default router;
