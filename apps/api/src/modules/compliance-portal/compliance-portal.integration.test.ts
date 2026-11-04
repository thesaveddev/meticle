import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import {
  createOrg, createUser, createLocation, createPerson, generateToken,
} from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { EmailService } from '../../shared/utils/email.service'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

// The access email is composed from a live location and organisation; this suite
// is about the token and the scope it grants, not delivery.
vi.spyOn(EmailService, 'sendEmail').mockResolvedValue(undefined as any)

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/**
 * A compliance officer is given a read-only link to ONE location. Everything
 * this module exists to protect follows from that sentence: the link must not
 * read another home's residents, must stop working when revoked or expired, and
 * must not be usable as a normal staff session. The module had no tests, so none
 * of it was checked — and the medication endpoint accepted the token's location
 * and then ignored it, which returned another home's MAR to a link issued for
 * this one.
 */
async function site() {
  const org = await createOrg()
  const stamp = `${Date.now()}-${Math.random()}`
  const admin = await createUser({ email: `cp-admin-${stamp}@compliance-portal-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  const manager = await createUser({ email: `cp-mgr-${stamp}@compliance-portal-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const locationA = await createLocation({ organization_id: org.id, name: 'Oak House', manager_id: manager.id })
  const locationB = await createLocation({ organization_id: org.id, name: 'Elm House' })
  const personA = await createPerson({ organization_id: org.id, location_id: locationA.id, first_name: 'Ada', last_name: 'Lovelace' })
  const personB = await createPerson({ organization_id: org.id, location_id: locationB.id, first_name: 'Grace', last_name: 'Hopper' })

  const marA = await migrateQuery(
    `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status)
     VALUES ($1, $2, 'Regular medicines', CURRENT_DATE - 30, CURRENT_DATE + 30, 'active') RETURNING id`,
    [org.id, personA.id],
  )
  const marB = await migrateQuery(
    `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status)
     VALUES ($1, $2, 'Regular medicines', CURRENT_DATE - 30, CURRENT_DATE + 30, 'active') RETURNING id`,
    [org.id, personB.id],
  )

  return { org, admin, manager, locationA, locationB, personA, personB, marA: marA.rows[0].id, marB: marB.rows[0].id }
}

async function issueToken(admin: any, locationId: string, overrides: Record<string, any> = {}) {
  const res = await request(app)
    .post('/compliance-portal/access')
    .set('Authorization', `Bearer ${generateToken(admin)}`)
    .send({
      location_id: locationId,
      officer_name: 'Inspector Jane Fields',
      email: `officer-${Date.now()}-${Math.random()}@cqc.example`,
      expires_hours: 24,
      ...overrides,
    })
  return res
}

describe('Compliance portal — issuing access', () => {
  it('issues a location-scoped link an administrator can hand out and list', async () => {
    const { admin, locationA } = await site()
    const res = await issueToken(admin, locationA.id)

    expect(res.status).toBe(201)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.split('.')).toHaveLength(3)
    expect(res.body.officerName).toBe('Inspector Jane Fields')
    expect(res.body.locationName).toBe('Oak House')
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(res.body.portalUrl).toContain('/portal/login?token=')

    const list = await request(app)
      .get('/compliance-portal/access')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(list.status).toBe(200)
    const issued = list.body.find((t: any) => t.officer_name === 'Inspector Jane Fields' && t.location_id === locationA.id)
    expect(issued).toBeTruthy()
    expect(issued.location_name).toBe('Oak House')
    expect(issued.revoked).toBe(false)
  })

  it('keeps access issuance with organisation administrators', async () => {
    const { manager, locationA } = await site()
    const res = await issueToken(manager, locationA.id)
    expect(res.status).toBe(403)

    const list = await request(app)
      .get('/compliance-portal/access')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
    expect(list.status).toBe(403)
  })

  it('will not issue a link for a location outside the organisation', async () => {
    const { admin } = await site()
    const otherOrg = await createOrg()
    const foreignLocation = await createLocation({ organization_id: otherOrg.id })

    const res = await issueToken(admin, foreignLocation.id)
    expect(res.status).toBe(404)
  })
})

describe('Compliance portal — what the link may read', () => {
  it('confirms the officer and the single location the link is for', async () => {
    const { admin, locationA } = await site()
    const issued = await issueToken(admin, locationA.id)

    const res = await request(app)
      .get('/compliance-portal/portal/verify')
      .set('Authorization', `Bearer ${issued.body.token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      valid: true,
      officerName: 'Inspector Jane Fields',
      locationName: 'Oak House',
    })
  })

  it('returns the dashboard for the location without leaking the rest of the organisation', async () => {
    const { admin, locationA, personA, personB } = await site()
    const issued = await issueToken(admin, locationA.id)

    const res = await request(app)
      .get('/compliance-portal/portal/dashboard')
      .set('Authorization', `Bearer ${issued.body.token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      location: expect.objectContaining({ id: locationA.id, name: 'Oak House' }),
    })
    expect(Array.isArray(res.body.people)).toBe(true)
    expect(Array.isArray(res.body.openIncidents)).toBe(true)
    expect(Array.isArray(res.body.recentMar)).toBe(true)
    expect(typeof res.body.overallScore).toBe('number')

    // Only this home's residents. The other home in the same organisation is
    // outside the scope the officer was granted.
    const ids = res.body.people.map((p: any) => p.id)
    expect(ids).toContain(personA.id)
    expect(ids).not.toContain(personB.id)
  })

  it('serves a resident at the token’s location and refuses one at another', async () => {
    const { admin, locationA, personA, personB } = await site()
    const issued = await issueToken(admin, locationA.id)
    const token = issued.body.token

    const mine = await request(app)
      .get(`/compliance-portal/portal/person/${personA.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(mine.status).toBe(200)
    expect(mine.body.person.id).toBe(personA.id)

    const other = await request(app)
      .get(`/compliance-portal/portal/person/${personB.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(other.status).toBe(404)
  })

  it('serves medication for a resident at the token’s location only', async () => {
    const { admin, locationA, personA, personB, marA, marB } = await site()
    const issued = await issueToken(admin, locationA.id)
    const token = issued.body.token

    const mine = await request(app)
      .get(`/compliance-portal/portal/person/${personA.id}/medication`)
      .set('Authorization', `Bearer ${token}`)
    expect(mine.status).toBe(200)
    expect(mine.body.records.map((r: any) => r.id)).toContain(marA)

    // This endpoint used to accept the token's location and never filter on it,
    // so a link issued for Oak House answered with Elm House's MAR.
    const other = await request(app)
      .get(`/compliance-portal/portal/person/${personB.id}/medication`)
      .set('Authorization', `Bearer ${token}`)
    expect(other.status).toBe(404)
    expect(other.body.records ?? []).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: marB })]))
  })
})

describe('Compliance portal — revocation and session separation', () => {
  it('stops answering as soon as the link is revoked', async () => {
    const { admin, locationA } = await site()
    const issued = await issueToken(admin, locationA.id)
    const token = issued.body.token

    const before = await request(app)
      .get('/compliance-portal/portal/verify')
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)

    const list = await request(app)
      .get('/compliance-portal/access')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    const record = list.body.find((t: any) => t.location_id === locationA.id)

    const revoked = await request(app)
      .post(`/compliance-portal/access/${record.id}/revoke`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(revoked.status).toBe(200)

    const after = await request(app)
      .get('/compliance-portal/portal/verify')
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(401)

    const dashboard = await request(app)
      .get('/compliance-portal/portal/dashboard')
      .set('Authorization', `Bearer ${token}`)
    expect(dashboard.status).toBe(401)
  })

  it('will not let one organisation revoke another’s link', async () => {
    const { admin, locationA } = await site()
    await issueToken(admin, locationA.id)

    const otherOrg = await createOrg()
    const otherAdmin = await createUser({ email: `cp-other-${Date.now()}-${Math.random()}@compliance-portal-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: otherOrg.id })

    const list = await request(app)
      .get('/compliance-portal/access')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    const record = list.body.find((t: any) => t.location_id === locationA.id)

    const res = await request(app)
      .post(`/compliance-portal/access/${record.id}/revoke`)
      .set('Authorization', `Bearer ${generateToken(otherAdmin)}`)
    expect(res.status).toBe(404)
  })

  it('does not accept a portal link as a staff session, nor a staff session as a link', async () => {
    const { admin, locationA, personA } = await site()
    const issued = await issueToken(admin, locationA.id)
    const token = issued.body.token

    // The portal token is signed with its own key, so the normal authenticator
    // must reject it rather than reading it as a user session.
    const asUser = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(asUser.status).toBe(401)

    const staffOnPortal = await request(app)
      .get('/compliance-portal/portal/person/' + personA.id)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(staffOnPortal.status).toBe(401)

    const anonymous = await request(app).get('/compliance-portal/portal/dashboard')
    expect(anonymous.status).toBe(401)
  })
})
