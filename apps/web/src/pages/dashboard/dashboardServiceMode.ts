export type DashboardServiceMode = 'supported_living' | 'domiciliary' | 'unconfigured'

const DOMICILIARY_TYPES = new Set(['domiciliary', 'live_in'])
const SUPPORTED_LIVING_TYPES = new Set(['supported_living', 'residential'])

/**
 * Match the API service-type guard: a primary service type is authoritative;
 * legacy secondary types are consulted only when no primary has been set.
 */
export function getDashboardServiceMode(organization?: {
  primary_service_type?: unknown
  service_types?: unknown
} | null): DashboardServiceMode {
  const types = typeof organization?.primary_service_type === 'string' && organization.primary_service_type
    ? [organization.primary_service_type]
    : Array.isArray(organization?.service_types)
      ? organization.service_types.filter((type): type is string => typeof type === 'string')
      : []

  if (types.some(type => DOMICILIARY_TYPES.has(type))) return 'domiciliary'
  if (types.some(type => SUPPORTED_LIVING_TYPES.has(type))) return 'supported_living'
  return 'unconfigured'
}
