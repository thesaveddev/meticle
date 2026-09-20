import { describe, expect, it, vi, beforeEach } from 'vitest';
import { requireServiceType } from './requireServiceType';
import * as database from '../database';

vi.mock('../database', () => ({ query: vi.fn() }));

describe('requireServiceType', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['domiciliary', ['domiciliary']],
    ['supported_living', ['supported_living']],
    ['residential', ['residential']],
    ['live_in', ['live_in']],
  ])('allows an organisation with %s service type', async (required, serviceTypes) => {
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [{ service_types: serviceTypes }] } as any);
    const next = vi.fn();
    await requireServiceType(required)({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies a domiciliary-only organisation on supported-living routes', async () => {
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [{ service_types: ['domiciliary'] }] } as any);
    const next = vi.fn();
    await requireServiceType('supported_living', 'residential')({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('denies a supported-living-only organisation on domiciliary routes', async () => {
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [{ service_types: ['supported_living'] }] } as any);
    const next = vi.fn();
    await requireServiceType('domiciliary', 'live_in')({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('fails closed when the organisation is missing or has no service types', async () => {
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [] } as any);
    const next = vi.fn();
    await requireServiceType('supported_living')({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
