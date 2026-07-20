import { Request, Response } from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import pool from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import { AppError } from '../../shared/middleware/error.middleware';

// Progressive lockout for MFA setup verification
const mfaSetupLockout = new Map<string, { count: number; lockedUntil: number }>();
const MFA_SETUP_MAX_ATTEMPTS = 5;
const MFA_SETUP_LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of mfaSetupLockout) {
    if (now > entry.lockedUntil) mfaSetupLockout.delete(key);
  }
}, 120_000);

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  const hashed = codes.map(c => crypto.createHash('sha256').update(c).digest('hex'));
  return { plain: codes, hashed };
}

export class MFAController {
  static async setup(req: Request, res: Response) {
    const userId = req.user!.userId;

    const existing = await pool.query('SELECT mfa_enabled, mfa_secret FROM users WHERE id = $1', [userId]);
    if (existing.rows[0]?.mfa_enabled) {
      return res.status(400).json({ error: { message: 'MFA is already enabled. Disable it first to set up a new one.' } });
    }

    const secret = speakeasy.generateSecret({ name: `CareDesk (${req.user!.email})` });

    await pool.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret.base32, userId]);

    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);

    res.json({ secret: secret.base32, qrCode });
  }

  static async verify(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: { message: 'Token is required' } });
    }

    // Check lockout
    const lockoutEntry = mfaSetupLockout.get(userId);
    if (lockoutEntry && Date.now() < lockoutEntry.lockedUntil) {
      const remainingMin = Math.ceil((lockoutEntry.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: { message: `Too many failed attempts. Try again in ${remainingMin} minutes.` } });
    }

    const result = await pool.query('SELECT mfa_secret FROM users WHERE id = $1', [userId]);
    const secret = result.rows[0]?.mfa_secret;
    if (!secret) {
      return res.status(400).json({ error: { message: 'MFA not set up. Generate a secret first.' } });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      // Track failed attempt
      const current = mfaSetupLockout.get(userId) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= MFA_SETUP_MAX_ATTEMPTS) {
        current.lockedUntil = Date.now() + MFA_SETUP_LOCKOUT_MS;
      }
      mfaSetupLockout.set(userId, current);
      return res.status(400).json({ error: { message: 'Invalid token. Try again.' } });
    }

    // Clear lockout on success
    mfaSetupLockout.delete(userId);

    // Generate backup codes
    const { plain, hashed } = generateBackupCodes();

    await pool.query(
      'UPDATE users SET mfa_enabled = TRUE, backup_codes = $1 WHERE id = $2',
      [hashed, userId]
    );

    // Send emails
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userResult.rows[0]?.email || '';
    const profileResult = await pool.query('SELECT first_name FROM staff_profiles WHERE user_id = $1', [userId]);
    const firstName = profileResult.rows[0]?.first_name || userEmail;
    await EmailService.sendMfaBackupCodesEmail(userEmail, plain, firstName);
    await EmailService.sendMfaSetupCompleteEmail(userEmail, firstName);

    res.json({ message: 'MFA enabled successfully', backupCodes: plain });
  }

  static async adminDisable(req: Request, res: Response) {
    const requesterRole = req.user!.role;
    const requesterOrg = req.user!.organizationId;
    const targetUserId = req.params.userId;

    if (requesterRole !== 'ORG_ADMIN' && requesterRole !== 'MANAGER') {
      return res.status(403).json({ error: { message: 'Only ORG_ADMIN or MANAGER can reset MFA for other users.' } });
    }

    const target = await pool.query('SELECT organization_id, email FROM users WHERE id = $1', [targetUserId]);
    if (target.rows.length === 0 || target.rows[0].organization_id !== requesterOrg) {
      return res.status(404).json({ error: { message: 'User not found in your organization.' } });
    }

    await pool.query(
      'UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, backup_codes = $1 WHERE id = $2',
      [ [], targetUserId ]
    );

    const profileResult = await pool.query('SELECT first_name FROM staff_profiles WHERE user_id = $1', [targetUserId]);
    const firstName = profileResult.rows[0]?.first_name || target.rows[0].email;
    await EmailService.sendMfaResetAdminEmail(target.rows[0].email, firstName);

    res.json({ message: 'MFA has been reset for the user.' });
  }

  static async disable(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { token } = req.body;

    const userResult = await pool.query('SELECT mfa_secret, backup_codes FROM users WHERE id = $1', [userId]);
    const secret = userResult.rows[0]?.mfa_secret;
    const backupCodes: string[] = userResult.rows[0]?.backup_codes || [];

    if (secret) {
      if (!token) {
        return res.status(400).json({ error: { message: 'Current MFA or backup code is required to disable MFA' } });
      }

      // Try TOTP first
      const totpVerified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!totpVerified) {
        // Try backup code
        const hashedInput = crypto.createHash('sha256').update(token.trim().toUpperCase()).digest('hex');
        const matchIndex = backupCodes.indexOf(hashedInput);
        if (matchIndex === -1) {
          return res.status(400).json({ error: { message: 'Invalid MFA token or backup code' } });
        }
      }
    }

    await pool.query(
      'UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, backup_codes = $1 WHERE id = $2',
      [ [], userId ]
    );

    res.json({ message: 'MFA disabled successfully' });
  }

  static async status(req: Request, res: Response) {
    const userId = req.user!.userId;

    const result = await pool.query(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [userId]
    );

    res.json({ mfaEnabled: result.rows[0]?.mfa_enabled || false });
  }
}
