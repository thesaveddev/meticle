import { describe, it, expect, beforeAll } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt.service';
import { UserRole } from '@meticle/shared';

const testPayload = {
  userId: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  role: UserRole.ORG_ADMIN,
  organizationId: '123e4567-e89b-12d3-a456-426614174001',
};

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
});

describe('jwt.service', () => {
  it('should generate an access token', () => {
    const token = generateAccessToken(testPayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should generate a refresh token', () => {
    const token = generateRefreshToken(testPayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify a valid access token', () => {
    const token = generateAccessToken(testPayload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.email).toBe(testPayload.email);
    expect(decoded.role).toBe(testPayload.role);
    expect(decoded.organizationId).toBe(testPayload.organizationId);
  });

  it('should verify a valid refresh token', () => {
    const token = generateRefreshToken(testPayload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
  });

  it('should reject an invalid access token', () => {
    expect(() => verifyAccessToken('invalid-token')).toThrow();
  });
});
