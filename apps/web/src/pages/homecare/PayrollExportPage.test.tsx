import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PayrollExportPage from './PayrollExportPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderPage(initialEntry = '/payroll-timesheets') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PayrollExportPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PayrollExportPage rate audit', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ role: 'MANAGER' }))
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/homecare/timesheets') return { data: [{
        id: 'ts-1', status: 'approved', staff_name: 'Amina Jones', person_name: 'Pat Taylor',
        scheduled_start: '2026-09-10T09:00:00.000Z', work_minutes: 45, travel_minutes: 12,
        paid_travel_minutes: 12, mileage_miles: 2.5, hourly_rate_pence: 1500,
        hourly_rate_source: 'carer_profile', hourly_rate_source_label: 'Carer pay profile: Standard weekday',
        mileage_rate_pence: 45, mileage_rate_source: 'organisation_policy', mileage_rate_source_label: 'Organisation mileage policy',
        paid_travel_policy_source: 'organisation_policy', paid_travel_policy_label: 'Organisation policy · travel paid',
        rate_calculated_at: '2026-09-10T10:00:00.000Z', gross_pay_pence: 1500,
      }] } as any
      if (url === '/homecare/payroll/exports') return { data: [] } as any
      return { data: [] } as any
    })
  })

  it('shows recorded hourly, mileage and travel sources with the call behind the pay', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Rate audit' }))

    expect(await screen.findByText('Carer pay profile: Standard weekday')).toBeInTheDocument()
    expect(screen.getByText('Organisation mileage policy')).toBeInTheDocument()
    expect(screen.getByText('Organisation policy · travel paid')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View breakdown' }))
    const dialog = await screen.findByRole('dialog', { name: 'Call & pay entry' })
    expect(within(dialog).getByText(/0h 45m/)).toBeInTheDocument()
    expect(within(dialog).getByText(/2\.50 mi/)).toBeInTheDocument()
    expect(within(dialog).getByText(/12 of 12 travel minutes/)).toBeInTheDocument()
    expect(within(dialog).getByText('£15.00')).toBeInTheDocument()
  })

  it('drills from carers to their calls and opens the pay entry', async () => {
    renderPage()
    // The calls view row opens the owning call directly
    fireEvent.click(await screen.findByText('Pat Taylor'))
    const fromCalls = await screen.findByRole('dialog', { name: 'Call & pay entry' })
    expect(within(fromCalls).getByText(/Pay is added automatically/i)).toBeInTheDocument()
    fireEvent.click(within(fromCalls).getByRole('button', { name: 'Close' }))

    fireEvent.click(await screen.findByRole('button', { name: /by carer/i }))
    fireEvent.click(await screen.findByText('Amina Jones'))
    fireEvent.click(await screen.findByText('Pat Taylor'))
    expect(await screen.findByRole('dialog', { name: 'Call & pay entry' })).toBeInTheDocument()
  })
})

describe('PayrollExportPage role scoping', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
  })

  it('renders the carer totals roll-up on its payroll tab, including deep links', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'MANAGER' }))
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.startsWith('/homecare/timesheets/monthly-totals')) return { data: [{
        staff_id: 'sp-1', staff_name: 'Amina Jones', visit_count: 4,
        total_work_minutes: 240, total_travel_minutes: 30, total_paid_travel_minutes: 30,
        total_mileage_miles: 12, total_gross_pay_pence: 6000, approved_gross_pence: 6000,
        pending_count: 1, approved_count: 3, rejected_count: 0, exception_count: 1,
      }] } as any
      return { data: [] } as any
    })
    // Deep link straight onto the tab (the /carer-totals redirect lands here)
    renderPage('/payroll-timesheets?view=carer-totals')

    expect(await screen.findByText('Amina Jones')).toBeInTheDocument()
    expect(screen.getByText('Gross pay')).toBeInTheDocument()
  })

  it('shows carers only their own pay, never the manager workspace', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'CARE_WORKER' }))
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/homecare/my-earnings') return { data: {
        staff_profile_linked: true,
        summary: {
          total_work_minutes: 120, total_paid_travel_minutes: 0, total_travel_minutes: 0,
          total_mileage_miles: 3, total_gross_pay_pence: 2500, hourly_rate_pence: 1500,
          mileage_rate_pence: 45, visit_count: 2,
        },
        visits: [{ id: 'v1', label: 'Morning call', person_name: 'Pat Taylor', scheduled_start: '2026-09-10T09:00:00.000Z', status: 'completed', work_minutes: 120, mileage_miles: 3, gross_pay_pence: 2500, tasks_total: 0, tasks_completed: 0 }],
        scheduled: [], ytd: null,
      } } as any
      return { data: [] } as any
    })
    renderPage()

    expect(await screen.findByText('My pay & timesheets')).toBeInTheDocument()
    expect(await screen.findByText('Gross pay')).toBeInTheDocument()
    expect(screen.getByText('Pat Taylor')).toBeInTheDocument()
    // The manager workspace must not be rendered — or queried — for carers
    expect(screen.queryByText('Export payroll inputs')).not.toBeInTheDocument()
    expect(mockedApi.get).not.toHaveBeenCalledWith('/homecare/timesheets')
    expect(mockedApi.get).not.toHaveBeenCalledWith('/homecare/payroll/exports')
  })
})
