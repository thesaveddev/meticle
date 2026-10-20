/**
 * The web app's session is a pair of httpOnly cookies, and this file is what
 * says so in the one place that can be wrong about it.
 *
 * The cookies were always *set* — `setTokenCookies` has run on login since the
 * API was written — but nothing read them, so the web client carried a bearer
 * token in localStorage and the cookie was decoration. T1-10 of
 * `docs/GO_LIVE_READINESS.md` recorded the choice as one of two: delete the
 * write, or make the cookie the session. It is the session now, and the
 * consequence worth testing is the one a reviewer would ask about first: a
 * sign-out has to end it.
 *
 * That is why the last test is here rather than in a UI test. Clearing
 * `localStorage` ends nothing on a cookie session, so a sign-out that forgets
 * to revoke or to clear leaves the next person on a shared device holding the
 * previous user's care records — the failure is silent, and it is a care-record
 * privacy failure rather than a session-ux one.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** The cookie jar a browser would keep, read out of `Set-Cookie`. */
function jarFrom(res: request.Response): Record<string, string> {
  const jar: Record<string, string> = {}
  for (const header of ((res.headers['set-cookie'] as unknown as string[]) || [])) {
    const [pair] = header.split(';')
    const separator = pair.indexOf('=')
    if (separator > 0) jar[pair.slice(0, separator)] = pair.slice(separator + 1)
  }
  return jar
}

function cookieHeader(jar: Record<string, string>, names: string[]): string {
  return names.map(name => `${name}=${jar[name] ?? ''}`).join('; ')
}

function setCookieHeaders(res: request.Response): string[] {
  return ((res.headers['set-cookie'] as unknown as string[]) || [])
}

/** A signed-in user, plus the cookies their browser would now hold. */
async function signedIn(role = 'ORG_ADMIN') {
  const org = await createOrg()
  const email = `cookie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`
  await createUser({ email, password: 'TestPass123!', role, organization_id: org.id })
  const login = await request(app).post('/auth/login').send({ email, password: 'TestPass123!' })
  expect(login.status).toBe(200)
  return { email, login, jar: jarFrom(login) }
}

describe('Auth session cookies', () => {
  it('issues the session as httpOnly, SameSite cookies at login', async () => {
    const { jar } = await signedIn()

    expect(jar.accessToken).toBeTruthy()
    expect(jar.refreshToken).toBeTruthy()

    const issued = setCookieHeaders((await signedIn()).login).join('\n')
    expect(issued).toMatch(/HttpOnly/i)
    expect(issued).toMatch(/SameSite=Lax/i)
    // The token still travels in the body for the mobile app, which has no
    // cookie jar: this change adds a client, it does not remove one.
  }, 30_000)

  it('authenticates a request that presents nothing but the cookie', async () => {
    const { email, jar } = await signedIn()

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', cookieHeader(jar, ['accessToken']))

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(email)
  }, 30_000)

  it('refuses a request with no credential at all', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('still accepts the bearer header, which is how the mobile app signs in', async () => {
    const { email, login } = await signedIn()

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(email)
  }, 30_000)

  it('renews the session from the refresh cookie alone, with no body', async () => {
    const { jar } = await signedIn()

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(jar, ['refreshToken']))

    expect(res.status).toBe(200)

    // The renewed session is the cookies that came back with the response, and
    // the test for that is that they authenticate: a refresh that answered 200
    // without re-issuing a usable cookie would be the silent expiry this guards
    // against. (The token strings are not compared — the access token carries a
    // second-resolution `iat`, so two issued in the same second are identical
    // by construction and that comparison would prove nothing either way.)
    const rotated = jarFrom(res)
    expect(rotated.accessToken).toBeTruthy()
    const me = await request(app).get('/auth/me').set('Cookie', cookieHeader(rotated, ['accessToken']))
    expect(me.status).toBe(200)
  }, 30_000)

  it('refuses a refresh with neither a cookie nor a body token', async () => {
    const res = await request(app).post('/auth/refresh').send({})
    expect(res.status).toBe(401)
  })

  it('ends the session on logout: the cookies are cleared and the token is revoked', async () => {
    const { jar } = await signedIn()
    const cookie = cookieHeader(jar, ['accessToken', 'refreshToken'])

    // It is the cookie that authenticates this request, so the sign-out is not
    // merely clearing state the browser already holds.
    const out = await request(app).post('/auth/logout').set('Cookie', cookie)
    expect(out.status).toBe(200)

    for (const header of setCookieHeaders(out)) {
      if (!/^(accessToken|refreshToken)=/.test(header)) continue
      expect(header).toMatch(/^(accessToken|refreshToken)=;/)
    }

    // The revoked token must not work even though the client still holds a copy
    // of it — which is exactly the case a browser that ignored the clear header
    // would produce.
    const after = await request(app).get('/auth/me').set('Cookie', cookie)
    expect(after.status).toBe(401)
    expect(after.body.message).toContain('revoked')
  }, 30_000)
})
