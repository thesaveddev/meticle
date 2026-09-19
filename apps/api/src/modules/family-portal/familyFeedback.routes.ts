import { Router } from 'express';
import { FamilyFeedbackController as Ctrl } from './familyFeedback.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';

const router = Router();
const publicRouter = Router();

// ── Public routes (token-based, no auth) ──
publicRouter.get('/:token', asyncHandler(Ctrl.getFeedbackForm));
publicRouter.post('/:token', asyncHandler(Ctrl.submitFeedback));

// ── Authenticated routes (managers) ──
router.use(authenticate);
router.get('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(Ctrl.listFeedback));

export default router;
export { publicRouter };
