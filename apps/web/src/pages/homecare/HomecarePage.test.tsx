import { render, screen, waitFor } from '@testing-library/react'
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
    expect(await screen.findByRole('heading', { name: 'Domiciliary care' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /care packages/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /timesheets/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new package/i })).toBeInTheDocument()
  })

  it('keeps a carer on assigned visits without manager controls', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'carer-1', role: 'CARE_WORKER' }))
    renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Domiciliary care' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /my visits/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new package/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /timesheets/i })).not.toBeInTheDocument()
  })
})
