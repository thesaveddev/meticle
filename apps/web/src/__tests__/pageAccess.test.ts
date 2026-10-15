/**
 * The page-access table is generated from *this* router and read by the server.
 *
 * `scripts/design/route-access.mjs` reads `App.tsx` and writes
 * `packages/shared/src/pageAccess.generated.ts`, which the API's Mica reads before
 * offering to open a page from a spoken answer. The generated file is committed,
 * so the two can drift: restrict a route here, and until somebody regenerates,
 * the server still offers the door this file just closed. `design:check` gates
 * that in CI, and the design job's own tests assert the derivation — this runs the
 * generator the way a person would, in the suite they run while working, so the
 * failure shows up in the loop that made the change rather than two jobs later.
 *
 * The gates asserted below are not arbitrary: they are the ones Mica's four page
 * offers are derived from, so if one moves, the offers move with it.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_ACCESS, UserRole } from '@meticle/shared'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

describe('the generated page-access table', () => {
  it('matches the router', () => {
    // Exits 0 when the committed table is current, 1 (with an explanation on
    // stderr) when the router has changed since it was written.
    const run = () =>
      execFileSync(process.execPath, ['scripts/design/route-access.mjs'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      })

    expect(run, 'the table is stale; run npm run design:sync').not.toThrow()
  })

  it('carries the gates the server offers pages from', () => {
    // `/training` is the one Mica's table used to restate by hand, and the reason
    // it must not: the answer is speakable for a care worker while the page is not.
    expect(PAGE_ACCESS['/training']).toMatchObject({ authenticated: true })
    expect(PAGE_ACCESS['/training'].roles).toEqual([
      UserRole.ORG_ADMIN,
      UserRole.MANAGER,
      UserRole.COMPLIANCE_OFFICER,
    ])

    // These name no roles, so the server may offer them to any caller it serves.
    expect(PAGE_ACCESS['/scheduling'].roles).toBeNull()
    expect(PAGE_ACCESS['/leave'].roles).toBeNull()
    expect(PAGE_ACCESS['/appointments'].roles).toEqual([
      UserRole.ORG_ADMIN,
      UserRole.MANAGER,
      UserRole.CARE_WORKER,
    ])
  })

  it('distinguishes a restricted page from a public one', () => {
    // Public routes must never be offered as a destination — they are outside the
    // authenticated area entirely, which is a different fact from "no role gate".
    for (const path of ['/pricing', '/login', '/privacy', '/']) {
      expect(PAGE_ACCESS[path]?.authenticated, path).toBe(false)
    }
    for (const path of ['/training', '/scheduling', '/leave', '/appointments', '/dashboard']) {
      expect(PAGE_ACCESS[path]?.authenticated, path).toBe(true)
    }
  })
})
