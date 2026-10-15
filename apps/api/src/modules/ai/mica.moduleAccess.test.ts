import { describe, expect, it } from 'vitest'
import { UserRole } from '@meticle/shared'
import { buildModuleAccess } from './mica.moduleAccess'
import { getAvailableModules, ROLE_DEFAULTS } from '../permissions/permissions.controller'
import { pageAccessFor } from './mica.facts'

/**
 * The module half of a page's gate.
 *
 * This is the half that decides whether `ModuleGuard` would let the carer in, so
 * every case below is really asking one question: does `buildModuleAccess` agree
 * with the answer the guard gets from `GET /permissions/:userId`? The two inputs
 * are the organisation's service model and the caller's own rows, so they are what
 * the cases vary.
 *
 * The properties worth holding, in the order they can go wrong:
 *
 *   1. Availability is the endpoint's own function, not a list restated here.
 *   2. A primary service model is authoritative (a domiciliary org that also
 *      carries a legacy supported-living value does not get supported-living
 *      modules).
 *   3. The caller's own row beats their role's default; the default beats `'none'`;
 *      an unknown role is `'none'` everywhere.
 *   4. A permission cannot conjure a module the organisation does not have.
 */
describe('buildModuleAccess', () => {
  it('uses the availability the permissions endpoint itself computes', () => {
    const input = { serviceTypes: ['supported_living', 'domiciliary'], role: UserRole.MANAGER }

    expect(buildModuleAccess(input).available).toEqual(
      getAvailableModules(input.serviceTypes, null),
    )
  })

  it('lets the primary service model decide, over a legacy secondary value', () => {
    // The same rule `requireServiceType` and `ModuleGuard` both apply: an org that
    // has moved to domiciliary does not keep its supported-living modules because an
    // old value is still in the array.
    const access = buildModuleAccess({
      serviceTypes: ['domiciliary', 'supported_living'],
      primaryServiceType: 'domiciliary',
      role: UserRole.ORG_ADMIN,
    })

    expect(access.available).toContain('homecare')
    expect(access.levels.homecare).toBe('edit')
    expect(access.available).not.toContain('tasks')
    expect(access.available).not.toContain('room_checks')
  })

  it('provides only the shared modules to an organisation with no service model at all', () => {
    // A half-configured organisation is not an open one: the shared care-record
    // modules are available and the care-model-specific ones are not, which is what
    // the endpoint returns for it.
    const access = buildModuleAccess({ serviceTypes: [], primaryServiceType: null, role: UserRole.ORG_ADMIN })

    expect(access.available).toContain('people')
    expect(access.available).toContain('compliance')
    expect(access.available).not.toContain('tasks')
    expect(access.available).not.toContain('call_scheduling')
  })

  it("reads the caller's own row before their role's default", () => {
    // A care worker has no `tasks` permission by default — the action that creates
    // one names CARE_WORKER, the page does not — so a grant is exactly the row an
    // admin would have added.
    const defaulted = buildModuleAccess({ serviceTypes: ['supported_living'], role: UserRole.CARE_WORKER })
    expect(defaulted.levels.tasks).toBe('none')
    expect(ROLE_DEFAULTS.CARE_WORKER.tasks).toBe('none')

    const granted = buildModuleAccess({
      serviceTypes: ['supported_living'],
      role: UserRole.CARE_WORKER,
      overrides: { tasks: 'view' },
    })
    expect(granted.levels.tasks).toBe('view')

    // And in the other direction: a default of 'edit' is not a floor.
    const revoked = buildModuleAccess({
      serviceTypes: ['supported_living'],
      role: UserRole.MANAGER,
      overrides: { scheduling: 'none' },
    })
    expect(revoked.levels.scheduling).toBe('none')
  })

  it('gives every module to a role it does not know, at no level', () => {
    // "No role" is not a wider role: availability still comes from the
    // organisation, and every level is the fail-closed one.
    const access = buildModuleAccess({ serviceTypes: ['supported_living', 'domiciliary'], role: undefined })

    expect(access.available).toContain('people')
    expect(Object.values(access.levels).every((level) => level === 'none')).toBe(true)
  })

  it('cannot be granted a module the organisation does not have', () => {
    // An override row on a module outside the service model is not a level for it —
    // `levels` is built over `available` — so the gate for a page gated on it stays
    // shut. This is the shape a stale grant takes after an org changes care model.
    const access = buildModuleAccess({
      serviceTypes: ['domiciliary'],
      primaryServiceType: 'domiciliary',
      role: UserRole.ORG_ADMIN,
      overrides: { tasks: 'edit', room_checks: 'edit' },
    })

    expect(access.levels.tasks).toBeUndefined()
    expect(pageAccessFor('/tasks', UserRole.ORG_ADMIN, access)).toBe(false)
    // The module it does have is open, with the level it was given.
    expect(pageAccessFor('/homecare', UserRole.ORG_ADMIN, access)).toBe(true)
  })
})
