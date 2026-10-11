import { describe, expect, it } from 'vitest'
import { getDashboardServiceMode } from './dashboardServiceMode'

describe('getDashboardServiceMode', () => {
  it.each([
    [{ primary_service_type: 'domiciliary', service_types: ['supported_living'] }, 'domiciliary'],
    [{ primary_service_type: 'live_in', service_types: ['residential'] }, 'domiciliary'],
    [{ primary_service_type: 'supported_living', service_types: ['domiciliary'] }, 'supported_living'],
    [{ service_types: ['residential'] }, 'supported_living'],
    [{ service_types: ['domiciliary', 'supported_living'] }, 'domiciliary'],
    [{ service_types: [] }, 'unconfigured'],
    [null, 'unconfigured'],
  ] as const)('classifies %j as %s', (organization, expected) => {
    expect(getDashboardServiceMode(organization)).toBe(expected)
  })
})
