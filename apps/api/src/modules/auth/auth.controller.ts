import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { EmailService } from '../../shared/utils/email.service';
import pool, { migrateQuery } from '../../shared/database';
import { UserRepository } from './user.repository';
import { hashPassword, comparePassword } from './password.util';
import speakeasy from 'speakeasy';
import { generateAccessToken, generateRefreshToken, generateMfaChallengeToken, verifyRefreshToken, verifyMfaChallengeToken } from './jwt.service';
import { UserRole, Plan } from '@meticle/shared';
import { AppError } from '../../shared/middleware/error.middleware';
import { OrgRepository } from '../orgs/org.repository';
import { PermissionsController } from '../permissions/permissions.controller';
import { blacklistToken } from '../../shared/middleware/tokenBlacklist';
import { logWarn, default as logger } from '../../shared/utils/logger';
import { isDisposableEmail, isDisposableEmailByMx } from '../../shared/utils/disposableEmail';

const PASSWORD_HISTORY_LIMIT = 5;

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// Progressive MFA lockout: 3 failed attempts → 1hr block
const mfaLockoutMap = new Map<string, { count: number; lockedUntil: number }>();
const MFA_MAX_ATTEMPTS = 3;
const MFA_LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Progressive login lockout: 5 failed attempts → 15min block
const loginLockoutMap = new Map<string, { count: number; lockedUntil: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of mfaLockoutMap) {
    if (now > entry.lockedUntil) mfaLockoutMap.delete(key);
  }
  for (const [key, entry] of loginLockoutMap) {
    if (now > entry.lockedUntil) loginLockoutMap.delete(key);
  }
}, 120_000);

const REGISTRATION_ALLOWED_ROLES = ['CARE_WORKER'];

function sanitizeUser(user: any) {
  const { password_hash, mfa_secret, backup_codes, ...safeUser } = user;
  return safeUser;
}

const registrationSchema = z.object({
  email: z.string().email().refine(v => !isDisposableEmail(v), 'Temporary email addresses are not allowed'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum(['CARE_WORKER', 'ORG_ADMIN'], { errorMap: () => ({ message: 'Role must be CARE_WORKER or ORG_ADMIN' }) }),
  name: z.string().min(1, 'Name is required'),
  organizationId: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export class AuthController {
  /**
   * @openapi
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password, role, name]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 minLength: 8
   *               role:
   *                 type: string
   *                 enum: [ORG_ADMIN, MANAGER, CARE_WORKER, COMPLIANCE_OFFICER]
   *               name:
   *                 type: string
   *               organizationId:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Validation error or email exists
   */
  static async register(req: Request, res: Response) {
    const validated = registrationSchema.parse(req.body);
    const { email, password, role, name, organizationId } = validated;

    if (await isDisposableEmailByMx(email)) throw new AppError(400, 'Temporary email addresses are not allowed');

    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError(400, 'An account with this email already exists.');
    }

    const hashedPassword = await hashPassword(password);
    let orgId: string | undefined = organizationId;

    const userRole = role as UserRole;

    // Auto-create organization for ORG_ADMIN and CARE_WORKER roles
    if (!orgId && (userRole === UserRole.ORG_ADMIN || userRole === UserRole.CARE_WORKER)) {
      const orgName = userRole === UserRole.ORG_ADMIN
        ? `${name}'s Organization`
        : `${name}'s Profile`;
      const org = await OrgRepository.createOrg(orgName, migrateQuery);
      orgId = org.id;

      // Auto-create Headquarters location for ORG_ADMIN
      if (userRole === UserRole.ORG_ADMIN) {
        await OrgRepository.createLocation(orgId, 'Headquarters', undefined, undefined, undefined, migrateQuery);
      }
    }

    const user = await UserRepository.create({
      email,
      password_hash: hashedPassword,
      role: userRole,
      organization_id: orgId,
    });

    // Create staff profile with the user's name
    const nameParts = name.trim().split(/\s+/);
    let locationId: string | null = null;
    if (userRole === UserRole.ORG_ADMIN) {
      const locResult = await migrateQuery(
        'SELECT id FROM locations WHERE organization_id = $1 AND name = $2 LIMIT 1',
        [orgId, 'Headquarters']
      );
      locationId = locResult.rows[0]?.id || null;
    }
    try {
      await migrateQuery(
        'INSERT INTO staff_profiles (user_id, first_name, last_name, location_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING',
        [user.id, nameParts[0], nameParts.slice(1).join(' ') || '', locationId]
      );
    } catch {
      // staff_profiles table might lack the unique constraint; non-critical
    }

    // Auto-verify on registration
    await migrateQuery('UPDATE users SET email_verified = TRUE WHERE id = $1', [user.id]);

    // Set default permissions for the new user's role
    PermissionsController.setDefaultPermissions(user.id, user.role).catch(logWarn('setDefaultPermissions'));

    // Store initial password in history
    await migrateQuery(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [user.id, hashedPassword]
    ).catch(logWarn('storeInitialPasswordHistory'));

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Send welcome email asynchronously after response
    const orgName = (userRole === UserRole.ORG_ADMIN ? `${name}'s Organization` : `${name}'s Profile`);
    const isAdmin = userRole === UserRole.ORG_ADMIN;
    EmailService.sendWelcomeEmail(email, name, orgName, isAdmin).catch(logWarn('sendWelcomeEmail'));

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
      message: 'Registration successful.',
    });
  }

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     summary: Login
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   */
  static async login(req: Request, res: Response) {
    const validated = loginSchema.parse(req.body);
    const { email, password } = validated;

    // Check login lockout
    const lockoutKey = email.toLowerCase();
    const lockout = loginLockoutMap.get(lockoutKey);
    if (lockout) {
      if (Date.now() < lockout.lockedUntil) {
        const remainingMin = Math.ceil((lockout.lockedUntil - Date.now()) / 60000);
        throw new AppError(429, `Too many failed login attempts. Try again in ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`);
      }
      loginLockoutMap.delete(lockoutKey);
    }

    const user = await UserRepository.findByEmail(email);
    if (!user) throw new AppError(401, 'Invalid email or password');

    if (user.status === 'deactivated') throw new AppError(403, 'Your account has been deactivated. Please contact your organization administrator.');

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      // Track failed attempt
      const entry = loginLockoutMap.get(lockoutKey) || { count: 0, lockedUntil: 0 };
      entry.count++;
      if (entry.count >= LOGIN_MAX_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_DURATION_MS;
        entry.count = 0;
        logger.warn({ email }, 'Login lockout triggered');
      }
      loginLockoutMap.set(lockoutKey, entry);
      throw new AppError(401, 'Invalid email or password');
    }

    // Successful login — clear lockout
    loginLockoutMap.delete(lockoutKey);
    if (user.force_password_reset) {
      res.json({ forcePasswordReset: true, message: 'A password reset has been requested for this account. Check your email to reset your password before logging in.' });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id };

    // Check MFA
    if (user.mfa_enabled) {
      const mfaToken = generateMfaChallengeToken(tokenPayload);
      res.json({ mfaRequired: true, mfaToken });
      return;
    }

    // Check if organization requires MFA
    if (user.organization_id) {
      const org = await OrgRepository.getOrgById(user.organization_id, migrateQuery);
      if (org?.force_mfa) {
        const setupToken = generateMfaChallengeToken(tokenPayload);
        res.json({ mfaSetupRequired: true, mfaSetupToken: setupToken, message: 'Your organization requires MFA. Please set up MFA to continue.' });
        return;
      }
    }

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    let organization = null;
    if (user.organization_id) organization = await OrgRepository.getOrgById(user.organization_id, migrateQuery);

    let profile = null;
    const profileResult = await migrateQuery('SELECT first_name, last_name, profile_picture_url FROM staff_profiles WHERE user_id = $1', [user.id]);
    if (profileResult.rows.length > 0) profile = profileResult.rows[0];

    setTokenCookies(res, accessToken, refreshToken);
    res.json({ user: { ...sanitizeUser(user), ...(profile || {}) }, accessToken, refreshToken, organization });
  }

  static async refresh(req: Request, res: Response) {
    const validated = refreshSchema.parse(req.body);
    let decoded: any;
    try {
      decoded = verifyRefreshToken(validated.refreshToken);
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    // Blacklist the old refresh token to prevent reuse
    const remaining = decoded?.exp ? Math.max(0, decoded.exp * 1000 - Date.now()) : 7 * 24 * 60 * 60 * 1000;
    await blacklistToken(validated.refreshToken, remaining);

    const user = await UserRepository.findById(decoded.userId);
    if (!user) {
      throw new AppError(401, 'User not found');
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    setTokenCookies(res, accessToken, refreshToken);
    res.json({ accessToken, refreshToken });
  }

  static async verifyEmail(req: Request, res: Response) {
    const { token } = req.query;
    const result = await migrateQuery(
      'SELECT * FROM verification_tokens WHERE token = $1 AND type = $2 AND expires_at > NOW()',
      [token, 'email_verification']
    );

    if (result.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired token');
    }

    const userId = result.rows[0].user_id;
    await migrateQuery('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);
    await migrateQuery('DELETE FROM verification_tokens WHERE id = $1', [result.rows[0].id]);

    res.json({ message: 'Email verified successfully' });
  }

  static async sendEmailCode(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) throw new AppError(400, 'Email is required');
    if (isDisposableEmail(email)) throw new AppError(400, 'Temporary email addresses are not allowed');
    if (await isDisposableEmailByMx(email)) throw new AppError(400, 'Temporary email addresses are not allowed');

    // Check if email is already registered
    const existing = await UserRepository.findByEmail(email);
    if (existing) throw new AppError(409, 'An account with this email already exists');

    // Rate limit: max 3 codes per email per 15 minutes
    const recent = await migrateQuery(
      `SELECT COUNT(*)::int as cnt FROM email_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '15 minutes'`,
      [email]
    );
    if (recent.rows[0].cnt >= 3) {
      throw new AppError(429, 'Too many verification codes requested. Please wait 15 minutes.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await migrateQuery(
      `INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)`,
      [email, code, expiresAt]
    );

    await EmailService.sendVerificationCode(email, code);
    res.json({ message: 'Verification code sent' });
  }

  static async verifyEmailCode(req: Request, res: Response) {
    const { email, code } = req.body;
    if (!email || !code) throw new AppError(400, 'Email and code are required');

    const result = await migrateQuery(
      `SELECT id FROM email_verification_codes
       WHERE email = $1 AND code = $2 AND expires_at > NOW() AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (result.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired verification code');
    }

    await migrateQuery(
      `UPDATE email_verification_codes SET verified = TRUE WHERE id = $1`,
      [result.rows[0].id]
    );

    res.json({ message: 'Email verified successfully', verified: true });
  }

  static async forgotPassword(req: Request, res: Response) {
    const validated = forgotPasswordSchema.parse(req.body);
    const { email } = validated;

    const user = await UserRepository.findByEmail(email);
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    await migrateQuery(
      'INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, token, 'password_reset', new Date(Date.now() + 60 * 60 * 1000)]
    );
    await EmailService.sendPasswordResetEmail(email, token);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  }

  static async resetPassword(req: Request, res: Response) {
    const validated = resetPasswordSchema.parse(req.body);
    const { token, newPassword } = validated;

    const result = await migrateQuery(
      'SELECT * FROM verification_tokens WHERE token = $1 AND type = $2 AND expires_at > NOW()',
      [token, 'password_reset']
    );

    if (result.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired token');
    }

    const userId = result.rows[0].user_id;
    const hashedPassword = await hashPassword(newPassword);

    // Check password history to prevent reuse
    const historyResult = await migrateQuery(
      'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, PASSWORD_HISTORY_LIMIT]
    );
    for (const row of historyResult.rows) {
      const match = await comparePassword(newPassword, row.password_hash);
      if (match) {
        throw new AppError(400, 'You cannot reuse a recent password. Please choose a different password.');
      }
    }

    // Store current password in history before updating
    const currentUser = await migrateQuery('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (currentUser.rows.length > 0) {
      await migrateQuery(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [userId, currentUser.rows[0].password_hash]
      );
    }

    await migrateQuery('UPDATE users SET password_hash = $1, force_password_reset = FALSE WHERE id = $2', [hashedPassword, userId]);
    await migrateQuery('DELETE FROM verification_tokens WHERE id = $1', [result.rows[0].id]);

    res.json({ message: 'Password reset successfully' });
  }

  // Register via invitation token
  static async registerWithInvitation(req: Request, res: Response) {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
      throw new AppError(400, 'Token, name, and password are required');
    }

    // Validate invitation
    const inviteResult = await migrateQuery(
      `SELECT i.*, o.name AS organization_name
       FROM invitations i
       JOIN organizations o ON o.id = i.organization_id
       WHERE i.token = $1 AND i.status = $2 AND i.expires_at > NOW()`,
      [token, 'pending']
    );

    if (inviteResult.rows.length === 0) {
      throw new AppError(400, 'Invalid or expired invitation');
    }

    const invitation = inviteResult.rows[0];

    // Check if email already exists (globally unique)
    const existingUser = await UserRepository.findByEmail(invitation.email);
    if (existingUser) {
      if (existingUser.organization_id === invitation.organization_id) {
        // Same org — link them and log in
        await migrateQuery('UPDATE invitations SET status = $1 WHERE id = $2', ['accepted', invitation.id]);

        const nameParts = name.trim().split(/\s+/);
        try {
          await migrateQuery(
            'INSERT INTO staff_profiles (user_id, first_name, last_name, location_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET location_id = COALESCE(NULLIF($4, NULL::uuid), staff_profiles.location_id)',
            [existingUser.id, nameParts[0], nameParts.slice(1).join(' ') || '', invitation.location_id]
          );
        } catch { /* non-critical */ }

        const tokenPayload = {
          userId: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
          organizationId: existingUser.organization_id,
        };
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        EmailService.sendWelcomeEmail(invitation.email, name, invitation.organization_name, false).catch(logWarn('sendWelcomeEmail'));

        res.status(200).json({
          user: sanitizeUser(existingUser),
          accessToken,
          refreshToken,
          message: 'Welcome back! Your invitation has been accepted.',
        });
        return;
      }
      // Email exists in a different org — reject (globally unique emails)
      throw new AppError(400, 'This email is already registered with another organization. Each organization requires a unique email address.');
    }

    const hashedPassword = await hashPassword(password);

    const user = await UserRepository.create({
      email: invitation.email,
      password_hash: hashedPassword,
      role: invitation.role,
      organization_id: invitation.organization_id,
    });

    // Set default permissions
    PermissionsController.setDefaultPermissions(user.id, user.role).catch(logWarn('setDefaultPermissions'));

    // Store initial password in history
    await migrateQuery(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [user.id, hashedPassword]
    ).catch(logWarn('storeInitialPasswordHistory'));

    // Create staff profile with the user's name
    const nameParts = name.trim().split(/\s+/);
    try {
      await migrateQuery(
        'INSERT INTO staff_profiles (user_id, first_name, last_name, location_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING',
        [user.id, nameParts[0], nameParts.slice(1).join(' ') || '', invitation.location_id]
      );
    } catch {
      // non-critical
    }

    // Mark invitation as accepted
    await migrateQuery(
      'UPDATE invitations SET status = $1 WHERE id = $2',
      ['accepted', invitation.id]
    );

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    EmailService.sendWelcomeEmail(invitation.email, name, invitation.organization_name, false).catch(logWarn('sendWelcomeEmail'));

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
      message: 'Registration successful. Welcome to your organization!',
    });
  }

  static async logout(req: Request, res: Response) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token) as any;
      const remaining = decoded?.exp ? Math.max(0, decoded.exp * 1000 - Date.now()) : 15 * 60 * 1000;
      await blacklistToken(token, remaining);

      // Also blacklist refresh token if provided in cookie
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        const refreshDecoded = jwt.decode(refreshToken) as any;
        const refreshRemaining = refreshDecoded?.exp ? Math.max(0, refreshDecoded.exp * 1000 - Date.now()) : 7 * 24 * 60 * 60 * 1000;
        await blacklistToken(refreshToken, refreshRemaining);
      }
    }
    res.json({ message: 'Logged out successfully' });
  }

  static async verifyMfaLogin(req: Request, res: Response) {
    const { mfaToken, token } = req.body;
    if (!mfaToken || !token) {
      throw new AppError(400, 'mfaToken and token are required');
    }

    let payload: any;
    try {
      payload = verifyMfaChallengeToken(mfaToken);
    } catch {
      throw new AppError(400, 'Invalid or expired MFA challenge token');
    }

    if (!payload.mfaChallenge) {
      throw new AppError(400, 'Invalid MFA challenge token');
    }

    const user = await UserRepository.findById(payload.userId);
    if (!user || !user.mfa_secret) {
      throw new AppError(400, 'MFA not configured');
    }

    // Check progressive lockout
    const lockoutEntry = mfaLockoutMap.get(payload.userId);
    if (lockoutEntry && Date.now() < lockoutEntry.lockedUntil) {
      const remainingMin = Math.ceil((lockoutEntry.lockedUntil - Date.now()) / 60000);
      throw new AppError(429, `Too many failed attempts. Try again in ${remainingMin} minutes.`);
    }

    // Try TOTP first
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      // Check backup codes
      const codes: string[] = user.backup_codes || [];
      const hashedInput = crypto.createHash('sha256').update(token.trim().toUpperCase()).digest('hex');
      const matchIndex = codes.indexOf(hashedInput);
      if (matchIndex === -1) {
        // Track failed attempt
        const current = mfaLockoutMap.get(payload.userId) || { count: 0, lockedUntil: 0 };
        current.count++;
        if (current.count >= MFA_MAX_ATTEMPTS) {
          current.lockedUntil = Date.now() + MFA_LOCKOUT_DURATION_MS;
        }
        mfaLockoutMap.set(payload.userId, current);
        throw new AppError(400, 'Invalid MFA code');
      }
      // Remove used backup code
      codes.splice(matchIndex, 1);
      await migrateQuery('UPDATE users SET backup_codes = $1 WHERE id = $2', [codes, user.id]);
    }

    // Clear lockout on success
    mfaLockoutMap.delete(payload.userId);

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    let organization = null;
    if (user.organization_id) organization = await OrgRepository.getOrgById(user.organization_id, migrateQuery);

    let profile = null;
    const profileResult = await migrateQuery('SELECT first_name, last_name, profile_picture_url FROM staff_profiles WHERE user_id = $1', [user.id]);
    if (profileResult.rows.length > 0) profile = profileResult.rows[0];

    // If used a backup code, include that info in response
    const usedBackup = !verified;
    setTokenCookies(res, accessToken, refreshToken);
    res.json({ user: { ...sanitizeUser(user), ...(profile || {}) }, accessToken, refreshToken, organization, usedBackup });
  }

  static async sendBackupCodes(req: Request, res: Response) {
    const { mfaToken } = req.body;
    if (!mfaToken) throw new AppError(400, 'MFA challenge token is required');

    let payload: any;
    try {
      payload = verifyMfaChallengeToken(mfaToken);
    } catch {
      throw new AppError(400, 'Invalid or expired MFA challenge token');
    }

    if (!payload.mfaChallenge) {
      throw new AppError(400, 'Invalid MFA challenge token');
    }

    const user = await UserRepository.findById(payload.userId);
    if (!user) throw new AppError(404, 'User not found');

    // Generate new backup codes (invalidates any old unused ones — security measure)
    const newCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      newCodes.push(`${part1}-${part2}`);
    }
    const hashed = newCodes.map(c => crypto.createHash('sha256').update(c).digest('hex'));
    await migrateQuery('UPDATE users SET backup_codes = $1 WHERE id = $2', [hashed, user.id]);

    const profileResult = await migrateQuery(
      'SELECT first_name, last_name FROM staff_profiles WHERE user_id = $1', [user.id]
    );
    const profile = profileResult.rows[0] || {};
    const name = profile.first_name || user.email;
    await EmailService.sendMfaBackupCodesEmail(user.email, newCodes, name);

    res.json({ message: 'New backup codes sent to your email.' });
  }

  /**
   * @openapi
   * /auth/me:
   *   get:
   *     summary: Get current user profile
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user data
   *       401:
   *         description: Unauthorized
   */
  static async getCurrentUser(req: Request, res: Response) {
    const userId = req.user!.userId;
    const user = await UserRepository.findById(userId);
    if (!user) throw new AppError(404, 'User not found');

    const profileResult = await migrateQuery(
      'SELECT first_name, last_name, profile_picture_url, employment_type, contracted_hours_weekly, location_id, is_on_leave, on_leave_until FROM staff_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0] || {};

    // Fetch location name
    let locationName = '';
    if (profile.location_id) {
      const locRes = await migrateQuery('SELECT name FROM locations WHERE id = $1', [profile.location_id]);
      locationName = locRes.rows[0]?.name || '';
    }

    let organization = null;
    if (user.organization_id) {
      organization = (await migrateQuery('SELECT id, name, plan, subscription_status, logo_url, primary_color, secondary_color, accent_color FROM organizations WHERE id = $1', [user.organization_id])).rows[0] || null;
    }

    res.json({
      user: { ...sanitizeUser(user), ...profile, organizationId: user.organization_id, location_name: locationName },
      organization,
    });
  }

  static async completeMfaSetup(req: Request, res: Response) {
    const validated = z.object({
      setupToken: z.string(),
      token: z.string(),
    }).parse(req.body);
    const { setupToken, token } = validated;

    let payload: any;
    try {
      payload = verifyMfaChallengeToken(setupToken);
    } catch {
      throw new AppError(400, 'Invalid or expired MFA setup token');
    }
    const userId = payload.userId;

    const user = await UserRepository.findById(userId);
    if (!user) throw new AppError(404, 'User not found');

    const secretResult = await migrateQuery('SELECT mfa_secret FROM users WHERE id = $1', [userId]);
    const secret = secretResult.rows[0]?.mfa_secret;
    if (!secret) {
      throw new AppError(400, 'MFA not set up. Generate a secret first.');
    }

    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
    if (!verified) {
      throw new AppError(400, 'Invalid token. Try again.');
    }

    const { plain, hashed } = (() => {
      const codes: string[] = [];
      for (let i = 0; i < 8; i++) {
        const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
        const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
        codes.push(`${part1}-${part2}`);
      }
      const hashed = codes.map(c => crypto.createHash('sha256').update(c).digest('hex'));
      return { plain: codes, hashed };
    })();

    await migrateQuery(
      'UPDATE users SET mfa_enabled = TRUE, backup_codes = $1 WHERE id = $2',
      [hashed, userId]
    );

    const profileResult = await migrateQuery(
      'SELECT first_name, last_name, profile_picture_url FROM staff_profiles WHERE user_id = $1', [userId]
    );
    const profile = profileResult.rows[0] || {};

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, organizationId: user.organization_id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Send emails
    const firstName = profile.first_name || user.email;
    await EmailService.sendMfaBackupCodesEmail(user.email, plain, firstName);
    await EmailService.sendMfaSetupCompleteEmail(user.email, firstName);

    res.json({
      message: 'MFA enabled successfully',
      backupCodes: plain,
      accessToken,
      refreshToken,
      user: { ...sanitizeUser(user), ...profile, organizationId: user.organization_id },
    });
  }
}
