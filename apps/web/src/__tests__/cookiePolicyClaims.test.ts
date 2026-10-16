/**
 * The cookie policy has to describe the cookies that exist, and nothing else.
 *
 * It did not. It listed a "CSRF token" cookie that no part of the product sets or
 * reads — CSRF is handled by `SameSite=Lax` on the two cookies that are real, plus
 * bearer-token API auth — and it described preferences ("your selected
 * organisation and role") as a cookie when they live in `localStorage`. A policy
 * that invents a cookie is not a harmless over-disclosure: it tells a reader the
 * product has a protection it does not have, and it points a data-protection
 * query at the wrong data store. This is the same defect class as T0-6i's
 * regulator claims, so it gets the same treatment — the claim is checked against
 * the code it describes.
 *
 * The inventory is read out of the API rather than restated here: `res.cookie(`
 * is the only way a cookie is set in this codebase, so it is the only list that
 * cannot drift from the product.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const POLICY = readFileSync(join(process.cwd(), 'src/pages/legal/CookiePolicyPage.tsx'), 'utf8')

function apiSourceFiles(): string[] {
  const root = join(process.cwd(), '..', 'api', 'src')
  if (!existsSync(root)) throw new Error(`cookie policy guard: expected API source root ${root}`)
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue
        walk(p)
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        out.push(p)
      }
    }
  }
  walk(root)
  return out
}

/** Cookie names the API sets, from the one call that sets them. */
function cookiesTheApiSets(): string[] {
  const names = new Set<string>()
  for (const file of apiSourceFiles()) {
    const code = readFileSync(file, 'utf8')
    for (const match of code.matchAll(/res\.cookie\(\s*'([^']+)'/g)) names.add(match[1])
  }
  return [...names].sort()
}

describe('the cookie policy matches the cookies that exist', () => {
  it('names every cookie the API sets', () => {
    const cookies = cookiesTheApiSets()
    // If this list is empty the guard is scanning nothing and would pass vacuously.
    expect(cookies.length).toBeGreaterThan(0)
    const missing = cookies.filter(name => !POLICY.includes(name))
    expect(missing.join(', ')).toBe('')
  })

  it('claims no cookie the product does not set', () => {
    // Every cookie-shaped name in the policy has to be one the API sets, or one
    // of the two Stripe sets on the billing page.
    const STRIPE_COOKIES = ['__stripe_mid', '__stripe_sid']
    // Only the list entries: a `<strong>` elsewhere ("Stripe — our payment
    // processor") is prose, not a claimed cookie name.
    const claimed = [...POLICY.matchAll(/<li>\s*<strong>([A-Za-z0-9_-]+)<\/strong>/g)].map(m => m[1])
    const allowed = new Set([...cookiesTheApiSets(), ...STRIPE_COOKIES])
    const invented = claimed.filter(name => !allowed.has(name))
    expect(invented.join(', ')).toBe('')
  })

  it('does not present a CSRF cookie, because no CSRF mechanism exists', () => {
    const csrfInApi = apiSourceFiles().some(file => /csrf/i.test(readFileSync(file, 'utf8')))
    expect(csrfInApi, 'a CSRF mechanism now exists — the policy may legitimately describe it').toBe(false)
    expect(POLICY).not.toMatch(/<strong>CSRF[^<]*<\/strong>\s*—/)
  })

  it('discloses local storage wherever the policy describes a stored preference', () => {
    // The product keeps the session, organisation, role and appearance settings in
    // localStorage. A cookie policy that describes them as cookies is describing
    // the wrong store.
    expect(POLICY).toMatch(/local storage/i)
    expect(POLICY).toMatch(/organisation and role/i)
  })
})
