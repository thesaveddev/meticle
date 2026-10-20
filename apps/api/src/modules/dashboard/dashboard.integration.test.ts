import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Dashboard — stats endpoints', () => {
  it('should return stats, compliance, today-rota, widgets and review-scheduler for an ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dash-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const paths = ['/dashboard/stats', '/dashboard/compliance', '/dashboard/today-rota', '/dashboard/widgets', '/dashboard/review-scheduler']
    for (const path of paths) {
      const res = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    }
  })

  it('should return 200 for a CARE_WORKER (auth only)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `dash2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(200)
  })

  it('names the staff behind the expiring background checks, with the document the record link needs', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dash-dbs-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)
    const worker = await createUser({ email: `dash-dbs-staff-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ user_id: worker.id, first_name: 'Nadia', last_name: 'Khan' })
    const otherOrg = await createOrg()
    const otherWorker = await createUser({ email: `dash-dbs-other-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: otherOrg.id })
    const otherStaff = await createStaffProfile({ user_id: otherWorker.id, first_name: 'Foreign', last_name: 'Worker' })

    const insert = (staffId: string, type: string, days: number) => migrateQuery(
      `INSERT INTO documents (staff_id, type, status, expiry_date, url)
       VALUES ($1, $2, 'approved', CURRENT_DATE + $3::int, 'https://files.example.com/dbs.pdf') RETURNING id`,
      [staffId, type, days],
    )
    // Two for the same person: the widget counts people, and the reminder opens each
    // person's earliest expiring check rather than listing them all.
    const checklist = await insert(staff.id, 'DBS', 6)
    await insert(staff.id, 'DBS', 21)
    await insert(otherStaff.id, 'DBS', 2)

    const response = await request(app)
      .get('/dashboard/widgets')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.dbs_expiring_soon).toBe(1)
    expect(response.body.dbs_expiring_staff).toHaveLength(1)
    expect(response.body.dbs_expiring_staff[0]).toMatchObject({
      document_id: checklist.rows[0].id,
      staff_user_id: worker.id,
      staff_name: 'Nadia Khan',
      document_type: 'DBS',
      days_until: 6,
    })
    // The count and the list are read with the same filters, so a provider's own
    // staff cannot be counted and then left unnamed.
    expect(JSON.stringify(response.body.dbs_expiring_staff)).not.toContain('Foreign Worker')
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/dashboard/stats')
    expect(res.status).toBe(401)
  })
})
