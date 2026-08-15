import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createIncidentCategory, createLeaveType, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { processOutbox } from './events.outbox'
import { registerConsumer, resetConsumers } from './events.consumers'
import { IncidentTriageConsumer } from './consumers/incident-triage.consumer'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

vi.mock('../ai/ai.provider', () => ({
  getProvider: () => ({
    name: 'openai',
    chatCompletion: async () => ({
      content: JSON.stringify({
        severity: 'high',
        confidence: 0.9,
        reasoning: 'Medication error with harm potential',
        recommended_actions: ['Review MAR', 'Notify GP'],
        requires_cqc_notification: true,
      }),
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    }),
  }),
}))

let app: Express
const createdOrgIds: string[] = []

beforeAll(async () => {
  app = createTestApp()
  resetConsumers()
  registerConsumer('incident.created', IncidentTriageConsumer)
}, 30_000)

afterAll(async () => {
  for (const orgId of createdOrgIds) {
    await migrateQuery(`DELETE FROM event_consumers WHERE event_id IN (SELECT id FROM domain_events WHERE organization_id = $1)`, [orgId])
    await migrateQuery(`DELETE FROM domain_events WHERE organization_id = $1`, [orgId])
    await migrateQuery(`DELETE FROM ai_audit_logs WHERE organization_id = $1`, [orgId])
  }
  resetConsumers()
})

async function makeManager() {
  const org = await createOrg()
  createdOrgIds.push(org.id)
  const user = await createUser({ email: `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@prod-events.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  await createStaffProfile({ user_id: user.id })
  return { org, user, token: generateToken(user) }
}

describe('Production event publishing — incident.created', () => {
  it('records an incident.created event when an incident is created via the API', async () => {
    const { org, token } = await makeManager()
    const cat = await createIncidentCategory({ organizationId: org.id })

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fall in hallway', description: 'Person slipped', severity: 'medium', category_id: cat.id, location: 'Wing A' })
    expect(res.status).toBe(201)

    const rows = await migrateQuery(
      `SELECT * FROM domain_events WHERE event_name = 'incident.created' AND organization_id = $1`, [org.id])
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].aggregate_id).toBe(res.body.id)
    expect(rows.rows[0].correlation_id).toBe(res.body.id)
    const payload = rows.rows[0].payload
    expect(payload.title).toBe('Fall in hallway')
    expect(payload.severity).toBe('medium')
    expect(payload.category_id).toBe(cat.id)

    const stats = await processOutbox(org.id)
    expect(stats.processed).toBe(1)
  })
})

describe('Production event publishing — leave.requested', () => {
  it('records a leave.requested event when leave is requested via the API', async () => {
    const org = await createOrg()
    createdOrgIds.push(org.id)
    const worker = await createUser({ email: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@prod-events.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ user_id: worker.id })
    const lt = await createLeaveType({ organization_id: org.id, name: 'Annual Leave' })
    const token = generateToken(worker)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: lt.id, start_date: '2026-09-01', end_date: '2026-09-03' })
    expect(res.status).toBe(201)

    const rows = await migrateQuery(
      `SELECT * FROM domain_events WHERE event_name = 'leave.requested' AND organization_id = $1`, [org.id])
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].aggregate_id).toBe(res.body.id)
    const payload = rows.rows[0].payload
    expect(payload.leave_type_name).toBe('Annual Leave')
    expect(payload.duration_type).toBe('days')
    expect(payload.requested_by).toBe(worker.id)
  })
})

describe('Incident AI triage consumer', () => {
  it('runs triage when AI is configured and stores the result on the incident', async () => {
    const { org, token } = await makeManager()
    const cat = await createIncidentCategory({ organizationId: org.id, name: 'Medication' })
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ enabled: true, provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini', enabledFeatures: ['incident_severity_triage'] }), org.id]
    )

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Medication error', description: 'Wrong dose administered', severity: 'low', category_id: cat.id })
    expect(res.status).toBe(201)

    const stats = await processOutbox(org.id)
    expect(stats.processed).toBe(1)
    expect(stats.published).toBe(1)

    const incident = (await migrateQuery(`SELECT ai_triage FROM incidents WHERE id = $1`, [res.body.id])).rows[0]
    expect(incident.ai_triage.severity).toBe('high')
    expect(incident.ai_triage.confidence).toBe(0.9)
    expect(incident.ai_triage.requires_cqc_notification).toBe(true)

    const consumerRow = (await migrateQuery(
      `SELECT status FROM event_consumers WHERE event_id = (SELECT id FROM domain_events WHERE aggregate_id = $1 AND event_name = 'incident.created')`,
      [res.body.id]
    )).rows[0]
    expect(consumerRow.status).toBe('processed')

    const audit = (await migrateQuery(
      `SELECT COUNT(*)::int AS cnt FROM ai_audit_logs WHERE organization_id = $1 AND feature = 'incident_severity_triage' AND success = true`, [org.id]
    )).rows[0]
    expect(audit.cnt).toBe(1)
  })

  it('no-ops (delivered without triage) when the org has no AI configuration', async () => {
    const { org, token } = await makeManager()
    const cat = await createIncidentCategory({ organizationId: org.id })

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Minor scrape', severity: 'low', category_id: cat.id })
    expect(res.status).toBe(201)

    const stats = await processOutbox(org.id)
    expect(stats.processed).toBe(1)
    expect(stats.published).toBe(1)

    const incident = (await migrateQuery(`SELECT ai_triage FROM incidents WHERE id = $1`, [res.body.id])).rows[0]
    expect(incident.ai_triage).toBeNull()

    const audit = (await migrateQuery(
      `SELECT COUNT(*)::int AS cnt FROM ai_audit_logs WHERE organization_id = $1`, [org.id]
    )).rows[0]
    expect(audit.cnt).toBe(0)
  })
})
