/**
 * Regulator registrations, and the last two England-only queries.
 *
 * Three separate things are pinned here because they were separately wrong:
 *
 *   1. A provider could not record a registration number with any regulator,
 *      because no such field existed. Now it can, and more than one at a time.
 *   2. Two dashboard/widget queries counted `d.type = 'DBS'`, so a Scottish
 *      provider's PVG records and a Northern Irish provider's AccessNI checks
 *      were invisible and the tile read 0%.
 *   3. The DBS application service minted a DBS certificate for any worker,
 *      including a Scot. A DBS cannot be issued for someone outside England and
 *      Wales, so that produced evidence their regulator would not accept.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery as db } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function orgAdmin(role = 'ORG_ADMIN') {
  const org = await createOrg()
  const user = await createUser({
    email: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: 'TestPass123!',
    role,
    organization_id: org.id,
  })
  return { org, user, token: generateToken(user) }
}

async function putRegistration(token: string, regulator_id: string, registration_number: string, verified = false) {
  return request(app)
    .put('/compliance/regulator-registrations')
    .set('Authorization', `Bearer ${token}`)
    .send({ regulator_id, registration_number, verified })
}

describe('recording a registration', () => {
  it('lists every regulator, recorded or not', async () => {
    const { token } = await orgAdmin()
    const res = await request(app)
      .get('/compliance/regulator-registrations')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.registrations).toHaveLength(4)
    expect(res.body.registered_count).toBe(0)
    // Nothing recorded, but every body is on screen so "nothing entered" is
    // distinguishable from "nothing to do".
    for (const r of res.body.registrations) {
      expect(r.recorded).toBe(false)
      expect(r.registration_number).toBeNull()
      expect(r.label).toBeTruthy()
    }
  })

  it('records a CIW registration for a Welsh provider', async () => {
    const { token } = await orgAdmin()
    const res = await putRegistration(token, 'ciw', 'CYM00002456')

    expect(res.status).toBe(200)
    const ciw = res.body.registrations.find((r: any) => r.regulator_id === 'ciw')
    expect(ciw.registration_number).toBe('CYM00002456')
    expect(ciw.recorded).toBe(true)
    expect(ciw.register_url).toContain('careinspectorate.wales')
    expect(res.body.registered_count).toBe(1)
  })

  it('records an RQIA registration for a Northern Irish provider', async () => {
    const { token } = await orgAdmin()
    const res = await putRegistration(token, 'rqia', 'RQ-2026-0042')

    expect(res.status).toBe(200)
    expect(res.body.registrations.find((r: any) => r.regulator_id === 'rqia').registration_number)
      .toBe('RQ-2026-0042')
  })

  it('records more than one registration for a national operator', async () => {
    // The reason this is a table and not a column: an English provider running
    // a service in Wales holds both numbers, and a single field loses one.
    const { token } = await orgAdmin()
    await putRegistration(token, 'cqc', '1-2345678901')
    const res = await putRegistration(token, 'ciw', 'CYM00002456')

    expect(res.body.registered_count).toBe(2)
    const byId = Object.fromEntries(res.body.registrations.map((r: any) => [r.regulator_id, r.registration_number]))
    expect(byId.cqc).toBe('1-2345678901')
    expect(byId.ciw).toBe('CYM00002456')
  })

  it('updates rather than duplicating when resubmitted', async () => {
    const { token } = await orgAdmin()
    await putRegistration(token, 'cqc', 'OLD-NUMBER')
    const res = await putRegistration(token, 'cqc', 'NEW-NUMBER')

    const cqc = res.body.registrations.filter((r: any) => r.regulator_id === 'cqc')
    expect(cqc).toHaveLength(1)
    expect(cqc[0].registration_number).toBe('NEW-NUMBER')
  })

  it('keeps a CIW number containing a forward slash intact', async () => {
    // gov.wales: older CIW numbers may contain '/' and "this must be included".
    // Normalising punctuation would silently corrupt a real identifier.
    const { token } = await orgAdmin()
    const res = await putRegistration(token, 'ciw', 'W15/12345678')
    expect(res.body.registrations.find((r: any) => r.regulator_id === 'ciw').registration_number)
      .toBe('W15/12345678')
  })

  it('leaves a number unverified until a human says they checked it', async () => {
    const { token } = await orgAdmin()
    let res = await putRegistration(token, 'cqc', '1-2345678901')
    expect(res.body.registrations.find((r: any) => r.regulator_id === 'cqc').verified_at).toBeNull()

    res = await putRegistration(token, 'cqc', '1-2345678901', true)
    expect(res.body.registrations.find((r: any) => r.regulator_id === 'cqc').verified_at)
      .toBeTruthy()
  })

  it('shows a verified format hint for Wales and none for England', async () => {
    const { token } = await orgAdmin()
    const res = await request(app)
      .get('/compliance/regulator-registrations')
      .set('Authorization', `Bearer ${token}`)

    const byId = Object.fromEntries(res.body.registrations.map((r: any) => [r.regulator_id, r]))
    expect(byId.ciw.format_hint).toContain('CYM')
    // We have not verified CQC's numbering, so no hint rather than a guess.
    expect(byId.cqc.format_hint).toBeNull()
  })

  it('rejects a workforce body, which registers people rather than services', async () => {
    const { token } = await orgAdmin()
    // Social Care Wales is not in the regulators table at all, so the
    // controller rejects it before the database is reached.
    const res = await putRegistration(token, 'social_care_wales', 'SCW-12345')
    expect(res.status).toBe(400)
  })

  it('rejects an unknown regulator', async () => {
    const { token } = await orgAdmin()
    expect((await putRegistration(token, 'nonsense', 'X')).status).toBe(400)
  })

  it('rejects an empty number', async () => {
    const { token } = await orgAdmin()
    expect((await putRegistration(token, 'cqc', '   ')).status).toBe(400)
  })

  it('stops a manager changing it', async () => {
    const { token } = await orgAdmin('MANAGER')
    expect((await putRegistration(token, 'cqc', '1-2345678901')).status).toBe(403)
  })

  it('lets a manager and a compliance officer read it', async () => {
    // Reading a registration is not the same decision as setting one, and a
    // compliance officer's job is to be able to see it.
    for (const role of ['MANAGER', 'COMPLIANCE_OFFICER']) {
      const { token } = await orgAdmin(role)
      const res = await request(app)
        .get('/compliance/regulator-registrations')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status, role).toBe(200)
    }
  })

  it('requires auth', async () => {
    expect((await request(app).get('/compliance/regulator-registrations')).status).toBe(401)
    expect((await request(app).get('/compliance/regulators')).status).toBe(401)
  })

  it('removes a registration only when asked explicitly', async () => {
    const { token } = await orgAdmin()
    await putRegistration(token, 'cqc', '1-2345678901')
    const res = await request(app)
      .delete('/compliance/regulator-registrations')
      .set('Authorization', `Bearer ${token}`)
      .send({ regulator_id: 'cqc' })

    expect(res.status).toBe(200)
    expect(res.body.registered_count).toBe(0)
  })

  it('keeps one organisation registrations out of another’s', async () => {
    const a = await orgAdmin()
    const b = await orgAdmin()
    await putRegistration(a.token, 'cqc', 'AAA-111')

    const res = await request(app)
      .get('/compliance/regulator-registrations')
      .set('Authorization', `Bearer ${b.token}`)
    expect(res.body.registered_count).toBe(0)
  })
})

describe('background check counts follow the nation', () => {
  async function widgetCoverage(vettingScheme?: string, docs: string[] = []) {
    const org = await createOrg()
    if (vettingScheme) {
      await db('UPDATE organizations SET vetting_scheme = $1 WHERE id = $2', [vettingScheme, org.id])
    }
    const admin = await createUser({
      email: `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })
    const su = await createUser({
      email: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
      password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
    })
    const staff = await createStaffProfile({ user_id: su.id })
    for (const type of docs) {
      await db(
        `INSERT INTO documents (staff_id, type, url, status, expiry_date)
         VALUES ($1, $2, '/files/private/t.pdf', 'approved', '2099-01-01')`,
        [staff.id, type],
      )
    }
    const res = await request(app)
      .get('/cqc/homecare-compliance')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    return res.body
  }

  it('counts a PVG for a Scottish provider', async () => {
    const body = await widgetCoverage('pvg_scotland', ['PVG', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK'])
    // Before the fix this read 0 of 1, because the filter was d.type = 'DBS'.
    expect(body.dbs.compliant).toBe(1)
    expect(body.dbs.rate).toBe(100)
  })

  it('counts an AccessNI check for a Northern Irish provider', async () => {
    const body = await widgetCoverage('accessni_northern_ireland', ['ACCESSNI', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK'])
    expect(body.dbs.rate).toBe(100)
  })

  it('still counts a DBS for an English provider', async () => {
    const body = await widgetCoverage(undefined, ['DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK'])
    expect(body.dbs.rate).toBe(100)
  })

  it('does not count a passport as a background check', async () => {
    const body = await widgetCoverage('pvg_scotland', ['PASSPORT', 'VISA', 'RIGHT_TO_WORK'])
    expect(body.dbs.rate).toBe(0)
  })
})

describe('the DBS service refuses a nation it does not serve', () => {
  async function staffIn(scheme?: string) {
    const org = await createOrg()
    if (scheme) {
      await db('UPDATE organizations SET vetting_scheme = $1 WHERE id = $2', [scheme, org.id])
    }
    const admin = await createUser({
      email: `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
      password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id,
    })
    const su = await createUser({
      email: `ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
      password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id,
    })
    return { org, token: generateToken(admin), staff: await createStaffProfile({ user_id: su.id }) }
  }

  it('creates a check for an English worker', async () => {
    const { org, token, staff } = await staffIn()
    const res = await request(app)
      .post('/dbs/checks')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id, level: 'enhanced', workforce: 'adult' })
    expect(res.status).toBeLessThan(400)
  })

  it('refuses for a Scottish worker and names the check that applies', async () => {
    const { token, staff } = await staffIn('pvg_scotland')
    const res = await request(app)
      .post('/dbs/checks')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id, level: 'enhanced', workforce: 'adult' })

    expect(res.status).toBe(400)
    // A refusal with a route attached. Silently minting a DBS for a Scot would
    // produce evidence Scotland's regulator does not accept.
    expect(res.body.message).toMatch(/PVG/)
  })

  it('refuses for a Northern Irish worker and names AccessNI', async () => {
    const { token, staff } = await staffIn('accessni_northern_ireland')
    const res = await request(app)
      .post('/dbs/checks')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id, level: 'enhanced', workforce: 'adult' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/AccessNI/)
  })

  it('still allows a Welsh worker, who is on the DBS scheme', async () => {
    const { token, staff } = await staffIn('ciw_wales')
    const res = await request(app)
      .post('/dbs/checks')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id, level: 'enhanced', workforce: 'adult' })
    expect(res.status).toBeLessThan(400)
  })
})
