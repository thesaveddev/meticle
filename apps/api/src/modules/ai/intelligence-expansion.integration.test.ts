import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

describe('expanded AI intelligence capabilities', () => {
  it('requires a manager role for the domiciliary operations copilot', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `copilot-worker-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const response = await request(app)
      .post('/ai/operations-copilot')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ window: '14' })

    expect(response.status).toBe(403)
  })

  it('does not let care workers request family communication drafts', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `family-draft-worker-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const response = await request(app)
      .post('/ai/family-communication-draft')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ window: '7' })

    expect(response.status).toBe(403)
  })
})
