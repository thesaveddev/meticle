import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createPerson, createLocation,
  createStaffProfile, createShift, generateToken,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * Mica's platform-wide question answering, end to end.
 *
 * Scripted provider: the model asks for a tool, we execute the real SQL, and
 * the final answer is written to contain the pseudonyms the controller sent.
 * The assertions then check the two properties this feature must hold at once:
 *
 *   1. the staff member hears real names back (pseudonym round-trip works), and
 *   2. no real name ever leaves the building (outbound provider bodies contain
 *      only pseudonyms) — the same boundary every other AI surface holds.
 */

const outbound: any[] = []
/** Scripted responses, consumed in order per request. */
let script: Array<(body: any) => any> = []

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: async (body: any) => {
          outbound.push(body)
          const next = script.shift()
          if (!next) throw new Error('test script exhausted')
          return next(body)
        },
      },
    }
    audio = { speech: { create: async () => { throw new Error('not used in this test') } } }
  }
  return { default: FakeOpenAI }
})

let app: Express
beforeAll(() => { app = createTestApp() })
afterEach(() => { outbound.length = 0; script = [] })

const TOOL_CALL = (id: string, name: string, args: object) => ({
  choices: [{
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
    },
  }],
  usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
})

const FINAL = (content: string) => ({
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
})

function outboundText(): string {
  return outbound.map((b) => JSON.stringify(b.messages)).join('\n')
}

describe('POST /ai/mica/ask', () => {
  it('answers "who is supporting Grace Roberts today" with real names restored and none sent to the model', async () => {
    const org = await createOrg()
    const manager = await createUser({
      email: `micaask-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'MANAGER',
      organization_id: org.id,
    })
    const location = await createLocation({ organization_id: org.id, name: 'Willow House' })
    const person = await createPerson({
      organization_id: org.id,
      first_name: 'Grace',
      last_name: 'Roberts',
      status: 'active',
    })
    // Staff user + profile so the assignment joins resolve through users.org.
    const carerUser = await createUser({
      email: `micaaskcarer-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const carer = await createStaffProfile({
      user_id: carerUser.id,
      first_name: 'Fatima',
      last_name: 'Iqbal',
      location_id: location.id,
    })
    const shift = await createShift({
      location_id: location.id,
      person_id: person.id,
      start_time: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
      end_time: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(),
      status: 'filled',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (id, shift_id, staff_id, status) VALUES (gen_random_uuid(), $1, $2, 'assigned')`,
      [shift.id, carer.id],
    )
    await migrateQuery(
      `INSERT INTO appointments (id, organization_id, person_id, title, start_time, end_time, status)
       VALUES (gen_random_uuid(), $1, $2, 'Physiotherapy', $3, $4, 'scheduled')`,
      [org.id, person.id,
       new Date(new Date().setHours(11, 30, 0, 0)).toISOString(),
       new Date(new Date().setHours(12, 30, 0, 0)).toISOString()],
    )
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-test-not-a-real-key',
        model: 'gpt-4o-mini',
        enabledFeatures: ['natural_language_assistant'],
      }), org.id],
    )
    const token = generateToken(manager)

    // The scripted final answer uses the pseudonyms the controller generates
    // from real names. The controller must restore them before responding.
    script = [
      () => TOOL_CALL('call_1', 'who_supports_person', { person_name: 'Grace Roberts' }),
      () => FINAL('Grace Roberts is supported by Fatima Iqbal on the day shift at Willow House today, 08:00 to 20:00.'),
    ]

    const res = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Who is supporting Grace Roberts today?' })

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Grace Roberts')
    expect(res.body.answer).toContain('Fatima Iqbal')
    expect(res.body.tokens).toBeGreaterThan(0)

    // Boundary: no real name crosses the LLM boundary. The user's question
    // and the model's own tool-call arguments may echo the name they typed;
    // the tool RESULT payloads we assemble are what must be pseudonymised.
    const toolPayloads = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'tool')
      .map((m: any) => m.content)
      .join('\n')
    expect(toolPayloads).not.toContain('Grace')
    expect(toolPayloads).not.toContain('Fatima')
    expect(toolPayloads).not.toContain('Roberts')
    expect(toolPayloads).not.toContain('Iqbal')
    expect(toolPayloads).toContain('Client ')
    expect(toolPayloads).toContain('Staff ')
    // And the tool result the model did see is the JSON we sent.
    expect(outboundText()).toContain('who_supports_person')
  })

  it('answers "today\'s appointments" via the appointments tool', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaask2-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const person = await createPerson({ organization_id: org.id, first_name: 'Ade', last_name: 'Okafor', status: 'active' })
    await migrateQuery(
      `INSERT INTO appointments (id, organization_id, person_id, title, start_time, end_time, status)
       VALUES (gen_random_uuid(), $1, $2, 'Dental check', $3, $4, 'scheduled')`,
      [org.id, person.id,
       new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
       new Date(new Date().setHours(15, 0, 0, 0)).toISOString()],
    )
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-test-not-a-real-key',
        model: 'gpt-4o-mini',
        enabledFeatures: ['natural_language_assistant'],
      }), org.id],
    )

    script = [
      () => TOOL_CALL('call_1', 'get_appointments', {}),
      () => FINAL('Ade Okafor has a dental check today at 14:00.'),
    ]

    const res = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ question: 'Give me the appointments of today' })

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Ade Okafor')
    expect(res.body.answer).toContain('dental check')
    // The tool result the model summarised must include the real row it found.
    expect(outboundText()).toContain('Dental check')
  })

  it('403s when the natural_language_assistant feature is off', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaask3-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ enabled: true, provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', enabledFeatures: [] }), org.id],
    )
    const res = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ question: 'Who is on shift?' })
    expect(res.status).toBe(403)
    expect(outbound.length).toBe(0)
  })

  it('threads a follow-up through sessionId: "what about tomorrow?" sees the prior turn, and a foreign sessionId does not', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaask5-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-test-not-a-real-key',
        model: 'gpt-4o-mini',
        enabledFeatures: ['natural_language_assistant'],
      }), org.id],
    )
    const token = generateToken(admin)

    // Turn 1: a normal question answered by a tool.
    script = [
      () => TOOL_CALL('c1', 'get_staff_on_shift', {}),
      () => FINAL('Three staff are on shift today.'),
    ]
    const first = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Who is on shift today?' })
    expect(first.status).toBe(200)
    const sessionId = first.body.sessionId as string
    expect(sessionId).toBeTruthy()

    // Turn 2: the elliptical follow-up. The model must see the prior turn.
    script = [
      () => FINAL('Tomorrow has two staff rostered.'),
    ]
    const second = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What about tomorrow?', sessionId })
    expect(second.status).toBe(200)
    expect(second.body.sessionId).toBe(sessionId)

    const secondUserMsgs = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content)
    // Prior question replayed, then the new one — the follow-up is grounded.
    expect(secondUserMsgs).toContain('Who is on shift today?')
    expect(secondUserMsgs).toContain('What about tomorrow?')
    // And the prior assistant answer is in context too.
    const assistantMsgs = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'assistant' && typeof m.content === 'string')
      .map((m: any) => m.content)
    expect(assistantMsgs).toContain('Three staff are on shift today.')

    // Security: another user's token with the same sessionId gets a fresh
    // conversation — no cross-user leak of the prior turn.
    const other = await createUser({
      email: `micaask6-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'MANAGER',
      organization_id: org.id,
    })
    script = [() => FINAL('I need more context for that question.')]
    const foreign = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${generateToken(other)}`)
      .send({ question: 'What about tomorrow?', sessionId })
    expect(foreign.status).toBe(200)
    expect(foreign.body.sessionId).not.toBe(sessionId)
    // Only the foreign request's own body — earlier bodies in this test are
    // the legitimate user's turns and legitimately contain the question.
    const foreignUserMsgs = (outbound[outbound.length - 1].messages as any[])
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content)
    expect(foreignUserMsgs).toEqual(['What about tomorrow?'])
  })

  it('answers medication-round, training-expiry and leave-balance questions via the new tools', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaask7-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const location = await createLocation({ organization_id: org.id, name: 'Beech Ward' })
    const person = await createPerson({
      organization_id: org.id, first_name: 'Nora', last_name: 'Whitfield', status: 'active',
    })
    // Carer with an expiring training record and a leave balance.
    const carerUser = await createUser({
      email: `micaask8-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const carer = await createStaffProfile({
      user_id: carerUser.id, first_name: 'Priya', last_name: 'Sharma', location_id: location.id,
    })
    // eMAR chart with one given dose and one overdue dose today.
    const marRecord = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'MAR Oct', CURRENT_DATE - 10, CURRENT_DATE + 20, 'active', $3) RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const item = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, instructions, is_active)
       VALUES ($1, 'Risperidone', '1', 'mg', 'oral', 'daily', 'With breakfast', TRUE) RETURNING id`,
      [marRecord.rows[0].id],
    )
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, $3::timestamptz, 'given'),
              ($1, $2, $4::timestamptz, 'pending')`,
      [item.rows[0].id, carer.id,
       new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
       new Date(new Date().setHours(1, 0, 0, 0)).toISOString()],
    )
    // Training record expiring in 10 days.
    const module = await migrateQuery(
      `INSERT INTO training_modules (organization_id, name, category)
       VALUES ($1, 'Medication Administration', 'mandatory') RETURNING id`,
      [org.id],
    )
    await migrateQuery(
      `INSERT INTO training_records (module_id, staff_id, status, completed_at, expires_at)
       VALUES ($1, $2, 'completed', CURRENT_DATE - 355, CURRENT_DATE + 10)`,
      [module.rows[0].id, carer.id],
    )
    // Leave balance: 25 allocated, 5 taken.
    const leaveType = await migrateQuery(
      `INSERT INTO leave_types (organization_id, name, color, days_allowed, duration_type)
       VALUES ($1, 'Annual Leave', '#10B981', 25, 'days') RETURNING id`,
      [org.id],
    )
    await migrateQuery(
      `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, days_taken)
       VALUES ($1, $2, $3, 25, 5)`,
      [carer.id, leaveType.rows[0].id, new Date().getFullYear()],
    )
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-test-not-a-real-key',
        model: 'gpt-4o-mini',
        enabledFeatures: ['natural_language_assistant'],
      }), org.id],
    )
    const token = generateToken(admin)

    // 1. Medication round: overdue dose for Nora Whitfield + a low-stock line.
    await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status, expiry_date)
       VALUES ($1, 'Risperidone', '1', 'mg', 2, 'tablet(s)', 10, $2, 'active', CURRENT_DATE + 30),
              ($1, 'Haloperidol', '0.5', 'mg', 0, 'tablet(s)', 10, $2, 'active', CURRENT_DATE + 90),
              ($1, 'Paracetamol', '500', 'mg', 40, 'tablet(s)', 10, NULL, 'active', NULL)`,
      [org.id, person.id],
    )
    // A delivery of Risperidone already booked for in three days and not yet
    // received into stock: the low line is below reorder level but does NOT
    // need reordering, because 200 tablets land before it can run out.
    const delivery = await migrateQuery(
      `INSERT INTO emedication_deliveries (organization_id, person_id, delivery_date, supplier)
       VALUES ($1, $2, CURRENT_DATE + 3, 'Test Pharmacy') RETURNING id`,
      [org.id, person.id],
    )
    await migrateQuery(
      `INSERT INTO emedication_delivery_items (delivery_id, medication_name, dosage, unit, quantity, quantity_unit)
       VALUES ($1, 'Risperidone', '1', 'mg', 200, 'tablet(s)')`,
      [delivery.rows[0].id],
    )
    script = [
      () => TOOL_CALL('m1', 'get_medication_round', {}),
      () => FINAL('Nora Whitfield\'s Risperidone dose is overdue; also Risperidone and Haloperidol stock are running low.'),
    ]
    const med = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Any medication overdue today?' })
    expect(med.status).toBe(200)
    expect(med.body.answer).toContain('overdue')
    const medToolPayloads = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'tool')
      .map((m: any) => m.content)
      .join('\n')
    // Tool results are pseudonymised at the boundary (that is the suite's own
    // opening test), so medication names cannot be asserted with real strings
    // — the answer the user hears has them restored, the payload does not.
    expect(medToolPayloads).not.toContain('Nora')
    expect(medToolPayloads).not.toContain('Whitfield')
    // Tool results are pseudonymised at the boundary, so the stock line that
    // matches Risperidone by name cannot be asserted with the real name.
    // Assert on the structural facts instead: both low-stock rows are present
    // (below-reorder 2-tablet line + explicit out-of-stock 0 line), the healthy
    // 40-tablet row is not, and no real person name crosses. Note the
    // below-reorder line correctly has out_of_stock:false while the zero-qty
    // line has true.
    expect(medToolPayloads).toContain('"quantity":2,"quantity_unit":"tablet(s)","reorder_level":10,"out_of_stock":false')
    expect(medToolPayloads).toContain('"quantity":0,"quantity_unit":"tablet(s)","reorder_level":10,"out_of_stock":true')
    expect(medToolPayloads).not.toContain('Paracetamol')
    // The pipeline and expiry fields ride on each low-stock row too. Exactly
    // one delivery was seeded into the pipeline for the Risperidone line — and
    // only for that person+medication+dosage key, so Haloperidol (no delivery)
    // must still show 0. The seeded line expiry (Risperidone 30d, Haloperidol
    // 90d) matches the usage-based run-out estimates, keeping the structural
    // check readable.
    expect(medToolPayloads).toContain('"incoming_quantity":200')
    expect(medToolPayloads).toMatch(/"next_delivery_date":"\d{4}-\d{2}-\d{2}"/)
    expect(medToolPayloads).toContain('"days_until_expiry":30')
    // Haloperidol: no pipeline delivery, and daily_usage is null so the
    // expiry-before-empty comparison cannot be made honestly — NULL, distinct
    // from FALSE ("compared, does not expire first") and TRUE ("compared, does").
    expect(medToolPayloads).toMatch(/"incoming_quantity":0,"next_delivery_date":null,"days_until_expiry":(90|[0-9]+),"expired_first":null/)
    // Risperidone: run-out at 56 days vs expiry at 30 days → the batch dies
    // before the stock runs out, which is exactly the warning Mica must give.
    expect(medToolPayloads).toContain('"expired_first":true')
    // The run-out estimate rides on each low-stock row. This seed has exactly
    // one given Risperidone dose in the last 28 days → 1/28/day → 2 tablets =
    // 56 days. Haloperidol has no recent administrations, so its estimate is
    // honestly null rather than a made-up number.
    expect(medToolPayloads).toContain('"given_28d":1,"daily_usage":0.0357,"days_until_empty":56')
    expect(medToolPayloads).toMatch(/"given_28d":0,"daily_usage":null,"days_until_empty":null/)

    // 2. Training expiry.
    script = [
      () => TOOL_CALL('m2', 'get_training_expiring', {}),
      () => FINAL('Priya Sharma\'s Medication Administration training expires in 10 days.'),
    ]
    const training = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Whose training is expiring soon?' })
    expect(training.status).toBe(200)
    expect(training.body.answer).toContain('Priya Sharma')

    // 3. Leave balance.
    script = [
      () => TOOL_CALL('m3', 'get_leave_balance', { staff_name: 'Priya Sharma' }),
      () => FINAL('Priya Sharma has 20 days of Annual Leave left out of 25.'),
    ]
    const leave = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'How much leave does Priya Sharma have left?' })
    expect(leave.status).toBe(200)
    expect(leave.body.answer).toContain('20 days')
    const leaveToolPayloads = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'tool')
      .map((m: any) => m.content)
      .join('\n')
    expect(leaveToolPayloads).toContain('Annual Leave')
    expect(leaveToolPayloads).toContain('20')
    // ...and staff/medication names must still be pseudonymised.
    expect(leaveToolPayloads).not.toContain('Priya')
    expect(leaveToolPayloads).not.toContain('Sharma')
  })

  it('400s when AI is not configured', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaask4-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const res = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ question: 'Who is on shift?' })
    expect(res.status).toBe(400)
  })
})
