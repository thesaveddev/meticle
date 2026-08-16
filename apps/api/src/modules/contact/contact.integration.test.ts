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
      .send({ name: 'John Doe', email: 'john@example.com', message: 'I would like a demo of the platform.' })
    expect(res.status).toBe(200)
  })

  it('should reject a submission with an invalid email', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'John Doe', email: 'not-an-email', message: 'Hello' })
    expect(res.status).toBe(400)
  })

  it('should reject a submission missing required fields', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'John Doe' })
    expect(res.status).toBe(400)
  })
})
