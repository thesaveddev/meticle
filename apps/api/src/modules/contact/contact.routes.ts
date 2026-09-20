import { Router } from 'express';
import { ContactController } from './contact.controller';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { rateLimit } from '../../shared/middleware/rateLimit.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { contactSchema } from '../../shared/validation/schemas';

const router = Router();

// Public contact form submission (no auth)
router.post('/', rateLimit(5, 15 * 60 * 1000), validate(contactSchema), asyncHandler(ContactController.submit));

export default router;
