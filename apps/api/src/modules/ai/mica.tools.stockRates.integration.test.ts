import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createPerson, createLocation,
  createStaffProfile, generateToken,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * days_until_empty must be each line's own run-out, not a shared average.
 *
 * The extrapolation divides the line's quantity by that medication+dosage
 * key's own given-doses-per-day (last 28 days). This suite seeds three
 * medications with intentionally different rates in one organisation —
 * 14 given, 2 given and 7 given doses — and asserts the tool payload shows a
 * distinct, arithmetically-exact days_until_empty per line:
 *
 *   Aricept    7 at 0.5/day  → 14.0 days
 *   Citalopram 1 at 2/28/day → 14.0 days (float rounding must not skew this)
 *   Metformin 21 at 0.25/day → 84.0 days
 *
 * Two lines land on the same day count deliberately: matching final values
 * prove the division happened per line rather than by luck of one rate,
 * while the differing usage/dosage inputs in the same payload prove the
 * inputs were per-line too.
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

describe('get_medication_round — days_until_empty from each line\'s own rate', () => {
  it('extrapolates every low-stock line from its own administration count', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaRates-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const location = await createLocation({ organization_id: org.id, name: 'Rate House' })
    const person = await createPerson({
      organization_id: org.id, first_name: 'Ana', last_name: 'Reyes', status: 'active',
    })
    const carerUser = await createUser({
      email: `micaRatesCarer-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const carer = await createStaffProfile({
      user_id: carerUser.id, first_name: 'Sam', last_name: 'Onyx', location_id: location.id,
    })

    const marRecord = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'MAR Rates', CURRENT_DATE - 10, CURRENT_DATE + 20, 'active', $3)
       RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const marId = marRecord.rows[0].id

    // Three items, three different rates. Quantities are chosen so the
    // arithmetic is exact and each final day-count is unambiguous.
    //   Aricept    5mg  qty  7 — 14 given doses → 0.5/day   → 14.0 days
    //   Citalopram 10mg qty  1 —  2 given doses → 2/28/day  → 14.0 days
    //   Metformin 500mg qty 21 —  7 given doses → 0.25/day  → 84.0 days
    const items = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, instructions, is_active)
       VALUES ($1, 'Aricept', '5', 'mg', 'oral', 'daily', 'Morning', TRUE),
              ($1, 'Citalopram', '10', 'mg', 'oral', 'daily', 'Evening', TRUE),
              ($1, 'Metformin', '500', 'mg', 'oral', 'daily', 'With food', TRUE)
       RETURNING id, name`,
      [marId],
    )
    const itemIds: Record<string, string> = {}
    for (const row of items.rows) itemIds[row.name] = row.id

    // Seed each rate inside one statement each: today at 08:00 keeps
    // scheduled_time inside both the last-28-days usage window and today's
    // round, while the per-item dose count is what the rate actually is.
    // scheduled_time is set explicitly to today at 08:00 rather than
    // date_trunc arithmetic so a run between 00:00 and 08:00 (when minus-13h
    // drifts to *yesterday's* day) still sits inside the 28-day usage window
    // the rate extrapolation reads — deterministically, at any wall clock.
    for (const [name, doses] of [['Aricept', 14], ['Citalopram', 2], ['Metformin', 7]] as const) {
      await migrateQuery(
        `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
         SELECT $1, $2,
                date_trunc('day', NOW())
                  - CASE WHEN EXTRACT(hour FROM NOW()) < 13 THEN interval '1 day' ELSE interval '0 day' END
                  + interval '8 hours'
                  + (($3 || ' minutes')::interval),
                'given'
         FROM generate_series(1, $3::int)`,
        [itemIds[name], carer.id, String(doses)],
      )
    }

    // Stock lines below the tool's low-stock threshold
    // (quantity <= COALESCE(reorder_level, 10)): same med/dosage keys as the
    // items above, distinct quantities. All three must actually be LOW, or the
    // tool (correctly) omits them and the per-line assertion has nothing to
    // assert. Rates:   Aricept 0.5/day, Citalopram 2/28-day, Metformin 0.25/day
    await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, 'Aricept', '5', 'mg', 7, 'tablet(s)', 20, $2, 'active'),
              ($1, 'Citalopram', '10', 'mg', 1, 'tablet(s)', 20, $2, 'active'),
              ($1, 'Metformin', '500', 'mg', 21, 'tablet(s)', 30, $2, 'active')`,
      [org.id, person.id],
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

    script = [
      () => TOOL_CALL('r1', 'get_medication_round', {}),
      () => FINAL('Stock is running low on three lines; Aricept lasts about 14 days, Citalopram about 14 days, Metformin about 84 days.'),
    ]

    const res = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'How long will each medicine last?' })

    expect(res.status).toBe(200)

    const medToolPayloads = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'tool')
      .map((m: any) => m.content)
      .join('\n')

    // Per-line extrapolation: quantity ÷ that line's own 28-day rate.
    // All three stock rows are below reorder, so all three must appear.
    const medicationRoundTool = outbound[0].tools.find((tool: any) => tool.function.name === 'get_medication_round')
    expect(medicationRoundTool.function.description).toContain('already out or run-out within 3 days = urgent')
    expect(medicationRoundTool.function.description).toContain('4–7 days = arrange delivery this week')
    expect(medicationRoundTool.function.description).toContain('expired_first is true')
    expect(outbound[0].messages[0].content).toContain('When asked how urgent a medication reorder is')
    expect(outbound[0].messages[0].content).toContain('4–7 days means arrange delivery this week')
    expect(outbound[0].messages[0].content).toContain('If expired_first is true')
    expect(medToolPayloads).toContain('"given_28d":14,"daily_usage":0.5,"days_until_empty":14')
    expect(medToolPayloads).toContain('"given_28d":2,"daily_usage":0.0714,"days_until_empty":14')
    expect(medToolPayloads).toContain('"given_28d":7,"daily_usage":0.25,"days_until_empty":84')
    // The second provider call replays the tool message, so each stock row
    // appears twice in the outbound transcript. Assert on DISTINCT rate rows
    // instead of raw counts: exactly three lines, each carrying its own rate —
    // proving per-line extrapolation rather than one blended rate.
    const distinctRateRows = new Set(
      (medToolPayloads.match(/"given_28d":\d+,"daily_usage":[\d.]+|"given_28d":\d+,"daily_usage":null/g) || []),
    )
    expect(distinctRateRows).toEqual(new Set([
      '"given_28d":14,"daily_usage":0.5',
      '"given_28d":2,"daily_usage":0.0714',
      '"given_28d":7,"daily_usage":0.25',
    ]))
  })

  it('keeps a no-recent-usage line honestly at days_until_empty null', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micaRates2-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const person = await createPerson({
      organization_id: org.id, first_name: 'Bo', last_name: 'Yu', status: 'active',
    })
    const marRecord = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'MAR Null', CURRENT_DATE - 5, CURRENT_DATE + 25, 'active', $3) RETURNING id`,
      [org.id, person.id, admin.id],
    )
    const carerUser = await createUser({
      email: `micaRates3-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const carer = await createStaffProfile({
      user_id: carerUser.id, first_name: 'Jo', last_name: 'Wren',
    })
    const item = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, instructions, is_active)
       VALUES ($1, 'Amlopidine', '5', 'mg', 'oral', 'daily', 'Morning', TRUE) RETURNING id`,
      [marRecord.rows[0].id],
    )
    // Administrations exist but none in the last 28 days — the rate window is
    // empty, so no rate may be invented from this line.
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, NOW() - interval '60 days', 'given')`,
      [item.rows[0].id, carer.id],
    )
    await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status)
       VALUES ($1, 'Amlopidine', '5', 'mg', 30, 'tablet(s)', 50, $2, 'active')`,
      [org.id, person.id],
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
      () => TOOL_CALL('r2', 'get_medication_round', {}),
      () => FINAL('One line is running low but I cannot estimate how long it will last.'),
    ]

    const res = await request(app)
      .post('/ai/mica/ask')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ question: 'How long will each medicine last?' })

    expect(res.status).toBe(200)
    const medToolPayloads = outbound
      .flatMap((b: any) => b.messages)
      .filter((m: any) => m.role === 'tool')
      .map((m: any) => m.content)
      .join('\n')

    // Outside the 28-day window: no rate, no invented run-out estimate.
    expect(medToolPayloads).toContain('"given_28d":0,"daily_usage":null,"days_until_empty":null')
  })
})
