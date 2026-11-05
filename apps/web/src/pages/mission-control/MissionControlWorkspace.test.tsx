import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MissionControlWorkspace, { MissionControlIndexRedirect } from './MissionControlWorkspace'
import {
  MissionControlCallsView,
  MissionControlCareView,
  MissionControlComplianceView,
  MissionControlIncidentsView,
  MissionControlStaffingView,
  MissionControlTodayView,
} from './MissionControlViews'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}))

const homecareSummary = {
  missed_today: 1,
  unassigned_today: 2,
  overdue_calls: 423,
  completed_today: 0,
  total_today: 0,
  training_expiring: 0,
  docs_expiring: 0,
  open_incidents: 1,
  overdue_incident_actions: 0,
  overdue_care_plans: 0,
  active_staff: 8,
  people_supported: 12,
  carers_working_today: 0,
  calls_by_status: [],
}

function renderWorkspace(serviceModel: 'domiciliary' | 'supported_living' = 'domiciliary', path = '/mission-control') {
  // Mirrors the nested route tree in App.tsx.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/mission-control" element={<MissionControlWorkspace serviceModel={serviceModel} />}>
            <Route index element={<MissionControlIndexRedirect />} />
            <Route path="today" element={<MissionControlTodayView />} />
            <Route path="calls" element={<MissionControlCallsView />} />
            <Route path="staffing" element={<MissionControlStaffingView />} />
            <Route path="compliance" element={<MissionControlComplianceView />} />
            <Route path="care" element={<MissionControlCareView />} />
            <Route path="incidents" element={<MissionControlIncidentsView />} />
          </Route>
          <Route path="/homecare" element={<div>Homecare destination</div>} />
          <Route path="/scheduling" element={<div>Rota destination</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SCHEDULE_DATE = '2026-10-12'
const dayVisit = (overrides: Record<string, unknown>) => ({
  status: 'scheduled',
  scheduled_start: `${SCHEDULE_DATE}T08:00:00`,
  scheduled_end: `${SCHEDULE_DATE}T08:30:00`,
  assigned_staff_id: null,
  assigned_staff_name: null,
  ...overrides,
})

const CARER_VISITS = [
  dayVisit({ id: 'v1', status: 'completed', assigned_staff_id: 'c1', assigned_staff_name: 'Grace Hopper', scheduled_start: `${SCHEDULE_DATE}T08:00:00`, scheduled_end: `${SCHEDULE_DATE}T08:30:00` }),
  dayVisit({ id: 'v2', status: 'scheduled', assigned_staff_id: 'c1', assigned_staff_name: 'Grace Hopper', scheduled_start: `${SCHEDULE_DATE}T10:00:00`, scheduled_end: `${SCHEDULE_DATE}T10:30:00` }),
  dayVisit({ id: 'v3', status: 'scheduled', assigned_staff_id: 'c2', assigned_staff_name: 'Alan Turing', scheduled_start: `${SCHEDULE_DATE}T09:00:00`, scheduled_end: `${SCHEDULE_DATE}T09:30:00` }),
  dayVisit({ id: 'v4', status: 'scheduled' }),
  dayVisit({ id: 'v5', status: 'cancelled', assigned_staff_id: 'c3', assigned_staff_name: 'Cancelled Carer' }),
]

/** Replaces one endpoint; every other mock from beforeEach still applies. */
function overrideGet(url: string, response: { data: unknown } | Error) {
  const base = vi.mocked(api.get).getMockImplementation()!
  vi.mocked(api.get).mockImplementation((requested: string, config?: any) => {
    if (requested === url) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response as any)
    }
    return base(requested, config)
  })
}

function mockVisits(response: { data: unknown[] } | Error) {
  overrideGet('/homecare/visits', response)
}

/** Renders the domiciliary Calls tab with a summary that reports calls, so the schedule table is shown. */
function renderCallsTab(visits: { data: unknown[] } | Error) {
  overrideGet('/mission-control/homecare-summary', { data: { ...homecareSummary, calls_by_status: [{ status: 'scheduled', count: 3 }, { status: 'completed', count: 1 }] } })
  mockVisits(visits)
  return renderWorkspace('domiciliary', '/mission-control/calls')
}

const TABLE_NAME = 'Visits for the selected day'
/** Data rows only; the header row is excluded. */
function tableBodyRows() {
  const table = screen.getByRole('table', { name: TABLE_NAME })
  return within(table.querySelector('tbody')!).queryAllByRole('row')
}

const SCHEDULE_VISITS = [
  dayVisit({ id: 'c1', status: 'completed', person_name: 'Ada Lovelace', assigned_staff_id: 'c1', assigned_staff_name: 'Grace Hopper', label: 'Morning call', scheduled_start: `${SCHEDULE_DATE}T08:00:00`, scheduled_end: `${SCHEDULE_DATE}T08:30:00` }),
  dayVisit({ id: 'c2', status: 'scheduled', person_name: 'Bob Ross', label: 'Lunch call', scheduled_start: `${SCHEDULE_DATE}T12:00:00`, scheduled_end: `${SCHEDULE_DATE}T12:30:00` }),
  dayVisit({ id: 'c3', status: 'en_route', person_name: 'Carla Ng', assigned_staff_id: 'c2', assigned_staff_name: 'Alan Turing', label: 'Evening call', scheduled_start: `${SCHEDULE_DATE}T18:00:00`, scheduled_end: `${SCHEDULE_DATE}T18:30:00` }),
  dayVisit({ id: 'c4', status: 'scheduled', person_name: 'Dan Reed', assigned_staff_id: 'c1', assigned_staff_name: 'Grace Hopper', label: 'Medication call', scheduled_start: `${SCHEDULE_DATE}T14:00:00`, scheduled_end: `${SCHEDULE_DATE}T14:30:00` }),
  dayVisit({ id: 'c5', status: 'missed', person_name: 'Eve Adams', assigned_staff_id: 'c2', assigned_staff_name: 'Alan Turing', label: 'Morning call', scheduled_start: `${SCHEDULE_DATE}T09:00:00`, scheduled_end: `${SCHEDULE_DATE}T09:30:00` }),
]

function activeTab() {
  const nav = screen.getByRole('navigation', { name: 'Mission Control sections' })
  return within(nav).getAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page')
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === '/mission-control/homecare-summary') return { data: homecareSummary } as any
    if (url === '/reporting/overview') return { data: { cards: [] } } as any
    if (url === '/dashboard/stats') return { data: { total_staff: 8, active_people: 12, staff_on_duty: 4, compliance_rate: 100, open_incidents: 0, locations: 3 } } as any
    if (url === '/dashboard/today-rota') return { data: [] } as any
    if (url === '/dashboard/review-scheduler') return { data: [] } as any
    if (url === '/dashboard/widgets') return { data: { dbs_expiring_soon: 0, training_expiring_soon: 0, overdue_medications: 0, missed_medications: 0, missed_detail: [], competency_due: 0, open_severe_incidents: 0, staff_below_threshold: 0 } } as any
    if (url === '/mission-control/summary') return { data: { staffing_coverage: {
      shifts_with_target: 4, below_minimum_shifts: 2, unstaffed_shifts: 1,
      coverage_percent: 72, required_coverage_percent: 85, staffing_shortfall: 3,
      affected_shifts: [{ shift_id: 'shift-1', location_id: 'loc-1', location_name: 'Maple House', start_time: '2026-10-12T08:00:00Z', end_time: '2026-10-12T16:00:00Z', minimum_staff: 2, assigned_staff: 0, shortfall: 2, coverage_percent: 0 }],
    } } } as any
    if (url === '/homecare/visits') return { data: [] } as any
    return { data: {} } as any
  })
})

describe('MissionControlWorkspace', () => {
  it('redirects the root route to Today and renders only the Today workspace', async () => {
    renderWorkspace()

    expect(await screen.findByRole('heading', { name: 'Mission Control' })).toBeInTheDocument()
    expect(await screen.findByText('No calls scheduled')).toBeInTheDocument()
    expect(screen.getByText('423')).toBeInTheDocument()
    expect(screen.queryByText('Call exceptions')).not.toBeInTheDocument()
    expect(activeTab().map(link => link.textContent)).toEqual(['Today'])
    expect(api.get).toHaveBeenCalledWith('/mission-control/homecare-summary', expect.objectContaining({ params: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } }))
  })

  it('switches the visible workspace and the active tab when a tab is clicked', async () => {
    renderWorkspace()
    await screen.findByText('No calls scheduled')

    fireEvent.click(screen.getByRole('link', { name: 'Calls' }))

    expect(await screen.findByText('Call exceptions')).toBeInTheDocument()
    expect(screen.queryByText('No calls scheduled')).not.toBeInTheDocument()
    expect(screen.queryByText('Call completion')).not.toBeInTheDocument()
    expect(activeTab().map(link => link.textContent)).toEqual(['Calls'])
  })

  it('renders the Calls workspace for a directly opened calls URL', async () => {
    renderWorkspace('domiciliary', '/mission-control/calls')

    expect(await screen.findByText('Call exceptions')).toBeInTheDocument()
    expect(screen.getByText(/unassigned calls are not overdue unless they also meet the overdue rule/i)).toBeInTheDocument()
    expect(screen.queryByText('No calls scheduled')).not.toBeInTheDocument()
    expect(activeTab().map(link => link.textContent)).toEqual(['Calls'])
  })

  it("labels the calls tab 'Rota' for supported-living organisations", async () => {
    renderWorkspace('supported_living', '/mission-control/calls')

    // The rota is what this tab shows for supported living — domiciliary
    // "calls" vocabulary must not leak into their navigation.
    const nav = screen.getByRole('navigation', { name: 'Mission Control sections' })
    const rotaLink = await within(nav).findByRole('link', { name: 'Rota' })
    expect(rotaLink.getAttribute('href')).toContain('/mission-control/calls')
    expect(within(nav).queryByRole('link', { name: 'Calls' })).toBeNull()
    expect(activeTab().map(link => link.textContent)).toEqual(['Rota'])
    expect(await screen.findByText("Today's rota")).toBeInTheDocument()
  })

  it('shows the coverage target, shortfall and escalation on the Staffing workspace', async () => {
    renderWorkspace('supported_living', '/mission-control/staffing')
    expect(await screen.findByText('7-day minimum staffing coverage')).toBeInTheDocument()
    // The Figma metric card and the minimum-staffing card both surface the figure.
    expect((await screen.findAllByText('72%')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Target 85% · 2 of 4 shifts below minimum · 3 staff needed/)).toBeInTheDocument()
    expect(screen.getByText(/Coverage is below the configured target/)).toBeInTheDocument()
    expect(screen.getByText(/Maple House: 0\/2 staff/)).toBeInTheDocument()
    expect(activeTab().map(link => link.textContent)).toEqual(['Staffing'])
  })

  it('keeps the selected tab active on the Incidents route and hides the other workspaces', async () => {
    renderWorkspace('domiciliary', '/mission-control/incidents')

    expect(await screen.findByText('Incident follow-up')).toBeInTheDocument()
    expect(screen.queryByText('Call exceptions')).not.toBeInTheDocument()
    expect(screen.queryByText('No calls scheduled')).not.toBeInTheDocument()
    // The Incidents tab carries the live open-incident count badge (mock reports 1).
    expect(activeTab().map(link => link.textContent)).toEqual(['Incidents1'])
  })

  it('updates all summary and schedule queries when the operational date changes', async () => {
    renderWorkspace()
    await screen.findByText('No calls scheduled')
    const initialSummaryCalls = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/mission-control/homecare-summary')
    const initialDate = initialSummaryCalls[initialSummaryCalls.length - 1][1]?.params?.date as string

    fireEvent.click(screen.getByRole('button', { name: 'Previous operational day' }))

    await waitFor(() => {
      const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/mission-control/homecare-summary')
      expect(calls.length).toBeGreaterThan(initialSummaryCalls.length)
    })
    const summaryCalls = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/mission-control/homecare-summary')
    expect(summaryCalls.at(-1)?.[1]?.params?.date).not.toBe(initialDate)
    // The date is shared: the active tab stays on Today after the change.
    expect(activeTab().map(link => link.textContent)).toEqual(['Today'])
  })

  describe('visits table on the domiciliary Calls tab', () => {
    it('lists the day\'s visits in time order with their person, carer, visit and status', async () => {
      renderCallsTab({ data: SCHEDULE_VISITS })

      expect(await screen.findByRole('table', { name: TABLE_NAME })).toBeInTheDocument()
      const rows = tableBodyRows()
      expect(rows).toHaveLength(5)
      expect(within(rows[0]).getByText('Ada Lovelace')).toBeInTheDocument()
      expect(within(rows[0]).getByText('Grace Hopper')).toBeInTheDocument()
      expect(within(rows[0]).getByText('Morning call')).toBeInTheDocument()
      expect(within(rows[1]).getByText('Eve Adams')).toBeInTheDocument()
      expect(within(rows[1]).getByText('Missed')).toBeInTheDocument()
      const bobRow = rows.find(row => within(row).queryByText('Bob Ross'))!
      expect(within(bobRow).getByText('Unassigned')).toBeInTheDocument()
    })

    it('searches across person, carer and visit fields', async () => {
      renderCallsTab({ data: SCHEDULE_VISITS })
      await screen.findByRole('table', { name: TABLE_NAME })
      const search = screen.getByRole('textbox', { name: 'Search visits' })

      fireEvent.change(search, { target: { value: 'carla' } })
      expect(tableBodyRows()).toHaveLength(1)
      expect(within(tableBodyRows()[0]).getByText('Carla Ng')).toBeInTheDocument()

      fireEvent.change(search, { target: { value: 'alan' } })
      expect(tableBodyRows()).toHaveLength(2)
      expect(tableBodyRows().map(row => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Carla Ng'), expect.stringContaining('Eve Adams')]))
    })

    it('filters by status and by carer assignment', async () => {
      renderCallsTab({ data: SCHEDULE_VISITS })
      await screen.findByRole('table', { name: TABLE_NAME })

      fireEvent.click(screen.getByRole('button', { name: /^Scheduled/ }))
      expect(tableBodyRows().map(row => row.textContent)).toEqual([
        expect.stringContaining('Bob Ross'),
        expect.stringContaining('Dan Reed'),
      ])
      expect(screen.getByRole('button', { name: /^Scheduled/ })).toHaveAttribute('aria-pressed', 'true')

      fireEvent.click(screen.getByRole('button', { name: /^In progress/ }))
      expect(tableBodyRows()).toHaveLength(1)
      expect(within(tableBodyRows()[0]).getByText('Carla Ng')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /^All \d/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
      expect(tableBodyRows()).toHaveLength(1)
      expect(within(tableBodyRows()[0]).getByText('Bob Ross')).toBeInTheDocument()
    })

    it('pages the visits ten at a time', async () => {
      const many = Array.from({ length: 12 }, (_, i) => dayVisit({
        id: `p${i}`,
        status: 'scheduled',
        person_name: `Person ${i}`,
        scheduled_start: `${SCHEDULE_DATE}T${String(6 + i).padStart(2, '0')}:00:00`,
        scheduled_end: `${SCHEDULE_DATE}T${String(6 + i).padStart(2, '0')}:30:00`,
      }))
      renderCallsTab({ data: many })
      await screen.findByRole('table', { name: TABLE_NAME })
      expect(tableBodyRows()).toHaveLength(10)

      fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }))
      expect(tableBodyRows()).toHaveLength(2)
      expect(within(tableBodyRows()[0]).getByText('Person 10')).toBeInTheDocument()
    })

    it('opens a read-only detail dialog when a row is clicked and closes it again', async () => {
      renderCallsTab({ data: SCHEDULE_VISITS })
      await screen.findByRole('table', { name: TABLE_NAME })

      fireEvent.click(within(tableBodyRows().find(row => row.textContent?.includes('Carla Ng'))!).getByText('Carla Ng'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('heading', { name: 'Carla Ng' })).toBeInTheDocument()
      expect(within(dialog).getByText('Alan Turing')).toBeInTheDocument()
      expect(within(dialog).getByText('En Route')).toBeInTheDocument()
      // Package, check-in and check-out are all absent from this fixture, so each shows the fallback.
      expect(within(dialog).getAllByText('Not recorded')).toHaveLength(3)

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('explains when filters match nothing and can clear them', async () => {
      renderCallsTab({ data: SCHEDULE_VISITS })
      await screen.findByRole('table', { name: TABLE_NAME })

      fireEvent.change(screen.getByRole('textbox', { name: 'Search visits' }), { target: { value: 'zzz' } })
      expect(screen.getByText('No visits match these filters.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(tableBodyRows()).toHaveLength(5)
    })

    it('shows a retryable error when the visits cannot be loaded', async () => {
      renderCallsTab(new Error('network down'))
      expect(await screen.findByText('Could not load the visits.')).toBeInTheDocument()
      expect(screen.queryByRole('table', { name: TABLE_NAME })).not.toBeInTheDocument()
    })
  })

  describe('handover gaps on the supported-living Compliance tab', () => {
    const gap = (overrides: Record<string, unknown>) => ({
      shift_id: 'shift-a',
      shift_type: 'day',
      start_time: '2026-10-15T08:00:00Z',
      end_time: '2026-10-15T16:00:00Z',
      location_id: 'loc-1',
      location_name: 'Ash Grove',
      staff_notified: true,
      hours_since_end: 20,
      rostered: [{ user_id: 'u1', name: 'Nadia Khan' }],
      ...overrides,
    })

    it('lists each shift that ended without a handover, who was on it and whether they were told', async () => {
      overrideGet('/mission-control/handover-gaps', { data: {
        window_days: 7,
        grace_minutes: 30,
        total: 2,
        shifts: [
          gap({ rostered: [{ user_id: 'u1', name: 'Nadia Khan' }, { user_id: 'u2', name: 'Tom Abara' }] }),
          gap({ shift_id: 'shift-b', location_name: 'Birch Lodge', staff_notified: false, rostered: [{ user_id: 'u3', name: 'Alex Reed' }] }),
        ],
      } })
      renderWorkspace('supported_living', '/mission-control/compliance')

      const table = await screen.findByRole('table', { name: 'Shifts that ended without a handover' })
      const rows = within(table.querySelector('tbody')!).getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(within(rows[0]).getByText('Ash Grove')).toBeInTheDocument()
      expect(within(rows[0]).getByText('Nadia Khan, Tom Abara')).toBeInTheDocument()
      expect(within(rows[0]).getByText('2 staff on the shift')).toBeInTheDocument()
      expect(within(rows[0]).getByText('Staff notified')).toBeInTheDocument()
      expect(within(rows[1]).getByText('Birch Lodge')).toBeInTheDocument()
      expect(within(rows[1]).getByText('Not yet notified')).toBeInTheDocument()
      expect(screen.getByText(/2 shifts ended without a handover in the last 7 days/)).toBeInTheDocument()
      expect(screen.getByText(/Shifts that ended in the last 30 minutes are left out/)).toBeInTheDocument()
    })

    it('opens the shift on the rota when its row is selected', async () => {
      overrideGet('/mission-control/handover-gaps', { data: {
        window_days: 7, grace_minutes: 30, total: 1, shifts: [gap({})],
      } })
      renderWorkspace('supported_living', '/mission-control/compliance')

      const table = await screen.findByRole('table', { name: 'Shifts that ended without a handover' })
      const row = within(table.querySelector('tbody')!).getAllByRole('row')[0]
      fireEvent.click(within(row).getByText('Ash Grove'))

      expect(await screen.findByText('Rota destination')).toBeInTheDocument()
    })

    it('says so plainly when every shift has a handover', async () => {
      overrideGet('/mission-control/handover-gaps', { data: { window_days: 7, grace_minutes: 30, total: 0, shifts: [] } })
      renderWorkspace('supported_living', '/mission-control/compliance')

      expect(await screen.findByText('Every shift in the last 7 days has a handover recorded.')).toBeInTheDocument()
      expect(screen.queryByRole('table', { name: 'Shifts that ended without a handover' })).not.toBeInTheDocument()
    })

    it('keeps the rest of the compliance view working when the gaps cannot be loaded', async () => {
      overrideGet('/mission-control/handover-gaps', new Error('network down'))
      renderWorkspace('supported_living', '/mission-control/compliance')

      expect(await screen.findByText('Could not load the handover gaps.')).toBeInTheDocument()
      expect(screen.getByText('Compliance records')).toBeInTheDocument()
    })
  })

  describe('rota on the supported-living Calls tab', () => {
    const rotaDay = new Date().toLocaleDateString('en-CA')
    const assigned = (staff_id: string, first_name: string, last_name: string) => ({ staff_id, first_name, last_name, status: 'assigned' })
    const rotaShift = (overrides: Record<string, unknown>) => ({
      status: 'scheduled',
      shift_type: 'day',
      assignments: [],
      ...overrides,
    })
    const ROTA_SHIFTS = [
      rotaShift({ id: 's1', location_id: 'loc-oak', location_name: 'Oak House', start_time: `${rotaDay}T07:00:00`, end_time: `${rotaDay}T15:00:00`, assignments: [assigned('u1', 'Alice', 'Brown'), assigned('u2', 'Karl', 'Owens')] }),
      rotaShift({ id: 's2', location_id: 'loc-oak', location_name: 'Oak House', start_time: `${rotaDay}T15:00:00`, end_time: `${rotaDay}T23:00:00`, assignments: [assigned('u3', 'Sam', 'Mensah'), assigned('u4', 'June', 'Taylor')] }),
      rotaShift({ id: 's3', location_id: 'loc-oak', location_name: 'Oak House', start_time: `${rotaDay}T23:00:00`, end_time: `${rotaDay}T23:59:00`, assignments: [assigned('u5', 'Ruth', 'Ng')] }),
      rotaShift({ id: 's4', location_id: 'loc-elm', location_name: 'Elm House', start_time: `${rotaDay}T07:00:00`, end_time: `${rotaDay}T15:00:00`, assignments: [assigned('u1', 'Alice', 'Brown'), assigned('u2', 'Karl', 'Owens')] }),
      rotaShift({ id: 's5', location_id: 'loc-elm', location_name: 'Elm House', start_time: `${rotaDay}T15:00:00`, end_time: `${rotaDay}T23:00:00`, assignments: [assigned('u6', 'Hana', 'Ellis')] }),
      rotaShift({ id: 's6', location_id: 'loc-elm', location_name: 'Elm House', start_time: `${rotaDay}T23:00:00`, end_time: `${rotaDay}T23:59:00`, assignments: [assigned('u7', 'Mara', 'Cole')] }),
      rotaShift({ id: 's7', location_id: 'loc-birch', location_name: 'Birch Court', start_time: `${rotaDay}T07:00:00`, end_time: `${rotaDay}T15:00:00` }),
      rotaShift({ id: 's8', location_id: 'loc-birch', location_name: 'Birch Court', start_time: `${rotaDay}T15:00:00`, end_time: `${rotaDay}T23:00:00` }),
    ]
    const ROTA_LOCATIONS = [
      { id: 'loc-oak', name: 'Oak House' },
      { id: 'loc-elm', name: 'Elm House' },
      { id: 'loc-birch', name: 'Birch Court' },
    ]
    const ROTA_MIN_STAFF = [
      { location_id: 'loc-oak', minimum_staff_per_day: 2, min_night_staff: 1 },
      { location_id: 'loc-elm', minimum_staff_per_day: 2, min_night_staff: 1 },
      { location_id: 'loc-birch', minimum_staff_per_day: 2, min_night_staff: 1 },
    ]

    function renderRota() {
      overrideGet('/shifts', { data: ROTA_SHIFTS })
      overrideGet('/settings/locations', { data: ROTA_LOCATIONS })
      overrideGet('/shifts/min-staff', { data: ROTA_MIN_STAFF })
      return renderWorkspace('supported_living', '/mission-control/calls')
    }

    it('summarises the day in four metric cards', async () => {
      renderRota()
      await screen.findByText("Today's rota")

      expect(screen.getByText('Scheduled shifts')).toBeInTheDocument()
      expect(screen.getByText('2 of 3')).toBeInTheDocument()
      expect(screen.getByText('Birch Court has no cover')).toBeInTheDocument()
      expect(screen.getByText('7 rostered · 1 free')).toBeInTheDocument()
      expect(screen.getByText('72%')).toBeInTheDocument()
      expect(screen.getByText('2 shifts below minimum')).toBeInTheDocument()
    })

    it('groups shifts by location with filled counts, initials and cover badges', async () => {
      renderRota()
      await screen.findByText("Today's rota")

      expect(screen.getByText('Oak House')).toBeInTheDocument()
      expect(screen.getByText('All shifts covered')).toBeInTheDocument()
      expect(screen.getByText('Elm House')).toBeInTheDocument()
      expect(screen.getByText('1 shift needs cover')).toBeInTheDocument()
      expect(screen.getByText('Birch Court')).toBeInTheDocument()
      expect(screen.getByText('No cover')).toBeInTheDocument()
      expect(screen.getAllByText('2 of 2 filled')).toHaveLength(3)
      expect(screen.getByText('1 of 2 filled')).toBeInTheDocument()
      expect(screen.getAllByText('0 of 2 filled')).toHaveLength(2)
      expect(screen.getAllByText('AB')).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: 'Fill shift' })).toHaveLength(3)
    })

    it('escalates open shifts with marketplace and agency actions', async () => {
      renderRota()
      await screen.findByText("Today's rota")

      expect(screen.getByText('3 shifts need cover today')).toBeInTheDocument()
      expect(screen.getByText(/earliest starts at/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Post to Shift Marketplace' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Book agency cover' })).toBeInTheDocument()
    })

    it('shows the next seven days and the rota quick actions', async () => {
      renderRota()
      await screen.findByText("Today's rota")

      expect(screen.getByText('Next 7 days')).toBeInTheDocument()
      expect(screen.getAllByText('Not planned')).toHaveLength(7)
      expect(screen.getByText('Rota Planner')).toBeInTheDocument()
      expect(screen.getByText('Shift Marketplace')).toBeInTheDocument()
      expect(screen.getByText('Leave Manager')).toBeInTheDocument()
      expect(screen.getByText('Agencies')).toBeInTheDocument()
    })

    it('shows the empty state with creation actions when nothing is scheduled', async () => {
      renderWorkspace('supported_living', '/mission-control/calls')

      expect(await screen.findByText('No shifts are scheduled for today')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Create shifts/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Post an open shift' })).toBeInTheDocument()
    })

    it('shows a retryable error when the rota cannot be loaded', async () => {
      overrideGet('/shifts', new Error('network down'))
      renderWorkspace('supported_living', '/mission-control/calls')

      expect(await screen.findByText("Today's rota could not be loaded.")).toBeInTheDocument()
    })
  })

  describe('carer allocation on the domiciliary Staffing tab', () => {
    it('lists each allocated carer with their calls, excluding cancelled and unassigned visits from carer counts', async () => {
      mockVisits({ data: CARER_VISITS })
      renderWorkspace('domiciliary', '/mission-control/staffing')

      expect(await screen.findByRole('list', { name: 'Carer allocations' })).toBeInTheDocument()
      expect(screen.getByText('2 carers allocated · 1 unassigned call')).toBeInTheDocument()
      const list = screen.getByRole('list', { name: 'Carer allocations' })
      expect(within(list).getAllByRole('listitem')).toHaveLength(2)
      expect(within(list).getByText('Grace Hopper')).toBeInTheDocument()
      expect(within(list).getByText('2 calls · 1 completed')).toBeInTheDocument()
      expect(within(list).getByText('08:00 – 10:30')).toBeInTheDocument()
      expect(within(list).getByText('Alan Turing')).toBeInTheDocument()
      expect(within(list).getByText('1 call · 0 completed')).toBeInTheDocument()
      expect(screen.queryByText('Cancelled Carer')).not.toBeInTheDocument()
    })

    it('filters carers by name and reports when nothing matches', async () => {
      mockVisits({ data: CARER_VISITS })
      renderWorkspace('domiciliary', '/mission-control/staffing')
      await screen.findByRole('list', { name: 'Carer allocations' })

      const search = screen.getByRole('textbox', { name: 'Search carers' })
      fireEvent.change(search, { target: { value: 'alan' } })
      const list = screen.getByRole('list', { name: 'Carer allocations' })
      expect(within(list).getAllByRole('listitem')).toHaveLength(1)
      expect(within(list).getByText('Alan Turing')).toBeInTheDocument()
      expect(within(list).queryByText('Grace Hopper')).not.toBeInTheDocument()

      fireEvent.change(search, { target: { value: 'zzz' } })
      expect(screen.getByText('No carers match “zzz”.')).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Carer allocations' })).not.toBeInTheDocument()
    })

    it('shows an empty state when no calls are scheduled for the day', async () => {
      mockVisits({ data: [] })
      renderWorkspace('domiciliary', '/mission-control/staffing')

      expect(await screen.findByText(/No carers are allocated to calls on/)).toBeInTheDocument()
      expect(screen.getByText('0 carers allocated · 0 unassigned calls')).toBeInTheDocument()
    })

    it('shows a retryable error when the visit list cannot be loaded', async () => {
      mockVisits(new Error('network down'))
      renderWorkspace('domiciliary', '/mission-control/staffing')
      expect(await screen.findByText('Could not load carer allocations.')).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Carer allocations' })).not.toBeInTheDocument()
    })
  })

  describe('medication exceptions on the supported-living Care tab', () => {
    const widgetsWithMeds = { data: {
      dbs_expiring_soon: 0, training_expiring_soon: 0,
      overdue_medications: 2, missed_medications: 1,
      missed_detail: [
        { resident_id: 'res-amara', person_name: 'Amara Nwosu', administration_id: 'a1', scheduled_time: '2026-10-26T08:00:00Z', administration_status: 'pending', record_id: 'r1' },
        { resident_id: 'res-brian', person_name: 'Brian Osei', administration_id: 'a2', scheduled_time: '2026-10-25T20:00:00Z', administration_status: 'missed', record_id: 'r2' },
      ],
      competency_due: 0, open_severe_incidents: 0, staff_below_threshold: 0,
    } }

    it('separates the overdue count from the missed count and names the residents behind each', async () => {
      overrideGet('/dashboard/widgets', widgetsWithMeds)
      renderWorkspace('supported_living', '/mission-control/care')

      expect(await screen.findAllByText('Medication overdue')).toHaveLength(2)
      expect(await screen.findAllByText('Missed medication')).toHaveLength(2)
      expect(screen.getByText('2 medication doses are more than 30 minutes late')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open MAR' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Review records' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Amara Nwosu/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Brian Osei/ })).toBeInTheDocument()
      expect(screen.getByText('Nothing due')).toBeInTheDocument()
    })

    it('shows no banner and no names when nothing is overdue or missed', async () => {
      renderWorkspace('supported_living', '/mission-control/care')

      expect(await screen.findAllByText('Medication overdue')).toHaveLength(2)
      expect(screen.queryByText(/Give or record these doses first/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open MAR' })).not.toBeInTheDocument()
      expect(screen.getAllByText('Nothing due')).toHaveLength(3)
    })
  })

  describe('reported incidents on the supported-living Incidents tab', () => {
    const statsWithIncident = { data: { total_staff: 8, active_people: 12, staff_on_duty: 4, compliance_rate: 100, open_incidents: 1, locations: 3 } }
    const widgetsNoSevere = { data: {
      dbs_expiring_soon: 0, training_expiring_soon: 0,
      overdue_medications: 0, missed_medications: 0, missed_detail: [],
      competency_due: 0, open_severe_incidents: 0, staff_below_threshold: 0,
    } }

    it('names the reported incident, its wait, and the investigation step', async () => {
      overrideGet('/dashboard/stats', statsWithIncident)
      overrideGet('/dashboard/widgets', widgetsNoSevere)
      overrideGet('/incidents', { data: [{
        id: 'inc-1', status: 'reported', severity: 'low', category_name: 'Medication',
        incident_date: '2026-07-25', created_at: '2026-07-25T10:00:00Z',
      }] })
      renderWorkspace('supported_living', '/mission-control/incidents')

      expect(await screen.findByText('Not yet triaged')).toBeInTheDocument()
      expect(await screen.findAllByText('Open severe incidents')).toHaveLength(2)
      expect(screen.getByRole('button', { name: 'Submit for triage' })).toBeInTheDocument()
      expect(screen.getByText('Investigation progress')).toBeInTheDocument()
      expect(screen.getByText('Something happened?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Report an incident' })).toBeInTheDocument()
      expect(screen.getByText(/waiting .* for triage/)).toBeInTheDocument()
      expect(screen.getAllByText('Reported')).toHaveLength(2)
    })

    it('shows empty states when nothing is open', async () => {
      renderWorkspace('supported_living', '/mission-control/incidents')

      expect(await screen.findByText('Not yet triaged')).toBeInTheDocument()
      expect(screen.getByText('No open incidents in your process.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Submit for triage' })).not.toBeInTheDocument()
    })
  })
})
