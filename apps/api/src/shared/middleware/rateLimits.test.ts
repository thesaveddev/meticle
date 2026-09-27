import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The module reads process.env at load time for AUTH_LIMITS, but
// `configuredLimit` reads it per call, which is what these tests exercise.
vi.mock('../utils/logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { configuredLimit, AUTH_LIMITS, LOGIN_RATE_LIMIT } from './rateLimits';

const ENV_NAME = 'TEST_RATE_LIMIT';

describe('configuredLimit', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[ENV_NAME];
    delete process.env[ENV_NAME];
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[ENV_NAME];
    else process.env[ENV_NAME] = saved;
  });

  it('uses the built-in default when the variable is absent', () => {
    expect(configuredLimit(ENV_NAME, 30)).toBe(30);
  });

  it('uses the built-in default when the variable is empty', () => {
    process.env[ENV_NAME] = '   ';
    expect(configuredLimit(ENV_NAME, 30)).toBe(30);
  });

  it('honours a sane configured value', () => {
    process.env[ENV_NAME] = '7';
    expect(configuredLimit(ENV_NAME, 30)).toBe(7);
  });

  it('tolerates surrounding whitespace', () => {
    process.env[ENV_NAME] = ' 12 ';
    expect(configuredLimit(ENV_NAME, 30)).toBe(12);
  });

  // The important property: a typo must never become "no limit".
  it('falls back on a non-numeric value rather than accepting it', () => {
    for (const bad of ['abc', '10; DROP TABLE users', '1e6', 'null', 'undefined']) {
      process.env[ENV_NAME] = bad;
      expect(configuredLimit(ENV_NAME, 30)).toBe(30);
    }
  });

  it('falls back on zero and negatives, which would disable the control', () => {
    for (const bad of ['0', '-5']) {
      process.env[ENV_NAME] = bad;
      expect(configuredLimit(ENV_NAME, 30)).toBe(30);
    }
  });

  it('falls back on a fractional value', () => {
    process.env[ENV_NAME] = '2.5';
    expect(configuredLimit(ENV_NAME, 30)).toBe(30);
  });

  // A stray zero turning 30 into 30000 would remove the abuse bound entirely.
  it('clamps a value far above the default instead of trusting it', () => {
    process.env[ENV_NAME] = '30000';
    expect(configuredLimit(ENV_NAME, 30)).toBe(300);
  });

  it('accepts a value exactly at the ceiling', () => {
    process.env[ENV_NAME] = '300';
    expect(configuredLimit(ENV_NAME, 30)).toBe(300);
  });

  it('falls back to the default on a number too large to represent exactly', () => {
    // Distinct from the clamping case: this fails isSafeInteger, so it never
    // becomes a parsed value at all. Falling back to the default is the more
    // conservative of the two safe answers — clamping to the ceiling would
    // still be ten times the intended limit.
    process.env[ENV_NAME] = '99999999999999999999';
    expect(configuredLimit(ENV_NAME, 30)).toBe(30);
  });
});

describe('shipped defaults', () => {
  it('are the values that are live now, so removing the env vars changes nothing', () => {
    // If these change, the comment blocks in auth.routes.ts need updating too.
    expect(AUTH_LIMITS.register).toBe(30);
    expect(AUTH_LIMITS.emailCode).toBe(10);
    expect(AUTH_LIMITS.forgotPassword).toBe(20);
  });

  it('keeps login out of configuration entirely', () => {
    expect(LOGIN_RATE_LIMIT).toBe(10);
    // No RATE_LIMIT_LOGIN variable is consulted, so an operator cannot switch
    // password-guessing protection off by setting one.
    expect(Object.keys(AUTH_LIMITS)).not.toContain('login');
  });
});
