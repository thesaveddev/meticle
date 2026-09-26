import { isDomiciliaryOrganisation } from '../serviceType'

describe('isDomiciliaryOrganisation', () => {
  it('accepts domiciliary and live-in organisations', () => {
    expect(isDomiciliaryOrganisation({ service_types: ['domiciliary'] })).toBe(true)
    expect(isDomiciliaryOrganisation({ service_types: ['supported_living'] })).toBe(false)
    expect(isDomiciliaryOrganisation({ primary_service_type: 'live_in' })).toBe(true)
  })

  // The session can carry a primary type and a list that disagree, which is how
  // an organisation that still lists domiciliary from when it did both looks.
  it('trusts the primary service type over the list', () => {
    expect(
      isDomiciliaryOrganisation({ primary_service_type: 'supported_living', service_types: ['domiciliary'] })
    ).toBe(false)
    expect(
      isDomiciliaryOrganisation({ primary_service_type: 'domiciliary', service_types: ['supported_living'] })
    ).toBe(true)
  })

  it('falls back to the list when there is no primary type', () => {
    expect(isDomiciliaryOrganisation({ service_types: ['supported_living', 'domiciliary'] })).toBe(true)
    expect(isDomiciliaryOrganisation({ service_types: [] })).toBe(false)
    expect(isDomiciliaryOrganisation({})).toBe(false)
  })

  it('treats a missing organisation as not domiciliary', () => {
    expect(isDomiciliaryOrganisation(undefined)).toBe(false)
    expect(isDomiciliaryOrganisation(null)).toBe(false)
  })

  it('ignores a non-string primary type rather than trusting it', () => {
    expect(isDomiciliaryOrganisation({ primary_service_type: 42, service_types: ['domiciliary'] })).toBe(true)
  })
})
