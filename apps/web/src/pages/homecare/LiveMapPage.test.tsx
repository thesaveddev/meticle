import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import LiveMapPage from './LiveMapPage'
import api from '../../services/api'

const { popups } = vi.hoisted(() => ({ popups: [] as string[] }))

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

vi.mock('leaflet', () => {
  const marker = () => {
    const m: any = {
      addTo: () => m,
      bindPopup: (html: string) => { popups.push(html) },
      remove: () => undefined,
      getLatLng: () => ({ lat: 51.5, lng: -0.1 }),
    }
    return m
  }
  const leaflet = {
    map: () => ({ fitBounds: vi.fn(), remove: vi.fn() }),
    tileLayer: () => ({ addTo: () => undefined }),
    marker,
    divIcon: (options: unknown) => options,
    featureGroup: () => ({ getBounds: () => ({ pad: () => ({}) }) }),
  }
  return { ...leaflet, default: leaflet }
})

const mockedApi = vi.mocked(api)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><LiveMapPage /></QueryClientProvider>)
}

describe('LiveMapPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockedApi.get.mockImplementation(() => new Promise(() => {}) as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces the indefinite loading state after the timeout', async () => {
    renderPage()
    // Wording corrected 27 Sep 2026: the map plots check-in positions, so
    // "live visit" / "real-time" overstated it. See
    // docs/DPIA_Live_Active_Visit_Map.md. Asserted with a regex because the
    // copy contains a straight apostrophe, which cannot sit inside a
    // single-quoted string literal.
    expect(screen.getByText(/Loading today's check-in data/)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(12_000)
    })

    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.getByText('The visit map is taking too long to respond.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })
})

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function visit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1', label: 'Morning call', person_name: 'Margaret Ellis', person_address: null,
    carer_name: 'Joyce Amankwah', carer_id: 's1', status: 'checked_in',
    scheduled_start: hoursAgo(5), scheduled_end: hoursAgo(4),
    position_source: 'check_in', position_captured_at: hoursAgo(3),
    latitude: 51.5074, longitude: -0.1278, is_active: true,
    location_id: 'l1', location_name: 'North London',
    // Present on purpose. This is the field the page used to render as though
    // it were the position time; a payload that still carries it must not
    // change what the page shows.
    updated_at: hoursAgo(0.03),
    ...overrides,
  }
}

function serve(active: unknown[], scheduled: unknown[] = []) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/dashboard/live-map') {
      return Promise.resolve({
        data: {
          active_visits: active, scheduled_visits: scheduled,
          completed_today: 0, total_today: active.length,
          centre: null, areas: [], area_stats: [],
        },
      })
    }
    return Promise.resolve({ data: [] })
  })
}

describe('the time a live-map pin shows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    popups.length = 0
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'm1', role: 'MANAGER' }))
  })

  it('shows when the position was captured, and how long ago that was', async () => {
    serve([visit()])
    renderPage()

    // The client name sits inside a longer caption line, so match on part of it.
    expect(await screen.findByText(/Margaret Ellis/)).toBeInTheDocument()
    expect(screen.getByText(`Checked in ${clockTime(hoursAgo(3))} · 3h ago`)).toBeInTheDocument()
  })

  it('never renders the visit row time as the position time', async () => {
    serve([visit()])
    renderPage()

    await screen.findByText(/Margaret Ellis/)
    // The row was edited a minute ago. If that clock is what the page shows,
    // this fails — which is the point of the field being in the fixture.
    const rowTime = clockTime(hoursAgo(0.03))
    expect(document.body.textContent).not.toContain(rowTime)
  })

  it('marks a position captured hours ago as recorded rather than current', async () => {
    serve([visit()])
    renderPage()

    expect(await screen.findByText('GPS recorded')).toBeInTheDocument()
    expect(screen.queryByText('GPS captured')).toBeNull()
  })

  it('marks a position from minutes ago as captured', async () => {
    serve([visit({ position_captured_at: hoursAgo(0.25) })])
    renderPage()

    expect(await screen.findByText('GPS captured')).toBeInTheDocument()
    expect(screen.getByText(`Checked in ${clockTime(hoursAgo(0.25))} · 15 min ago`)).toBeInTheDocument()
  })

  it('says when a plotted point came from check-out', async () => {
    serve([visit({ position_source: 'check_out', position_captured_at: hoursAgo(2) })])
    renderPage()

    expect(await screen.findByText(`Checked out ${clockTime(hoursAgo(2))} · 2h ago`)).toBeInTheDocument()
  })

  it('shows no time at all for a visit with no position', async () => {
    serve([visit({ latitude: null, longitude: null, position_source: null, position_captured_at: null })])
    renderPage()

    expect(await screen.findByText('No GPS')).toBeInTheDocument()
    expect(screen.queryByText(/Checked in/)).toBeNull()
    expect(screen.queryByText(/Checked out/)).toBeNull()
  })

  it('says on the page that a pin is a capture rather than a live fix', async () => {
    serve([visit()])
    renderPage()

    expect(await screen.findByText(/not a live fix/i)).toBeInTheDocument()
  })

  it('carries the capture time into the map popup, not the row time', async () => {
    serve([visit()])
    renderPage()

    await screen.findByText(/Margaret Ellis/)
    await waitFor(() => expect(popups.length).toBeGreaterThan(0))
    const popup = popups.join('\n')
    expect(popup).toContain(`Checked in ${clockTime(hoursAgo(3))}`)
    expect(popup).toContain('3h ago')
    expect(popup).not.toContain(clockTime(hoursAgo(0.03)))
  })
})
