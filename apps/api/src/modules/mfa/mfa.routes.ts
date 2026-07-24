import { Router } from 'express';
import { MFAController } from './mfa.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@meticle/shared';
import { mfaSetupSchema, mfaVerifySchema, mfaDisableSchema, mfaAdminDisableSchema } from '../../shared/validation/schemas';

const router = Router();

router.get('/status', authenticate, asyncHandler(MFAController.status));
router.post('/setup', authenticate, validate(mfaSetupSchema), asyncHandler(MFAController.setup));
router.post('/verify', authenticate, validate(mfaVerifySchema), asyncHandler(MFAController.verify));
router.post('/disable', authenticate, validate(mfaDisableSchema), asyncHandler(MFAController.disable));
router.post('/admin-disable/:userId', authenticate, requireRole(UserRole.ORG_ADMIN), validate(mfaAdminDisableSchema), asyncHandler(MFAController.adminDisable));

export default router;
