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

  it('fails closed when the organisation row is missing (stale token)', async () => {
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [] } as any);
    const next = vi.fn();
    await requireServiceType('supported_living')({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('fails closed for an existing but unprovisioned organisation', async () => {
    // Onboarding has not selected a model; missing configuration must not grant
    // access to care data simply because the organization row exists.
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [{ service_types: [], primary_service_type: null }] } as any);
    const next = vi.fn();
    await requireServiceType('supported_living', 'residential')({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('unprovisioned organisation is still denied on domiciliary-only routes', async () => {
    // Fail-open covers the shared care models only — it must not open the
    // strictly domiciliary blocks to an org whose model is simply unknown.
    vi.mocked(database.query).mockResolvedValueOnce({ rows: [{ service_types: [], primary_service_type: null }] } as any);
    const next = vi.fn();
    await requireServiceType('domiciliary', 'live_in')({ user: { organizationId: 'org-1' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
