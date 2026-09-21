import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Contact — public form', () => {
  it('should accept a valid contact submission (no auth)', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'John Doe', email: 'john@example.com', company: 'Example Care', message: 'I would like a demo of the platform.', privacyConsent: true, marketingConsent: false })
    expect(res.status).toBe(201)
  })

  it('should reject a submission with an invalid email', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'John Doe', email: 'not-an-email', company: 'Example Care', message: 'Hello', privacyConsent: true })
    expect(res.status).toBe(400)
  })

  it('should reject a submission missing required fields', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'John Doe' })
    expect(res.status).toBe(400)
  })

  it('should require explicit privacy consent', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'John Doe', email: 'john-consent@example.com', company: 'Example Care', message: 'Hello' })
    expect(res.status).toBe(400)
  })
})
