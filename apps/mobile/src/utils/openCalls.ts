/**
 * Who gets the open-calls feature.
 *
 * It used to be "is this a domiciliary organisation", which was not enough: a
 * manager of a domiciliary agency was shown the marketplace, so the people who
 * approve claims were also being offered shifts to claim. Two different
 * audiences now share one screen, and this is the only place that decides which
 * one you are.
 *
 *   - a care worker in a domiciliary (or live-in) organisation picks up shifts
 *   - a manager approves the claims those shifts produce
 *
 * Everyone else — supported living, compliance officers, anyone who is not a
 * care worker — sees neither.
 */
import type { MobileUser, SessionOrganisation } from '../types'
import { isDomiciliaryOrganisation } from './serviceType'

/** The roles that run a location and therefore decide on a claim. */
export function canApproveOpenCalls(user?: MobileUser | null): boolean {
  return user?.role === 'ORG_ADMIN' || user?.role === 'MANAGER'
}

/**
 * The open-call marketplace. Care workers only, and positively so.
 *
 * Written as "is this a care worker" rather than "is this not a manager",
 * because a denylist lets every role nobody thought about through — a
 * compliance officer in a domiciliary agency was being offered shifts. A
 * manager of the same agency is the person who approves these claims, so
 * offering them shifts of their own is both confusing and a conflict of
 * interest.
 */
export function canClaimOpenCalls(user?: MobileUser | null, organization?: SessionOrganisation | null): boolean {
  if (user?.role !== 'CARE_WORKER') return false
  return isDomiciliaryOrganisation(organization)
}
