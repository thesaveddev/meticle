import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

function clickTab(label: RegExp) {
  fireEvent.click(screen.getByRole('tab', { name: label }))
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/fluid/total')) return Promise.resolve({ data: { total_ml: 0 } })
    return Promise.resolve({ data: [] })
  })
})

describe('HealthTab inner tabs', () => {
  it('renders four inner tabs and shows the Observations section by default', async () => {
    renderHealthTab()

    expect(screen.getByRole('tab', { name: /Observations/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Fluid/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Bowel/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Dental/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Health Observations')).toBeInTheDocument()
    })
  })

  it('switches to each section and shows its empty state', async () => {
    renderHealthTab()

    await waitFor(() => {
      expect(screen.getByText('No observations recorded')).toBeInTheDocument()
    })

    clickTab(/Fluid/i)
    await waitFor(() => {
      expect(screen.getByText('No fluid intake recorded for this date')).toBeInTheDocument()
    })

    clickTab(/Bowel/i)
    await waitFor(() => {
      expect(screen.getByText('No bowel movements recorded')).toBeInTheDocument()
    })

    clickTab(/Dental/i)
    await waitFor(() => {
      expect(screen.getByText('No dental records')).toBeInTheDocument()
    })
  })

  it('shows only the active section while keeping the others one click away', async () => {
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
    })
    expect(screen.queryByText('Bowel Movements')).not.toBeInTheDocument()
    expect(screen.queryByText('Dental Records')).not.toBeInTheDocument()

    clickTab(/Bowel/i)
    await waitFor(() => {
      expect(screen.getByText('Bowel Movements')).toBeInTheDocument()
    })
    expect(screen.queryByText('Fine today')).not.toBeInTheDocument()

    clickTab(/Dental/i)
    await waitFor(() => {
      expect(screen.getByText('Dental Records')).toBeInTheDocument()
    })
  })

  it('shows the fluid daily total from the API on the Fluid tab', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/fluid/total')) return Promise.resolve({ data: { total_ml: 1750 } })
      return Promise.resolve({ data: [] })
    })

    renderHealthTab()

    clickTab(/Fluid/i)
    await waitFor(() => {
      expect(screen.getByText(/1,?750 ml/)).toBeInTheDocument()
      expect(screen.getByText('Target: 2000 ml')).toBeInTheDocument()
    })
  })
})