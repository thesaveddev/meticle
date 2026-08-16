import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createIncidentCategory, createIncident, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Incidents Integration — POST /incidents', () => {
  it('should create an incident as MANAGER', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const cat = await createIncidentCategory({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Slip and Fall', description: 'Person slipped in hallway', severity: 'medium', category_id: cat.id, location: 'Wing B' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Slip and Fall')
    expect(res.body.severity).toBe('medium')
  })

  it('should reject incident creation without auth', async () => {
    const res = await request(app).post('/incidents').send({ title: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('Incidents Integration — GET /incidents', () => {
  it('should list incidents', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createIncident({ organizationId: org.id, title: 'Test Incident Report' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/incidents')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((i: any) => i.title === 'Test Incident Report')).toBe(true)
  })
})

describe('Incidents Integration — GET /incidents/stats', () => {
  it('should return incident stats', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createIncident({ organizationId: org.id, severity: 'high' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/incidents/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBeDefined()
    expect(res.body.reported).toBeDefined()
  })
})

describe('Incidents Integration — GET /incidents/:id', () => {
  it('should return a single incident with involved people and actions', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .get(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(incident.id)
    expect(res.body.involved).toBeDefined()
    expect(res.body.actions).toBeDefined()
  })
})

describe('Incidents Integration — PATCH /incidents/:id', () => {
  it('should update an incident', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .patch(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'investigating', severity: 'high' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('investigating')
  })
})

describe('Incidents Integration — POST /incidents/:id/actions', () => {
  it('should create an action item for an incident', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post(`/incidents/${incident.id}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'Review CCTV footage', assigned_to: user.id, status: 'pending' })

    expect(res.status).toBe(201)
    expect(res.body.action).toBe('Review CCTV footage')
  })
})

describe('Incidents Integration — POST /incidents/:id/involved', () => {
  it('should add involved person to an incident', async () => {
    const org = await createOrg()
    // Create a person reference
    const suId = '00000000-0000-0000-0000-000000000001'
    try {
      await migrateQuery(
        'INSERT INTO people (id, organization_id, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [suId, org.id, 'Test', 'Resident']
      )
    } catch { /* table may not exist */ }
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post(`/incidents/${incident.id}/involved`)
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: suId, involvement_type: 'affected' })

    expect(res.status).toBe(201)
    expect(res.body.person_id).toBe(suId)
  })
})

describe('Incidents Integration — GET /incidents/categories', () => {
  it('should return incident categories', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createIncidentCategory({ organizationId: org.id, name: 'Fall' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/incidents/categories')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('Incidents Integration — full create payload', () => {
  it('should persist near-miss, confidential, CQC and investigation fields', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const cat = await createIncidentCategory({ organizationId: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Medication error', description: 'Wrong dose given', category_id: cat.id,
        incident_date: '2026-08-10', incident_time: '14:30', location: 'Wing B',
        severity: 'high', is_cqc_reportable: true, is_near_miss: true, is_confidential: true,
        root_cause: 'Lookalike packaging', outcomes: 'No harm', investigation_notes: 'Interviewed staff',
        lessons_learned: 'Double-check labels', cqc_reference: 'CQC-123', reported_to_cqc_at: '2026-08-11',
      })

    expect(res.status).toBe(201)
    expect(res.body.is_near_miss).toBe(true)
    expect(res.body.is_confidential).toBe(true)
    expect(res.body.is_cqc_reportable).toBe(true)
    expect(res.body.investigation_notes).toBe('Interviewed staff')
    expect(res.body.lessons_learned).toBe('Double-check labels')
    expect(res.body.root_cause).toBe('Lookalike packaging')
    expect(res.body.cqc_reference).toBe('CQC-123')

    const detail = await request(app)
      .get(`/incidents/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.incident_time).toBe('14:30')
  })

  it('should reject invalid severity with 400', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const token = generateToken(admin)

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad severity', severity: 'extreme' })

    expect(res.status).toBe(400)
  })

  it('should reject invalid status with 400', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const token = generateToken(admin)

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad status', status: 'weird' })

    expect(res.status).toBe(400)
  })
})

describe('Incidents Integration — confidential gating', () => {
  it('should hide confidential incidents from MANAGER but show them to ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    await createStaffProfile({ userId: mgr.id })
    const incident = await createIncident({ organizationId: org.id, title: 'Confidential HR Issue', is_confidential: true })

    const adminRes = await request(app)
      .get(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(adminRes.status).toBe(200)

    const mgrRes = await request(app)
      .get(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
    expect(mgrRes.status).toBe(404)

    const mgrList = await request(app)
      .get('/incidents')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
    expect(mgrList.body.some((i: any) => i.id === incident.id)).toBe(false)

    const mgrStats = await request(app)
      .get('/incidents/stats')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
    expect(mgrStats.body.confidential).toBe(0)

    const mgrPatch = await request(app)
      .patch(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ status: 'investigating' })
    expect(mgrPatch.status).toBe(404)

    const mgrAction = await request(app)
      .post(`/incidents/${incident.id}/actions`)
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ action: 'Should not be allowed' })
    expect(mgrAction.status).toBe(404)
  })
})

describe('Incidents Integration — actions lifecycle', () => {
  it('should update, complete, and delete an action', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post(`/incidents/${incident.id}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'Review policy', assigned_to: mgr.id, due_date: '2026-08-01' })
    expect(created.status).toBe(201)
    const actionId = created.body.id

    const updated = await request(app)
      .patch(`/incidents/${incident.id}/actions/${actionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('in_progress')

    const completed = await request(app)
      .patch(`/incidents/${incident.id}/actions/${actionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
    expect(completed.status).toBe(200)
    expect(completed.body.completed_at).toBeTruthy()
    expect(completed.body.status).toBe('completed')

    const del = await request(app)
      .delete(`/incidents/${incident.id}/actions/${actionId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(204)
  })

  it('should include overdue actions in stats', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(mgr)

    await request(app)
      .post(`/incidents/${incident.id}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'Past due task', assigned_to: mgr.id, due_date: '2020-01-01' })

    const res = await request(app)
      .get('/incidents/stats')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.open_actions).toBe(1)
    expect(res.body.overdue_actions).toBe(1)
  })
})

describe('Incidents Integration — involved people lifecycle', () => {
  it('should add and remove an involved person', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(mgr)
    const personId = '00000000-0000-0000-0000-0000000000aa'
    await migrateQuery(
      'INSERT INTO people (id, organization_id, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [personId, org.id, 'Jane', 'Doe']
    )

    const added = await request(app)
      .post(`/incidents/${incident.id}/involved`)
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: personId, involvement_type: 'witness', notes: 'Saw the incident' })
    expect(added.status).toBe(201)

    const removed = await request(app)
      .delete(`/incidents/${incident.id}/involved/${added.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(removed.status).toBe(204)

    const detail = await request(app)
      .get(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.body.involved.length).toBe(0)
  })
})

describe('Incidents Integration — evidence attachments', () => {
  it('should upload, list, and delete an attachment', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(mgr)

    const upload = await request(app)
      .post(`/incidents/${incident.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('incident evidence note'), 'evidence.txt')
    expect(upload.status).toBe(201)
    expect(upload.body.file_url).toContain('/files/private/')
    const attachmentId = upload.body.id

    const list = await request(app)
      .get(`/incidents/${incident.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((a: any) => a.id === attachmentId)).toBe(true)

    const del = await request(app)
      .delete(`/incidents/${incident.id}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(204)
  })
})

describe('Incidents Integration — categories CRUD', () => {
  it('should create, update, and delete a category as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const token = generateToken(admin)

    const created = await request(app)
      .post('/incidents/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Slip Trip Fall', severity: 'high', is_cqc_reportable: true })
    expect(created.status).toBe(201)

    const updated = await request(app)
      .put(`/incidents/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ severity: 'medium' })
    expect(updated.status).toBe(200)
    expect(updated.body.severity).toBe('medium')

    const deleted = await request(app)
      .delete(`/incidents/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(204)
  })

  it('should block MANAGER from creating categories', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const token = generateToken(mgr)

    const res = await request(app)
      .post('/incidents/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' })
    expect(res.status).toBe(403)
  })
})

describe('Incidents Integration — delete + audit + notifications', () => {
  it('should delete an incident and write audit + notification records', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    await createStaffProfile({ userId: mgr.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'To Be Deleted', severity: 'high' })
    expect(created.status).toBe(201)

    const del = await request(app)
      .delete(`/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(del.status).toBe(204)

    const gone = await request(app)
      .get(`/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(gone.status).toBe(404)

    const audit = await migrateQuery("SELECT * FROM audit_logs WHERE entity_type = 'incident' AND action = 'delete' ORDER BY created_at DESC LIMIT 1")
    expect(audit.rows.length).toBe(1)

    const notifications = await migrateQuery(
      `SELECT * FROM notifications WHERE title LIKE '%reported%' AND user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [admin.id]
    )
    expect(notifications.rows.length).toBe(1)
  })

  it('should write audit rows when creating and updating an incident', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Audited incident' })
    expect(created.status).toBe(201)

    const updated = await request(app)
      .patch(`/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'investigating' })
    expect(updated.status).toBe(200)

    const audit = await migrateQuery(
      `SELECT action FROM audit_logs WHERE entity_type = 'incident' AND entity_id = $1 ORDER BY created_at`,
      [created.body.id]
    )
    const actions = audit.rows.map((r: any) => r.action)
    expect(actions).toContain('create')
    expect(actions).toContain('update')
  })

  it('should include the incident in the audit timeline endpoint', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgr.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(mgr)

    const res = await request(app)
      .get(`/incidents/${incident.id}/timeline`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((t: any) => t.event === 'incident.created')).toBe(true)
  })
})
