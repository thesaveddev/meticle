import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { EmailUnsubscribeController } from './email-unsubscribe.controller';

/**
 * Public by design: the whole point of an unsubscribe link is that the person
 * clicking it does not have to sign in. Mounted at `/email`, outside the
 * notifications router's `authenticate`.
 */
const router = Router();

router.get('/unsubscribe', asyncHandler(EmailUnsubscribeController.describe));
router.post('/unsubscribe', asyncHandler(EmailUnsubscribeController.unsubscribe));

export default router;
