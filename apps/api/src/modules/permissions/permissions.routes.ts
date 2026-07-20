import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { PermissionsController } from './permissions.controller';
import { UserRole } from '@caredesk/shared';
import { updatePermissionsSchema } from '../../shared/validation/schemas';

const router = Router();

router.use(authenticate);

router.get('/modules', asyncHandler(PermissionsController.getModules));
router.get('/:userId', asyncHandler(PermissionsController.getUserPermissions));
router.put('/:userId', requireRole(UserRole.ORG_ADMIN), validate(updatePermissionsSchema), asyncHandler(PermissionsController.updateUserPermissions));

export default router;
