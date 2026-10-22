import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('AI — config, unconfigured 400s, audit logs', () => {
  it('should manage config and report unconfigured AI as 400', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `ai-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const emptyConfig = await request(app)
      .get('/ai/config')
      .set('Authorization', `Bearer ${token}`)
    expect(emptyConfig.status).toBe(200)

    const analyze = await request(app)
      .post('/ai/analyze/compliance')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgName: 'Test', overallRate: 3 })
    expect(analyze.status).toBe(400)
    expect(analyze.body.error.message).toContain('AI not configured')

    const triage = await request(app)
      .post('/ai/triage/incident')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fall', description: 'Resident fell', category: 'falls' })
    expect(triage.status).toBe(400)

    const updated = await request(app)
      .put('/ai/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-test-key-1234', enabledFeatures: ['incident_severity_triage'] })
    expect(updated.status).toBe(200)

    const config = await request(app)
      .get('/ai/config')
      .set('Authorization', `Bearer ${token}`)
    expect(config.status).toBe(200)
    expect(config.body.config.apiKey).toContain('1234')

    const logs = await request(app)
      .get('/ai/audit-logs')
      .set('Authorization', `Bearer ${token}`)
    expect(logs.status).toBe(200)
    expect(logs.body.logs).toBeDefined()

    const usage = await request(app)
      .get('/ai/usage-stats')
      .set('Authorization', `Bearer ${token}`)
    expect(usage.status).toBe(200)
    expect(usage.body.stats).toBeDefined()
  })

  it('should persist budget, fallback and voice settings through validation (not strip them)', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `ai3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const updated = await request(app)
      .put('/ai/config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-test-key-5678',
        enabledFeatures: ['natural_language_assistant'],
        monthlyTokenBudget: 100000, monthlyCostCapGBP: 25.5,
        fallbackProvider: 'anthropic', fallbackApiKey: 'sk-fallback-9999', fallbackModel: 'claude-sonnet-4-20250514',
        ttsVoice: 'sage',
      })
    expect(updated.status).toBe(200)

    const config = await request(app)
      .get('/ai/config')
      .set('Authorization', `Bearer ${token}`)
    expect(config.status).toBe(200)
    const body = config.body.config
    // Persisted, not stripped by validate().
    expect(body.monthlyTokenBudget).toBe(100000)
    expect(body.monthlyCostCapGBP).toBe(25.5)
    expect(body.fallbackProvider).toBe('anthropic')
    expect(body.fallbackModel).toBe('claude-sonnet-4-20250514')
    expect(body.ttsVoice).toBe('sage')
    // Secrets come back masked — primary and fallback alike.
    expect(body.apiKey).toContain('5678')
    expect(body.apiKey).not.toContain('sk-test-key-5678')
    expect(body.fallbackApiKey).toContain('9999')
    expect(body.fallbackApiKey).not.toContain('sk-fallback-9999')

    const usage = await request(app)
      .get('/ai/usage-stats')
      .set('Authorization', `Bearer ${token}`)
    expect(usage.status).toBe(200)
    // The Settings budget bar reads these; they exist even with no traffic.
    expect(usage.body.stats.monthlyTokens).toBe(0)
    expect(usage.body.stats.monthlyCostGbp).toBe(0)
    expect(usage.body.stats.monthlyCostCapGbp).toBe(25.5)
    expect(usage.body.stats.monthlyTokenBudget).toBe(100000)
  })

  it('should reject a CARE_WORKER reading config (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `ai2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/ai/config')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/ai/config')
    expect(res.status).toBe(401)
  })
})
