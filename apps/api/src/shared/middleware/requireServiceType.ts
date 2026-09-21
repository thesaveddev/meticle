import { Request, Response, NextFunction } from 'express';
import { query } from '../database';
import { AppError } from './error.middleware';

/**
 * Middleware that restricts access to routes based on the organisation's service type.
 *
 * Usage: requireServiceType('residential', 'supported_living')
 *   → only allows access if the org has at least one of those service types.
 *
 * The org's service_types are cached per-request to avoid repeated DB queries
 * when multiple service-type checks run on the same request.
 */
export function requireServiceType(...allowedTypes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.organizationId) {
        return next(new AppError(403, 'Access denied'));
      }

      // Check cache on the request to avoid repeated queries
      const cacheKey = '_serviceTypeContext';
      let serviceContext: { serviceTypes: string[]; primaryServiceType: string | null } | undefined = (req as any)[cacheKey];

      if (!serviceContext) {
        const result = await query(
          'SELECT service_types, primary_service_type FROM organizations WHERE id = $1',
          [user.organizationId]
        );
        serviceContext = {
          serviceTypes: result.rows[0]?.service_types || [],
          primaryServiceType: result.rows[0]?.primary_service_type || null,
        };
        (req as any)[cacheKey] = serviceContext;
      }

      // When a primary model is configured, it is authoritative. This keeps
      // a domiciliary organisation from reaching supported-living routes just
      // because a legacy secondary value remains in service_types.
      const hasAccess = serviceContext.primaryServiceType
        ? allowedTypes.includes(serviceContext.primaryServiceType)
        : serviceContext.serviceTypes.some((t: string) => allowedTypes.includes(t));
      if (!hasAccess) {
        return next(new AppError(403, 'This feature is not available for your organisation type'));
      }

      next();
    } catch (err) {
      next(new AppError(500, 'Failed to verify service type'));
    }
  };
}

/**
 * Shared care-record modules are valid for either care model, but they still
 * require an explicit, recognised service model. This prevents organisations
 * with missing or malformed onboarding configuration from reaching shared
 * person, health, goals, incident, or leave data routes.
 */
export const requireCareOrganisation = requireServiceType(
  'supported_living',
  'residential',
  'domiciliary',
  'live_in',
);

/**
 * Convenience: block access for domiciliary orgs.
 * Use on routes that are only for supported_living / residential.
 */
export const requireSupportedLivingOnly = requireServiceType('supported_living', 'residential');

/**
 * Convenience: block access for supported_living / residential orgs.
 * Use on routes that are only for domiciliary / live_in.
 */
export const requireDomiciliaryOnly = requireServiceType('domiciliary', 'live_in');
