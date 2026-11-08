import { surfaceOf, tabsForSurface } from '../surface'

/**
 * The phone used to branch on `isManager`, so a compliance officer fell through to
 * the carer's app: a Today screen of visits that were never theirs, an Earnings tab
 * for shifts they do not work, and a Schedule that only ever looked empty. These
 * are the tests that keep every role on a surface that tells the truth.
 */
describe('surfaceOf', () => {
  it('puts a care worker on the field surface', () => {
    expect(surfaceOf({ role: 'CARE_WORKER' })).toBe('field')
  })

  it('puts a compliance officer on oversight rather than the carer app', () => {
    expect(surfaceOf({ role: 'COMPLIANCE_OFFICER' })).toBe('oversight')
  })

  it('keeps a manager and an org admin on the companion surface', () => {
    expect(surfaceOf({ role: 'MANAGER' })).toBe('companion')
    expect(surfaceOf({ role: 'ORG_ADMIN' })).toBe('companion')
  })

  it('treats a session that has not resolved as field', () => {
    expect(surfaceOf(null)).toBe('field')
    expect(surfaceOf(undefined)).toBe('field')
  })
})

describe('tabsForSurface', () => {
  const keys = (surface: Parameters<typeof tabsForSurface>[0]) => tabsForSurface(surface).map(tab => tab.key)

  it('gives the field surface the carer tabs, in order', () => {
    expect(tabsForSurface('field').map(tab => tab.label)).toEqual([
      'Today', 'Schedule', 'Chat', 'Earnings', 'Settings',
    ])
  })

  it('gives oversight no field-only tab and both of the ones it is missing', () => {
    for (const fieldOnly of ['today', 'schedule', 'mileage']) {
      expect(keys('oversight')).not.toContain(fieldOnly)
    }
    expect(keys('oversight')).toEqual(['clients', 'policies', 'chat', 'settings'])
  })

  it('keeps the companion tab set unchanged', () => {
    expect(tabsForSurface('companion').map(tab => tab.label)).toEqual([
      'Team', 'Clients', 'Visits', 'Chat', 'Settings',
    ])
  })
})
