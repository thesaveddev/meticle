import { describe, it, expect, vi } from 'vitest';
import { rateLimit } from './rateLimit.middleware';

vi.mock('../redis', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
}));

// The in-memory store is module-level and keyed on `ip:path`, so every test in
// this file would otherwise share one bucket — a longer window set by an
// earlier test silently governs a later one. Each test gets its own path.
let pathCounter = 0;
function mockReqRes() {
  pathCounter += 1;
  const req: any = { ip: '127.0.0.1', path: `/test-${pathCounter}` };
  // Mirrors the express Response chaining used by the middleware:
  // `res.status(429).set(...).json(...)`.
  const res: any = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('rateLimit middleware', () => {
  it('should allow requests under the limit', async () => {
    const { req, res, next } = mockReqRes();
    const handler = rateLimit(5, 60_000);
    await handler(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should block requests over the limit', async () => {
    const { req, res, next } = mockReqRes();
    const handler = rateLimit(2, 60_000);
    await handler(req, res, next);
    await handler(req, res, next);
    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String), statusCode: 429 })
    );
  });

  // A rejected caller used to get a bare "try again later" with no indication
  // of how long "later" was, which reads as a broken app rather than a limit.
  it('should tell a rejected caller how long to wait', async () => {
    const { req, res, next } = mockReqRes();
    const handler = rateLimit(1, 60_000);
    await handler(req, res, next);
    await handler(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
    const body = res.json.mock.calls[0][0];
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  // The in-memory branch knows the exact window end, so the hint must track
  // the real reset rather than always quoting the full window length.
  it('should report a shrinking wait as the window is consumed', async () => {
    const { req, res, next } = mockReqRes();
    const handler = rateLimit(1, 3_000);
    await handler(req, res, next);

    await handler(req, res, next);
    const first = res.json.mock.calls[0][0].retryAfterSeconds;

    await new Promise((r) => setTimeout(r, 1_100));
    await handler(req, res, next);
    const second = res.json.mock.calls[1][0].retryAfterSeconds;

    expect(second).toBeLessThan(first);
  });
});
