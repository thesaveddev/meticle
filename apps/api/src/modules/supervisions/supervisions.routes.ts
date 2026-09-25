import { Router } from 'express';
import { SupervisionController } from './supervisions.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { validate } from '../../shared/middleware/validate.middleware';
import { createSupervisionSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(SupervisionController.list));
router.get('/summary', asyncHandler(SupervisionController.summary));
router.post('/', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(createSupervisionSchema), asyncHandler(SupervisionController.create));
router.delete('/:id', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), asyncHandler(SupervisionController.remove));

export default router;
