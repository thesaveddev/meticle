/**
 * The phone's three surfaces, and the tab set each one is given.
 *
 * The shell used to ask `isManager`. That is a role test, and a role test has one
 * answer for every role its author did not think about — which is why a
 * `COMPLIANCE_OFFICER` was handed the field app: a Today screen of visits that
 * were never theirs, an Earnings tab for shifts they do not work, a Schedule
 * they could not claim from, and an empty rota that read as a quiet day. The web
 * app branches on permissions; the phone cannot, because the session it keeps
 * carries no permission list, so it branches on what the person is here to do:
 *
 *   - `field`     — deliver the care. Today's visits, the week's shifts, clocking
 *                   on and off, handover, and the money those shifts earn.
 *   - `oversight` — read the service. The people, the policies that govern their
 *                   care, notifications, and nothing that implies a visit of
 *                   one's own (blueprint §4.3, §9.8).
 *   - `companion` — run the service from the phone: the manager's dashboard, the
 *                   rota and claim approvals, alongside their web workspace.
 *
 * A role maps to exactly one surface and a surface to exactly one tab set, so the
 * shell never tests a role again. Anything a surface must not offer — the
 * open-call marketplace, clocking on, availability and leave requests — is
 * decided here, once, rather than at each call site.
 */
import type { MobileUser, UserRole } from '../types'

export type Surface = 'field' | 'oversight' | 'companion'

export type TabKey =
  | 'today'
  | 'schedule'
  | 'chat'
  | 'mileage'
  | 'settings'
  | 'clients'
  | 'visits'
  | 'policies'

export interface SurfaceTab {
  key: TabKey
  label: string
}

const FIELD_TABS: SurfaceTab[] = [
  { key: 'today', label: 'Today' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'chat', label: 'Chat' },
  { key: 'mileage', label: 'Earnings' },
  { key: 'settings', label: 'Settings' },
]

/**
 * What a compliance officer gets. No Today, because there is no round of visits
 * to be on; no Earnings, because no shift of theirs earns any; no Schedule,
 * because a rota they cannot claim from is a rota that only ever looks empty.
 * The header's notification bell is on every surface, so notices arrive here
 * too — the tab that is theirs alone is the policies they are accountable for.
 */
const OVERSIGHT_TABS: SurfaceTab[] = [
  { key: 'clients', label: 'Clients' },
  { key: 'policies', label: 'Policies' },
  { key: 'chat', label: 'Chat' },
  { key: 'settings', label: 'Settings' },
]

const COMPANION_TABS: SurfaceTab[] = [
  { key: 'today', label: 'Team' },
  { key: 'clients', label: 'Clients' },
  { key: 'visits', label: 'Visits' },
  { key: 'chat', label: 'Chat' },
  { key: 'settings', label: 'Settings' },
]

/**
 * Which surface each role gets.
 *
 * A `Record<UserRole, Surface>` on purpose: a role added to the shared union
 * without a decision here fails the type check, rather than silently inheriting
 * the field app — which is the failure this file exists to end.
 */
const SURFACE_BY_ROLE: Record<UserRole, Surface> = {
  CARE_WORKER: 'field',
  COMPLIANCE_OFFICER: 'oversight',
  MANAGER: 'companion',
  ORG_ADMIN: 'companion',
}

export function surfaceOf(user?: Pick<MobileUser, 'role'> | null): Surface {
  // Before the session resolves there is no role and no tab bar to build; the
  // field surface is the default the shell already had.
  if (!user?.role) return 'field'
  return SURFACE_BY_ROLE[user.role] || 'field'
}

export function tabsForSurface(surface: Surface): SurfaceTab[] {
  switch (surface) {
    case 'oversight':
      return OVERSIGHT_TABS
    case 'companion':
      return COMPANION_TABS
    case 'field':
    default:
      return FIELD_TABS
  }
}
