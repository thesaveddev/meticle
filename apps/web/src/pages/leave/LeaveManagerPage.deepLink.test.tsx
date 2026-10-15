import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import LeaveManagerPage from './LeaveManagerPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The record link a leave request is opened from: `?request=<id>`.
 *
 * The link has to work from wherever it arrives — a notification, a colleague's
 * chat message, an email button — so the request has to open from three starting
 * points, and each is a case below:
 *
 *   1. it is already in the caller's own list, which is the only list a care worker
 *      has;
 *   2. it is somebody else's and the caller is a manager, so it is in the
 *      all-requests list they manage (and the page must move to that tab, because
 *      the link promises the request, not a dialog floating over the wrong list);
 *   3. neither list on screen holds it, because the lists are filtered and paged —
 *      which is the common case for an email — so the page reads it by id.
 *
 * The last case is the one worth being strict about: a link that only worked for a
 * row you could already see would be no better than a link to the leave page. The
 * assertions are on text only the detail dialog renders, since the tables show the
 * type, dates, duration and status too.
 */
const MINE = {
  id: 'lr1',
  staff_id: 's1',
  leave_type_id: 'lt1',
  start_date: '2026-11-02',
  end_date: '2026-11-04',
  hours_requested: null,
  duration_type: 'days',
  status: 'pending',
  reason: 'Family wedding',
  notes: 'Notes that only the dialog shows',
  leave_type_name: 'Annual Leave',
  leave_type_color: '#0164C8',
  leave_duration_type: 'days',
  first_name: 'Priya',
  last_name: 'Sharma',
  created_at: '2026-10-15T09:00:00.000Z',
}

const SOMEBODY_ELSES = {
  ...MINE,
  id: 'lr9',
  first_name: 'Tom',
  last_name: 'Bradley',
  status: 'approved',
  notes: 'Read from the all-requests list',
}

/** Renders the URL's search string, so a test can see the link being cleared. */
function LocationProbe() {
  return <div data-testid="location-search">{useLocation().search}</div>
}

function renderLeave(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/leave" element={<><LeaveManagerPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Every read the page makes on mount, with the two request lists as arguments. */
function mockApi({ mine, all }: { mine: any[]; all: any[] | (() => any[]) }) {
  const allCalls = { count: 0 }
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/leave/my-requests') return Promise.resolve({ data: mine })
    if (url.startsWith('/leave/requests')) {
      allCalls.count += 1
      const value = typeof all === 'function' ? all() : all
      return Promise.resolve({ data: value })
    }
    if (url.startsWith('/leave/calendar-stats')) return Promise.resolve({ data: { dates: [] } })
    return Promise.resolve({ data: [] })
  })
  return allCalls
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'MANAGER' }))
})

describe('LeaveManagerPage deep links', () => {
  it("opens the request a link names when it is one of the caller's own", async () => {
    mockApi({ mine: [MINE], all: [] })
    renderLeave('/leave?request=lr1')

    expect(await screen.findByText('Notes that only the dialog shows')).toBeInTheDocument()
    // The request was already loaded, so nothing was read for it by id.
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith('/leave/requests/lr1')
  })

  it("opens somebody else's request for a manager, on the tab that lists it", async () => {
    mockApi({ mine: [], all: [SOMEBODY_ELSES] })
    renderLeave('/leave?request=lr9')

    expect(await screen.findByText('Read from the all-requests list')).toBeInTheDocument()
    // The link promises the request, so the page lands on the list that holds it.
    //
    // Read with `hidden: true` because the record is open over that list: a MUI dialog
    // marks everything behind it `aria-hidden`, and the tab this asserts on is
    // deliberately the one behind the dialog rather than beside it.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'All Requests', hidden: true })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('reads and opens a request neither list on screen happened to hold', async () => {
    // The all-requests read the page makes on mount is filtered, so it can come back
    // without the linked row; the page then follows the link by id.
    let first = true
    const calls = mockApi({
      mine: [],
      all: () => {
        if (first) { first = false; return [] }
        return [SOMEBODY_ELSES]
      },
    })
    renderLeave('/leave?request=lr9')

    expect(await screen.findByText('Read from the all-requests list')).toBeInTheDocument()
    // Two reads: the list on mount, then the link's own.
    await waitFor(() => expect(calls.count).toBeGreaterThan(1))
  })

  it('drops the link when the record is closed, so it cannot re-open itself', async () => {
    mockApi({ mine: [MINE], all: [] })
    renderLeave('/leave?request=lr1')

    await screen.findByText('Notes that only the dialog shows')
    expect(screen.getByTestId('location-search').textContent).toContain('request=lr1')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    // The dialog is gone and so is the parameter that opened it: the URL is what
    // re-opens a dialog, so a link that outlived its dialog would put the reader
    // back in it on the next render or reload.
    await waitFor(() => expect(screen.queryByText('Notes that only the dialog shows')).not.toBeInTheDocument())
    expect(screen.getByTestId('location-search').textContent).not.toContain('request=')
  })

  it('opens nothing when no link is present', async () => {
    mockApi({ mine: [MINE], all: [] })
    renderLeave('/leave')

    // The caller's own list is on screen — the row by the leave type it names, which
    // is a column of that table (the table is the caller's own leave, so it does not
    // repeat their name back at them) — and nothing was opened over it.
    expect(await screen.findByText('Annual Leave')).toBeInTheDocument()
    expect(screen.queryByText('Notes that only the dialog shows')).not.toBeInTheDocument()
  })
})
