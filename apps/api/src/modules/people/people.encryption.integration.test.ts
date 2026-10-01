import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { isCiphertext } from '../../shared/utils/encryption'

/**
 * The unit tests prove the cipher works. These prove it is *applied* to a real
 * column, which is the part that was missing for a year: `encryption.ts` was a
 * correct aes-256-GCM implementation that no production code imported, so no
 * column was ever encrypted while three documents described it as encrypted at
 * rest. A test that only exercised `encryptField` would have been green that
 * whole time.
 *
 * So each case writes through the HTTP API and then reads the raw column with a
 * connection that bypasses row-level security, which is the only place the
 * plaintext/ciphertext distinction is observable.
 */
let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function createPersonWithNhs(nhs: string) {
  const org = await createOrg()
  const location = await createLocation({ organizationId: org.id })
  const mgr = await createUser({
    email: `enc-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123!',
    role: 'MANAGER',
    organization_id: org.id,
  })
  const token = generateToken(mgr)
  const created = await request(app)
    .post('/people')
    .set('Authorization', `Bearer ${token}`)
    .send({
      first_name: 'Alan',
      last_name: 'Turing',
      date_of_birth: '1912-06-23',
      location_id: location.id,
      nhs_number: nhs,
    })
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  return { org, token, id: created.body.id as string, apiValue: created.body.nhs_number as string }
}

/** Reads the column as stored, ignoring the API layer entirely. */
async function storedNhsNumber(id: string): Promise<string | null> {
  const result = await migrateQuery('SELECT nhs_number FROM people WHERE id = $1', [id])
  return result.rows[0]?.nhs_number ?? null
}

describe('people.nhs_number is encrypted at rest', () => {
  it('stores a create as ciphertext and still returns the number to the caller', async () => {
    const { id, apiValue } = await createPersonWithNhs('943 476 5919')

    expect(apiValue).toBe('943 476 5919')

    const stored = await storedNhsNumber(id)
    expect(stored).not.toBeNull()
    expect(isCiphertext(stored)).toBe(true)
    // The obvious way to leak a number is to leave it readable next to the
    // ciphertext, so assert on the digits rather than on the shape alone.
    expect(stored).not.toContain('943')
  })

  it('stores an update as ciphertext', async () => {
    const { id, token } = await createPersonWithNhs('111 222 3334')

    const updated = await request(app)
      .patch(`/people/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nhs_number: '987 654 3210' })
    expect(updated.status).toBe(200)
    expect(updated.body.nhs_number).toBe('987 654 3210')

    const stored = await storedNhsNumber(id)
    expect(isCiphertext(stored)).toBe(true)
    expect(stored).not.toContain('987')
  })

  it('decrypts on read through list and get', async () => {
    const { id, token } = await createPersonWithNhs('222 333 4445')

    const list = await request(app).get('/people').set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.find((p: any) => p.id === id)?.nhs_number).toBe('222 333 4445')

    const got = await request(app).get(`/people/${id}`).set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.nhs_number).toBe('222 333 4445')
  })

  it('does not encrypt a null number, and does not choke on one', async () => {
    const { id, apiValue } = await createPersonWithNhs('' as string)
    expect(apiValue == null || apiValue === '').toBe(true)
    expect(await storedNhsNumber(id)).toBeNull()
  })

  it('cannot decrypt one tenant’s number with another tenant’s context', async () => {
    // The key is HKDF-derived per organization, so this is what stops a
    // ciphertext being read outside the tenant that owns it.
    const { id } = await createPersonWithNhs('444 555 6667')
    const stored = (await storedNhsNumber(id))!

    const { encryptField, decryptField } = await import('../../shared/utils/encryption')
    expect(() => decryptField(stored, '99999999-9999-4999-8999-999999999999')).toThrow()
    expect(encryptField('444 555 6667', '99999999-9999-4999-8999-999999999999')).not.toBe(stored)
  })
})