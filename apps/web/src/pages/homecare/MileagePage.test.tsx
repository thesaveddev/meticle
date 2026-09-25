import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import MileagePage from './MileagePage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const mockedApi = vi.mocked(api)

const visits = [
  {
    id: 'v1', person_name: 'Jane Doe', assigned_staff_id: 's1', assigned_staff_name: 'Ada Care',
    scheduled_start: '2026-09-01T08:00:00Z', scheduled_end: '2026-09-01T09:00:00Z', status: 'completed',
    check_in_at: '2026-09-01T07:55:00Z', check_out_at: '2026-09-01T09:05:00Z',
    actual_mileage_miles: 4, actual_travel_minutes: 25, mileage_rate_pence: 45,
  },
  {
    id: 'v2', person_name: 'John Smith', assigned_staff_id: 's1', assigned_staff_name: 'Ada Care',
    scheduled_start: '2026-09-02T12:00:00Z', scheduled_end: '2026-09-02T13:00:00Z', status: 'scheduled',
    check_in_at: null,
    actual_mileage_miles: 6, actual_travel_minutes: 30, mileage_rate_pence: 45,
  },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter><QueryClientProvider client={client}><MileagePage /></QueryClientProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'm1', role: 'MANAGER' }))
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/homecare/visits') return Promise.resolve({ data: visits })
    return Promise.resolve({ data: [] })
  })
})

describe('MileagePage', () => {
  it('holds mileage until check-in and opens the owning call from a row', async () => {
    renderPage()
    expect(await screen.findByText('Awarded miles')).toBeInTheDocument()
    expect(await screen.findByText('Awarded')).toBeInTheDocument()
    expect(await screen.findByText('Awaits check-in')).toBeInTheDocument()
    expect(await screen.findByText(/is not awarded yet/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByText('John Smith'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: /call owning this mileage/i })).toBeInTheDocument()
    expect(within(dialog).getByText(/not awarded yet/i)).toBeInTheDocument()
  })

  it('lists carers and drills into their mileage', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /by carer/i }))
    expect(await screen.findByText(/select a carer to see their mileage/i)).toBeInTheDocument()
    fireEvent.click(await screen.findByText('Ada Care'))
    expect(await screen.findByRole('button', { name: /all carers/i })).toBeInTheDocument()
    // The carer column collapses in the drill-down view
    expect(screen.queryAllByText('Ada Care').length).toBeLessThan(3)
  })
})
