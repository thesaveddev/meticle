import { test, expect, type Page } from '@playwright/test'

/**
 * Authenticated application-surface visual regression.
 *
 * The marketing spec covers the public pages because they render without state.
 * That left the product itself — the shell every signed-in user lives in, and
 * the workspace it frames — with no pixel coverage at all, which is where a
 * colour or spacing change is most expensive and least noticed.
 *
 * Two things make an authenticated capture trustworthy rather than noise:
 *
 *  1. **Seeded state, not a live database.** Every request the route makes is
 *     intercepted and answered from the fixtures below. The alternative — a
 *     migrated and seeded Postgres in the visual job — was rejected on purpose:
 *     `seed-orbis.ts` mints a fresh demo org with a random name and dates
 *     relative to the run, so every capture would diff against the last one and
 *     the gate would be trained away within a week. These payloads are the API
 *     contracts written down, so a shape change here is deliberate.
 *
 *  2. **A frozen clock.** The workspace renders the operational date, computes
 *     "today" from `new Date()`, and derives completion rates from the selected
 *     day. `page.clock.setFixedTime` pins `Date.now`/`new Date` (timers keep
 *     running) so a Monday-morning capture is the same frame on any day the
 *     suite runs.
 *
 * The stub table is checked for completeness on every run: an endpoint the page
 * fetches but the table does not answer is reported by name and fails the test.
 * Add a fixture when you add a fetch — do not let the capture fall back to a
 * skeleton, because a screenshot of a loading state passes forever.
 *
 * Updating the baselines: `npm run visual:update` writes them where you run it,
 * and on a Windows machine that is not where the gate compares. The same page
 * rendered here and on the CI runner differs by ~7.75% of the frame in text
 * rasterisation alone, against a 1% `maxDiffPixelRatio`, so a locally generated
 * baseline cannot pass. Regenerate by letting the pipeline produce the actuals
 * (the visual job uploads `tests/visual/__results__` on failure) and adopting
 * those, which is how every baseline in this directory was produced.
 *
 * What this gate actually detects, measured rather than assumed: widening the
 * Today metric gutters from 12px to 32px moved 13,391 pixels (2.0%) on
 * desktop-light and 8,265 (3.0%) on mobile-light — red on all four projects and
 * green on every marketing capture. So the four frames carry real weight. It
 * also locates the floor: against a 1% `maxDiffPixelRatio`, a change smaller
 * than roughly one card gutter can still slip through, which is the same
 * tolerance question §11 of the design audit leaves open for the marketing set.
 */

// Monday 12 October 2026, 09:15 in Europe/London (the config pins the locale and
// timezone). Weekday on purpose: several widgets print weekdays.
const FROZEN_NOW = '2026-10-12T08:15:00.000Z'
const OPERATIONAL_DATE = '2026-10-12'

const ORG_ID = 'b7d1c0de-0000-4000-8000-00000000a001'

const USER = {
  id: 'b7d1c0de-0000-4000-8000-000000000001',
  first_name: 'Ada',
  last_name: 'Okonkwo',
  email: 'ada.okonkwo@northgate.test',
  role: 'ORG_ADMIN',
  organization_id: ORG_ID,
}

const ORGANIZATION = {
  id: ORG_ID,
  name: 'Northgate Supported Living',
  primary_service_type: 'supported_living',
  service_types: ['supported_living'],
  onboarding_completed: true,
  subscription_status: 'active',
  minimum_staffing_coverage_percent: 90,
  minimum_compliance_percent: 90,
}

/**
 * Modules the seeded account can open: the shell's navigation keys plus every
 * module the supported-living quick actions link to, so both render in full.
 * Granting a key the app does not know is inert; omitting one only ever hides
 * part of the frame, which is the failure mode this file exists to avoid.
 */
const MODULES = [
  'dashboard', 'people', 'care', 'staffing', 'medication', 'emedication', 'tasks',
  'staff_directory', 'leave', 'billing', 'compliance', 'reporting', 'incidents',
  'training', 'finance', 'communication', 'my_space', 'settings',
]

const STATS = {
  total_staff: 24,
  compliance_rate: 92,
  open_shifts: 2,
  agency_saved: 1450,
  active_people: 18,
  staff_on_duty: 11,
  open_incidents: 3,
  locations: 3,
}

const ROTA = [
  { id: 'shift-1', start_time: '2026-10-12T07:00:00.000Z', end_time: '2026-10-12T15:00:00.000Z', status: 'filled', location_name: 'Northgate House', assigned_staff: 'Priya Raman' },
  { id: 'shift-2', start_time: '2026-10-12T08:00:00.000Z', end_time: '2026-10-12T20:00:00.000Z', status: 'filled', location_name: 'Northgate House', assigned_staff: 'Marcus Bell' },
  { id: 'shift-3', start_time: '2026-10-12T15:00:00.000Z', end_time: '2026-10-12T23:00:00.000Z', status: 'open', location_name: 'Elm Court', assigned_staff: '' },
]

const REVIEWS = [
  { id: 'review-1', person: 'Jonah Whitfield', item_name: 'Support plan review', due_date: '2026-10-15', entity_type: 'care_plan', status: 'active' },
  { id: 'review-2', person: 'Elin Marsden', item_name: 'Medication review', due_date: '2026-10-20', entity_type: 'medication', status: 'active' },
  { id: 'review-3', person: 'Tomas Petrov', item_name: 'Risk assessment review', due_date: '2026-11-02', entity_type: 'risk_assessment', status: 'active' },
]

const WIDGETS = {
  dbs_expiring_soon: 2,
  training_expiring_soon: 5,
  overdue_medications: 1,
  competency_due: 4,
  open_severe_incidents: 1,
  staff_below_threshold: 2,
  compliance_breakdown: { total_active: 24, compliant_count: 22, below_threshold: 2 },
}

/** Shape of GET /reporting/overview (see reporting.repository.ts buildSummaryCards). */
const PULSE = {
  generatedAt: `${OPERATIONAL_DATE}T08:15:00.000Z`,
  cards: [
    { label: 'Active staff', value: 24, subtitle: 'People with an active account', color: '#0F4C81' },
    { label: 'People supported', value: 18, subtitle: 'Active people in the service', color: '#7C3AED' },
    { label: 'Compliance rate', value: '92%', subtitle: '2 overdue records', color: '#16A34A' },
    { label: 'Training completion', value: '88%', subtitle: '3 overdue modules', color: '#16A34A' },
    { label: 'Open incidents', value: 3, subtitle: '1 high or critical', color: '#DC2626' },
    { label: 'Missed medication', value: 1, subtitle: 'Administration records needing review', color: '#DC2626' },
  ],
  attention: [
    { label: 'Overdue compliance records', value: 2, action: 'Review compliance', target: 'compliance' },
    { label: 'Overdue training modules', value: 3, action: 'Open training', target: 'training' },
    { label: 'Overdue tasks', value: 4, action: 'Review tasks', target: 'tasks' },
    { label: 'Locations', value: 3, action: 'View locations', target: 'locations' },
  ],
}

/** Shape of GET /mission-control/summary for a supported-living organisation. */
const SUMMARY = {
  alerts: { critical: 1, high: 2, medium: 3, low: 4, total: 10 },
  categories: { medication: 2, staffing_safety: 3, compliance: 3, care: 2 },
  overdue_medications: 1,
  unfilled_shifts: 1,
  understaffed_shifts: 1,
  staffing_coverage: {
    shifts_with_target: 6,
    below_minimum_shifts: 1,
    unstaffed_shifts: 1,
    coverage_percent: 91,
    staffing_shortfall: 1,
    required_coverage_percent: 90,
    affected_shifts: [
      {
        shift_id: 'shift-3',
        location_id: 'loc-2',
        location_name: 'Elm Court',
        start_time: '2026-10-12T15:00:00.000Z',
        end_time: '2026-10-12T23:00:00.000Z',
        minimum_staff: 2,
        assigned_staff: 1,
        shortfall: 1,
        coverage_percent: 50,
      },
    ],
  },
  expiring_training: 5,
  expiring_dbs: 2,
  overdue_care_plan_reviews: 1,
  overdue_policy_reviews: 0,
  low_fluid_intake: 0,
  overdue_incident_actions: 1,
}

/**
 * People list. Nothing on the captured route renders it; the shell's global
 * search fetches it on mount, and an unstubbed call would be answered with an
 * empty object the search would then treat as an empty result set.
 */
const PEOPLE = [
  { id: 'person-1', first_name: 'Jonah', last_name: 'Whitfield', status: 'active', room: '1' },
  { id: 'person-2', first_name: 'Elin', last_name: 'Marsden', status: 'active', room: '2' },
  { id: 'person-3', first_name: 'Tomas', last_name: 'Petrov', status: 'active', room: '3' },
]

const NOTIFICATIONS = [
  { id: 'notif-1', title: 'DBS check expiring', message: 'Priya Raman: 18 days', read: false, created_at: `${OPERATIONAL_DATE}T07:05:00.000Z` },
  { id: 'notif-2', title: 'Shift understaffed', message: 'Elm Court, 15:00', read: false, created_at: `${OPERATIONAL_DATE}T06:40:00.000Z` },
]

/**
 * Endpoint table. Exact pathnames (query strings are ignored) plus two
 * parameterised routes. Anything the page requests that is not listed here is
 * reported and fails the run.
 */
const STUBS: Array<{ path: string | RegExp; json: unknown }> = [
  { path: '/auth/me', json: { user: USER, organization: ORGANIZATION } },
  { path: '/settings/org', json: ORGANIZATION },
  { path: new RegExp(`^/permissions/`), json: { permissions: MODULES.map(module => ({ module, permission_level: 'edit' })) } },
  { path: '/billing/subscription', json: { subscriptionStatus: 'active', plan: 'standard', seats: 24 } },
  { path: '/notifications/unread-count', json: { count: NOTIFICATIONS.filter(n => !n.read).length } },
  { path: '/notifications', json: NOTIFICATIONS },
  { path: '/chat/unread', json: { 'channel-care-team': 2 } },
  { path: '/people', json: PEOPLE },
  { path: '/dashboard/stats', json: STATS },
  { path: '/dashboard/today-rota', json: ROTA },
  { path: '/dashboard/review-scheduler', json: REVIEWS },
  { path: '/dashboard/widgets', json: WIDGETS },
  { path: '/reporting/overview', json: PULSE },
  { path: '/mission-control/summary', json: SUMMARY },
]

/**
 * Install the seeded session and the stub table.
 *
 * Returns an array the caller asserts on: the API paths this page asked for that
 * the table does not answer.
 */
async function installSeededSession(page: Page): Promise<string[]> {
  await page.addInitScript(({ sessionUser, organization, moduleNames }) => {
    localStorage.setItem('accessToken', 'visual-regression-seeded-token')
    localStorage.setItem('user', JSON.stringify(sessionUser))
    localStorage.setItem('organization', JSON.stringify(organization))
    localStorage.setItem(
      'mc_module_permissions',
      JSON.stringify(Object.fromEntries(moduleNames.map((name: string) => [name, 'edit']))),
    )
  }, { sessionUser: USER, organization: ORGANIZATION, moduleNames: MODULES })

  const unmatched: string[] = []
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url())
    const apiPath = pathname.replace(/^\/api/, '')
    const stub = STUBS.find(candidate =>
      typeof candidate.path === 'string' ? candidate.path === apiPath : candidate.path.test(apiPath),
    )
    if (!stub) {
      unmatched.push(`${route.request().method()} ${apiPath}`)
      return route.fulfill({ json: {} })
    }
    return route.fulfill({ json: stub.json })
  })

  // The shell opens a Socket.IO connection for push notification counts. Nothing
  // serves it in this harness, so refuse it outright: a deterministic "not
  // connected" beats a race between the capture and the reconnect backoff.
  await page.route('**/socket.io/**', route => route.abort())

  return unmatched
}

/**
 * Font settle, mirroring the marketing spec: Inter is fetched with
 * `display=swap`, so text paints in a fallback face until each weight arrives.
 * MUI only requests the heavy weights once the display type mounts, so wait for
 * the weights explicitly rather than trusting `document.fonts.ready`.
 */
async function awaitFonts(page: Page) {
  await page.evaluate(async () => {
    const faces = ['400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter', '800 16px Inter', '900 16px Inter']
    const deadline = performance.now() + 3500
    await Promise.allSettled(faces.map(face => document.fonts.load(face).then(() => undefined, () => undefined)))
    const remaining = Math.max(0, deadline - performance.now())
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))])
  })
}

/** Two frames after layout, so a mounted transition has committed. */
async function awaitFrame(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

test('the seeded Mission Control workspace matches its baseline', async ({ page }) => {
  // Pin the clock before the app boots so every rendered date is fixed.
  await page.clock.setFixedTime(new Date(FROZEN_NOW))

  const unmatched = await installSeededSession(page)

  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  const response = await page.goto('/mission-control', { waitUntil: 'domcontentloaded' })
  expect(response?.ok(), '/mission-control did not return 2xx').toBeTruthy()

  // ThemeContext writes `data-theme` on mount; capturing before it lands is what
  // makes dark projects disagree with their own baselines.
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-theme'), null, { timeout: 4000 }).catch(() => {})

  // Prove the frame is the seeded screen and not a redirect, a skeleton or a
  // section error before anything is compared. Each of these fails for its own
  // reason, which is what makes a red screenshot actionable.
  await expect(page, 'the workspace should have opened on Today').toHaveURL(/\/mission-control\/today$/)
  await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
  // The workspace, not just the shell: the seeded rota (3 shifts, none of them
  // completed) drives the completion metric and the seeded rostered figure drives
  // the card beside it. Both are derived, so they prove the fixtures reached the
  // view rather than that some label rendered.
  await expect(page.getByText('Shift completion')).toBeVisible()
  await expect(page.getByText('0 of 3 shifts')).toBeVisible()
  await expect(page.getByText('11 rostered today')).toBeVisible()
  await expect(page.getByText('Reported or investigating')).toBeVisible()
  // Operational pulse only renders content when /reporting/overview returns
  // cards, so these two assert the fixture rather than the card's existence.
  await expect(page.getByText('Service-wide reporting measures')).toBeVisible()
  await expect(page.getByText('92%')).toBeVisible()
  await expect(page.getByText('2 overdue records')).toBeVisible()
  // The seeded organisation reached the shell. The mobile layout keeps it in the
  // drawer, so presence is asserted rather than visibility.
  await expect(page.getByText('Northgate Supported Living').first()).toBeAttached()
  await expect(page.getByText('Pulse metrics are currently unavailable.')).toHaveCount(0)
  await expect(page.getByRole('status', { name: /loading mission control/i })).toHaveCount(0)

  await awaitFonts(page)
  await awaitFrame(page)

  // A stub table that silently answers `{}` would let the capture drift to empty
  // states without failing, so completeness is asserted rather than assumed.
  expect(unmatched, `unstubbed API calls: ${unmatched.join(', ')}`).toEqual([])
  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([])

  await expect(page).toHaveScreenshot('mission-control-today.png', { fullPage: false })
})
