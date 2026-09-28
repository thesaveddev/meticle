/**
 * The upload menus can only offer types in this list, because documents are
 * attached to a staff record by choosing a type from a dropdown. Anything
 * missing here is a document a Scottish or Northern Irish manager is unable to
 * upload at all — which is what made the API's nation-specific support
 * unusable while the columns on the monitoring page still looked correct.
 */
import { describe, it, expect } from 'vitest'
import {
  IDENTITY_DOCUMENT_TYPES,
  IDENTITY_TYPE_VALUES,
  identityTypeLabel,
  nationLabel,
} from '../data/identityDocuments'

describe('identity document types', () => {
  it('offers the England and Wales check', () => {
    expect(IDENTITY_TYPE_VALUES).toContain('DBS')
  })

  it('offers Scotland’s scheme, both routes in', () => {
    // PVG and Disclosure Scotland are alternatives, so both belong in the menu
    // even though only one is needed.
    expect(IDENTITY_TYPE_VALUES).toContain('PVG')
    expect(IDENTITY_TYPE_VALUES).toContain('DISCLOSURE_SCOTLAND')
  })

  it('offers the Northern Ireland check', () => {
    expect(IDENTITY_TYPE_VALUES).toContain('ACCESSNI')
  })

  it('keeps the UK-wide right-to-work documents', () => {
    for (const type of ['PASSPORT', 'VISA', 'RIGHT_TO_WORK']) {
      expect(IDENTITY_TYPE_VALUES).toContain(type)
    }
  })

  it('has a unique value and a non-empty label for every entry', () => {
    const values = IDENTITY_DOCUMENT_TYPES.map((t) => t.value)
    expect(new Set(values).size).toBe(values.length)
    for (const t of IDENTITY_DOCUMENT_TYPES) {
      expect(t.label.length).toBeGreaterThan(0)
    }
  })

  it('labels every type it offers, and falls back rather than rendering blank', () => {
    for (const value of IDENTITY_TYPE_VALUES) {
      expect(identityTypeLabel(value)).not.toBe(value)
    }
    // An unrecognised type still renders something, because the table is
    // driven by whatever the API returns.
    expect(identityTypeLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(identityTypeLabel('')).toBe('')
  })

  it('labels the four nations', () => {
    expect(nationLabel('england')).toBe('England')
    expect(nationLabel('wales')).toBe('Wales')
    expect(nationLabel('scotland')).toBe('Scotland')
    expect(nationLabel('northern_ireland')).toBe('Northern Ireland')
    expect(nationLabel(undefined)).toBe('')
    expect(nationLabel('wessex')).toBe('wessex')
  })
})
