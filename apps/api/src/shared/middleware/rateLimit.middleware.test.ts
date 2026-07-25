import { describe, it, expect, vi } from 'vitest';
import { rateLimit } from './rateLimit.middleware';

vi.mock('../redis', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
}));

function mockReqRes() {
  const req: any = { ip: '127.0.0.1', path: '/test' };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
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
});
