import { Router } from 'express';
import { TaskController } from './tasks.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import { createTaskSchema, updateTaskSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(TaskController.list));
router.get('/:id', asyncHandler(TaskController.getById));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createTaskSchema), asyncHandler(TaskController.create));
// A support worker can complete or annotate a task, which is the whole point of
// the task list appearing in their navigation. The controller reduces their
// submission to status and notes.
router.patch('/:id', validate(updateTaskSchema), asyncHandler(TaskController.update));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(TaskController.delete));

export default router;
