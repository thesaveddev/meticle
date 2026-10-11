import { expect, test, type Page } from '@playwright/test'

const permissionModules = [
  'dashboard', 'people', 'care', 'staffing', 'homecare', 'call_scheduling',
  'medication', 'compliance', 'reporting', 'incidents', 'training', 'finance',
  'communication', 'my_space', 'settings',
]

function grantableUser(role: string) {
  return {
    id: `e2e-${role.toLowerCase()}`,
    first_name: 'Rota',
    last_name: 'Reviewer',
    email: `${role.toLowerCase()}@example.test`,
    role,
    organization_id: '00000000-0000-4000-8000-000000000001',
  }
}

async function installSession(page: Page, role: string, organization: Record<string, unknown>) {
  const user = grantableUser(role)
  await page.addInitScript(({ sessionUser, modules }) => {
    localStorage.setItem('accessToken', 'dashboard-routing-e2e-token')
    localStorage.setItem('user', JSON.stringify(sessionUser))
    localStorage.setItem('mc_module_permissions', JSON.stringify(Object.fromEntries(modules.map((module: string) => [module, 'view']))))
  }, { sessionUser: user, modules: permissionModules })

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({ json: { user, organization: { name: 'Routing Test Org', ...organization } } })
    }
    if (url.pathname.endsWith('/permissions/e2e-' + role.toLowerCase())) {
      return route.fulfill({ json: { permissions: permissionModules.map(module => ({ module, permission_level: 'view' })) } })
    }
    if (url.pathname.endsWith('/permissions/' + user.id)) {
      return route.fulfill({ json: { permissions: permissionModules.map(module => ({ module, permission_level: 'view' })) } })
    }
    if (url.pathname.endsWith('/settings/org')) {
      return route.fulfill({ json: organization })
    }
    if (url.pathname.endsWith('/billing/subscription')) return route.fulfill({ json: { subscriptionStatus: 'active' } })
    if (url.pathname.endsWith('/notifications/unread-count')) return route.fulfill({ json: { count: 0 } })
    if (url.pathname.endsWith('/notifications')) return route.fulfill({ json: [] })
    if (url.pathname.endsWith('/chat/unread')) return route.fulfill({ json: {} })
    if (url.pathname.endsWith('/homecare/settings/location-tracking')) return route.fulfill({ json: { location_tracking_enabled: true } })
    if (url.pathname.endsWith('/organizations/' + user.organization_id)) return route.fulfill({ json: { name: 'Routing Test Org', ...organization } })
    if (url.pathname.endsWith('/homecare/my-visits')) return route.fulfill({ json: [] })
    if (url.pathname.endsWith('/dashboard/domiciliary')) return route.fulfill({ json: { selected_date: '2026-10-11', calls_today: 0 } })
    if (url.pathname.endsWith('/dashboard/stats')) return route.fulfill({ json: { total_staff: 0, active_people: 0 } })
    if (url.pathname.endsWith('/dashboard/today-rota')) return route.fulfill({ json: [] })
    if (url.pathname.endsWith('/dashboard/review-scheduler')) return route.fulfill({ json: [] })
    if (url.pathname.endsWith('/dashboard/widgets')) return route.fulfill({ json: {
      dbs_expiring_soon: 0, training_expiring_soon: 0, overdue_medications: 0,
      competency_due: 0, open_severe_incidents: 0, staff_below_threshold: 0,
    } })
    if (url.pathname.endsWith('/appointments')) return route.fulfill({ json: [] })
    if (url.pathname.endsWith('/reporting/overview')) return route.fulfill({ json: { cards: [] } })
    if (url.pathname.endsWith('/mission-control/homecare-summary')) {
      return route.fulfill({ json: {
        missed_today: 0, unassigned_today: 0, overdue_calls: 0, completed_today: 0,
        total_today: 0, training_expiring: 0, docs_expiring: 0, open_incidents: 0,
        overdue_incident_actions: 0, overdue_care_plans: 0, active_staff: 0,
        people_supported: 0, carers_working_today: 0, calls_by_status: [],
      } })
    }
    return route.fulfill({ json: {} })
  })
}

test.describe('dashboard route selection', () => {
  test('keeps CARE_WORKER on the personal dashboard in supported living', async ({ page }) => {
    await installSession(page, 'CARE_WORKER', { primary_service_type: 'supported_living', service_types: ['supported_living'] })
    await page.goto('/dashboard')
    await expect(page.getByText('My Shifts Today')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  })

  test('routes an operational manager to supported-living Mission Control', async ({ page }) => {
    await installSession(page, 'MANAGER', { primary_service_type: 'supported_living', service_types: ['supported_living'] })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/mission-control$/)
    await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
    await expect(page.getByText("Today's rota")).toBeVisible()
  })

  test('routes a domiciliary manager to the domiciliary Mission Control workspace even when a legacy secondary type conflicts', async ({ page }) => {
    await installSession(page, 'MANAGER', { primary_service_type: 'domiciliary', service_types: ['domiciliary', 'supported_living'] })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/mission-control$/)
    await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
    await expect(page.getByText("Today's call schedule")).toBeVisible()
    await expect(page.getByText('Carer coverage')).toBeVisible()
    await expect(page.getByText("Today's rota")).toHaveCount(0)
  })

  test('leaves an unconfigured care worker on the dashboard without calling model-specific endpoints', async ({ page }) => {
    let supportedEndpoints = 0
    await installSession(page, 'CARE_WORKER', { primary_service_type: null, service_types: [] })
    page.on('request', request => {
      if (/\/api\/dashboard\/(stats|today-rota|widgets|review-scheduler|domiciliary)/.test(request.url())) supportedEndpoints++
    })
    await page.goto('/dashboard')
    await expect(page.getByText('Choose a service model')).toBeVisible()
    expect(supportedEndpoints).toBe(0)
  })
})
