/**
 * The API specification must not be public in production.
 *
 * `setupSwagger` was called unconditionally, so https://<host>/api/docs.json
 * answered any anonymous request and published every route in the API —
 * including the billing webhook and the file-serving endpoints. It is
 * reconnaissance, and it widened the content security policy on /docs to
 * script-src 'unsafe-eval'. This test exists so the guard cannot be removed
 * silently by a well-meaning "restore the docs in prod" change.
 */
import express from 'express'
import request from 'supertest'
import { setupSwagger } from '../index'

function appWithSwagger() {
  const app = express()
  app.get('/ping', (_req, res) => { res.json({ ok: true }) })
  app.get('/metrics', (_req, res) => { res.type('text/plain').send('up') })
  setupSwagger(app)
  return app
}

describe('Swagger exposure', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalFlag = process.env.SWAGGER_ENABLED

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalFlag === undefined) delete process.env.SWAGGER_ENABLED
    else process.env.SWAGGER_ENABLED = originalFlag
  })

  it('is available in development, where developers need it', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.SWAGGER_ENABLED
    const response = await request(appWithSwagger()).get('/docs.json')
    expect(response.status).toBe(200)
    expect(response.body.paths).toHaveProperty('/ping')
  })

  it('is not registered at all in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SWAGGER_ENABLED
    // Mounted only when the guard passes, so the route simply does not exist and
    // Express falls through to its own 404 rather than serving a spec.
    const response = await request(appWithSwagger()).get('/docs.json')
    expect(response.status).toBe(404)
  })

  it('does not serve the docs UI in production either', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SWAGGER_ENABLED
    const response = await request(appWithSwagger()).get('/docs/')
    expect(response.status).toBe(404)
  })

  it('can be turned on deliberately, so staging is not a dead end', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SWAGGER_ENABLED = 'true'
    const response = await request(appWithSwagger()).get('/docs.json')
    expect(response.status).toBe(200)
  })

  it('leaves unrelated routes working when it is off', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SWAGGER_ENABLED
    expect((await request(appWithSwagger()).get('/ping')).status).toBe(200)
  })
})
