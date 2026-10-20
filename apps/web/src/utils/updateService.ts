/**
 * The vocabulary two screens share about one DBS Update Service subscription.
 *
 * The compliance page is where a subscription is administered — recorded, checked,
 * renewed, withdrawn — and a staff member's own profile shows the same record
 * read-only on its compliance tab, beside their other evidence. Both read these
 * labels, so "Due soon" and "No change — the certificate stands" cannot come to
 * mean one thing where a manager acts and another where they arrive from a link.
 *
 * The values are the API's own (`apps/api/src/modules/dbs/dbs.types.ts`): the
 * levels and workforces a certificate can cover, the due states resolved against
 * the provider's warning window, and one phrase per check outcome.
 */

/** Certificate levels the Update Service is available for. Basic is not eligible. */
export const DBS_LEVELS = ['standard', 'enhanced', 'enhanced_with_barred']

export const DBS_WORKFORCE = ['adult', 'child', 'both']

export const UPDATE_SERVICE_STATE_COLORS: Record<string, string> = {
  current: '#10B981',
  due_soon: '#F59E0B',
  overdue: '#EF4444',
  not_active: '#51637A',
}

export const UPDATE_SERVICE_STATE_LABELS: Record<string, string> = {
  current: 'Current',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  not_active: 'Not active',
}

export const UPDATE_SERVICE_STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  withdrawn: '#51637A',
  lapsed: '#F59E0B',
}

export const UPDATE_SERVICE_OUTCOMES = [
  { value: 'no_change', label: 'No change — the certificate stands' },
  { value: 'changed', label: 'Changed — a new certificate is needed' },
  { value: 'unable_to_check', label: 'Could not be completed' },
]

export const UPDATE_SERVICE_CONSENT_METHODS = [
  { value: 'written', label: 'Written' },
  { value: 'email', label: 'Email' },
  { value: 'verbal', label: 'Verbal' },
  { value: 'online_form', label: 'Online form' },
]

export const UPDATE_SERVICE_IDENTITY_METHODS = [
  { value: 'manual_document_check', label: 'Document checked in person' },
  { value: 'digital_identity_service', label: 'Digital identity service' },
]

/** How a due date reads, from the day count the API resolved in the provider's own timezone. */
export function duePhrase(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—'
  const value = Number(days)
  if (Number.isNaN(value)) return '—'
  if (value < 0) return `overdue by ${Math.abs(value)} day${Math.abs(value) === 1 ? '' : 's'}`
  if (value === 0) return 'due today'
  return `in ${value} day${value === 1 ? '' : 's'}`
}

export const labelFor = (options: Array<{ value: string; label: string }>, value: string) =>
  options.find(o => o.value === value)?.label || String(value || '').replace(/_/g, ' ')

export const capitalise = (value: string) => String(value || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
