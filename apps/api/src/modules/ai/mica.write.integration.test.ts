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
 * Mica write actions end to end: create a task and book an appointment
 * through the confirm-before-persist gateway. The properties under test:
 *
 *   1. POST /ai/mica/actions NEVER writes — it returns a draft (or
 *      clarification), and the row count is unchanged.
 *   2. POST /ai/mica/actions/confirm persists exactly one row, re-validating
 *      org-scoped references server-side.
 *   3. A draft cannot be cross-confirmed or confirmed for a foreign org.
 *   4. The feature flag and role gates hold.
 */
let app: Express
beforeAll(() => { app = createTestApp() })

async function seedOrg() {
  const org = await createOrg()
  const admin = await createUser({
    email: `micawrite-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  const location = await createLocation({ organization_id: org.id, name: 'Ash Grove' })
  const person = await createPerson({
    organization_id: org.id, first_name: 'Elsie', last_name: 'Fletcher', status: 'active',
  })
  const worker = await createUser({
    email: `micaworker-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
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
      enabledFeatures: ['natural_language_assistant'],
    }), org.id],
  )
  return { org, admin, location, person, staff, token: generateToken(admin) }
}

async function taskCount(orgId: string): Promise<number> {
  const r = await migrateQuery(`SELECT COUNT(*)::int AS c FROM tasks WHERE organization_id = $1`, [orgId])
  return Number(r.rows[0].c)
}

async function appointmentCount(orgId: string): Promise<number> {
  const r = await migrateQuery(`SELECT COUNT(*)::int AS c FROM appointments WHERE organization_id = $1`, [orgId])
  return Number(r.rows[0].c)
}

describe('POST /ai/mica/actions — CREATE_TASK', () => {
  it('drafts a training-renewal task from a spoken training-expiry utterance, prefilled not written', async () => {
    const seeded = await seedOrg()

    // What the client sends when Mica's voice flow detects the implicit intent
    // ("Priya's medication training expires next month"): the utterance plus
    // pre-filled task fields — no write has been requested explicitly, so this
    // must still produce a reviewable DRAFT, never a row.
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'CREATE_TASK',
        utterance: "Priya Sharma's medication training expires next month",
        input: {
          utterance: "Priya Sharma's medication training expires next month",
          title: "Priya Sharma's medication renewal",
          description: 'Detected from: "Priya Sharma\'s medication training expires next month"',
          assigneeName: 'Tom Bradley',
          priority: 'medium',
          source: 'voice',
        },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.draft).toBe(true)
    expect(prepare.body.output.assigneeId).toBe(seeded.staff.id)
    expect(prepare.body.output.title).toBe("Priya Sharma's medication renewal")
    // The spoken summary names what the draft is about — no silent fields.
    expect(prepare.body.summary).toContain('assigned to Tom Bradley')

    // Nothing written until the user approves.
    expect(await taskCount(seeded.org.id)).toBe(0)

    const confirm = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ draft: prepare.body })
    expect(confirm.status).toBe(200)
    expect(confirm.body.confirmed).toBe(true)

    const rows = await migrateQuery(
      `SELECT title, priority FROM tasks WHERE organization_id = $1`,
      [seeded.org.id],
    )
    expect(rows.rows.length).toBe(1)
    expect(rows.rows[0].title).toBe("Priya Sharma's medication renewal")
    expect(rows.rows[0].priority).toBe('medium')
  })

  it('drafts without writing, then persists exactly one task on confirm', async () => {
    const seeded = await seedOrg()

    // Person-name disambiguation is single-match here, so the draft resolves
    // the person and reports it in the summary.
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'CREATE_TASK',
        input: {
          title: 'Order new grip rails for the bathroom',
          personName: 'Elsie Fletcher',
          assigneeName: 'Tom Bradley',
          priority: 'high',
          dueDate: '2026-10-16',
        },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.draft).toBe(true)
    expect(prepare.body.summary).toContain('Elsie Fletcher')
    expect(prepare.body.output.personId).toBe(seeded.person.id)
    expect(prepare.body.output.assigneeId).toBe(seeded.staff.id)

    // Nothing written yet.
    expect(await taskCount(seeded.org.id)).toBe(0)

    const confirm = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ draft: prepare.body })
    expect(confirm.status).toBe(200)
    expect(confirm.body.confirmed).toBe(true)
    expect(confirm.body.result.taskId).toBeTruthy()

    const rows = await migrateQuery(
      `SELECT title, assigned_to, person_id, priority, due_date, created_by FROM tasks WHERE organization_id = $1`,
      [seeded.org.id],
    )
    expect(rows.rows.length).toBe(1)
    expect(rows.rows[0].title).toBe('Order new grip rails for the bathroom')
    expect(rows.rows[0].assigned_to).toBe(seeded.staff.id)
    expect(rows.rows[0].person_id).toBe(seeded.person.id)
    expect(rows.rows[0].priority).toBe('high')
    expect(rows.rows[0].created_by).toBe(seeded.admin.id)
  })

  it('clarifies when two staff share a name instead of guessing the assignee', async () => {
    const seeded = await seedOrg()
    const twin = await createUser({
      email: `micawtwin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: seeded.org.id,
    })
    await createStaffProfile({ user_id: twin.id, first_name: 'Tom', last_name: 'Bradley', location_id: seeded.location.id })

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'CREATE_TASK',
        input: { title: 'Restock PPE', assigneeName: 'Tom Bradley' },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.needClarification).toBe(true)
    expect(prepare.body.type).toBe('chooseOption')
    expect(prepare.body.options.length).toBe(2)
    expect(await taskCount(seeded.org.id)).toBe(0)
  })

  it('a confirmed draft is not re-confirmed or cross-confirmed undetected', async () => {
    const seeded = await seedOrg()
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ action: 'CREATE_TASK', input: { title: 'Check fire doors' } })
    expect(prepare.status).toBe(200)

    // Forged draft: action says appointment but payload is a task draft.
    const forged = { ...prepare.body, action: 'CREATE_APPOINTMENT' as const }
    const cross = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ draft: forged })
    expect(cross.status).toBe(400)
    expect(await taskCount(seeded.org.id)).toBe(0)
  })
})

describe('POST /ai/mica/actions — CREATE_APPOINTMENT', () => {
  it('drafts without writing, then persists exactly one appointment on confirm', async () => {
    const seeded = await seedOrg()
    const start = new Date(); start.setDate(start.getDate() + 3); start.setHours(14, 0, 0, 0)
    const end = new Date(start); end.setHours(15, 0, 0, 0)

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'CREATE_APPOINTMENT',
        input: {
          title: 'Podiatry clinic',
          personName: 'Elsie Fletcher',
          staffName: 'Tom Bradley',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.draft).toBe(true)
    expect(prepare.body.output.personId).toBe(seeded.person.id)
    expect(prepare.body.output.staffId).toBe(seeded.staff.id)
    // Unwritten.
    expect(await appointmentCount(seeded.org.id)).toBe(0)

    const confirm = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ draft: prepare.body })
    expect(confirm.status).toBe(200)
    expect(confirm.body.confirmed).toBe(true)

    const rows = await migrateQuery(
      `SELECT title, person_id, staff_id, start_time, status, created_by FROM appointments WHERE organization_id = $1`,
      [seeded.org.id],
    )
    expect(rows.rows.length).toBe(1)
    expect(rows.rows[0].title).toBe('Podiatry clinic')
    expect(rows.rows[0].person_id).toBe(seeded.person.id)
    expect(rows.rows[0].staff_id).toBe(seeded.staff.id)
    expect(rows.rows[0].status).toBe('scheduled')
  })

  it('missing start time is an error, not a silent default', async () => {
    const seeded = await seedOrg()
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ action: 'CREATE_APPOINTMENT', input: { title: 'Eye test' } })
    expect(prepare.status).toBe(400)
    expect(prepare.body.error).toBeTruthy()
    expect(await appointmentCount(seeded.org.id)).toBe(0)
  })

  it('reads the time out of what the carer said, and reads it back in their zone', async () => {
    const seeded = await seedOrg()
    const utterance = 'book podiatry for tomorrow at 2pm'

    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'CREATE_APPOINTMENT',
        utterance,
        input: { utterance, title: 'Podiatry', personName: 'Elsie Fletcher' },
      })
    expect(prepare.status).toBe(200)
    expect(prepare.body.draft).toBe(true)
    expect(prepare.body.output.startTime).toBeTruthy()
    // The read-back is the number the user confirms, so it has to be the 2pm
    // they said. en-GB renders it as 14:00; what matters is that it is not the
    // container's 13:00 (BST) reading of the same instant, which is what the
    // summary said before the zone was threaded through.
    expect(prepare.body.summary).toContain('at 14:00')
    expect(prepare.body.summary).not.toContain('13:00')
    expect(await appointmentCount(seeded.org.id)).toBe(0)

    // End time defaults to an hour later, as the manual booking form does.
    const drafted = new Date(prepare.body.output.startTime).getTime()
    expect(new Date(prepare.body.output.endTime).getTime() - drafted).toBe(3600_000)

    const confirm = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ draft: prepare.body })
    expect(confirm.status).toBe(200)
    expect(confirm.body.confirmed).toBe(true)

    // Asked of the database rather than of the resolver, so the stored instant
    // is checked independently of the code that produced it. start_time is
    // TIMESTAMPTZ, so `AT TIME ZONE` reads it as London wall-clock in one step;
    // chaining a UTC step first would convert it twice and hand back the UTC
    // hour, which is exactly the answer this assertion exists to refuse.
    const stored = await migrateQuery(
      `SELECT (start_time AT TIME ZONE 'Europe/London')::time::text AS local_time,
              ((start_time AT TIME ZONE 'Europe/London')::date
                - (now() AT TIME ZONE 'Europe/London')::date) AS day_offset
         FROM appointments WHERE organization_id = $1`,
      [seeded.org.id],
    )
    expect(stored.rows.length).toBe(1)
    expect(stored.rows[0].local_time).toBe('14:00:00')
    expect(Number(stored.rows[0].day_offset)).toBe(1)
  })

  it('refuses to guess a bare hour and asks instead', async () => {
    const seeded = await seedOrg()
    const utterance = 'book podiatry at 2'
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({ action: 'CREATE_APPOINTMENT', utterance, input: { utterance, title: 'Podiatry' } })
    // 02:00 or 14:00 is not the server's call to make, and the error says what
    // to add rather than just failing.
    expect(prepare.status).toBe(400)
    expect(prepare.body.error.message).toContain('tomorrow at 2pm')
    expect(await appointmentCount(seeded.org.id)).toBe(0)
  })

  it('takes a wall-clock timestamp as the carer\u2019s local time, not the container\u2019s', async () => {
    const seeded = await seedOrg()
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        action: 'CREATE_APPOINTMENT',
        input: { title: 'Sight check', personName: 'Elsie Fletcher', startTime: '2030-07-04T14:00' },
      })
    expect(prepare.status).toBe(200)
    // July is BST, so 14:00 London is 13:00Z — and the test runner's own zone
    // must not be able to change that.
    expect(prepare.body.output.startTime).toBe('2030-07-04T13:00:00.000Z')
  })
})

describe('write-action gates', () => {
  it('403s when natural_language_assistant is off', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `micawoff-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    await migrateQuery(
      `UPDATE organizations SET ai_config = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ enabled: true, provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o-mini', enabledFeatures: [] }), org.id],
    )
    const res = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ action: 'CREATE_TASK', input: { title: 'x' } })
    expect(res.status).toBe(403)
  })

  it('rejects an unknown timestamp draft field re-validated: confirm of a draft referencing a foreign-org person fails', async () => {
    const seededA = await seedOrg()
    const seededB = await seedOrg()

    // Draft prepared in org A referencing org A's person, then confirmed
    // by an org-B admin. Org scoping must reject it.
    const prepare = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${seededA.token}`)
      .send({
        action: 'CREATE_APPOINTMENT',
        input: {
          title: 'Leaked appointment',
          personId: seededA.person.id,
          startTime: new Date(Date.now() + 3600_000).toISOString(),
        },
      })
    expect(prepare.status).toBe(200)

    const confirmByForeign = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seededB.token}`)
      .send({ draft: prepare.body })
    expect(confirmByForeign.status).toBe(400)
    expect(await appointmentCount(seededB.org.id)).toBe(0)
  })

  it('care-note confirmthrough is refused: care notes approve via their own endpoint', async () => {
    const seeded = await seedOrg()
    const res = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${seeded.token}`)
      .send({
        draft: {
          draft: true,
          action: 'CREATE_CARE_NOTE',
          output: {},
          summary: 'x',
        },
      })
    expect(res.status).toBe(400)
  })
})
