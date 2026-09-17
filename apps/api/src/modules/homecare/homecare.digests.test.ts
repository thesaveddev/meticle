import { describe, expect, it } from 'vitest';
import { isDigestDue, localDateKey } from './homecare.digests';

describe('homecare digest scheduling', () => {
  it('uses Europe/London for the local date, including daylight saving time', () => {
    expect(localDateKey(new Date('2026-06-01T23:30:00.000Z'), 'Europe/London')).toBe('2026-06-02');
    expect(localDateKey(new Date('2026-01-01T23:30:00.000Z'), 'Europe/London')).toBe('2026-01-01');
  });

  it('is due only during the configured window, not for the rest of the day', () => {
    expect(isDigestDue(new Date('2026-01-02T08:00:00.000Z'), '08:00', 'Europe/London')).toBe(true);
    expect(isDigestDue(new Date('2026-01-02T08:08:00.000Z'), '08:00', 'Europe/London')).toBe(true);
    expect(isDigestDue(new Date('2026-01-02T08:10:00.000Z'), '08:00', 'Europe/London')).toBe(false);
    expect(isDigestDue(new Date('2026-01-02T09:00:00.000Z'), '13:00', 'Europe/London')).toBe(false);
  });

  it('evaluates each recipient in their own timezone', () => {
    const now = new Date('2026-01-02T13:00:00.000Z');
    expect(isDigestDue(now, '13:00', 'Europe/London')).toBe(true);
    expect(isDigestDue(now, '13:00', 'America/New_York')).toBe(false);
  });
});
