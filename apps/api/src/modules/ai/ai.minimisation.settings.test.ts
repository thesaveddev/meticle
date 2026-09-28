import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery, query } from '../../shared/database'

/**
 * The manager-facing control for how much clinical narrative crosses the LLM
 * boundary. The setting itself is proven end to end in
 * ai.boundary.integration.test.ts; this file proves the control:
 *
 *   - it is ORG_ADMIN only, because it changes what leaves the building for
 *     every carer and every service user in the organisation, which is not a
 *     decision a manager's manager should discover by accident;
 *   - changing it is audited old -> new, because a privacy control whose
 *     history is invisible cannot be evidenced to a customer's security review;
 *   - it works before any AI provider is configured, because the decision about
 *     what may be sent belongs to the organisation, not to whoever set up the
 *     API key.
 */
let app: Express
beforeAll(() => { app = createTestApp() })

describe('AI data minimisation control', () => {
  it('defaults to full for a new organisation', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dm-admin-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const res = await request(app).get('/ai/data-minimisation').set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.mode).toBe('full')
    // The consequence list travels with the control, so a manager reading the
    // setting can see what switching it would degrade.
    expect(Array.isArray(res.body.degraded_capabilities)).toBe(true)
    expect(res.body.degraded_capabilities.length).toBeGreaterThan(0)
    expect(res.body.method.appliesStatisticalDetection).toBe(false)
  })

  it('is ORG_ADMIN only', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `dm-mgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const res = await request(app).put('/ai/data-minimisation').set('Authorization', `Bearer ${generateToken(manager)}`).send({ mode: 'minimal' })
    expect(res.status).toBe(403)
    const check = await query('SELECT ai_data_minimisation FROM organizations WHERE id = $1', [org.id])
    expect(check.rows[0].ai_data_minimisation).toBe('full')
  })

  it('persists the setting and audits old -> new', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dm-audit-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const auth = { Authorization: `Bearer ${generateToken(admin)}` }

    const put = await request(app).put('/ai/data-minimisation').set(auth).send({ mode: 'minimal' })
    expect(put.status).toBe(200)
    expect(put.body.previous).toBe('full')
    expect(put.body.mode).toBe('minimal')

    const row = await query('SELECT ai_data_minimisation FROM organizations WHERE id = $1', [org.id])
    expect(row.rows[0].ai_data_minimisation).toBe('minimal')

    // audit_logs is RLS-protected, so this read goes through the admin pool
    // the same way every other migration-time assertion in this suite does.
    const audit = await migrateQuery(
      `SELECT old_data, new_data FROM audit_logs WHERE entity_type = 'organization_ai_data_minimisation' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [org.id],
    )
    expect(audit.rows[0]?.old_data).toMatchObject({ mode: 'full' })
    expect(audit.rows[0]?.new_data).toMatchObject({ mode: 'minimal' })
  })

  it('rejects a mode the code does not implement', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dm-bad-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const res = await request(app).put('/ai/data-minimisation').set('Authorization', `Bearer ${generateToken(admin)}`).send({ mode: 'strictly reduced' })
    expect(res.status).toBe(400)
    const row = await query('SELECT ai_data_minimisation FROM organizations WHERE id = $1', [org.id])
    expect(row.rows[0].ai_data_minimisation).toBe('full')
  })
})
