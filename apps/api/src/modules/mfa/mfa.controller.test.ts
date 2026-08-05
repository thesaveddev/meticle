import { describe, it, expect } from 'vitest';
import speakeasy from 'speakeasy';

describe('MFA flow', () => {
  it('should generate a valid secret', () => {
    const secret = speakeasy.generateSecret({ name: 'Test' });
    expect(secret.base32).toBeDefined();
    expect(secret.otpauth_url).toContain('otpauth://');
  });

  it('should verify a valid TOTP token', () => {
    const secret = speakeasy.generateSecret({ name: 'Test' });
    const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
    const verified = speakeasy.totp.verify({
      secret: secret.base32,
      encoding: 'base32',
      token,
      window: 1,
    });
    expect(verified).toBe(true);
  });

  it('should reject an invalid TOTP token', () => {
    const secret = speakeasy.generateSecret({ name: 'Test' });
    const verified = speakeasy.totp.verify({
      secret: secret.base32,
      encoding: 'base32',
      token: '000000',
      window: 1,
    });
    expect(verified).toBe(false);
  });

  it('should rebuild the otpauth URL for a reused (stored) secret', () => {
    const stored = speakeasy.generateSecret({ name: 'Meticle (test@x.com)' }).base32;
    const url = speakeasy.otpauthURL({
      secret: stored,
      encoding: 'base32',
      label: 'Meticle (test@x.com)',
    });
    expect(url).toContain('otpauth://');
    expect(url).toContain(`secret=${stored}`);

    const token = speakeasy.totp({ secret: stored, encoding: 'base32' });
    const verified = speakeasy.totp.verify({
      secret: stored,
      encoding: 'base32',
      token,
      window: 1,
    });
    expect(verified).toBe(true);
  });
});
