import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { rateLimit } from '../../shared/middleware/rateLimit.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, mfaVerifyLoginSchema, mfaCompleteSetupSchema, mfaSendBackupCodesSchema, registerWithInvitationSchema, verifyEmailSchema, sendEmailCodeSchema, verifyEmailCodeSchema } from '../../shared/validation/schemas';

const router = Router();

/**
 * Registration is limited per IP, which is the wrong unit for a single customer.
 *
 * A care home is the normal onboarding unit: one organisation, one office, one
 * NAT egress address. When that home activates, 15-30 staff register inside the
 * same hour and every one of them shares `req.ip`, so a per-IP budget sized for
 * "one person guessing passwords" becomes a per-organisation budget that the
 * customer's own staff collectively exhaust. The limit then reads as our
 * software being broken at the exact moment we are trying to win the account.
 *
 * 30 per 15 minutes is sized to seat a full care home in one sitting, and it
 * is safe to raise this far specifically because registration is gated on
 * proven mailbox ownership: `AuthController.register` rejects any caller who
 * has not already completed `verify-email-code` for that address within the
 * hour, so every one of these 30 requests corresponds to a real inbox someone
 * genuinely controls. That proof gate is the actual abuse control here; this
 * counter is only backstop against scripted volume, which 30 still bounds.
 *
 * Password guessing is unaffected — that is `/login`, deliberately left at 10
 * per 15 minutes, and additionally locked per-account by
 * `LOGIN_MAX_ATTEMPTS`.
 */
const REGISTRATION_LIMIT = 30;

router.post('/register', rateLimit(REGISTRATION_LIMIT, 15 * 60 * 1000), validate(registerSchema), asyncHandler(AuthController.register));
router.post('/register-with-invitation', rateLimit(REGISTRATION_LIMIT, 15 * 60 * 1000), validate(registerWithInvitationSchema), asyncHandler(AuthController.registerWithInvitation));
router.post('/login', rateLimit(10, 15 * 60 * 1000), validate(loginSchema), asyncHandler(AuthController.login));
router.post('/mfa/verify-login', rateLimit(10, 60 * 1000), validate(mfaVerifyLoginSchema), asyncHandler(AuthController.verifyMfaLogin));
router.post('/mfa/complete-setup', rateLimit(5, 60 * 1000), validate(mfaCompleteSetupSchema), asyncHandler(AuthController.completeMfaSetup));
router.post('/mfa/send-backup-codes', rateLimit(3, 60 * 1000), validate(mfaSendBackupCodesSchema), asyncHandler(AuthController.sendBackupCodes));
router.post('/refresh', rateLimit(10, 60 * 1000), validate(refreshTokenSchema), asyncHandler(AuthController.refresh));
router.post('/verify-email', rateLimit(5, 60 * 1000), validate(verifyEmailSchema), asyncHandler(AuthController.verifyEmail));
router.post('/send-email-code', rateLimit(5, 60 * 1000), validate(sendEmailCodeSchema), asyncHandler(AuthController.sendEmailCode));
router.post('/verify-email-code', rateLimit(5, 60 * 1000), validate(verifyEmailCodeSchema), asyncHandler(AuthController.verifyEmailCode));
router.post('/forgot-password', rateLimit(5, 60 * 60 * 1000), validate(forgotPasswordSchema), asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', rateLimit(5, 60 * 1000), validate(resetPasswordSchema), asyncHandler(AuthController.resetPassword));
router.get('/me', authenticate, asyncHandler(AuthController.getCurrentUser));
router.post('/logout', authenticate, asyncHandler(AuthController.logout));

export default router;
