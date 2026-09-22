import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WeeklyCallPlanner from './WeeklyCallPlanner'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><WeeklyCallPlanner /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/people?status=active') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
})

describe('WeeklyCallPlanner', () => {
  it('refetches the visit range when moving to the next week', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Plan and assign calls' })).toBeInTheDocument()
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/homecare/visits', expect.objectContaining({ params: expect.objectContaining({ from: expect.any(String), to: expect.any(String) }) })))
    const initialVisitCalls = mockedApi.get.mock.calls.filter(([url]) => url === '/homecare/visits').length

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(mockedApi.get.mock.calls.filter(([url]) => url === '/homecare/visits').length).toBeGreaterThan(initialVisitCalls))
  })

  it('shows the assigned staff name returned by the visits endpoint', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/homecare/visits') return Promise.resolve({ data: [{
        id: 'visit-1', label: 'Morning call', person_name: 'Alex Jones', assigned_staff_id: 'staff-1',
        assigned_staff_name: 'Jordan Smith', carer_name: null, status: 'scheduled',
        scheduled_start: '2026-09-21T09:00:00.000Z', scheduled_end: '2026-09-21T09:30:00.000Z',
      }] })
      return Promise.resolve({ data: [] })
    })

    renderPage()

    expect(await screen.findByText('Jordan Smith')).toBeInTheDocument()
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument()
  })
})
