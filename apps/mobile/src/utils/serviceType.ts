import type { SessionOrganisation } from '../types'

/**
 * Whether the session's organisation is a domiciliary care provider, which is
 * what gates the open-call marketplace.
 *
 * The session carries both `primary_service_type` and a `service_types` list,
 * and they can disagree — an organisation that has moved most of its work into
 * live-in care still lists domiciliary from when it did both. The primary type
 * wins, because it is what the organisation actually trades as; the list is only
 * a fallback for older sessions that do not send one.
 *
 * `live_in` counts as domiciliary: care in the person's own home is the same
 * model, and the API's open-call access rule treats the two the same way.
 */
export function isDomiciliaryOrganisation(organisation?: SessionOrganisation | null): boolean {
  if (!organisation) return false
  const primary = typeof organisation.primary_service_type === 'string' ? organisation.primary_service_type : null
  if (primary) return primary === 'domiciliary' || primary === 'live_in'
  const types = Array.isArray(organisation.service_types) ? organisation.service_types : []
  return types.some((type: string) => type === 'domiciliary' || type === 'live_in')
}

/**
 * Whether the session's organisation runs supported living, where work is a shift
 * in a building that is handed over at the end — rather than a series of calls.
 *
 * Primary type first for the same reason as the domiciliary rule: an organisation
 * that has moved into supported living may still list domiciliary from when it did
 * both, and the primary type is what it actually trades as. A provider that only
 * lists it counts too, because the list is what older sessions send.
 */
export function isSupportedLivingOrganisation(organisation?: SessionOrganisation | null): boolean {
  if (!organisation) return false
  const primary = typeof organisation.primary_service_type === 'string' ? organisation.primary_service_type : null
  if (primary) return primary === 'supported_living'
  const types = Array.isArray(organisation.service_types) ? organisation.service_types : []
  return types.includes('supported_living')
}
