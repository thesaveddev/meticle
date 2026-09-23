import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PayrollExportPage from './PayrollExportPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><PayrollExportPage /></QueryClientProvider>)
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

  it('shows recorded hourly, mileage and travel sources for approved timesheets', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Approved rate audit' }))

    expect(await screen.findByText('Carer pay profile: Standard weekday')).toBeInTheDocument()
    expect(screen.getByText('Organisation mileage policy')).toBeInTheDocument()
    expect(screen.getByText('Organisation policy · travel paid')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View breakdown' }))
    expect(await screen.findByRole('dialog', { name: 'Approved timesheet rate audit' })).toBeInTheDocument()
    expect(screen.getByText(/45 work minutes/)).toBeInTheDocument()
    expect(screen.getByText(/2\.50 miles/)).toBeInTheDocument()
    expect(screen.getByText(/12 of 12 travel minutes included/)).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('£15.00')).toBeInTheDocument()
  })
})
