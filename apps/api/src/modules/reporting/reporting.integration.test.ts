import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Reporting â€” registry, data, CSV export', () => {
  it('should list reports, fetch data and export CSV', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `re-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const reports = await request(app)
      .get('/reporting/reports')
      .set('Authorization', `Bearer ${token}`)
    expect(reports.status).toBe(200)
    expect(reports.body.reports.length).toBeGreaterThan(0)

    const data = await request(app)
      .get('/reporting/data/incident-summary')
      .set('Authorization', `Bearer ${token}`)
    expect(data.status).toBe(200)

    const exportRes = await request(app)
      .get('/reporting/export/incident-summary')
      .query({ format: 'csv' })
      .set('Authorization', `Bearer ${token}`)
    expect(exportRes.status).toBe(200)

    const unknown = await request(app)
      .get('/reporting/data/not-a-report')
      .set('Authorization', `Bearer ${token}`)
    expect(unknown.status).toBe(400)
  })

  it('should reject a CARE_WORKER reading reports (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `re2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/reporting/reports')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/reporting/reports')
    expect(res.status).toBe(401)
  })
})
