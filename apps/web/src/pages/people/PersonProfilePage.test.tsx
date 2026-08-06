import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { SnackbarProvider } from '../../context/SnackbarContext'
import PersonProfilePage from './PersonProfilePage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

vi.mock('./HealthTab', () => ({ default: () => <div data-testid="health-tab" /> }))
vi.mock('./BodyMapTab', () => ({ default: () => <div data-testid="body-map-tab" /> }))
vi.mock('./MemoryBookTab', () => ({ default: () => <div data-testid="memory-book-tab" /> }))
vi.mock('../goals/GoalsPage', () => ({ default: () => <div data-testid="goals-tab" /> }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  Cell: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  RadarChart: ({ children }: any) => <div>{children}</div>,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import api from '../../services/api'

const PERSON = {
  id: 'p1',
  first_name: 'Agatha',
  last_name: 'Christie',
  date_of_birth: '1940-05-01',
  gender: 'female',
  status: 'active',
  tags: [],
  flags: [],
  care_plans: [],
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="current-url">{location.pathname + location.search}</span>
}

function renderProfile(initialEntry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SnackbarProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/people/:id" element={<><PersonProfilePage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </SnackbarProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/settings/locations') return Promise.resolve({ data: [] })
    if (url === '/family-portal/members') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: PERSON })
  })
})

describe('PersonProfilePage URL-driven tabs', () => {
  it('opens the health tab when ?tab=health is in the URL', async () => {
    renderProfile('/people/p1?tab=health')

    await waitFor(() => {
      expect(screen.getByTestId('health-tab')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('body-map-tab')).not.toBeInTheDocument()
  })

  it('opens the goals tab when ?tab=goals is in the URL', async () => {
    renderProfile('/people/p1?tab=goals')

    await waitFor(() => {
      expect(screen.getByTestId('goals-tab')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('health-tab')).not.toBeInTheDocument()
  })

  it('falls back to the overview tab for an unknown slug', async () => {
    renderProfile('/people/p1?tab=not-a-real-tab')

    await waitFor(() => {
      expect(screen.getByText('Personal Details')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('health-tab')).not.toBeInTheDocument()
  })

  it('shows the overview tab when no ?tab param is present', async () => {
    renderProfile('/people/p1')

    await waitFor(() => {
      expect(screen.getByText('Personal Details')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('health-tab')).not.toBeInTheDocument()
  })

  it('syncs the URL when a tab is clicked', async () => {
    renderProfile('/people/p1')

    await waitFor(() => {
      expect(screen.getByText('Personal Details')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Care'))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Care Plans' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Care Plans' }))

    await waitFor(() => {
      expect(screen.getByTestId('current-url')).toHaveTextContent('/people/p1?tab=care-plans')
    })
  })
})
