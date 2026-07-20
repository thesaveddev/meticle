import { Router } from 'express';
import { DsptController } from './dspt.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';

const router = Router();
router.use(authenticate);

router.get('/status', asyncHandler(DsptController.getStatus));
router.post('/assessments', requireRole(UserRole.ORG_ADMIN), asyncHandler(DsptController.createAssessment));
router.get('/assessments/:id', asyncHandler(DsptController.getAssessmentDetail));
router.patch('/assessments/:id/standards/:standardKey', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(DsptController.updateStandardStatus));
router.post('/assessments/:id/submit', requireRole(UserRole.ORG_ADMIN), asyncHandler(DsptController.submitAssessment));

export default router;