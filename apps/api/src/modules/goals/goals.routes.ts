import { Router } from 'express';
import { GoalController } from './goals.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createGoalSchema, updateGoalSchema } from '../../shared/validation/schemas';
import { UserRole } from '@caredesk/shared';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(GoalController.list));
router.get('/:id', asyncHandler(GoalController.getById));
router.get('/stats/:serviceUserId', asyncHandler(GoalController.getServiceUserStats));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createGoalSchema), asyncHandler(GoalController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateGoalSchema), asyncHandler(GoalController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(GoalController.delete));

export default router;
