import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

type TestUser = Awaited<ReturnType<typeof createUser>>

type RestrictedEndpoint = {
  name: string
  method: 'get' | 'post'
  path: string
}

const supportedLivingEndpoints: RestrictedEndpoint[] = [
  { name: 'rota', method: 'get', path: '/shifts' },
  { name: 'appointments', method: 'get', path: '/appointments' },
  { name: 'medication', method: 'get', path: '/emedication/records' },
  { name: 'nutrition', method: 'get', path: '/nutrition/overview' },
  { name: 'agencies', method: 'get', path: '/agencies' },
  { name: 'expenses', method: 'get', path: '/expenses' },
  { name: 'tasks', method: 'get', path: '/tasks' },
  { name: 'room checks', method: 'get', path: '/room-checks' },
  { name: 'supported-living dashboard', method: 'get', path: '/dashboard/stats' },
  { name: 'supported-living Mission Control', method: 'get', path: '/mission-control/summary' },
  { name: 'AI rota analysis', method: 'post', path: '/ai/analyze/rota' },
  { name: 'AI meal-plan generation', method: 'post', path: '/ai/generate/meal-plan' },
]

const domiciliaryEndpoints: RestrictedEndpoint[] = [
  { name: 'homecare packages', method: 'get', path: '/homecare/packages' },
  { name: 'domiciliary dashboard', method: 'get', path: '/dashboard/domiciliary' },
  { name: 'domiciliary Mission Control', method: 'get', path: '/mission-control/homecare-summary' },
  { name: 'homecare compliance', method: 'get', path: '/cqc/homecare-compliance' },
]

function callEndpoint(app: Express, endpoint: RestrictedEndpoint, token: string) {
  const requestBuilder = request(app)[endpoint.method](endpoint.path).set('Authorization', `Bearer ${token}`)
  return endpoint.method === 'post' ? requestBuilder.send({}) : requestBuilder
}

let app: Express
let domiciliaryUser: TestUser
let supportedLivingUser: TestUser
const organisationIds: string[] = []

beforeAll(async () => {
  app = createTestApp()

  const domiciliaryOrg = await createOrg({ service_types: ['domiciliary'] })
  const supportedLivingOrg = await createOrg({ service_types: ['supported_living'] })
  organisationIds.push(domiciliaryOrg.id, supportedLivingOrg.id)

  domiciliaryUser = await createUser({
    email: `rbac-dom-${Date.now()}@test.com`,
    role: 'ORG_ADMIN',
    organization_id: domiciliaryOrg.id,
  })
  supportedLivingUser = await createUser({
    email: `rbac-sl-${Date.now()}@test.com`,
    role: 'ORG_ADMIN',
    organization_id: supportedLivingOrg.id,
  })
}, 30_000)

afterAll(async () => {
  for (const organisationId of organisationIds) {
    await migrateQuery('DELETE FROM users WHERE organization_id = $1', [organisationId])
    await migrateQuery('DELETE FROM organizations WHERE id = $1', [organisationId])
  }
})

describe('service-type API boundary matrix', () => {
  it.each(supportedLivingEndpoints)('returns 403 for a domiciliary organisation on $name', async endpoint => {
    const response = await callEndpoint(app, endpoint, generateToken(domiciliaryUser))
    expect(response.status, `${endpoint.method.toUpperCase()} ${endpoint.path}: ${JSON.stringify(response.body)}`).toBe(403)
  })

  it.each(domiciliaryEndpoints)('returns 403 for a supported-living organisation on $name', async endpoint => {
    const response = await callEndpoint(app, endpoint, generateToken(supportedLivingUser))
    expect(response.status, `${endpoint.method.toUpperCase()} ${endpoint.path}: ${JSON.stringify(response.body)}`).toBe(403)
  })
})
