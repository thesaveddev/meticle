import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * /ai/mica/settle — the LLM intent fallback for utterances the client's
 * regex heuristics miss ("book podiatry", "arrange a sight check").
 *
 * Recognising intent is all it does: the properties under test are that the
 * route (a) classifies on the scripted model, (b) declines anything outside
 * the frozen action list rather than inventing a fifth action, and (c) never
 * writes — the response carries no draft and no persisted row. The care-note
 * and question paths are unchanged by this route's existence.
 */

const outbound: any[] = []
/** Scripted replies consumed in order per request. */
let script: Array<() => any> = []

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: async (body: any) => {
          outbound.push(body)
          const next = script.shift()
          if (!next) throw new Error('test script exhausted')
          return next()
        },
      },
    }
    audio = { speech: { create: async () => { throw new Error('not used') } } }
  }
  return { default: FakeOpenAI }
})

let app: Express
beforeAll(() => { app = createTestApp() })
afterEach(() => { outbound.length = 0; script = [] })

const REPLY = (content: string) => ({
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
})

async function seedOrg(opts: { provider?: string; features?: string[] } = {}) {
  const org = await createOrg()
  const admin = await createUser({
    email: `micasettle-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  await migrateQuery(
    `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
    [JSON.stringify({
      enabled: true,
      provider: opts.provider ?? 'openai',
      apiKey: 'sk-test-not-a-real-key',
      model: 'gpt-4o-mini',
      enabledFeatures: opts.features ?? ['natural_language_assistant'],
    }), org.id],
  )
  return { org, admin, token: generateToken(admin) }
}

describe('POST /ai/mica/settle', () => {
  it('classifies "book podiatry" as CREATE_APPOINTMENT with the subject extracted', async () => {
    const seeded = await seedOrg()
    script = [() => REPLY('{"action":"CREATE_APPOINTMENT","subject":"podiatry","personName":null}')]

    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'book podiatry' })
    expect(res.status).toBe(200)
    expect(res.data?.intent).toBeUndefined() // sanity: supertest shape
    expect(res.body.intent).toBeTruthy()
    expect(res.body.intent.action).toBe('CREATE_APPOINTMENT')
    expect(res.body.intent.title).toBe('podiatry')
    // No person named → no invented person on the draft.
    expect(res.body.intent.personName).toBeUndefined()
  })

  it('classifies "arrange a sight check for Elsie Fletcher" with the person extracted', async () => {
    const seeded = await seedOrg()
    script = [() => REPLY('{"action":"CREATE_APPOINTMENT","subject":"sight check","personName":"Elsie Fletcher"}')]

    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'arrange a sight check for Elsie Fletcher' })
    expect(res.status).toBe(200)
    expect(res.body.intent.action).toBe('CREATE_APPOINTMENT')
    expect(res.body.intent.personName).toBe('Elsie Fletcher')
  })

  it('routes care observations to none so the client keeps its care-note path', async () => {
    const seeded = await seedOrg()
    script = [() => REPLY('{"action":"none","subject":null,"personName":null}')]

    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'Elsie enjoyed her lunch today' })
    expect(res.status).toBe(200)
    expect(res.body.intent).toBeNull()
    expect(res.body.action).toBe('none')
  })

  it('declines class-but-not-list actions the model hallucinates instead of routing them', async () => {
    const seeded = await seedOrg()
    // The model invents an action id outside the frozen list.
    script = [() => REPLY('{"action":"SCHEDULE_REMINDER","subject":"call family","personName":null}')]

    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'schedule a reminder' })
    expect(res.status).toBe(200)
    expect(res.body.intent).toBeNull()
    expect(res.body.action).toBe('unclassified')
  })

  it('returns a bounded 400 when the model reply is not JSON, and never 500s', async () => {
    const seeded = await seedOrg()
    script = [() => REPLY('I think they wanted to make a task.')]

    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'can you sort that visit out' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toBeTruthy()
  })

  it('403s when natural_language_assistant is off — same gate as the rest of Mica', async () => {
    const seeded = await seedOrg({ features: [] })
    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'book podiatry' })
    expect(res.status).toBe(403)
  })

  it('400s for a non-openai provider (the returned intent must come from a known model contract)', async () => {
    const seeded = await seedOrg({ provider: 'anthropic' })
    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'book podiatry' })
    expect(res.status).toBe(400)
  })

  it('recognition-only: nothing was written to tasks or appointments while classifying', async () => {
    const seeded = await seedOrg()
    script = [() => REPLY('{"action":"CREATE_TASK","subject":"call family","personName":null}')]

    const res = await request(app)
      .post('/ai/mica/settle')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ utterance: 'remind me to call the family' })
    expect(res.status).toBe(200)
    expect(res.body.intent.action).toBe('CREATE_TASK')

    const tasks = await migrateQuery(`SELECT COUNT(*)::int AS c FROM tasks WHERE organization_id = $1`, [seeded.org.id])
    const appts = await migrateQuery(`SELECT COUNT(*)::int AS c FROM appointments WHERE organization_id = $1`, [seeded.org.id])
    expect(tasks.rows[0].c).toBe(0)
    expect(appts.rows[0].c).toBe(0)
  })
})
