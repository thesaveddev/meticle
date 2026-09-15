import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const fd = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

describe('GET /homecare/colleagues', () => {
  it('gives a carer the colleagues they can swap or share a ride with, and nobody else', async () => {
    const org = await createOrg()
    const carer = await createUser({ email: `colleagues-carer-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const colleague = await createUser({ email: `colleagues-mate-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const colleagueProfile = await createStaffProfile({ userId: colleague.id })

    const outsiderOrg = await createOrg()
    const outsider = await createUser({ email: `colleagues-outsider-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: outsiderOrg.id })
    await createStaffProfile({ userId: outsider.id })

    const response = await request(app).get('/homecare/colleagues').set('Authorization', `Bearer ${generateToken(carer)}`)

    expect(response.status).toBe(200)
    const entry = response.body.find((row: any) => row.user_id === colleague.id)
    // The staff profile id is what /staff-visits/:staffId takes, so the picker can use it directly.
    expect(entry).toBeTruthy()
    expect(entry.id).toBe(colleagueProfile.id)
    expect(typeof entry.name).toBe('string')
    expect(entry.name.length).toBeGreaterThan(0)

    expect(response.body.some((row: any) => row.user_id === carer.id)).toBe(false)
    expect(response.body.some((row: any) => row.user_id === outsider.id)).toBe(false)
    // Minimal projection: the manager-only staff directory holds contact and employment details.
    expect(response.body.some((row: any) => row.email || row.phone || row.employment_type)).toBe(false)
  })

  it("lets a carer read a colleague's calls, which is how a swap or ride share is chosen", async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `colleagues-manager-${unique()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `colleagues-asker-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const colleague = await createUser({ email: `colleagues-owner-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: carer.id })
    const colleagueProfile = await createStaffProfile({ userId: colleague.id })
    const managerToken = generateToken(manager)

    const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
      person_id: person.id, name: `Colleague package ${unique()}`, start_date: fd(1),
    })
    expect(pkg.status).toBe(201)

    const start = new Date(Date.now() + 5 * 60000)
    const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
      package_id: pkg.body.id, person_id: person.id, assigned_staff_id: colleagueProfile.id,
      visit_type: 'morning', label: 'Morning call',
      scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime() + 3600000).toISOString(),
    })
    expect(visit.status).toBe(201)

    const carerToken = generateToken(carer)
    const colleagues = await request(app).get('/homecare/colleagues').set('Authorization', `Bearer ${carerToken}`)
    const entry = colleagues.body.find((row: any) => row.user_id === colleague.id)
    expect(entry).toBeTruthy()

    const range = `from=${new Date(Date.now() - 3600000).toISOString()}&to=${new Date(Date.now() + 30 * 86400000).toISOString()}`
    const visits = await request(app)
      .get(`/homecare/staff-visits/${entry.id}?${range}`)
      .set('Authorization', `Bearer ${carerToken}`)

    expect(visits.status).toBe(200)
    expect(visits.body.some((v: any) => v.id === visit.body.id)).toBe(true)
  })

  it('requires authentication', async () => {
    const response = await request(app).get('/homecare/colleagues')
    expect(response.status).toBe(401)
  })
})
