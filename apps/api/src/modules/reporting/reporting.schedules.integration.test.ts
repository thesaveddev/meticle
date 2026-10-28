import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { nextOccurrence } from './reporting.delivery'
import { runDueReportSchedules } from './reporting.delivery'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

const REPORT_CONFIG = {
  name: 'Scheduled staffing snapshot',
  description: '',
  dataset: 'staff',
  columns: ['first_name', 'last_name', 'role'],
  filters: [],
  group_by: null,
  aggregations: [],
  sort_by: null,
  sort_dir: 'desc',
  row_limit: 500,
  chart_type: 'table',
}

async function setupReport(token: string) {
  const res = await request(app).post('/reporting/custom').set('Authorization', `Bearer ${token}`).send(REPORT_CONFIG)
  expect(res.status).toBe(201)
  return res.body.report.id as string
}

describe('Custom report schedules — next occurrence', () => {
  it('computes daily, weekly and monthly runs in the org timezone', () => {
    // Monday 2026-10-26 07:00 UTC == 07:00 in UTC winter clock
    const monday = new Date('2026-10-26T07:00:00Z')
    const daily = nextOccurrence({ frequency: 'daily', send_time: '08:00' }, 'UTC', monday)
    expect(daily.toISOString()).toBe('2026-10-26T08:00:00.000Z')

    // Same time already passed today → tomorrow
    const late = nextOccurrence({ frequency: 'daily', send_time: '06:00' }, 'UTC', monday)
    expect(late.toISOString()).toBe('2026-10-27T06:00:00.000Z')

    // Weekly: Monday 07:00, schedule Monday 08:00 → today; Friday 08:00 → Friday
    const weeklyToday = nextOccurrence({ frequency: 'weekly', day_of_week: 1, send_time: '08:00' }, 'UTC', monday)
    expect(weeklyToday.toISOString()).toBe('2026-10-26T08:00:00.000Z')
    const weeklyFri = nextOccurrence({ frequency: 'weekly', day_of_week: 5, send_time: '08:00' }, 'UTC', monday)
    expect(weeklyFri.toISOString()).toBe('2026-10-30T08:00:00.000Z')

    // Monthly on the 1st, from Oct 26 → Nov 1
    const monthly = nextOccurrence({ frequency: 'monthly', day_of_month: 1, send_time: '09:30' }, 'UTC', monday)
    expect(monthly.toISOString()).toBe('2026-11-01T09:30:00.000Z')

    // Europe/London is UTC+1 in July (BST): 08:00 wall = 07:00 UTC.
    // (Late October is GMT again — the clocks go back on the 25th.)
    const julyMonday = new Date('2026-07-06T06:59:00Z')
    const londonSummer = nextOccurrence({ frequency: 'daily', send_time: '08:00' }, 'Europe/London', julyMonday)
    expect(londonSummer.toISOString()).toBe('2026-07-06T07:00:00.000Z')
    const londonWinter = nextOccurrence({ frequency: 'daily', send_time: '08:00' }, 'Europe/London', monday)
    expect(londonWinter.toISOString()).toBe('2026-10-26T08:00:00.000Z')

    // An unknown zone never throws — it falls back to UTC
    const fallback = nextOccurrence({ frequency: 'daily', send_time: '08:00' }, 'Not/AZone', monday)
    expect(fallback.toISOString()).toBe('2026-10-26T08:00:00.000Z')
  })
})

describe('Custom report schedules — API', () => {
  it('creates, lists, updates and deletes a schedule, and rejects bad input', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `sched-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)
    const reportId = await setupReport(token)

    const recipients = await request(app).get('/reporting/custom/recipients').set('Authorization', `Bearer ${token}`)
    expect(recipients.status).toBe(200)
    expect(recipients.body.recipients.some((r: any) => r.id === mgr.id)).toBe(true)

    const created = await request(app).post(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`).send({
      frequency: 'weekly', day_of_week: 1, send_time: '08:00', recipient_ids: [mgr.id], enabled: true,
    })
    expect(created.status).toBe(201)
    expect(created.body.schedule.frequency).toBe('weekly')
    expect(created.body.schedule.next_run_at).toBeTruthy()

    // Weekly without a day, a bad time, and a stranger as recipient are all 400
    const noDay = await request(app).post(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`).send({
      frequency: 'weekly', send_time: '08:00', recipient_ids: [mgr.id],
    })
    expect(noDay.status).toBe(400)

    const badTime = await request(app).post(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`).send({
      frequency: 'daily', send_time: '25:00', recipient_ids: [mgr.id],
    })
    expect(badTime.status).toBe(400)

    const stranger = await request(app).post(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`).send({
      frequency: 'daily', send_time: '08:00', recipient_ids: ['00000000-0000-0000-0000-000000000000'],
    })
    expect(stranger.status).toBe(400)

    const listed = await request(app).get(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.schedules).toHaveLength(1)

    const updated = await request(app).put(`/reporting/custom/${reportId}/schedules/${created.body.schedule.id}`)
      .set('Authorization', `Bearer ${token}`).send({
        frequency: 'daily', send_time: '09:00', recipient_ids: [mgr.id], enabled: false,
      })
    expect(updated.status).toBe(200)
    expect(updated.body.schedule.frequency).toBe('daily')
    expect(updated.body.schedule.enabled).toBe(false)

    const deleted = await request(app).delete(`/reporting/custom/${reportId}/schedules/${created.body.schedule.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)

    const relisted = await request(app).get(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`)
    expect(relisted.body.schedules).toHaveLength(0)
  })

  it('rejects a CARE_WORKER managing schedules (403)', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `sched-mgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const reportId = await setupReport(generateToken(mgr))
    const worker = await createUser({ email: `sched-w-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app).get(`/reporting/custom/${reportId}/schedules`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('delivers a due schedule by email and advances it', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `sched-deliver-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)
    const reportId = await setupReport(token)

    const created = await request(app).post(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`).send({
      frequency: 'daily', send_time: '08:00', recipient_ids: [mgr.id], enabled: true,
    })
    expect(created.status).toBe(201)
    const scheduleId = created.body.schedule.id as string

    // Force the schedule due, then run the sweep directly
    await migrateQuery(`UPDATE custom_report_schedules SET next_run_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [scheduleId])
    const result = await runDueReportSchedules()
    expect(result.checked).toBeGreaterThanOrEqual(1)
    expect(result.sent).toBeGreaterThanOrEqual(1)

    const rows = await migrateQuery(
      `SELECT next_run_at, last_run_at, last_error FROM custom_report_schedules WHERE id = $1`, [scheduleId])
    expect(new Date(rows.rows[0].next_run_at).getTime()).toBeGreaterThan(Date.now())
    expect(rows.rows[0].last_run_at).toBeTruthy()
    expect(rows.rows[0].last_error).toBeNull()

    const queued = await migrateQuery(
      `SELECT id FROM email_queue WHERE to_email = $1 ORDER BY created_at DESC LIMIT 1`, [mgr.email])
    expect(queued.rows.length).toBe(1)

    // The sweep records one history row per attempt: sent with counts.
    const history = await migrateQuery(
      `SELECT status, recipient_count, row_count, error FROM custom_report_deliveries WHERE schedule_id = $1 ORDER BY ran_at DESC`,
      [scheduleId])
    expect(history.rows.length).toBe(1)
    expect(history.rows[0].status).toBe('sent')
    expect(history.rows[0].recipient_count).toBe(1)
    expect(history.rows[0].row_count).toBeGreaterThanOrEqual(0)
    expect(history.rows[0].error).toBeNull()

    const served = await request(app).get(`/reporting/custom/${reportId}/schedules/${scheduleId}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
    expect(served.status).toBe(200)
    expect(served.body.deliveries).toHaveLength(1)
    expect(served.body.deliveries[0].status).toBe('sent')
    expect(served.body.deliveries[0].recipient_count).toBe(1)

    // A broken report still advances the schedule and records the failure.
    await migrateQuery(`UPDATE custom_reports SET columns = '["nope"]' WHERE id = $1`, [reportId])
    await migrateQuery(`UPDATE custom_report_schedules SET next_run_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [scheduleId])
    const retry = await runDueReportSchedules()
    expect(retry.failed).toBeGreaterThanOrEqual(1)

    const afterFail = await migrateQuery(
      `SELECT status, error FROM custom_report_deliveries WHERE schedule_id = $1 ORDER BY ran_at DESC`, [scheduleId])
    expect(afterFail.rows.length).toBe(2)
    expect(afterFail.rows[0].status).toBe('failed')
    expect(afterFail.rows[0].error).toBeTruthy()

    await migrateQuery(`DELETE FROM custom_report_schedules WHERE id = $1`, [scheduleId])
  }, 60_000)

  it('serves delivery history scoped to the schedule', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `sched-hist-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)
    const reportId = await setupReport(token)
    const created = await request(app).post(`/reporting/custom/${reportId}/schedules`).set('Authorization', `Bearer ${token}`).send({
      frequency: 'daily', send_time: '08:00', recipient_ids: [mgr.id], enabled: true,
    })
    const scheduleId = created.body.schedule.id as string

    // Unknown schedule, bad limit, and a worker outside the role gate.
    const missing = await request(app).get(`/reporting/custom/${reportId}/schedules/00000000-0000-0000-0000-000000000000/deliveries`)
      .set('Authorization', `Bearer ${token}`)
    expect(missing.status).toBe(404)

    const badLimit = await request(app).get(`/reporting/custom/${reportId}/schedules/${scheduleId}/deliveries?limit=99`)
      .set('Authorization', `Bearer ${token}`)
    expect(badLimit.status).toBe(400)

    const otherOrg = await createOrg()
    const worker = await createUser({ email: `sched-hist-w-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: otherOrg.id })
    const forbidden = await request(app).get(`/reporting/custom/${reportId}/schedules/${scheduleId}/deliveries`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(forbidden.status).toBe(403)

    // A teammate in another org cannot read this org's history through their own report id.
    const otherMgr = await createUser({ email: `sched-hist-o-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: otherOrg.id })
    const otherReportId = await setupReport(generateToken(otherMgr))
    const crossOrg = await request(app).get(`/reporting/custom/${otherReportId}/schedules/${scheduleId}/deliveries`)
      .set('Authorization', `Bearer ${generateToken(otherMgr)}`)
    expect(crossOrg.status).toBe(404)

    await migrateQuery(`DELETE FROM custom_report_schedules WHERE id = $1`, [scheduleId])
  }, 60_000)

  it('sends a saved report to the requester on demand', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `sched-now-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)
    const reportId = await setupReport(token)

    const res = await request(app).post(`/reporting/custom/${reportId}/send-now`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.sent).toBe(true)
    expect(res.body.to).toBe(mgr.email)
  }, 60_000)
})
