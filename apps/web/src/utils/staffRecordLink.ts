import { MICA_RECORD_PARAMS, MICA_STAFF_COMPLIANCE_TAB, micaRecordPath } from '@meticle/shared'

/**
 * The one staff-record target every surface sends a reader to.
 *
 * A reminder about a person's document, training or DBS re-check is about *that
 * person's record*, and there is exactly one place that record lives:
 * `/staff/<userId>?tab=compliance&record=<recordId>` — the link a compliance email
 * already hands over, and the shape `micaRecordPath` builds for a `staff-compliance`
 * ref (`packages/shared/src/micaDeepLinks.ts`).
 *
 * Written as one function rather than a template string in each caller, because the
 * two ways this drifts are both silent. A second copy that interpolates a
 * `staff_profiles.id` instead of the user id lands on a page the route answers 404
 * for; a copy that drops the record parameter looks like a link that worked and opens
 * the person rather than the record. `staffId` here is therefore the **user** id —
 * `/staff/:userId` reads `:userId`, and `GET /staff/:userId` 404s for a profile id.
 *
 * A link with no record (the Update Service reminder, before its record is opened)
 * keeps the tab and nothing else, which is where a manager records a status check.
 */
export function staffRecordPath(staffUserId: string, recordId?: string | null): string {
  if (!recordId) return `/staff/${encodeURIComponent(staffUserId)}?tab=${MICA_STAFF_COMPLIANCE_TAB}`
  return micaRecordPath({ kind: 'staff-compliance', id: recordId, staffId: staffUserId })
}

/** The record parameter this target carries, for a caller that has to read it back. */
export const STAFF_COMPLIANCE_RECORD_PARAM = MICA_RECORD_PARAMS['staff-compliance']
