import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

describe('AI intelligence capabilities', () => {
  it('does not allow a care worker to use manager risk signals', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `intel-worker-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const response = await request(app)
      .post('/ai/risk-signals')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ from: '2026-09-01', to: '2026-09-07' })

    expect(response.status).toBe(403)
  })

  it('requires a person id for a person care summary', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `intel-manager-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const response = await request(app)
      .post('/ai/care-summary')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: '2026-09-01', to: '2026-09-07' })

    expect(response.status).toBe(400)
    expect(response.body.error?.message || response.body.message).toContain('AI not configured')
  })
})
