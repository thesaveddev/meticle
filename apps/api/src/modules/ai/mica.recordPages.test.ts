import { describe, expect, it } from 'vitest'
import { UserRole } from '@meticle/shared'
import { recordPageFor, recordRefFromWrite } from './mica.recordPages'
import { buildModuleAccess } from './mica.moduleAccess'
import { MODULES } from '../permissions/permissions.controller'
import { PAGE_ACCESS } from '@meticle/shared'

/**
 * The caller's modules, in the two shapes these tests need: a real map from the
 * same function the permissions endpoint uses (`buildModuleAccess`), and an open
 * one, for isolating the role half of the gate.
 */
const realModules = (role: UserRole, overrides: Record<string, string> = {}) =>
  buildModuleAccess({
    serviceTypes: ['supported_living', 'domiciliary'],
    role,
    overrides,
  })

const EVERYTHING = realModules(UserRole.ORG_ADMIN)

/**
 * The page behind a written record.
 *
 * Two things are being held here, and they are separate properties:
 *
 *   1. The link. A record's page is a route *with the record in it*, so the shape
 *      of that link is the contract between this module and the page that reads it
 *      (`MICA_RECORD_PARAMS` in `@meticle/shared`). Each case asserts the literal
 *      path, because a link that is merely "truthy" is the failure this exists to
 *      prevent: a carer who follows it lands on an unfiltered list and never
 *      learns why.
 *   2. The gate. A record Mica cannot show this caller is not offered at all, and
 *      that answer is the router's own (`/appointments` names three roles;
 *      `/tasks` and `/people/:id` name none and are gated by module).
 */
describe('recordPageFor', () => {
  it('links a task to the tasks page, with the id the page opens it from', () => {
    // A care worker whose `tasks` permission was granted: the router names no role
    // for `/tasks`, so the module is the whole of this caller's gate.
    const page = recordPageFor(
      { kind: 'task', id: 'a1b2' },
      UserRole.CARE_WORKER,
      realModules(UserRole.CARE_WORKER, { tasks: 'view' }),
    )

    expect(page?.path).toBe('/tasks?task=a1b2')
    expect(page?.destination).toBe('tasks')
    expect(page?.label).toBe('the new task')
    // The question the reply ends with — the same shape as a list answer's offer.
    expect(page?.offer).toBe('Want me to open the new task?')
  })

  it('links an appointment to the appointments page', () => {
    const page = recordPageFor({ kind: 'appointment', id: 'c3d4' }, UserRole.MANAGER, realModules(UserRole.MANAGER))

    expect(page?.path).toBe('/appointments?appointment=c3d4')
    expect(page?.destination).toBe('appointments')
    expect(page?.offer).toBe('Want me to open the new appointment?')
  })

  it('links a care note to the note on the profile it belongs to', () => {
    const page = recordPageFor(
      { kind: 'care-note', id: 'n9', personId: 'p7' },
      UserRole.CARE_WORKER,
      realModules(UserRole.CARE_WORKER, { people: 'view' }),
    )

    // The tab slug is `PersonProfilePage`'s own: a slug it does not know would
    // open the profile on its first tab, with the note nowhere in sight.
    expect(page?.path).toBe('/people/p7?tab=daily-notes&source=n9')
    expect(page?.destination).toBe('person')
    expect(page?.label).toBe('the new care note')
  })

  it('encodes what it puts in the query string', () => {
    const page = recordPageFor({ kind: 'task', id: 'not a uuid' }, UserRole.ORG_ADMIN, EVERYTHING)

    // Ids are uuids in practice; a link that breaks on the one that is not is a
    // link that breaks silently.
    expect(page?.path).toBe('/tasks?task=not%20a%20uuid')
  })

  it('offers nothing to a caller the router would not let open the page', () => {
    // `/appointments` names ORG_ADMIN, MANAGER and CARE_WORKER in its AuthGuard.
    // Every other role — and a caller with no role at all — gets no question, so
    // no carer is told to open a door that is locked for them.
    expect(recordPageFor({ kind: 'appointment', id: 'c3d4' }, UserRole.COMPLIANCE_OFFICER, EVERYTHING)).toBeUndefined()
    expect(recordPageFor({ kind: 'appointment', id: 'c3d4' }, UserRole.SUPER_ADMIN, EVERYTHING)).toBeUndefined()
    expect(recordPageFor({ kind: 'appointment', id: 'c3d4' }, undefined, EVERYTHING)).toBeUndefined()

    // And the same write for the roles that may open it does offer the page.
    expect(recordPageFor({ kind: 'appointment', id: 'c3d4' }, UserRole.ORG_ADMIN, EVERYTHING)).toBeDefined()
    expect(recordPageFor({ kind: 'appointment', id: 'c3d4' }, UserRole.CARE_WORKER, EVERYTHING)).toBeDefined()
  })

  it('offers a page the router gates by module and not by role', () => {
    // `/tasks` and `/people/:id` name no roles: `roles: null` is the router saying
    // "every authenticated user", not "no restriction" — so the modules are the
    // whole of the gate, and a caller whose role the table does not mention is
    // offered the page all the same.
    expect(recordPageFor({ kind: 'task', id: 't1' }, undefined, EVERYTHING)?.path).toBe('/tasks?task=t1')
    expect(recordPageFor({ kind: 'care-note', id: 'n1', personId: 'p1' }, UserRole.SUPER_ADMIN, EVERYTHING)?.path)
      .toBe('/people/p1?tab=daily-notes&source=n1')
  })

  it('withholds the record when the module half of the gate is shut', () => {
    // The half the router writes and nothing read. `/tasks` is gated on the `tasks`
    // module with no role list, so a care worker who may create a task — the action
    // names CARE_WORKER — is still not offered the page, because `ModuleGuard`
    // would bounce them to /unauthorized. No question is asked, so no promise is
    // broken.
    expect(
      recordPageFor({ kind: 'task', id: 't1' }, UserRole.CARE_WORKER, realModules(UserRole.CARE_WORKER)),
    ).toBeUndefined()

    // And the other way a module can be shut: the organisation's service model does
    // not provide it. A domiciliary org has no `/appointments` at all, so the same
    // booking an ORG_ADMIN would be asked about is answered with a plain sentence.
    const domiciliary = buildModuleAccess({
      serviceTypes: ['domiciliary'],
      primaryServiceType: 'domiciliary',
      role: UserRole.ORG_ADMIN,
    })
    expect(recordPageFor({ kind: 'appointment', id: 'c3d4' }, UserRole.ORG_ADMIN, domiciliary)).toBeUndefined()
    // The same caller, in the same org, still gets the profile — `people` is shared
    // by every care model.
    expect(
      recordPageFor({ kind: 'care-note', id: 'n1', personId: 'p1' }, UserRole.ORG_ADMIN, domiciliary),
    ).toBeDefined()

    // A caller whose modules were never resolved is not offered a gated page
    // either: "not asked" is not "allowed".
    expect(recordPageFor({ kind: 'task', id: 't1' }, UserRole.ORG_ADMIN, undefined)).toBeUndefined()
  })

  it('only offers records whose page is gated on a module the permissions surface can grant', () => {
    // A page gated on a module `MODULES` does not carry is openable by nobody — the
    // endpoint `ModuleGuard` asks never returns such a module — so an offer built on
    // one would be a promise the router always breaks.
    for (const [kind, accessPath] of [
      ['task', '/tasks'],
      ['appointment', '/appointments'],
      ['care-note', '/people/:id'],
    ] as const) {
      const module = PAGE_ACCESS[accessPath].module
      expect(module, `${kind}'s page declares no module to gate on`).toBeTruthy()
      expect(MODULES, `${kind}'s page is gated on ${module}`).toContain(module)
    }
  })
})

describe('recordRefFromWrite', () => {
  it('reads the record the gateway just created', () => {
    expect(recordRefFromWrite({ taskId: 't1' })).toEqual({ kind: 'task', id: 't1' })
    expect(recordRefFromWrite({ appointmentId: 'a1' })).toEqual({ kind: 'appointment', id: 'a1' })
  })

  it('says nothing when the write produced no record to point at', () => {
    expect(recordRefFromWrite({})).toBeUndefined()
    expect(recordRefFromWrite(undefined)).toBeUndefined()
    expect(recordRefFromWrite({ taskId: '' })).toBeUndefined()
    expect(recordRefFromWrite({ appointmentId: 7 })).toBeUndefined()
  })
})
