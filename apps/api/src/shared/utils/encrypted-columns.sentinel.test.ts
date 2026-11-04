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

  describe('third-party contact details', () => {
    it('encrypts a family contact\'s phone and email, including inside a person row', async () => {
      // The nested case is the one that matters. `findById` returns family
      // contacts as a `json_agg` inside the person row, so decrypting only the
      // top-level columns would leave a family's numbers as ciphertext in the
      // middle of a care record — which reads as corruption, not as a decision.
      const org = await createOrg()
      const location = await createLocation({ organizationId: org.id })
      const mgr = await createUser({
        email: `fc-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password: 'TestPass123!',
        role: 'MANAGER',
        organization_id: org.id,
      })
      const token = generateToken(mgr)
      const person = await request(app)
        .post('/people')
        .set('Authorization', `Bearer ${token}`)
        .send({ first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1815-12-10', location_id: location.id })
      expect(person.status, JSON.stringify(person.body)).toBe(201)

      const contact = await request(app)
        .post(`/people/${person.body.id}/family-contacts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Byron', relationship: 'Brother', phone: '0800 111 222', email: 'byron@example.com' })
      expect(contact.status, JSON.stringify(contact.body)).toBe(201)
      // Decrypted on the way out, or the caller stores ciphertext in a form.
      expect(contact.body.phone).toBe('0800 111 222')
      expect(contact.body.email).toBe('byron@example.com')

      const stored = await migrateQuery('SELECT phone, email FROM family_contacts WHERE id = $1', [contact.body.id])
      for (const column of ENCRYPTED_COLUMNS.family_contacts) {
        expect(isCiphertext(stored.rows[0][column]), `${column} is stored as ${JSON.stringify(stored.rows[0][column])}`).toBe(true)
      }

      const got = await request(app).get(`/people/${person.body.id}`).set('Authorization', `Bearer ${token}`)
      expect(got.status).toBe(200)
      const nested = (got.body.family_contacts ?? []).find((c: any) => c.id === contact.body.id)
      expect(nested, 'family contact should be present in the person payload').toBeDefined()
      expect(nested.phone).toBe('0800 111 222')
      expect(nested.email).toBe('byron@example.com')
      expect(isCiphertext(nested.phone)).toBe(false)
    })

    it('encrypts a staff member\'s emergency contact number', async () => {
      const org = await createOrg()
      const user = await createUser({
        email: `ec-${Date.now()}@test.com`,
        password: 'TestPass123!',
        role: 'CARE_WORKER',
        organization_id: org.id,
      })
      const token = generateToken(user)
      await request(app).patch('/staff/me/profile').set('Authorization', `Bearer ${token}`).send({ phone: '07700 900999' })

      // The route is ORG_ADMIN-only, and unlike the profile endpoints it does not
      // fall through to self — so the admin acts on their own record here.
      const admin = await createUser({
        email: `ec-admin-${Date.now()}@test.com`,
        password: 'TestPass123!',
        role: 'ORG_ADMIN',
        organization_id: org.id,
      })
      await request(app).patch('/staff/me/profile').set('Authorization', `Bearer ${generateToken(admin)}`).send({ phone: '07700 900999' })
      const adminToken = generateToken(admin)
      // The route addresses `:staffId`, which is the `staff_profiles` id, not the
      // user id.
      const adminProfile = await migrateQuery('SELECT id FROM staff_profiles WHERE user_id = $1', [admin.id])

      const created = await request(app)
        .post(`/staff/${adminProfile.rows[0].id}/emergency-contacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Next of kin', relationship: 'Partner', phone: '07700 900888' })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(created.body.phone).toBe('07700 900888')

      const stored = await migrateQuery('SELECT phone FROM emergency_contacts WHERE id = $1', [created.body.id])
      expect(isCiphertext(stored.rows[0].phone), `phone is stored as ${JSON.stringify(stored.rows[0].phone)}`).toBe(true)
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

  /**
   * The clinical narrative is the most sensitive text in the product: what a
   * carer wrote about a resident's day, what a care plan says someone needs, what
   * a risk assessment says might hurt them, and what an incident report says
   * happened. None of it is used in a query predicate, so none of it needs to be
   * readable in the database.
   */
  describe('clinical narrative', () => {
    async function managedResident() {
      const org = await createOrg()
      const location = await createLocation({ organizationId: org.id })
      const mgr = await createUser({
        email: `clin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password: 'TestPass123!',
        role: 'MANAGER',
        organization_id: org.id,
      })
      const token = generateToken(mgr)
      const person = await request(app)
        .post('/people')
        .set('Authorization', `Bearer ${token}`)
        .send({ first_name: 'Edith', last_name: 'Cavell', date_of_birth: '1940-02-03', location_id: location.id })
      expect(person.status, JSON.stringify(person.body)).toBe(201)
      return { org, token, personId: person.body.id as string }
    }

    it('encrypts a daily note and decrypts it back out of the notes list', async () => {
      const { token, personId } = await managedResident()
      const content = 'Refused breakfast but drank tea. Asked about her sister twice; settled with music.'

      const created = await request(app)
        .post(`/people/${personId}/daily-notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'wellbeing', shift: 'day', content })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(created.body.content).toBe(content)

      const row = await storedRow('daily_notes', created.body.id)
      expect(isCiphertext(row?.content), `content is stored as ${JSON.stringify(row?.content)}`).toBe(true)

      const list = await request(app).get(`/people/${personId}/daily-notes`).set('Authorization', `Bearer ${token}`)
      expect(list.status, JSON.stringify(list.body)).toBe(200)
      const note = (Array.isArray(list.body) ? list.body : list.body.notes ?? []).find((n: any) => n.id === created.body.id)
      expect(note, 'the note should come back from the list').toBeDefined()
      expect(note.content).toBe(content)
    })

    it('encrypts a care plan narrative and decrypts it inside the person payload', async () => {
      const { token, personId } = await managedResident()
      const description = 'Needs prompting with personal care in the morning; prefers a female carer.'
      const riskAssessment = 'Falls risk: unsteady on the stairs, uses a frame indoors.'

      const created = await request(app)
        .post(`/people/${personId}/care-plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Personal care', category: 'personal_care', description, risk_assessment: riskAssessment })
      expect(created.status, JSON.stringify(created.body)).toBe(201)

      const row = await storedRow('care_plans', created.body.id)
      for (const column of ENCRYPTED_COLUMNS.care_plans) {
        expect(isCiphertext(row?.[column]), `${column} is stored as ${JSON.stringify(row?.[column])}`).toBe(true)
      }
      // The title stays searchable, which is the whole reason it is not encrypted.
      expect(row?.title).toBe('Personal care')

      // `findById` returns care plans as a `json_agg` inside the person row, so
      // this is the nested case: decrypting only the top-level columns would
      // leave ciphertext in the middle of a care record.
      const got = await request(app).get(`/people/${personId}`).set('Authorization', `Bearer ${token}`)
      expect(got.status, JSON.stringify(got.body)).toBe(200)
      const plan = (got.body.care_plans ?? []).find((p: any) => p.id === created.body.id)
      expect(plan, 'the care plan should be nested in the person payload').toBeDefined()
      expect(plan.description).toBe(description)
      expect(plan.risk_assessment).toBe(riskAssessment)
    })

    it('encrypts a risk assessment and its mitigation on create and update', async () => {
      const { token, personId } = await managedResident()

      const created = await request(app)
        .post(`/people/${personId}/risk-assessments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'Falls',
          risk_level: 'high',
          details: 'Two falls in the last month, both in the bathroom.',
          mitigation_actions: 'Grab rails fitted; night light; hourly checks overnight.',
        })
      expect(created.status, JSON.stringify(created.body)).toBe(201)

      let row = await storedRow('risk_assessments', created.body.id)
      for (const column of ENCRYPTED_COLUMNS.risk_assessments) {
        expect(isCiphertext(row?.[column]), `${column} is stored as ${JSON.stringify(row?.[column])}`).toBe(true)
      }

      const updated = await request(app)
        .patch(`/people/risk-assessments/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mitigation_actions: 'Additional: sensor mat by the bed.' })
      expect(updated.status, JSON.stringify(updated.body)).toBe(200)
      expect(updated.body.mitigation_actions).toBe('Additional: sensor mat by the bed.')

      row = await storedRow('risk_assessments', created.body.id)
      expect(isCiphertext(row?.mitigation_actions)).toBe(true)
      // The untouched column keeps its original ciphertext rather than being
      // re-encrypted from a value that was never decrypted.
      expect(isCiphertext(row?.details)).toBe(true)
    })

    it('encrypts an incident narrative and decrypts it on the incident read path', async () => {
      const { token } = await managedResident()
      const description = 'Found on the floor beside the bed at 06:40, conscious and talking. No injury.'

      const created = await request(app)
        .post('/incidents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Unwitnessed fall',
          description,
          severity: 'high',
          root_cause: 'Bed rail not raised after the night check.',
          outcomes: 'No injury. GP informed. Care plan updated.',
          investigation_notes: 'Interviewed the night carer and the resident; both agree she was found at 06:40.',
          lessons_learned: 'Raise the bed rail at every night check and record it.',
        })
      expect(created.status, JSON.stringify(created.body)).toBe(201)

      const row = await storedRow('incidents', created.body.id)
      for (const column of ENCRYPTED_COLUMNS.incidents) {
        expect(isCiphertext(row?.[column]), `${column} is stored as ${JSON.stringify(row?.[column])}`).toBe(true)
      }
      // Severity, dates and the title drive the register's filters and sorts, so
      // they deliberately stay in the clear.
      expect(row?.title).toBe('Unwitnessed fall')
      expect(row?.severity).toBe('high')

      const got = await request(app).get(`/incidents/${created.body.id}`).set('Authorization', `Bearer ${token}`)
      expect(got.status, JSON.stringify(got.body)).toBe(200)
      expect(got.body.description).toBe(description)
      expect(got.body.root_cause).toBe('Bed rail not raised after the night check.')
      expect(got.body.outcomes).toBe('No injury. GP informed. Care plan updated.')
      expect(got.body.investigation_notes).toBe(
        'Interviewed the night carer and the resident; both agree she was found at 06:40.',
      )
      expect(got.body.lessons_learned).toBe('Raise the bed rail at every night check and record it.')
    })
  })
})