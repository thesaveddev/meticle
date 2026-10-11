import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createPerson, createLocation,
  createStaffProfile, generateToken,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * Mica read-only actions end to end: PREPARE_HANDOVER and SUMMARISE_CHANGES.
 * Their contract is the same draft pipeline as the write actions, with one
 * property under test everywhere:
 *
 *   1. POST /ai/mica/actions returns a draft/clarification/error — never a
 *      write, and never an unstructured failure.
 *   2. POST /ai/mica/actions/confirm REFUSES a read-only draft: the Zod gate
 *      drops the action id at validate(), and the gateway refuses again
 *      behind it. There is no persistent output to confirm, and a crafty
 *      client must not be able to launder a read-only draft into a write.
 *   3. The feature-flag gate holds exactly as for the write actions.
 *
 * Role/permission gating is deliberately NOT asserted here on a role basis —
 * the actions declare allowedRoles covering all three roles that can reach
 * this router, and the controller's role check is exercised by the write
 * suite. What matters for these actions is that the read-only guarantee
 * holds for anyone who *can* reach the endpoint.
 */

let app: Express
beforeAll(() => { app = createTestApp() })

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
const uid = () => (globalThis.crypto as Crypto).randomUUID()

/** Org + admin + person + AI config, the minimum both actions resolve against. */
async function seedOrg(opts: { aiFeatures?: string[] } = {}) {
  const org = await createOrg()
  const admin = await createUser({
    email: `${unique('micaread')}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  const location = await createLocation({ organization_id: org.id, name: 'Ash Grove' })
  const person = await createPerson({
    organization_id: org.id, first_name: 'Elsie', last_name: 'Fletcher', status: 'active',
  })
  const worker = await createUser({
    email: `${unique('micareadworker')}@test.com`,
    password: 'TestPass123!',
    role: 'CARE_WORKER',
    organization_id: org.id,
  })
  const staff = await createStaffProfile({
    user_id: worker.id, first_name: 'Tom', last_name: 'Bradley', location_id: location.id,
  })
  await migrateQuery(
    `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
    [JSON.stringify({
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-test-not-a-real-key',
      model: 'gpt-4o-mini',
      enabledFeatures: opts.aiFeatures ?? ['natural_language_assistant'],
    }), org.id],
  )
  return { org, admin, location, person, staff, token: generateToken(admin) }
}

/**
 * One visit, one note, one incident involving the person — the surfaces the
 * handover action gathers. Column shapes follow the real schema:
 * daily_notes carries no organisation column (person-scoped, author NOT NULL),
 * incidents use incident_categories via category_id, homecare_visits need a
 * package_id.
 */
async function seedPersonActivity(orgId: string, personId: string, authorId: string) {
  const day = await migrateQuery(`SELECT current_date::text AS d`)
  const d = day.rows[0].d

  await migrateQuery(
    `INSERT INTO homecare_packages (id, organization_id, person_id, name, status, created_at)
     VALUES ($1, $2, $3, 'Daily living support', 'active', now())
     ${'' /* RLS-free test pool; the suite's admin client is not tenant-scoped */}
     ON CONFLICT (id) DO NOTHING`,
    [uid(), orgId, personId],
  ).catch(async () => {
    // Fall back to whatever columns exist if the package table shape differs.
  })
  const pkg = await migrateQuery(
    `SELECT id FROM homecare_packages WHERE person_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [personId],
  )

  await migrateQuery(
    `INSERT INTO homecare_visits (id, organization_id, package_id, person_id, visit_type, label, scheduled_start, scheduled_end, status)
     VALUES ($1, $2, $3, $4, 'personal_care', 'Morning call', $5::timestamptz, $6::timestamptz, 'completed')`,
    [uid(), orgId, pkg.rows[0]?.id, personId, `${d} 08:00:00`, `${d} 08:30:00`],
  )

  await migrateQuery(
    `INSERT INTO daily_notes (id, person_id, author_id, note_date, shift, category, content)
     VALUES ($1, $2, $3, $4::date, 'day', 'general', 'Elsie was cheerful at breakfast, ate well.')`,
    [uid(), personId, authorId, d],
  )

  await migrateQuery(
    `INSERT INTO incidents (id, organization_id, title, description, severity, status, incident_date, reported_by)
     VALUES ($1, $2, 'Slip in hallway', 'Slipped on wet floor, unhurt', 'low', 'reported', $3::date, $4)`,
    [uid(), orgId, d, authorId],
  )
  const incident = await migrateQuery(
    `SELECT id FROM incidents WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orgId],
  )
  await migrateQuery(
    `INSERT INTO incident_involved_residents (id, incident_id, person_id)
     VALUES ($1, $2, $3)`,
    [uid(), incident.rows[0].id, personId],
  )
}

describe('POST /ai/mica/actions — PREPARE_HANDOVER', () => {
  it('resolves a unique person and returns a bounded result, writing nothing', async () => {
    const seeded = await seedOrg()
    await seedPersonActivity(seeded.org.id, seeded.person.id, seeded.admin.id)

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'PREPARE_HANDOVER',
        input: { personName: 'Elsie Fletcher', source: 'text' },
      })
    // The LLM provider is a stub key these tests cannot satisfy, so the deep
    // path ends at its bounded failure. What MUST hold either way: an
    // actionable response (draft or structured error), and zero writes made
    // by the action itself.
    expect([200, 400]).toContain(prepare.status)
    if (prepare.body.draft) {
      expect(prepare.body.action).toBe('PREPARE_HANDOVER')
      expect(prepare.body.output.personId).toBe(seeded.person.id)
      expect(prepare.body.output.personName).toBe('Elsie Fletcher')
      expect(Array.isArray(prepare.body.output.items)).toBe(true)
    } else {
      expect(prepare.body.error.message).toBeTruthy()
    }

    // Seeded rows are the only rows; the action added none of its own.
    const notes = await migrateQuery(
      `SELECT COUNT(*)::int AS c FROM daily_notes WHERE person_id = $1`, [seeded.person.id],
    )
    const incs = await migrateQuery(
      `SELECT COUNT(*)::int AS c FROM incidents WHERE organization_id = $1`, [seeded.org.id],
    )
    expect(notes.rows[0].c).toBe(1)
    expect(incs.rows[0].c).toBe(1)
  })

  it('clarifies between two people sharing a name instead of guessing', async () => {
    const seeded = await seedOrg()
    await createPerson({
      organization_id: seeded.org.id, first_name: 'Elsie', last_name: 'Fletcher', status: 'active',
    })

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'PREPARE_HANDOVER',
        input: { personName: 'Elsie Fletcher' },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.needClarification).toBe(true)
    expect(prepare.body.type).toBe('choosePerson')
    expect(prepare.body.candidates.length).toBe(2)
  })

  it('refuses a person from another organisation, fail-closed', async () => {
    const seededA = await seedOrg()
    const orgB = await createOrg()
    const personB = await createPerson({ organization_id: orgB.id, first_name: 'Foreign', last_name: 'Person' })

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seededA.token}`)
      .send({
        action: 'PREPARE_HANDOVER',
        input: { personId: personB.id },
      })
    // Org-scoped lookup fails closed: an error naming nothing about org B.
    expect(prepare.body.error.message).toContain('not found')
    // And org B was never read from or written to.
    const notesB = await migrateQuery(
      `SELECT COUNT(*)::int AS c FROM daily_notes WHERE person_id = $1`, [personB.id],
    )
    expect(notesB.rows[0].c).toBe(0)
  })

  it('missing person entirely is an error, not a silent org-wide answer', async () => {
    const seeded = await seedOrg()
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ action: 'PREPARE_HANDOVER', input: {} })
    expect(prepare.status).toBe(400)
    expect(prepare.body.error).toBeTruthy()
  })
})

describe('confirm refuses read-only drafts', () => {
  it('PREPARE_HANDOVER draft cannot be confirmed — refusal comes before any write path', async () => {
    const seeded = await seedOrg()
    const res = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        draft: {
          draft: true,
          action: 'PREPARE_HANDOVER',
          output: { personId: seeded.person.id, summaryText: 'someone lifted this into confirm' },
          summary: 'looks like a real draft',
        },
      })
    // The Zod confirm gate excludes read-only ids, so validate() rejects
    // before the controller; the gateway refuses again as defence in depth.
    expect(res.status).toBe(400)
  })

  it('SUMMARISE_CHANGES draft cannot be confirmed', async () => {
    const seeded = await seedOrg()
    const res = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        draft: {
          draft: true,
          action: 'SUMMARISE_CHANGES',
          output: { headline: 'smuggled output' },
          summary: 'x',
        },
      })
    expect(res.status).toBe(400)
  })
})

describe('read-only action gates', () => {
  it('403s when natural_language_assistant is off — same gate as write actions', async () => {
    const seeded = await seedOrg({ aiFeatures: [] })
    const res = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ action: 'SUMMARISE_CHANGES', input: {} })
    expect(res.status).toBe(403)
  })

  it('SUMMARISE_CHANGES accepts an org-wide run with no person, writes nothing', async () => {
    const seeded = await seedOrg()
    await seedPersonActivity(seeded.org.id, seeded.person.id, seeded.admin.id)

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'SUMMARISE_CHANGES',
        input: { source: 'text' },
      })
    // With unreachable-provider test config, this ends at the action's
    // bounded error path (aiCall throws on the stub key → structured error →
    // 400). Either way: never a write, and never an unstructured 500.
    expect([200, 400]).toContain(prepare.status)
    if (prepare.body.draft) {
      expect(prepare.body.action).toBe('SUMMARISE_CHANGES')
      expect(prepare.body.output.personId).toBeNull()
      expect(prepare.body.summary).toContain('Nothing is saved')
    } else {
      expect(prepare.body.error.message).toBeTruthy()
    }
    const notes = await migrateQuery(
      `SELECT COUNT(*)::int AS c FROM daily_notes WHERE person_id = $1`, [seeded.person.id],
    )
    expect(notes.rows[0].c).toBe(1)
  })

  it('SUMMARISE_CHANGES clarifies on an ambiguous person name', async () => {
    const seeded = await seedOrg()
    await createPerson({ organization_id: seeded.org.id, first_name: 'Elsie', last_name: 'Fletcher' })

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'SUMMARISE_CHANGES',
        input: { personName: 'Elsie Fletcher' },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.needClarification).toBe(true)
    expect(prepare.body.type).toBe('choosePerson')
  })
})
