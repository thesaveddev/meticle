import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mod from '../shared/utils/disposableEmail';
const { isDisposableEmail, mxHostIsDisposable, isDisposableEmailByMx } = mod;

describe('isDisposableEmail', () => {
  it('should reject 10minutemail.com', () => {
    expect(isDisposableEmail('test@10minutemail.com')).toBe(true);
  });

  it('should reject mailinator.com', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
  });

  it('should reject tempmail.com (supplement)', () => {
    expect(isDisposableEmail('test@tempmail.com')).toBe(true);
  });

  it('should accept gmail.com', () => {
    expect(isDisposableEmail('test@gmail.com')).toBe(false);
  });

  it('should accept outlook.com', () => {
    expect(isDisposableEmail('test@outlook.com')).toBe(false);
  });

  it('should return false for invalid email', () => {
    expect(isDisposableEmail('notanemail')).toBe(false);
    expect(isDisposableEmail('')).toBe(false);
  });
});

describe('mxHostIsDisposable', () => {
  it('should detect 10minutemail MX host', () => {
    expect(mxHostIsDisposable('prd-smtp.10minutemail.com')).toBe(true);
  });

  it('should detect trailing-dot MX host', () => {
    expect(mxHostIsDisposable('prd-smtp.10minutemail.com.')).toBe(true);
  });

  it('should detect mailinator MX host', () => {
    expect(mxHostIsDisposable('mx.mailinator.com')).toBe(true);
  });

  it('should not flag gmail MX', () => {
    expect(mxHostIsDisposable('aspmx.l.google.com')).toBe(false);
  });

  it('should not flag outlook MX', () => {
    expect(mxHostIsDisposable('outlook-com.olc.protection.outlook.com')).toBe(false);
  });

  it('should handle empty host', () => {
    expect(mxHostIsDisposable('')).toBe(false);
  });
});

describe('isDisposableEmailByMx', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when MX host is disposable', async () => {
    vi.spyOn(mod.mxResolver, 'resolveMx').mockResolvedValue([
      { exchange: 'prd-smtp.10minutemail.com', priority: 50, name: '' },
    ]);
    const result = await isDisposableEmailByMx('user@jbsze.com');
    expect(result).toBe(true);
  });

  it('should return false for normal domain', async () => {
    vi.spyOn(mod.mxResolver, 'resolveMx').mockResolvedValue([
      { exchange: 'aspmx.l.google.com', priority: 10, name: '' },
      { exchange: 'alt1.aspmx.l.google.com', priority: 20, name: '' },
    ]);
    const result = await isDisposableEmailByMx('user@gmail.com');
    expect(result).toBe(false);
  });

  it('should return false on DNS error (fail-open)', async () => {
    vi.spyOn(mod.mxResolver, 'resolveMx').mockRejectedValue(new Error('ENOTFOUND'));
    const result = await isDisposableEmailByMx('user@nonexistent-domain-xyz123.com');
    expect(result).toBe(false);
  });

  it('should return false for invalid email', async () => {
    const result = await isDisposableEmailByMx('notanemail');
    expect(result).toBe(false);
  });
});
