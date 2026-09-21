import { Router } from 'express';
import { ContactController } from './contact.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { rateLimit } from '../../shared/middleware/rateLimit.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { UserRole } from '@meticle/shared';
import { contactSchema, updateContactSubmissionSchema } from '../../shared/validation/schemas';

const router = Router();

// Public contact form submission (no auth)
router.post('/', rateLimit(5, 15 * 60 * 1000), validate(contactSchema), asyncHandler(ContactController.submit));

// Internal sales pipeline — restricted to platform administrators.
router.get('/submissions', authenticate, requireRole(UserRole.SUPER_ADMIN), asyncHandler(ContactController.list));
router.patch('/submissions/:id', authenticate, requireRole(UserRole.SUPER_ADMIN), validate(updateContactSubmissionSchema), asyncHandler(ContactController.update));

export default router;
