import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { PushController } from './push.controller';

const router = Router();
router.use(authenticate);
router.get('/config', asyncHandler(PushController.getConfig));
router.post('/subscribe', asyncHandler(PushController.subscribe));
router.post('/unsubscribe', asyncHandler(PushController.unsubscribe));

export default router;
