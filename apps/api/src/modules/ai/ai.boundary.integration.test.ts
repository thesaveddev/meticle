import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * Proves the boundary end to end rather than at the function boundary.
 *
 * Every other test in this area asserts that a helper does the right thing. The
 * question that actually matters is what leaves the building, so this file
 * intercepts the outbound provider request and reads the prompt body. A unit
 * test on `minimiseVariables` would still pass if a handler forgot to call the
 * wrapper, if the setting were read from the wrong organisation, or if the
 * records blob were assembled somewhere the minimiser never sees.
 *
 * It is also the only test here that proves the two controls are independent,
 * which is the distinction the design turns on: in `full` mode a person's name
 * is pseudonymised and their clinical narrative still crosses; in `minimal`
 * mode the narrative does not cross at all. Redaction is not minimisation, and
 * conflating them is how a team ends up believing a pseudonymised note is
 * anonymous.
 */

/** Captures the body of every outbound chat completion. */
const outbound: any[] = []

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: async (body: any) => {
          outbound.push(body)
          return {
            choices: [{ message: { content: JSON.stringify({
              headline: 'Test headline',
              summary: 'Test summary',
              items: [],
              suggested_follow_up: [],
              limitations: [],
            }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
          }
        },
      },
    }
  }
  return { default: FakeOpenAI }
})

let app: Express
beforeAll(() => { app = createTestApp() })
afterEach(() => { outbound.length = 0 })

const AI_CONFIG = {
  enabled: true,
  provider: 'openai' as const,
  apiKey: 'sk-test-not-a-real-key',
  model: 'gpt-4o-mini',
  enabledFeatures: [
    'change_detection', 'care_summary', 'risk_signals', 'operational_anomaly_detection',
    'compliance_copilot', 'natural_language_assistant', 'end_of_day_intelligence',
    'domiciliary_operations_copilot', 'rota_alternatives', 'competency_coaching',
    'family_communication_draft',
  ],
}

/** Everything the provider was actually sent, flattened to one searchable string. */
function outboundText(): string {
  return outbound.map((b) => JSON.stringify(b.messages)).join('\n')
}

async function setupOrg(minimisation: 'full' | 'minimal') {
  const org = await createOrg()
  const manager = await createUser({
    email: `aiboundary-${minimisation}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'MANAGER',
    organization_id: org.id,
  })
  const person = await createPerson({
    organization_id: org.id,
    first_name: 'Wilhelmina',
    last_name: 'Okonjo-Hartley',
  })
  await migrateQuery(
    `UPDATE organizations SET ai_config = $1::jsonb, ai_data_minimisation = $2 WHERE id = $3`,
    [JSON.stringify(AI_CONFIG), minimisation, org.id],
  )
  return { org, manager, person }
}

const NARRATIVE = 'Declined her risperidone and seemed very withdrawn all afternoon'

async function insertNote(personId: string, authorId: string) {
  // The organisation is reached through people, exactly as the intelligence
  // query does it, so the test exercises the real join rather than a shortcut.
  await migrateQuery(
    `INSERT INTO daily_notes (id, person_id, author_id, note_date, shift, category, content)
     VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE, 'day', 'observation', $3)`,
    [personId, authorId, NARRATIVE],
  )
}

describe('LLM boundary, end to end', () => {
  it('sends narrative through in full mode, with the name pseudonymised', async () => {
    const { org, manager, person } = await setupOrg('full')
    await insertNote(person.id, manager.id)

    const res = await request(app)
      .post('/ai/change-detection')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })

    expect(res.status).toBe(200)
    expect(outbound.length).toBeGreaterThan(0)
    const sent = outboundText()
    // Full mode is the default and must stay byte-compatible: the note is there.
    expect(sent).toContain('Declined her risperidone')
    // ...but the name is not, even here. This is the control that predates
    // minimisation and must not be regressed by it.
    expect(sent).not.toContain('Wilhelmina')
    expect(sent).not.toContain('Okonjo-Hartley')
    expect(sent).toMatch(/Client [0-9A-F]{4}/)
  })

  it('withholds narrative in minimal mode while keeping the coded facts', async () => {
    const { org, manager, person } = await setupOrg('minimal')
    await insertNote(person.id, manager.id)

    const res = await request(app)
      .post('/ai/change-detection')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })

    expect(res.status).toBe(200)
    expect(outbound.length).toBeGreaterThan(0)
    const sent = outboundText()
    // The actual clinical sentence must not reach the processor. This is the
    // assertion the whole feature exists for.
    expect(sent).not.toContain('Declined her risperidone')
    expect(sent).not.toContain('risperidone')
    expect(sent).not.toContain('withdrawn')
    // ...but the record is still there, so change detection still has something
    // to notice. Blanket-withholding the whole payload would be privacy
    // theatre, not privacy.
    expect(sent).toContain('withheld')
    expect(sent).toContain('daily_note')
  })

  it('reports what actually crossed the boundary, in the response body', async () => {
    const { org, manager, person } = await setupOrg('minimal')
    await insertNote(person.id, manager.id)

    const res = await request(app)
      .post('/ai/change-detection')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })

    expect(res.body.data_boundary).toMatchObject({
      direct_identifiers_removed: true,
      clinical_narrative: 'withheld',
      ai_data_minimisation: 'minimal',
      narrative_dependent: true,
    })
    // The disclosure is machine-readable so a security review reads the same
    // claim out of the JSON that the interface makes.
    expect(res.body.method.appliesStatisticalDetection).toBe(false)
    expect(res.body.method.hasLearnedBaseline).toBe(false)
    expect(res.body.method.method).toBe('dated_record_query_plus_language_model_summary')
  })

  it('names the capability honestly rather than by its route alias', async () => {
    const { org, manager, person } = await setupOrg('full')
    await insertNote(person.id, manager.id)

    const res = await request(app)
      .post('/ai/anomaly-detection')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })

    expect(res.status).toBe(200)
    // The frozen feature-flag key, for anyone integrating against the old name.
    expect(res.body.capability).toBe('operational_anomaly_detection')
    // ...and the honest name, which is what it should be called.
    expect(res.body.capability_meta.label).toBe('Operational activity review')
    expect(res.body.capability_meta.label).not.toMatch(/anomaly detection/i)
    expect(res.body.capability_meta.summary).toMatch(/no statistical detection/i)
  })

  it('performs a free-text query unwithheld, because a question is not a record', async () => {
    // The assistant takes a question. Withholding it would make the feature
    // useless for a reason that buys nothing: the manager typed it themselves.
    const { org, manager, person } = await setupOrg('minimal')
    await insertNote(person.id, manager.id)

    const res = await request(app)
      .post('/ai/assistant')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ question: 'Which clients refused medication this week?', from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })

    expect(res.status).toBe(200)
    expect(outboundText()).toContain('Which clients refused medication this week')
    expect(res.body.data_boundary.clinical_narrative).toBe('withheld')
  })

  it('scopes the setting to the organisation that set it', async () => {
    const minimal = await setupOrg('minimal')
    const full = await setupOrg('full')
    await insertNote(minimal.person.id, minimal.manager.id)
    await insertNote(full.person.id, full.manager.id)

    await request(app)
      .post('/ai/change-detection')
      .set('Authorization', `Bearer ${generateToken(minimal.manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })
    expect(outboundText()).not.toContain('Declined her risperidone')

    outbound.length = 0
    await request(app)
      .post('/ai/change-detection')
      .set('Authorization', `Bearer ${generateToken(full.manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })
    // A different tenant with the default setting must be unaffected. Reading
    // the setting from the wrong place is the failure mode that would make this
    // control worse than having none.
    expect(outboundText()).toContain('Declined her risperidone')
  })

  it('sends store:false so the processor is not holding a second copy', async () => {
    const { org, manager, person } = await setupOrg('full')
    await insertNote(person.id, manager.id)

    await request(app)
      .post('/ai/change-detection')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })

    expect(outbound.length).toBeGreaterThan(0)
    expect(outbound.every((b) => b.store === false)).toBe(true)
  })
})
