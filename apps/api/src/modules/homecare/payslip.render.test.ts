import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken, sessionDay } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

const fd = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

// PDFs are rendered by headless Chrome. The suite runs without a browser in CI,
// so this level of check only runs where a browser is actually installed.
const browserAvailable = !!process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].some(candidate => fs.existsSync(candidate))

describe.skipIf(!browserAvailable)('payslip render', () => {
  it('returns a rendered PDF for the carer', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `render-manager-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `render-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
      person_id: person.id, name: `Render package ${Date.now()}`, start_date: fd(1), hourly_rate_pence: 1500, travel_time_paid: true, mileage_rate_pence: 45,
    })
    const start = new Date(Date.now() + 5 * 60000)
    const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
      package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Morning call',
      scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime() + 3600000).toISOString(),
    })
    await request(app).post(`/homecare/visits/${visit.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 12, actual_travel_minutes: 15, actual_mileage_miles: 4.2 })
    await request(app).post(`/homecare/visits/${visit.body.id}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10, actual_mileage_miles: 4.2, note: 'Done.' })

    const day = await sessionDay(start)
    const res = await request(app)
      .get(`/homecare/my-payslip?from=${day}&to=${day}`)
      .set('Authorization', `Bearer ${carerToken}`)
      .buffer(true)
      .parse((response: any, cb: any) => {
        const chunks: any[] = []
        response.on('data', (c: any) => chunks.push(c))
        response.on('end', () => cb(null, Buffer.concat(chunks)))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-')
    expect(res.body.length).toBeGreaterThan(5000)
  }, 90_000)
})
