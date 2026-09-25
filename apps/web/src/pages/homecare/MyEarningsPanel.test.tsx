import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyEarningsPanel from './MyEarningsPanel'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MyEarningsPanel /></QueryClientProvider>)
}

describe('MyEarningsPanel', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
  })

  it('explains an unlinked staff profile instead of showing a page of zeros', async () => {
    mockedApi.get.mockResolvedValue({ data: { staff_profile_linked: false, summary: {}, visits: [], scheduled: [], ytd: null } } as any)
    renderPanel()
    expect(await screen.findByText(/not linked to a staff profile/i)).toBeInTheDocument()
    expect(screen.queryByText('Gross pay')).not.toBeInTheDocument()
  })

  it('offers a retry when earnings fail to load instead of rendering silent zeros', async () => {
    mockedApi.get.mockRejectedValue(new Error('boom'))
    renderPanel()
    // The query retries once before surfacing the error, so allow for the backoff
    expect(await screen.findByText(/could not load your earnings/i, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByText('Gross pay')).not.toBeInTheDocument()
  })

  it('renders period totals, year to date and the calls behind the pay', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      staff_profile_linked: true,
      summary: {
        total_work_minutes: 60, total_paid_travel_minutes: 15, total_travel_minutes: 15,
        total_mileage_miles: 4, total_gross_pay_pence: 1725, hourly_rate_pence: 1500,
        mileage_rate_pence: 45, visit_count: 1,
      },
      visits: [{ id: 'v1', label: 'Morning call', person_name: 'Pat Taylor', scheduled_start: '2026-09-10T09:00:00.000Z', status: 'completed', work_minutes: 60, paid_travel_minutes: 15, mileage_miles: 4, gross_pay_pence: 1725, tasks_total: 2, tasks_completed: 2 }],
      scheduled: [],
      ytd: { year: 2026, total_gross_pay_pence: 1725, total_work_minutes: 60, total_mileage_miles: 4, visit_count: 1, months: [] },
    } } as any)
    renderPanel()

    expect(await screen.findByText('Pat Taylor')).toBeInTheDocument()
    expect(screen.getByText('Year to date · 2026')).toBeInTheDocument()
    expect(screen.getAllByText('£17.25').length).toBeGreaterThan(0)
  })
})
