import { Router } from 'express';
import { MarketplaceController } from './marketplace.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { applyShiftSchema, publishShiftSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();

router.use(authenticate);

router.get('/shifts', asyncHandler(MarketplaceController.getAvailableShifts));
router.post('/apply/:shiftId', validate(applyShiftSchema), asyncHandler(MarketplaceController.applyForShift));
router.post('/publish/:shiftId', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(publishShiftSchema), asyncHandler(MarketplaceController.publishShift));

export default router;
