import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STAFF_LOCATION_NOTICE_KEY, STAFF_LOCATION_NOTICE_VERSION } from './staffLocationNotice'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')
const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8')

/**
 * Reads the mobile notice rather than importing it.
 *
 * The apps do not share a package, and wiring one up for a string constant
 * would be more moving parts than the constant is worth. So this reads the file
 * and compares. That is a weaker check than a real import — a refactor of the
 * mobile module that kept the exported names but changed how the value is
 * derived would slip past — and it is deliberate: the thing that has to hold is
 * that the version stamped on a record is the version a carer was shown, and
 * this is where a mismatch would otherwise be invisible until an ICO enquiry.
 */
describe('the carer location notice version', () => {
  it('is the same on the server as in the text the app displays', () => {
    const mobile = read('apps/mobile/src/content/staffLocationNotice.ts')
    expect(mobile).toContain(`STAFF_LOCATION_NOTICE_VERSION = '${STAFF_LOCATION_NOTICE_VERSION}'`)
    expect(mobile).toContain(`STAFF_LOCATION_NOTICE_KEY = '${STAFF_LOCATION_NOTICE_KEY}'`)
  })

  it('is not the old version, which is the mistake a stale copy makes silently', () => {
    // Spelled out rather than left implicit: a failure here should say which
    // version is wrong, not just show a diff of two identical-shaped strings.
    expect(STAFF_LOCATION_NOTICE_VERSION).toBe('1.1')
  })
})

/**
 * The control only means something if the record is the worker's own. These
 * read the source because a manager-facing write path would be invisible to a
 * test that only exercises the happy route.
 */
describe('the decision record', () => {
  it('has no route by which a manager can record a decision for someone else', () => {
    const routes = read('apps/api/src/modules/homecare/homecare.routes.ts')
    const writes = routes.split('\n').filter(l => l.includes('/location-decision') && l.includes('router.post'))
    // One write, at the worker's own endpoint, with no user id in the path.
    expect(writes).toHaveLength(1)
    expect(writes[0]).toContain("router.post('/location-decision'")
    expect(routes).not.toMatch(/location-decision[s]?\/:\w*user/)
  })

  it('scopes the stored row to the signed-in worker rather than anything posted', () => {
    const controller = read('apps/api/src/modules/homecare/homecare.controller.ts')
    // The insert takes the org from the session, so a posted body cannot move a
    // decision into another organisation's evidence view.
    expect(controller).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, NOW\(\)\)/)
    expect(controller).toMatch(/\[userId\(req\), orgId\(req\), decision, notice_key, notice_version, app_version \?\? null\]/)
  })

  it('records the direction in the audit action, so a refusal is not filed as an update', () => {
    const controller = read('apps/api/src/modules/homecare/homecare.controller.ts')
    expect(controller).toContain("decision === 'agreed' ? 'agree' : 'decline'")
  })
})
