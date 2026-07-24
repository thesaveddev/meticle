import { Router } from 'express';
import { GoalController } from './goals.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createGoalSchema, updateGoalSchema, createMilestoneSchema, updateMilestoneSchema, recordProgressSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(GoalController.list));
router.get('/stats/:serviceUserId', asyncHandler(GoalController.getServiceUserStats));
router.get('/:id', asyncHandler(GoalController.getById));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createGoalSchema), asyncHandler(GoalController.create));
router.patch('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateGoalSchema), asyncHandler(GoalController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(GoalController.delete));

// Milestones
router.get('/:id/milestones', asyncHandler(GoalController.listMilestones));
router.post('/:id/milestones', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createMilestoneSchema), asyncHandler(GoalController.createMilestone));
router.patch('/milestones/:milestoneId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(updateMilestoneSchema), asyncHandler(GoalController.updateMilestone));
router.delete('/milestones/:milestoneId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(GoalController.deleteMilestone));

// Progress History
router.get('/:id/progress-history', asyncHandler(GoalController.getProgressHistory));
router.post('/:id/progress', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(recordProgressSchema), asyncHandler(GoalController.recordProgress));

export default router;
