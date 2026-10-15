/**
 * The CORS policy had no test coverage, which is how a disallowed `Origin`
 * came to return 500 in production for as long as it did: the rejection was
 * expressed as a thrown Error, and no test ever sent a foreign origin.
 *
 * The express tests below mount the real `cors` middleware with the real policy,
 * because that is the only way to catch the failure. Asserting the callback was
 * invoked with `false` would still pass if someone changed the middleware's
 * handling; asserting the *status code* cannot.
 */
import express from 'express'
import request from 'supertest'
import cors from 'cors'
import { describe, it, expect } from 'vitest'
import { resolveAllowedOrigins, corsOrigin } from './corsOrigin'

const ALLOWED = 'https://meticlecare.com'
const FOREIGN = 'https://evil.example.com'

function appWith(origins: string[] | undefined) {
  const app = express()
  app.use(cors({ origin: corsOrigin(origins), credentials: true }))
  app.get('/health/ready', (_req, res) => { res.json({ status: 'ok' }) })
  return app
}

describe('resolveAllowedOrigins', () => {
  it('uses CORS_ORIGINS when it is set, trimming and dropping empties', () => {
    expect(resolveAllowedOrigins({ CORS_ORIGINS: ' https://a.example , ,https://b.example ' } as any))
      .toEqual(['https://a.example', 'https://b.example'])
  })

  it('falls back to the production domains in production', () => {
    expect(resolveAllowedOrigins({ NODE_ENV: 'production' } as any))
      .toEqual([ALLOWED, 'https://www.meticlecare.com'])
  })

  it('returns no allowlist outside production, so local ports keep working', () => {
    expect(resolveAllowedOrigins({ NODE_ENV: 'development' } as any)).toBeUndefined()
  })

  it('lets an explicit CORS_ORIGINS win over the production default', () => {
    expect(resolveAllowedOrigins({ NODE_ENV: 'production', CORS_ORIGINS: ALLOWED } as any))
      .toEqual([ALLOWED])
  })
})

describe('corsOrigin', () => {
  it('allows a request with no Origin header — curl and the mobile app send none', async () => {
    const res = await request(appWith([ALLOWED])).get('/health/ready')
    expect(res.status).toBe(200)
  })

  it('allows an allowlisted origin and returns it in the header', async () => {
    const res = await request(appWith([ALLOWED])).get('/health/ready').set('Origin', ALLOWED)
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('permits everything when there is no allowlist (development)', async () => {
    const res = await request(appWith(undefined)).get('/health/ready').set('Origin', FOREIGN)
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe(FOREIGN)
  })

  // The regression this module exists for.
  it('answers a foreign GET with a normal response, not a 500', async () => {
    const res = await request(appWith([ALLOWED])).get('/health/ready').set('Origin', FOREIGN)
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('answers a foreign preflight without an error status', async () => {
    const res = await request(appWith([ALLOWED]))
      .options('/health/ready')
      .set('Origin', FOREIGN)
      .set('Access-Control-Request-Method', 'POST')
    expect(res.status).toBeLessThan(400)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('answers an allowlisted preflight with 204 and the CORS headers', async () => {
    const res = await request(appWith([ALLOWED]))
      .options('/health/ready')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(res.headers['access-control-allow-methods']).toContain('POST')
  })
})
