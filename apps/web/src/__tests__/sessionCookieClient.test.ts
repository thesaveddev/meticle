/**
 * The web app's session is a cookie, and this is the guard that keeps it that
 * way — the counterpart to `cookiePolicyClaims.test.ts`, which keeps the
 * published policy honest about the same two cookies.
 *
 * The migration is worth a test because it is the kind of change that comes back
 * a file at a time. `localStorage` is the path of least resistance for a new
 * page that needs a credential ("just read the token like the others do"), and
 * the moment one page does, the session exists in two places with two lifetimes:
 * a token that outlives `POST /auth/logout` because clearing the browser cannot
 * clear an httpOnly cookie, and an XSS-readable token for a session the policy
 * says no script can read.
 *
 * The last test reaches across into the API's source for the same reason the
 * cookie-policy guard does: the browser side of this only makes sense if the
 * server actually reads the cookie, and a comment claiming it does is not
 * evidence.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(root: string, out: string[] = []): string[] {
  if (!existsSync(root)) throw new Error(`session guard: expected source root ${root}`)
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      sourceFiles(path, out)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(path)
    }
  }
  return out
}

const WEB_SRC = join(process.cwd(), 'src')
const API_SRC = join(process.cwd(), '..', 'api', 'src')

function filesMatching(pattern: RegExp, files = sourceFiles(WEB_SRC)): string[] {
  return files
    .filter(file => pattern.test(readFileSync(file, 'utf8')))
    .map(file => file.replace(/^.*apps[\\/]web[\\/]/, ''))
}

describe('the web client holds no session token', () => {
  it('never writes an access or refresh token to local storage', () => {
    // `removeItem` is allowed and expected: it is what clears the keys an older
    // build left behind.
    expect(filesMatching(/localStorage\.setItem\(\s*'(access|refresh)Token'/).join(', ')).toBe('')
  })

  it('never reads one either', () => {
    expect(filesMatching(/localStorage\.getItem\(\s*'(access|refresh)Token'/).join(', ')).toBe('')
  })

  it('attaches an Authorization header by hand only for the compliance portal', () => {
    // The portal is a different product with a different credential
    // (`portal_token`, held in localStorage because the portal is not the app's
    // session). Everything else is authenticated by the cookie the browser sends
    // itself, so api.ts must not be building bearer headers for it.
    const api = readFileSync(join(WEB_SRC, 'services', 'api.ts'), 'utf8')
    expect(api).toContain('portal_token')

    // Every bearer header the client builds by hand must be the portal token,
    // and there must be no session token left for it to build one from.
    const bearerLines = api.split('\n').filter(line => /Bearer \$/.test(line))
    expect(bearerLines.filter(line => !line.includes('portalToken')).join(', ')).toBe('')
  })

  it('is authenticated by a cookie the API actually reads', () => {
    const middleware = readFileSync(join(API_SRC, 'shared', 'middleware', 'auth.middleware.ts'), 'utf8')
    expect(middleware).toMatch(/req\.cookies\?\.accessToken/)
    // The bearer header has to keep working: the mobile app sends the token it
    // holds in expo-secure-store and has no cookie at all.
    expect(middleware).toMatch(/req\.headers\.authorization/)
  })

  it('renews the session from the cookie, not from a stored token', () => {
    const api = readFileSync(join(WEB_SRC, 'services', 'api.ts'), 'utf8')
    expect(api).toMatch(/axios\.post\('\/api\/auth\/refresh', \{\}, \{ withCredentials: true \}\)/)
  })
})
