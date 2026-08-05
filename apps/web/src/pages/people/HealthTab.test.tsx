import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HealthTab from './HealthTab'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import api from '../../services/api'

const PERSON_ID = 'person-1'

function renderHealthTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <HealthTab personId={PERSON_ID} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/fluid/total')) return Promise.resolve({ data: { total_ml: 0 } })
    return Promise.resolve({ data: [] })
  })
})

describe('HealthTab stacked sections', () => {
  it('renders all four health sections together on a single page', async () => {
    renderHealthTab()

    await waitFor(() => {
      expect(screen.getByText('Health Observations')).toBeInTheDocument()
      expect(screen.getByText('Bowel Movements')).toBeInTheDocument()
      expect(screen.getByText('Dental Records')).toBeInTheDocument()
      expect(screen.getByText('Fluid Intake')).toBeInTheDocument()
    })
  })

  it('shows an empty state for every section when no data exists', async () => {
    renderHealthTab()

    await waitFor(() => {
      expect(screen.getByText('No observations recorded')).toBeInTheDocument()
      expect(screen.getByText('No bowel movements recorded')).toBeInTheDocument()
      expect(screen.getByText('No dental records')).toBeInTheDocument()
      expect(screen.getByText('No fluid intake recorded for this date')).toBeInTheDocument()
    })
  })

  it('keeps all sections visible even when some sections have records', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/observations')) {
        return Promise.resolve({
          data: [{ id: 'o1', category: 'general', severity: 'normal', observation_date: '2026-08-01', notes: 'Fine today', recorded_by_name: 'A. Staff' }],
        })
      }
      if (url.includes('/fluid/total')) return Promise.resolve({ data: { total_ml: 1250 } })
      return Promise.resolve({ data: [] })
    })

    renderHealthTab()

    await waitFor(() => {
      expect(screen.getByText('Fine today')).toBeInTheDocument()
      expect(screen.getByText('Health Observations')).toBeInTheDocument()
      expect(screen.getByText('Bowel Movements')).toBeInTheDocument()
      expect(screen.getByText('Dental Records')).toBeInTheDocument()
      expect(screen.getByText('Fluid Intake')).toBeInTheDocument()
    })
  })

  it('shows the fluid daily total from the API', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/fluid/total')) return Promise.resolve({ data: { total_ml: 1750 } })
      return Promise.resolve({ data: [] })
    })

    renderHealthTab()

    await waitFor(() => {
      expect(screen.getByText(/1,?750 ml/)).toBeInTheDocument()
      expect(screen.getByText('Target: 2000 ml')).toBeInTheDocument()
    })
  })
})
