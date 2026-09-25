import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import HomecarePage from './HomecarePage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

const mockedApi = vi.mocked(api)
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter><QueryClientProvider client={client}><HomecarePage /></QueryClientProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/homecare/visits') return Promise.resolve({ data: [] })
    if (url === '/homecare/my-visits') return Promise.resolve({ data: [] })
    if (url === '/homecare/packages') return Promise.resolve({ data: [] })
    if (url === '/homecare/timesheets') return Promise.resolve({ data: [] })
    if (url.startsWith('/people')) return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
})

describe('HomecarePage', () => {
  it('shows the manager workspaces for a manager', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'manager-1', role: 'MANAGER' }))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Care operations' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /care packages/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /missed calls/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /exceptions/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /travel & pay rules/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new package/i })).toBeInTheDocument()
  })

  it('keeps a carer on assigned visits without manager controls', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'carer-1', role: 'CARE_WORKER' }))
    renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Care operations' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /my visits/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new package/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /timesheets/i })).not.toBeInTheDocument()
  })

  it('opens the call pattern dialog from a care package', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'manager-1', role: 'MANAGER' }))
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/homecare/packages') return Promise.resolve({ data: [{ id: 'pkg-1', name: 'Morning support', person_name: 'Jane Doe', funding_type: 'private', status: 'active', hourly_rate_pence: 1800, client_rate_pence: 2500, start_date: '2026-09-01' }] })
      return Promise.resolve({ data: [] })
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: /care packages/i }))
    fireEvent.click(await screen.findByRole('button', { name: /set up call pattern/i }))
    expect(await screen.findByRole('heading', { name: /call pattern · morning support/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add pattern/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /days this call repeats on/i })).toBeInTheDocument()
  })
})
