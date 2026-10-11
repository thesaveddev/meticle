import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

const SERVICE_TYPE_DENIED = 'This feature is not available for your organisation type'
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

let app: Express
beforeAll(() => { app = createTestApp() })

/** Endpoints the dashboard and settings pages request for every organisation. */
const sharedPageEndpoints = [
  '/settings/org',
  '/settings/staff',
  '/settings/compliance-config',
  '/settings/delegations',
  '/settings/compliance-profiles',
  '/settings/locations',
  '/ai/config',
  '/ai/data-minimisation',
  '/mfa/status',
  '/notifications',
  '/notifications/unread-count',
  '/chat/unread',
  '/reporting/overview',
  '/leave/types',
]

/** Requests the supported-living dashboard and Mission Control make. */
const supportedLivingPageEndpoints = [
  '/dashboard/stats',
  '/dashboard/today-rota',
  '/dashboard/widgets',
  '/dashboard/review-scheduler',
  '/dashboard/daily-overview',
  '/dashboard/compliance',
  '/appointments',
  '/mission-control/summary',
  '/mission-control/alerts',
  `/settings/locations/${UNKNOWN_UUID}/certificates`,
  '/emedication/records',
]

/** Requests the domiciliary dashboard and Mission Control make. */
const domiciliaryPageEndpoints = [
  '/dashboard/domiciliary',
  '/mission-control/homecare-summary',
  '/homecare/settings/location-tracking',
  '/homecare/settings/location-retention',
  '/settings/locations/area-comparison',
  `/settings/locations/${UNKNOWN_UUID}/area-summary`,
  '/homecare/my-visits',
  '/cqc/homecare-compliance',
]

async function expectNoServiceTypeDenial(app: Express, token: string, path: string) {
  const response = await request(app).get(path).set('Authorization', `Bearer ${token}`)
  // Role-based 403s are fine here; only a service-type denial is a failure.
  const message = response.body?.message ?? ''
  expect(message, `GET ${path} (status ${response.status})`).not.toContain(SERVICE_TYPE_DENIED)
}

describe('dashboard and settings endpoints accept the organisation service model', () => {
  it.each([
    ['supported_living', 'supported_living'],
    ['residential', 'residential'],
  ])('%s organisation: supported-living pages are reachable', async (_label, primary) => {
    const org = await createOrg({ primary_service_type: primary, service_types: [primary] })
    const admin = await createUser({ email: `page-sl-${primary}-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    for (const path of [...sharedPageEndpoints, ...supportedLivingPageEndpoints]) {
      await expectNoServiceTypeDenial(app, token, path)
    }
  })

  it.each([
    ['domiciliary', 'domiciliary'],
    ['live_in', 'live_in'],
  ])('%s organisation: domiciliary pages are reachable', async (_label, primary) => {
    const org = await createOrg({ primary_service_type: primary, service_types: [primary] })
    const admin = await createUser({ email: `page-dom-${primary}-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    for (const path of [...sharedPageEndpoints, ...domiciliaryPageEndpoints]) {
      await expectNoServiceTypeDenial(app, token, path)
    }
  })

  it('organisation with only a legacy service_types entry: pages use the same model as the API', async () => {
    const org = await createOrg({ primary_service_type: null, service_types: ['domiciliary'] })
    const manager = await createUser({ email: `page-legacy-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)

    for (const path of [...sharedPageEndpoints, ...domiciliaryPageEndpoints]) {
      await expectNoServiceTypeDenial(app, token, path)
    }
  })
})
