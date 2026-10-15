import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../../test/helpers'
import {
  createOrg, createUser, createPerson, createLocation,
  createStaffProfile, createNotification, generateToken,
} from '../../../test/factories'
import { migrateQuery } from '../../../shared/database'

/**
 * A notification is about a record, and it says so.
 *
 * The bell used to be a dead end: "New Task Assigned" told a carer they had work and
 * left them to find it, and a Mica task created mid-sentence notified the assignee
 * with no way to open the thing that had just been made. A notification now carries
 * the record's own link — the same path the page reads and the same one an email
 * builds its button out of (`micaRecordPath` in `@meticle/shared`) — so the sentence
 * and the row it names arrive together.
 *
 * Three properties, and they are separate:
 *
 *   1. The direct path: assigning a task through the API raises the notification and
 *      the email, both carrying `/tasks?task=<id>`.
 *   2. The consumer path: a Mica task and a Mica appointment, delivered through the
 *      real outbox and the production consumers, carry the link for the record each
 *      one names — the event's own aggregate, which is the id Mica said out loud.
 *   3. The absent case: a notification about nothing carries no link, because a
 *      guessed link is worse than none.
 */

let app: Express
beforeAll(() => { app = createTestApp() }, 30_000)

/** The email is best-effort and enqueued after the response, so give it a moment. */
async function queuedEmailTo(to: string, contains: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = await migrateQuery(
      `SELECT to_email, subject, html_body FROM email_queue WHERE to_email = $1`,
      [to],
    )
    const match = rows.rows.find((row: any) => String(row.html_body).includes(contains))
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return undefined
}

describe('the record link a notification carries', () => {
  it('links an assigned task in the assignee’s bell and in their email', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `link-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const location = await createLocation({ organization_id: org.id, name: 'Ash Grove' })
    const workerEmail = `link-worker-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
    const worker = await createUser({
      email: workerEmail,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const staff = await createStaffProfile({
      user_id: worker.id, first_name: 'Tom', last_name: 'Bradley', location_id: location.id,
    })

    const created = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ title: 'Order new grip rails', assigned_to: staff.id, priority: 'high', due_date: '2026-11-02' })
    expect(created.status).toBe(201)
    const taskId = created.body.id as string
    expect(taskId).toBeTruthy()

    // 1. The bell entry carries the task it is about.
    const notification = await migrateQuery(
      `SELECT title, link FROM notifications
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [worker.id],
    )
    expect(notification.rows.length).toBe(1)
    expect(notification.rows[0].title).toBe('New Task Assigned')
    expect(notification.rows[0].link).toBe(`/tasks?task=${taskId}`)

    // 2. And so does the email, as an absolute link the recipient's client can
    //    follow — the same path, on the origin the app is served from.
    const email = await queuedEmailTo(workerEmail, `/tasks?task=${taskId}`)
    expect(email, 'no task email was queued for the assignee').toBeDefined()
    expect(String(email!.subject)).toMatch(/task/i)
  })

  it('links what Mica wrote, through the real consumers, for a task and an appointment', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `link-mica-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const location = await createLocation({ organization_id: org.id, name: 'Oak House' })
    const worker = await createUser({
      email: `link-mica-worker-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const staff = await createStaffProfile({
      user_id: worker.id, first_name: 'Priya', last_name: 'Sharma', location_id: location.id,
    })
    await createPerson({ organization_id: org.id, first_name: 'Elsie', last_name: 'Fletcher', status: 'active' })
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

    const taskDraft = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'CREATE_TASK', input: { title: 'Check fire doors', assigneeId: staff.id } })
    expect(taskDraft.status).toBe(200)
    const taskConfirm = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: taskDraft.body })
    expect(taskConfirm.status).toBe(200)
    const taskId = taskConfirm.body.result.taskId as string

    const apptDraft = await request(app)
      .post('/ai/mica/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: 'CREATE_APPOINTMENT',
        input: {
          title: 'Podiatry clinic',
          personName: 'Elsie Fletcher',
          startTime: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    expect(apptDraft.status).toBe(200)
    const apptConfirm = await request(app)
      .post('/ai/mica/actions/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: apptDraft.body })
    expect(apptConfirm.status).toBe(200)
    const appointmentId = apptConfirm.body.result.appointmentId as string

    // Deliver both events through the outbox, with the production consumers
    // registered — the same route production takes.
    const { registerProductionConsumers } = await import('./register')
    const { resetConsumers } = await import('../events.consumers')
    const { processOutbox } = await import('../events.outbox')
    resetConsumers()
    registerProductionConsumers()
    const stats = await processOutbox(org.id)
    expect(stats.published).toBeGreaterThanOrEqual(2)

    const taskNotification = await migrateQuery(
      `SELECT title, link FROM notifications
       WHERE title LIKE 'New task from Mica:%' ORDER BY created_at DESC LIMIT 1`,
    )
    expect(taskNotification.rows.length).toBe(1)
    expect(taskNotification.rows[0].link).toBe(`/tasks?task=${taskId}`)

    const appointmentNotification = await migrateQuery(
      `SELECT title, link FROM notifications
       WHERE title LIKE 'New appointment from Mica:%' ORDER BY created_at DESC LIMIT 1`,
    )
    expect(appointmentNotification.rows.length).toBe(1)
    expect(appointmentNotification.rows[0].link).toBe(`/appointments?appointment=${appointmentId}`)

    // Tidy: leave the registry as other suites expect to find it.
    resetConsumers()
  })

  it('carries no link when a notification is about nothing in particular', async () => {
    const org = await createOrg()
    const user = await createUser({
      email: `link-none-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      password: 'TestPass123!',
      role: 'MANAGER',
      organization_id: org.id,
    })
    await createNotification({ userId: user.id, title: 'Rota published' })

    const list = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${generateToken(user)}`)
    expect(list.status).toBe(200)
    expect(list.body.length).toBe(1)
    // A billing notice or a survey invitation is not a record, and the column is
    // nullable for exactly that reason — a link invented to fill it would open the
    // wrong place, which is the failure this whole contract exists to prevent.
    expect(list.body[0].link).toBeNull()
  })
})
