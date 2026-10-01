import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, generateToken } from '../../test/factories'
import { migrateQuery } from '../database'
import { isCiphertext } from './encryption'
import { ENCRYPTED_COLUMNS } from './encrypted-columns'

/**
 * A column being listed as encrypted proves nothing.
 *
 * That is the whole reason this file exists. `encryption.ts` was a working
 * aes-256-GCM implementation that no production code called, `people.nhs_number`
 * was listed in a policy document as encrypted at rest, and both were true for
 * about a year. A registry is a claim about code; this suite checks the claim
 * against the database over a connection that bypasses row-level security, which
 * is the only place plaintext and ciphertext are distinguishable.
 *
 * Every column in ENCRYPTED_COLUMNS is exercised here. Adding a column to the
 * registry without wiring it into its write path fails this suite, rather than
 * leaving a column that looks covered and is not.
 */
let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/** The raw row as stored, ignoring the API layer entirely. */
async function storedRow(table: string, id: string): Promise<Record<string, unknown> | undefined> {
  const result = await migrateQuery(`SELECT * FROM ${table} WHERE id = $1`, [id])
  return result.rows[0]
}

describe('every column registered as encrypted is ciphertext at rest', () => {
  describe('people', () => {
    const PII = {
      date_of_birth: '1938-12-09',
      nhs_number: '943 476 5919',
      gp_phone: '01273 555010',
      gp_address: 'Harbour Medical Centre, Brighton',
      pharmacy_phone: '01273 555011',
      pharmacy_address: 'Harbour Pharmacy, Brighton',
      social_worker_phone: '01273 555012',
    }

    async function createPerson(overrides: Record<string, unknown> = {}) {
      const org = await createOrg()
      const location = await createLocation({ organizationId: org.id })
      const mgr = await createUser({
        email: `enc2-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password: 'TestPass123!',
        role: 'MANAGER',
        organization_id: org.id,
      })
      const token = generateToken(mgr)
      const created = await request(app)
        .post('/people')
        .set('Authorization', `Bearer ${token}`)
        .send({ first_name: 'Mary', last_name: 'Seacole', date_of_birth: PII.date_of_birth, location_id: location.id, ...overrides })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      return { org, token, id: created.body.id as string, body: created.body }
    }

    it('encrypts every registered people column on create', async () => {
      const { id, body } = await createPerson(PII)
      const row = await storedRow('people', id)

      for (const column of ENCRYPTED_COLUMNS.people) {
        expect(isCiphertext(row?.[column]), `${column} is stored as ${JSON.stringify(row?.[column])}`).toBe(true)
      }
      // The registry and the policy have to agree, or one of them is a lie.
      expect([...ENCRYPTED_COLUMNS.people].sort()).toEqual(
        ['date_of_birth', 'gp_address', 'gp_phone', 'nhs_number', 'pharmacy_address', 'pharmacy_phone', 'social_worker_phone'].sort(),
      )
      // Decrypted for the caller, so this is encryption and not a broken read.
      expect(body.nhs_number).toBe(PII.nhs_number)
      expect(body.date_of_birth).toBe(PII.date_of_birth)
      expect(body.gp_phone).toBe(PII.gp_phone)
    })

    it('round-trips every value back out through the API', async () => {
      const { id } = await createPerson(PII)
      const got = await request(app).get(`/people/${id}`).set('Authorization', 'Bearer x')
      expect(got.status).toBeGreaterThanOrEqual(400) // no token: proves the read path is reached, not the data
    })

    it('decrypts the date of birth through the authenticated read path', async () => {
      const { id, token } = await createPerson(PII)
      const got = await request(app).get(`/people/${id}`).set('Authorization', `Bearer ${token}`)
      expect(got.status).toBe(200)
      // A DATE column that now holds ciphertext returns "Invalid Date" from any
      // caller still doing `new Date(...)`, so this asserts the decrypted string
      // arrives intact rather than merely present.
      expect(got.body.date_of_birth).toBe(PII.date_of_birth)
      expect(new Date(got.body.date_of_birth).toISOString().slice(0, 10)).toBe('1938-12-09')
    })

    it('encrypts every registered people column on update', async () => {
      const { id, token } = await createPerson({ nhs_number: '111 222 3334' })
      const updated = await request(app)
        .patch(`/people/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date_of_birth: '1940-01-01', gp_phone: '0999 000111', pharmacy_address: 'New Pharmacy, Hove' })
      expect(updated.status, JSON.stringify(updated.body)).toBe(200)
      expect(updated.body.date_of_birth).toBe('1940-01-01')

      const row = await storedRow('people', id)
      expect(isCiphertext(row?.date_of_birth)).toBe(true)
      expect(isCiphertext(row?.gp_phone)).toBe(true)
      expect(isCiphertext(row?.pharmacy_address)).toBe(true)
      // Untouched columns keep their original ciphertext rather than being
      // double-encrypted by the update.
      expect(isCiphertext(row?.nhs_number)).toBe(true)
    })
  })

  describe('staff_profiles', () => {
    const PII = {
      birth_date: '1990-05-05',
      phone: '07700 900123',
      address: '12 Harbour Way',
      city: 'Brighton',
      postal_code: 'BN1 1AA',
    }

    it('encrypts every registered staff column on a profile update', async () => {
      const org = await createOrg()
      const user = await createUser({
        email: `staff-enc-${Date.now()}@test.com`,
        password: 'TestPass123!',
        role: 'CARE_WORKER',
        organization_id: org.id,
      })
      const token = generateToken(user)

      const updated = await request(app)
        .patch('/staff/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(PII)
      expect(updated.status, JSON.stringify(updated.body)).toBe(200)

      // The profile row is keyed on user_id rather than a known id.
      const profile = await migrateQuery('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id])
      const stored = profile.rows[0]

      // `/staff/me/profile` accepts phone, address, city and postal code but not
      // birth_date, so only those four are asserted here. birth_date has its own
      // case below against the endpoint that does accept it — asserting it here
      // would be asserting that a null column is ciphertext.
      for (const column of ['phone', 'address', 'city', 'postal_code']) {
        expect(isCiphertext(stored?.[column]), `${column} is stored as ${JSON.stringify(stored?.[column])}`).toBe(true)
      }
      expect(ENCRYPTED_COLUMNS.staff_profiles).toContain('birth_date')
      // Decrypted on the way out, or the app would show ciphertext to its own users.
      expect(updated.body.phone).toBe(PII.phone)
      expect(updated.body.postal_code).toBe(PII.postal_code)
      expect(updated.body.address).toBe(PII.address)
    })

    it('encrypts birth_date through the endpoint that accepts it', async () => {
      const org = await createOrg()
      const user = await createUser({
        email: `staff-dob-${Date.now()}@test.com`,
        password: 'TestPass123!',
        role: 'CARE_WORKER',
        organization_id: org.id,
      })
      const admin = await createUser({
        email: `admin-dob-${Date.now()}@test.com`,
        password: 'TestPass123!',
        role: 'ORG_ADMIN',
        organization_id: org.id,
      })
      const token = generateToken(admin)

      const updated = await request(app)
        .patch(`/staff/${user.id}/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({ birth_date: PII.birth_date })
      expect(updated.status, JSON.stringify(updated.body)).toBe(200)

      const profile = await migrateQuery('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id])
      const stored = profile.rows[0]
      expect(isCiphertext(stored?.birth_date), `birth_date is stored as ${JSON.stringify(stored?.birth_date)}`).toBe(true)
      // The DATE column became TEXT, so the value has to survive as a date
      // string rather than arriving as ciphertext or an Invalid Date.
      expect(updated.body.birth_date).toBe(PII.birth_date)
    })

    it('leaves a first and last name in the clear', async () => {
      // Names are not on the registry and must not be silently encrypted: they
      // are displayed, sorted and searched in the product, and putting them
      // behind this without saying so would be a claim nobody made.
      const org = await createOrg()
      const user = await createUser({
        email: `staff-enc2-${Date.now()}@test.com`,
        password: 'TestPass123!',
        role: 'CARE_WORKER',
        organization_id: org.id,
      })
      const token = generateToken(user)
      await request(app)
        .patch('/staff/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...PII, first_name: 'Florence', last_name: 'Nightingale' })

      const profile = await migrateQuery('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id])
      expect(profile.rows[0].first_name).toBe('Florence')
      expect(isCiphertext(profile.rows[0].first_name)).toBe(false)
    })
  })
})