import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import RotaPlannerPage from './RotaPlannerPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

vi.mock('../../utils/permissions', () => ({
  fetchUserPermissions: vi.fn(async () => ({ permissions: [] })),
}))

import api from '../../services/api'

/**
 * The deep link that names one shift: `/scheduling?week=<day>&shift=<id>`.
 *
 * An unclaimed-shift reminder, the shift-start digest and Mica's own "want me to
 * open it?" all hand over a shift, and this page is where it opens — through the
 * detail dialog a click on the grid opens, not a second rendering of the same
 * record.
 *
 * Two properties are worth more than the dialog opening at all:
 *
 *   1. The week is part of the link, because a shift is only found on a grid that is
 *      showing its week. A link that opened the right shift on the wrong week would
 *      look like it worked and leave the carer hunting.
 *   2. Closing the record drops `shift` but **keeps** `week`. The week is the carer's
 *      position on the grid; a close button that moved them back to this week would
 *      be a bug nobody would think to look for.
 *
 * The page fetches a handful of endpoints before it can render a grid, so the mock
 * answers exactly those (staff, locations, min-staff, people, the week's shifts) and
 * nothing else is asserted on.
 */

const WEEK = '2026-10-12'

/** One open day shift on the Monday of the linked week, at the only location. */
const SHIFT = {
  id: 'sh1',
  location_id: 'loc1',
  location_name: 'Oak House',
  shift_type: 'day',
  start_time: '2026-10-12T07:00:00.000Z',
  end_time: '2026-10-12T19:00:00.000Z',
  assignments: [],
}

/** Shows the current route, so the URL can be asserted after a close. */
function UrlProbe() {
  const location = useLocation()
  return <span data-testid="url">{`${location.pathname}${location.search}`}</span>
}

function renderRota(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/scheduling" element={<><RotaPlannerPage /><UrlProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/shifts/staff') return Promise.resolve({ data: [] })
    if (url === '/leave/locations') return Promise.resolve({ data: [{ id: 'loc1', name: 'Oak House', manager_id: null }] })
    if (url === '/shifts/min-staff') return Promise.resolve({ data: [] })
    if (url.startsWith('/people')) return Promise.resolve({ data: [] })
    if (url.startsWith('/shifts?')) return Promise.resolve({ data: [SHIFT] })
    return Promise.resolve({ data: [] })
  })
})

describe('RotaPlannerPage deep links', () => {
  it('opens the shift a link names, and reads the week the link carries', async () => {
    renderRota(`/scheduling?week=${WEEK}&shift=sh1`)

    // The dialog is the record's own view; the title is text only it renders.
    expect(await screen.findByText('Shift Detail')).toBeInTheDocument()
    // The grid behind it opened on the linked week rather than on today's. The whole
    // range, not a bare "12 Oct": the day is also written on the shift itself, so a
    // loose match would pass on a grid showing the wrong week.
    expect(screen.getByText('12 Oct - 18 Oct 2026')).toBeInTheDocument()
  })

  it('opens nothing when the week does not hold the shift the link names', async () => {
    renderRota(`/scheduling?week=${WEEK}&shift=no-such-shift`)

    // The rota itself loaded — the shift reached the page and the grid is drawn.
    expect(await screen.findByText(/Oak House: /)).toBeInTheDocument()
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.some(([u]) => String(u).startsWith('/shifts?'))).toBe(true),
    )
    // A link to a shift this week does not contain opens no dialog: the honest
    // answer to a link whose record has since been deleted or moved.
    expect(screen.queryByText('Shift Detail')).not.toBeInTheDocument()
  })

  it('opens no record when the route carries no link at all', async () => {
    renderRota(`/scheduling?week=${WEEK}`)

    expect(await screen.findByText(/Oak House: /)).toBeInTheDocument()
    expect(screen.queryByText('Shift Detail')).not.toBeInTheDocument()
  })

  it('drops the shift from the URL when the record closes, and keeps the week', async () => {
    renderRota(`/scheduling?week=${WEEK}&shift=sh1`)
    await screen.findByText('Shift Detail')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    // `shift` is gone, so a reload does not reopen a dialog the carer dismissed…
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(`/scheduling?week=${WEEK}`))
    // …and `week` is still where they were reading.
    expect(screen.getByTestId('url').textContent).toContain(`week=${WEEK}`)
    expect(screen.queryByText('Shift Detail')).not.toBeInTheDocument()
  })
})
