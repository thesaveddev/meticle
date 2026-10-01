import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { decryptField, encryptField, isCiphertext, FieldEncryptionError } from './encryption'

/**
 * `people.nhs_number` is stored encrypted under a key derived per organization.
 *
 * This started as the opposite assertion. For about a year `encryption.ts` was
 * a working aes-256-GCM implementation that **nothing called**, so no column was
 * encrypted, and three documents said otherwise: the claim register said
 * pgcrypto was merely unused, the claim guard's registry said column-level
 * encryption "genuinely exists", and readiness item T0-15 told an operator to go
 * and set `FIELD_ENCRYPTION_KEY`. Doing that would have changed nothing.
 *
 * These tests exist so the question cannot be asked a second time. They fail if
 * encryption stops being applied, if the key stops being required, or if a
 * ciphertext starts surviving a write unencrypted.
 */
const KEY = 'a'.repeat(64) // 32 bytes of hex
const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '22222222-2222-4222-8222-222222222222'

describe('field encryption', () => {
  const original = process.env.FIELD_ENCRYPTION_KEY

  beforeEach(() => { process.env.FIELD_ENCRYPTION_KEY = KEY })
  afterEach(() => {
    if (original === undefined) delete process.env.FIELD_ENCRYPTION_KEY
    else process.env.FIELD_ENCRYPTION_KEY = original
  })

  it('round-trips a value', () => {
    const nhs = '943 476 5919'
    const encrypted = encryptField(nhs, ORG)!
    expect(encrypted).not.toContain('943')
    expect(isCiphertext(encrypted)).toBe(true)
    expect(decryptField(encrypted, ORG)).toBe(nhs)
  })

  it('produces a different ciphertext every time', () => {
    // A random IV per write. A fixed IV would leak that two people share an
    // NHS number, which is the exact fact the column exists to protect.
    expect(encryptField('9434765919', ORG)).not.toBe(encryptField('9434765919', ORG))
  })

  it('binds the ciphertext to the organization', () => {
    // Derived per tenant, so a row cannot be read in another tenant's context.
    const encrypted = encryptField('9434765919', ORG)!
    expect(() => decryptField(encrypted, OTHER_ORG)).toThrow()
  })

  it('treats empty and null as nothing to encrypt', () => {
    expect(encryptField('', ORG)).toBeNull()
    expect(decryptField(null as unknown as string, ORG)).toBeNull()
  })

  it('refuses to double-encrypt', () => {
    // Otherwise a re-save of an already-encrypted value would nest ciphertext.
    const once = encryptField('9434765919', ORG)!
    expect(() => encryptField(once, ORG)).toThrow(FieldEncryptionError)
  })

  it('still reads a row written before the backfill', () => {
    // Legacy plaintext rows exist until the backfill script has run, and a read
    // that threw on them would take a person's record off the screen.
    expect(decryptField('9434765919', ORG)).toBe('9434765919')
    expect(isCiphertext('9434765919')).toBe(false)
  })

  describe('a key that is missing or malformed', () => {
    it('throws rather than returning the plaintext', () => {
      // The behaviour this whole file exists for. The old code logged a warning
      // and returned the input unchanged, which made a missing key look like a
      // working cipher with a missing variable.
      delete process.env.FIELD_ENCRYPTION_KEY
      expect(() => encryptField('9434765919', ORG)).toThrow(FieldEncryptionError)
      expect(() => encryptField('9434765919', ORG)).toThrow(/not set/i)
    })

    it('rejects a key that is not hex', () => {
      process.env.FIELD_ENCRYPTION_KEY = 'not-hex-at-all'
      expect(() => encryptField('9434765919', ORG)).toThrow(/hex/i)
    })

    it('rejects a key of the wrong length', () => {
      process.env.FIELD_ENCRYPTION_KEY = 'abcd'
      expect(() => encryptField('9434765919', ORG)).toThrow(/32 bytes/i)
    })

    it('names the key it wants, so the fix is obvious from the crash', () => {
      delete process.env.FIELD_ENCRYPTION_KEY
      expect(() => encryptField('9434765919', ORG)).toThrow(/openssl rand -hex 32/)
    })
  })
})