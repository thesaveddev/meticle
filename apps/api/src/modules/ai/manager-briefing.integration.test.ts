import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('AI manager briefing', () => {
  it('requires AI configuration and allows managers to request it', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `brief-manager-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const response = await request(app)
      .post('/ai/manager-briefing')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: '2026-09-01', to: '2026-09-07' })

    expect(response.status).toBe(400)
    expect(response.body.message || response.body.error?.message).toContain('AI not configured')
  })

  it('rejects care workers before any AI request', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `brief-worker-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const response = await request(app)
      .post('/ai/manager-briefing')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ from: '2026-09-01', to: '2026-09-07' })

    expect(response.status).toBe(403)
  })
})
