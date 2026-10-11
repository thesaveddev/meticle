import { describe, expect, it } from 'vitest'
import { getDashboardEntryPath } from './dashboardEntry'

describe('getDashboardEntryPath', () => {
  it('keeps staff on their personal dashboard', () => {
    expect(getDashboardEntryPath('CARE_WORKER')).toBe('/dashboard')
  })

  it.each(['ORG_ADMIN', 'MANAGER', 'COMPLIANCE_OFFICER', null, undefined])(
    'sends operational role %s to Mission Control',
    role => expect(getDashboardEntryPath(role)).toBe('/mission-control'),
  )
})
