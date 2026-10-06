import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallSchedulingPage from './CallSchedulingPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))

const mockedApi = vi.mocked(api)

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function renderPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <CallSchedulingPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'manager-1', role: 'MANAGER' }))
})

describe('CallSchedulingPage', () => {
  it('opens the visit details when loaded from a visit deep link', async () => {
    const visitDate = new Date()
    visitDate.setDate(visitDate.getDate() + 1)
    const targetDate = localDate(visitDate)
    const nextDate = new Date(visitDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateLabel = localDate(nextDate)
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/homecare/visits') {
        return Promise.resolve({ data: [{
          id: 'visit-linked-from-incident',
          label: 'Incident follow-up call',
          person_name: 'Ada Lovelace',
          carer_name: 'Jordan Smith',
          assigned_staff_id: 'staff-1',
          package_name: 'Morning support',
          status: 'completed',
          scheduled_start: `${targetDate}T09:00:00.000Z`,
          scheduled_end: `${targetDate}T09:30:00.000Z`,
        }] })
      }
      return Promise.resolve({ data: [] })
    })

    renderPage(`/call-scheduling/day?date=${targetDate}&visit=visit-linked-from-incident`)

    expect(await screen.findByRole('heading', { name: 'Call details' })).toBeInTheDocument()
    // The client and carer render both in the day's call list and in the
    // opened details dialog, so assert on the dialog's own content.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(dialog).getByText('Incident follow-up call')).toBeInTheDocument()
    expect(within(dialog).getByText('Jordan Smith')).toBeInTheDocument()
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/homecare/visits', {
      params: { from: targetDate, to: nextDateLabel },
    }))
  })
})
