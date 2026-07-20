import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from './password.util';

describe('password.util', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('TestPass123!');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('TestPass123!');
  });

  it('should compare a correct password', async () => {
    const password = 'TestPass123!';
    const hash = await hashPassword(password);
    const result = await comparePassword(password, hash);
    expect(result).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('TestPass123!');
    const result = await comparePassword('WrongPass123!', hash);
    expect(result).toBe(false);
  });

  it('should generate different hashes for the same password', async () => {
    const password = 'TestPass123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});
