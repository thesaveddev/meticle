import { Router } from 'express';
import { SmsController } from './sms.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { updateSmsConfigSchema, sendSmsSchema } from '../../shared/validation/schemas';
import { UserRole } from '@meticle/shared';

const router = Router();
router.use(authenticate);

router.get('/config', requireRole(UserRole.ORG_ADMIN), asyncHandler(SmsController.getConfig));
router.put('/config', requireRole(UserRole.ORG_ADMIN), validate(updateSmsConfigSchema), asyncHandler(SmsController.updateConfig));
// A manual message from a manager — cover requests, urgent call-outs. One
// recipient per call, queued rather than sent inline, so a slow Twilio never
// holds the response.
router.post('/send', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER), validate(sendSmsSchema), asyncHandler(SmsController.send));

export default router;

/**
 * Twilio's delivery receipts. Public — Twilio holds no session — so the only
 * routes here are the webhook, mounted in index.ts behind an urlencoded
 * parser (Twilio posts a form, not JSON) with the signature doing the
 * authenticating. See SmsController.handleStatus.
 */
export const publicSmsRouter = Router();
publicSmsRouter.post('/status', asyncHandler(SmsController.handleStatus));
