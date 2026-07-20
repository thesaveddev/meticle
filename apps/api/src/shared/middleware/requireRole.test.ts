import { describe, it, expect, vi } from 'vitest';
import { requireRole } from './requireRole';
import { UserRole } from '@caredesk/shared';

function mockRequest(role?: string) {
  return {
    user: role ? { userId: '123', email: 'test@test.com', role, organizationId: 'org-1' } : undefined,
  } as any;
}

function mockResponse() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
}

describe('requireRole', () => {
  it('should pass for matching role', () => {
    const middleware = requireRole(UserRole.ORG_ADMIN);
    const req = mockRequest('ORG_ADMIN');
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should pass for any of multiple roles', () => {
    const middleware = requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER);
    const req = mockRequest('MANAGER');
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject for non-matching role', () => {
    const middleware = requireRole(UserRole.ORG_ADMIN);
    const req = mockRequest('CARE_WORKER');
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('should reject when no user', () => {
    const middleware = requireRole(UserRole.ORG_ADMIN);
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
