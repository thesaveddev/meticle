import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createPerson, createLocation, createStaffProfile,
  createShift, createLeaveType, createLeaveRequest, createTrainingModule, createTrainingRecord,
  generateToken, sessionDay,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'

/**
 * Mica's deterministic list answers, end to end.
 *
 * The property under test is the one the carer feels: "who is on shift today",
 * "give me today's appointments" and "how is Nora's medication round looking"
 * are answered from the organisation's own rows with **no AI provider
 * configured** — the same state navigation already works in. The org in these
 * tests has `ai_config.enabled = false`, so any answer at all is proof that no
 * model was involved, and the control case (a question needing judgement) still
 * hits the "AI not configured" gate: the deterministic path swallowed nothing.
 *
 * Nothing is mocked. The real tools in `mica.tools.ts` run the real SQL.
 */
let app: Express
beforeAll(() => { app = createTestApp() })

const ask = (token: string, question: string, sessionId?: string) =>
  request(app).post('/ai/mica/ask').set('Authorization', `Bearer ${token}`)
    .send({ question, ...(sessionId ? { sessionId } : {}) })

async function seedOrg() {
  const org = await createOrg()
  const admin = await createUser({
    email: `micafact-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  // AI deliberately off: every answer below must stand without a provider.
  await migrateQuery(
    `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
    [JSON.stringify({ enabled: false }), org.id],
  )
  return { org, admin, token: generateToken(admin) }
}

/** An instant at local wall-clock hour today, seeded the way the other Mica suites do. */
const at = (hour: number, minute = 0) => new Date(new Date().setHours(hour, minute, 0, 0)).toISOString()

async function seedCarer(orgId: string, locationId: string, first: string, last: string) {
  const user = await createUser({
    email: `micafactstaff-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'CARE_WORKER',
    organization_id: orgId,
  })
  const profile = await createStaffProfile({
    user_id: user.id, first_name: first, last_name: last, location_id: locationId,
  })
  return { user, profile }
}

describe('POST /ai/mica/ask — deterministic list answers, no provider', () => {
  it('answers "who is on shift today" from the rota', async () => {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Oak House' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Fatima', 'Iqbal')
    const shift = await createShift({
      location_id: location.id, start_time: at(8), end_time: at(20), status: 'filled',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (id, shift_id, staff_id, status) VALUES (gen_random_uuid(), $1, $2, 'assigned')`,
      [shift.id, carer.profile.id],
    )

    const res = await ask(seeded.token, 'Who is on shift today?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Fatima Iqbal')
    expect(res.body.answer).toContain('on shift today')
    expect(res.body.navigate).toBeUndefined()
    // No model ran: the provider path is the only one that reports tokens.
    expect(res.body.tokens).toBeUndefined()
    // The answer still joins the conversation, so a follow-up has context.
    expect(res.body.sessionId).toBeTruthy()
  })

  it("answers \"give me today's appointments\" without a provider", async () => {
    const seeded = await seedOrg()
    const person = await createPerson({
      organization_id: seeded.org.id, first_name: 'Ade', last_name: 'Okafor', status: 'active',
    })
    await migrateQuery(
      `INSERT INTO appointments (id, organization_id, person_id, title, start_time, end_time, status)
       VALUES (gen_random_uuid(), $1, $2, 'Dental check', $3, $4, 'scheduled')`,
      [seeded.org.id, person.id, at(14), at(15)],
    )

    const res = await ask(seeded.token, "Give me today's appointments")

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Dental check')
    expect(res.body.answer).toContain('Ade Okafor')
    expect(res.body.tokens).toBeUndefined()
  })

  it('answers a medication round, org-wide and for one named person', async () => {
    const seeded = await seedOrg()
    const person = await createPerson({
      organization_id: seeded.org.id, first_name: 'Nora', last_name: 'Whitfield', status: 'active',
    })
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Beech Ward' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Priya', 'Sharma')

    const chart = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
       VALUES ($1, $2, 'MAR Oct', CURRENT_DATE - 10, CURRENT_DATE + 20, 'active', $3) RETURNING id`,
      [seeded.org.id, person.id, seeded.admin.id],
    )
    const item = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, instructions, is_active)
       VALUES ($1, 'Risperidone', '1', 'mg', 'oral', 'daily', 'With breakfast', TRUE) RETURNING id`,
      [chart.rows[0].id],
    )
    // One dose given this morning, one still overdue from the small hours.
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, $3::timestamptz, 'given'), ($1, $2, $4::timestamptz, 'pending')`,
      [item.rows[0].id, carer.profile.id, at(8), at(1)],
    )
    await migrateQuery(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id, status, expiry_date)
       VALUES ($1, 'Risperidone', '1', 'mg', 2, 'tablet(s)', 10, $2, 'active', CURRENT_DATE + 30)`,
      [seeded.org.id, person.id],
    )

    const orgWide = await ask(seeded.token, 'How is the medication round looking today?')
    expect(orgWide.status).toBe(200)
    expect(orgWide.body.answer).toContain('2 doses are scheduled today')
    expect(orgWide.body.answer).toMatch(/overdue/i)
    expect(orgWide.body.answer).toContain('Risperidone')
    // Facts, not advice: the urgency bands stay with the model.
    expect(orgWide.body.answer).not.toMatch(/\burgent\b/i)

    const forPerson = await ask(seeded.token, "How is Nora Whitfield's medication round looking today?")
    expect(forPerson.status).toBe(200)
    expect(forPerson.body.answer).toContain("Nora Whitfield's medication round today")
    expect(forPerson.body.answer).toContain('Risperidone')
  })

  it('will not guess which person is meant', async () => {
    const seeded = await seedOrg()
    await createPerson({ organization_id: seeded.org.id, first_name: 'Grace', last_name: 'Roberts', status: 'active' })
    await createPerson({ organization_id: seeded.org.id, first_name: 'Grace', last_name: 'Reed', status: 'active' })

    const res = await ask(seeded.token, "How is Grace's medication round looking today?")

    expect(res.status).toBe(200)
    expect(res.body.answer).toMatch(/more than one match/i)
    expect(res.body.answer).toContain('Grace Roberts')
    expect(res.body.answer).toContain('Grace Reed')
    // No round was reported, because no round was resolved.
    expect(res.body.answer).not.toMatch(/doses/)
  })

  it('says so when the name matches nobody', async () => {
    const seeded = await seedOrg()
    const res = await ask(seeded.token, "How is Wilhelmina Webb's medication round looking today?")

    expect(res.status).toBe(200)
    expect(res.body.answer).toMatch(/couldn't find anyone called Wilhelmina Webb/i)
  })

  it('answers who is on leave today', async () => {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Ash Grove' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Jane', 'Doyle')
    const leaveType = await createLeaveType({ organization_id: seeded.org.id, name: 'Annual Leave' })
    const today = await sessionDay(new Date())

    await createLeaveRequest({
      staff_id: carer.profile.id,
      leave_type_id: leaveType.id,
      start_date: today,
      end_date: today,
      status: 'approved',
    })

    const res = await ask(seeded.token, 'Who is on leave today?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Jane Doyle')
    expect(res.body.answer).toContain('on approved leave today')
  })

  it('leaves a question that needs judgement on the model path — and its gate closed', async () => {
    const seeded = await seedOrg()
    const res = await ask(seeded.token, 'How urgent is the Risperidone reorder?')

    // The gate, not an answer: proof that the deterministic path answered only
    // the list questions it claims and swallowed nothing on its way past.
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/AI not configured/i)
    expect(res.body.answer).toBeUndefined()
  })
})

/**
 * The other half of a list answer: the page it came from, offered and then opened
 * by the carer's next word.
 *
 * Tested under the same condition as the answers themselves — `ai_config.enabled =
 * false` — because that is the whole point of the exchange: an organisation with no
 * provider configured can hear "want me to open the rota planner?" and say yes. The
 * control case at the end is what keeps it honest: a "yes" that answered no question
 * opens nothing.
 */
describe('POST /ai/mica/ask — the list answer offers its page, and a "yes" opens it', () => {
  async function seedRota() {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Oak House' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Fatima', 'Iqbal')
    const shift = await createShift({
      location_id: location.id, start_time: at(8), end_time: at(20), status: 'filled',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (id, shift_id, staff_id, status) VALUES (gen_random_uuid(), $1, $2, 'assigned')`,
      [shift.id, carer.profile.id],
    )
    return seeded
  }

  it('answers who is on shift, offers the rota, and opens it on "yes"', async () => {
    const seeded = await seedRota()

    const answered = await ask(seeded.token, 'Who is on shift today?')
    expect(answered.status).toBe(200)
    expect(answered.body.answer).toContain('Fatima Iqbal')
    // The offer is the last sentence, and it opens nothing by itself: the carer
    // asked what is on the rota, not to be taken there.
    expect(answered.body.answer).toMatch(/Want me to open the rota planner\?$/)
    expect(answered.body.offer).toMatchObject({ destination: 'rota', path: '/scheduling' })
    expect(answered.body.navigate).toBeUndefined()

    const confirmed = await ask(seeded.token, 'yes', answered.body.sessionId)
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.navigate).toMatchObject({ destination: 'rota', path: '/scheduling' })
    expect(confirmed.body.answer).toBe('Opening the rota planner.')
  })

  it('opens the appointments list the same way', async () => {
    const seeded = await seedOrg()
    const person = await createPerson({
      organization_id: seeded.org.id, first_name: 'Ade', last_name: 'Okafor', status: 'active',
    })
    await migrateQuery(
      `INSERT INTO appointments (id, organization_id, person_id, title, start_time, end_time, status)
       VALUES (gen_random_uuid(), $1, $2, 'Dental check', $3, $4, 'scheduled')`,
      [seeded.org.id, person.id, at(14), at(15)],
    )

    const answered = await ask(seeded.token, "Give me today's appointments")
    expect(answered.body.offer).toMatchObject({ path: '/appointments' })
    expect(answered.body.answer).toMatch(/Want me to open the appointments list\?$/)

    const confirmed = await ask(seeded.token, 'go on', answered.body.sessionId)
    expect(confirmed.body.navigate.path).toBe('/appointments')
    expect(confirmed.body.answer).toBe('Opening the appointments list.')
  })

  it('offers the page of the latest answer, not the first one it offered', async () => {
    const seeded = await seedRota()

    const first = await ask(seeded.token, 'Who is on shift today?')
    expect(first.body.offer.destination).toBe('rota')

    const second = await ask(seeded.token, "Give me today's appointments", first.body.sessionId)
    expect(second.body.offer.destination).toBe('appointments')

    const confirmed = await ask(seeded.token, 'yes', first.body.sessionId)
    expect(confirmed.body.navigate.path).toBe('/appointments')
  })

  it('opens the page once: a second "yes" cannot re-open it', async () => {
    const seeded = await seedRota()
    const answered = await ask(seeded.token, 'Who is on shift today?')
    expect((await ask(seeded.token, 'yes', answered.body.sessionId)).body.navigate.path).toBe('/scheduling')

    // The confirmation was a turn of its own, so the offer is gone by now, and a
    // "yes" with nothing outstanding falls back through to the gates.
    const again = await ask(seeded.token, 'yes', answered.body.sessionId)
    expect(again.body.navigate).toBeUndefined()
    expect(again.status).toBe(400)
    expect(again.body.error.message).toMatch(/AI not configured/i)
  })

  it('will not open anything on a "yes" that answered no question', async () => {
    const seeded = await seedOrg()
    const res = await ask(seeded.token, 'yes')

    expect(res.status).toBe(400)
    expect(res.body.navigate).toBeUndefined()
  })

  it('offers no page for the list answers that are only lists', async () => {
    const seeded = await seedOrg()
    const res = await ask(seeded.token, 'Who is on leave today?')

    expect(res.status).toBe(200)
    expect(res.body.offer).toBeUndefined()
    expect(res.body.answer).not.toMatch(/want me to open/i)
  })
})

/**
 * The second batch of list questions, end to end and with no provider configured.
 *
 * Same condition as every answer above (`ai_config.enabled = false`), for the same
 * reason: these four were the questions this path used to hand to the tool loop,
 * and they are the ones an organisation with no OpenAI key could not ask at all.
 * Each case seeds real rows through the real tools' SQL and asserts the sentence a
 * carer hears, plus the two controls that keep the boundary honest — a summary is
 * still the model's, and a balance with no name is still the model's.
 *
 * Dates are inserted relative to the *database's* CURRENT_DATE rather than a
 * JavaScript timestamp: the month the incident count is scoped to is the database
 * session's month, and a suite that computed its own would fail for a few hours
 * every month end — the same trap `sessionDay` exists to close.
 */
describe('POST /ai/mica/ask — the next four list questions, still with no provider', () => {
  const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  it('answers whose training is expiring from the training records', async () => {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Oak House' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Priya', 'Sharma')
    const module = await createTrainingModule({ organization_id: seeded.org.id, name: 'Fire Safety' })
    await createTrainingRecord({ module_id: module.id, staff_id: carer.profile.id, expires_at: inDays(10) })

    const res = await ask(seeded.token, 'Whose training is expiring soon?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Priya Sharma')
    expect(res.body.answer).toContain('Fire Safety')
    expect(res.body.answer).toContain('expiring soon')
    expect(res.body.tokens).toBeUndefined()
  })

  it('answers how much leave a staff member has left, aggregated as days plus hours', async () => {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Oak House' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Priya', 'Sharma')
    const leaveType = await createLeaveType({ organization_id: seeded.org.id, name: 'Annual Leave', days_allowed: 28 })
    await migrateQuery(
      `INSERT INTO leave_balances (id, staff_id, leave_type_id, year, days_allocated, days_taken, hours_allocated, hours_taken)
       VALUES (gen_random_uuid(), $1, $2, EXTRACT(YEAR FROM CURRENT_DATE)::int, 28, 16, 0, 0)`,
      [carer.profile.id, leaveType.id],
    )

    const res = await ask(seeded.token, 'How much leave does Priya Sharma have left?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Priya Sharma has 12 days of leave left')
    expect(res.body.tokens).toBeUndefined()
  })

  it('will not answer a balance for a name it cannot place, and says which', async () => {
    const seeded = await seedOrg()
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Oak House' })
    const first = await seedCarer(seeded.org.id, location.id, 'Priya', 'Sharma')
    const second = await seedCarer(seeded.org.id, location.id, 'Priya', 'Kapoor')
    const leaveType = await createLeaveType({ organization_id: seeded.org.id, name: 'Annual Leave' })
    for (const carer of [first, second]) {
      await migrateQuery(
        `INSERT INTO leave_balances (id, staff_id, leave_type_id, year, days_allocated, days_taken, hours_allocated, hours_taken)
         VALUES (gen_random_uuid(), $1, $2, EXTRACT(YEAR FROM CURRENT_DATE)::int, 28, 0, 0, 0)`,
        [carer.profile.id, leaveType.id],
      )
    }

    const res = await ask(seeded.token, 'How much leave does Priya have left?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toMatch(/more than one match/i)
    expect(res.body.answer).toContain('Priya Sharma')
    expect(res.body.answer).toContain('Priya Kapoor')
    // Two colleagues, two balances: neither is read out against the other.
    expect(res.body.answer).not.toMatch(/days of leave left/)
  })

  it('answers who is supporting one person, across the rota', async () => {
    const seeded = await seedOrg()
    const person = await createPerson({
      organization_id: seeded.org.id, first_name: 'Grace', last_name: 'Roberts', status: 'active',
    })
    const location = await createLocation({ organization_id: seeded.org.id, name: 'Oak House' })
    const carer = await seedCarer(seeded.org.id, location.id, 'Priya', 'Sharma')
    const shift = await createShift({
      location_id: location.id, person_id: person.id, start_time: at(8), end_time: at(20), status: 'filled',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (id, shift_id, staff_id, status) VALUES (gen_random_uuid(), $1, $2, 'assigned')`,
      [shift.id, carer.profile.id],
    )

    const res = await ask(seeded.token, 'Who is supporting Grace Roberts today?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('Priya Sharma')
    expect(res.body.answer).toContain('supporting Grace Roberts today')
    expect(res.body.tokens).toBeUndefined()
  })

  it('counts the month\'s incidents, excluding confidential ones and other months', async () => {
    const seeded = await seedOrg()
    // Four rows in one statement, three of them this month: the two the count must
    // find, the confidential one it must not, and last month's, outside the window.
    await migrateQuery(
      `INSERT INTO incidents (id, organization_id, title, description, incident_date, severity, status, is_near_miss, is_confidential)
       VALUES (gen_random_uuid(), $1, 'Fire door held open', 'test', CURRENT_DATE, 'high', 'reported', FALSE, FALSE),
              (gen_random_uuid(), $1, 'Near miss on stairs', 'test', CURRENT_DATE, 'low', 'reported', TRUE, FALSE),
              (gen_random_uuid(), $1, 'Confidential matter', 'test', CURRENT_DATE, 'critical', 'reported', FALSE, TRUE),
              (gen_random_uuid(), $1, 'Last month', 'test', (CURRENT_DATE - interval '40 days')::date, 'medium', 'closed', FALSE, FALSE)`,
      [seeded.org.id],
    )

    const res = await ask(seeded.token, 'How many incidents this month?')

    expect(res.status).toBe(200)
    expect(res.body.answer).toContain('There have been 2 incidents this month')
    expect(res.body.answer).toContain('1 was a near miss')
    // A count, never a record: no title, and nothing from a confidential row.
    expect(res.body.answer).not.toMatch(/fire door|confidential|last month/i)
    expect(res.body.tokens).toBeUndefined()
  })

  it('leaves the two questions with no answer to read on the model path — and its gate closed', async () => {
    const seeded = await seedOrg()

    // A summary of the same incidents the count answers: judgement, not a count.
    const summary = await ask(seeded.token, "Summarise this month's incidents")
    expect(summary.status).toBe(400)
    expect(summary.body.error.message).toMatch(/AI not configured/i)

    // A balance with no name in it: whose balance would be read out?
    const balance = await ask(seeded.token, 'How much leave is left?')
    expect(balance.status).toBe(400)
    expect(balance.body.answer).toBeUndefined()
  })
})
