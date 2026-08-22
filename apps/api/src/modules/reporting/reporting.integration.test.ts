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
  it('should list reports, fetch the overview, and expose filter options', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `re-overview-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const reports = await request(app)
      .get('/reporting/reports')
      .set('Authorization', `Bearer ${token}`)
    expect(reports.status).toBe(200)
    expect(reports.body.reports.length).toBeGreaterThan(0)

    const overview = await request(app)
      .get('/reporting/overview')
      .set('Authorization', `Bearer ${token}`)
    expect(overview.status).toBe(200)
    expect(Array.isArray(overview.body.cards)).toBe(true)
    expect(Array.isArray(overview.body.attention)).toBe(true)

    const options = await request(app)
      .get('/reporting/filter-options')
      .set('Authorization', `Bearer ${token}`)
    expect(options.status).toBe(200)
    expect(Array.isArray(options.body.locations)).toBe(true)
    expect(Array.isArray(options.body.departments)).toBe(true)
  })

  it('should load every registered report without a server error', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `re-all-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)
    const reports = await request(app).get('/reporting/reports').set('Authorization', `Bearer ${token}`)
    expect(reports.status).toBe(200)

    const results = await Promise.all(reports.body.reports.map(async (report: { id: string }) => ({
      id: report.id,
      response: await request(app).get(`/reporting/data/${report.id}`).set('Authorization', `Bearer ${token}`),
    })))
    const failures = results.filter(({ response }) => response.status !== 200).map(({ id, response }) => ({ id, status: response.status, body: response.body }))
    expect(failures).toEqual([])
  })

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
