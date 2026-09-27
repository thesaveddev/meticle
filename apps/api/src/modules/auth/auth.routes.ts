import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../shared/middleware/validate.middleware';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { rateLimit } from '../../shared/middleware/rateLimit.middleware';
import { AUTH_LIMITS, LOGIN_RATE_LIMIT } from '../../shared/middleware/rateLimits';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, mfaVerifyLoginSchema, mfaCompleteSetupSchema, mfaSendBackupCodesSchema, registerWithInvitationSchema, verifyEmailSchema, sendEmailCodeSchema, verifyEmailCodeSchema } from '../../shared/validation/schemas';

const router = Router();

// Sizing rationale for every limit below lives with the constant itself, in
// `shared/middleware/rateLimits.ts` — the signup caps are environment-tunable,
// so a comment here would drift away from the value it describes.

router.post('/register', rateLimit(AUTH_LIMITS.register, 15 * 60 * 1000), validate(registerSchema), asyncHandler(AuthController.register));
router.post('/register-with-invitation', rateLimit(AUTH_LIMITS.register, 15 * 60 * 1000), validate(registerWithInvitationSchema), asyncHandler(AuthController.registerWithInvitation));
router.post('/login', rateLimit(LOGIN_RATE_LIMIT, 15 * 60 * 1000), validate(loginSchema), asyncHandler(AuthController.login));
router.post('/mfa/verify-login', rateLimit(10, 60 * 1000), validate(mfaVerifyLoginSchema), asyncHandler(AuthController.verifyMfaLogin));
router.post('/mfa/complete-setup', rateLimit(5, 60 * 1000), validate(mfaCompleteSetupSchema), asyncHandler(AuthController.completeMfaSetup));
router.post('/mfa/send-backup-codes', rateLimit(3, 60 * 1000), validate(mfaSendBackupCodesSchema), asyncHandler(AuthController.sendBackupCodes));
router.post('/refresh', rateLimit(10, 60 * 1000), validate(refreshTokenSchema), asyncHandler(AuthController.refresh));
router.post('/verify-email', rateLimit(5, 60 * 1000), validate(verifyEmailSchema), asyncHandler(AuthController.verifyEmail));
router.post('/send-email-code', rateLimit(AUTH_LIMITS.emailCode, 60 * 1000), validate(sendEmailCodeSchema), asyncHandler(AuthController.sendEmailCode));
router.post('/verify-email-code', rateLimit(5, 60 * 1000), validate(verifyEmailCodeSchema), asyncHandler(AuthController.verifyEmailCode));
// On enumeration: the response is byte-identical whether or not the account
// exists, and the controller burns a password comparison on the miss path so
// the timing is too. Raising this cap therefore does not widen the enumeration
// surface — a reset email can only ever be sent to an address that already has
// an account, so the worst case is a nuisance email to an existing user, not
// contact with an arbitrary stranger. Sizing: see AUTH_LIMITS.forgotPassword.
router.post('/forgot-password', rateLimit(AUTH_LIMITS.forgotPassword, 60 * 60 * 1000), validate(forgotPasswordSchema), asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', rateLimit(5, 60 * 1000), validate(resetPasswordSchema), asyncHandler(AuthController.resetPassword));
router.get('/me', authenticate, asyncHandler(AuthController.getCurrentUser));
router.post('/logout', authenticate, asyncHandler(AuthController.logout));

export default router;
