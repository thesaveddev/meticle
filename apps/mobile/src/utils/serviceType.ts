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
