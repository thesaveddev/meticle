const STAFF_ROLES = new Set(['CARE_WORKER'])

/** Legacy Dashboard URLs remain useful for staff; managers use Mission Control. */
export function getDashboardEntryPath(role: unknown): '/dashboard' | '/mission-control' {
  return typeof role === 'string' && STAFF_ROLES.has(role) ? '/dashboard' : '/mission-control'
}
