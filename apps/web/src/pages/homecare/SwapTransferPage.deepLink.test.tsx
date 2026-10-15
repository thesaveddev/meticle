import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import SwapTransferPage from './SwapTransferPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The deep link a swap request's email names: `?swap=<id>`.
 *
 * A swap email goes to the carer whose call it is and to the colleague it is asked
 * of, and both arrive on a page whose sent/received filter is applied on the client
 * — so the request the link names is often not a row on screen. It is therefore
 * followed by id, and it opens the same read-only dialog a row click does, which is
 * the part worth pinning: a second way to look at a request would be a second place
 * for the fields to disagree.
 *
 * There is deliberately no "fetches a request the list does not hold" case. The API
 * has no single-request read (`GET /homecare/swap-requests/:id` does not exist), and
 * the list endpoint returns every request the caller can see without pagination, so
 * the link is resolved against the whole set the page has; a link to anything else
 * opens nothing rather than a dialog full of blanks.
 */
const SWAP = {
  id: 's1',
  request_type: 'swap',
  status: 'pending',
  visit_label: 'Morning call',
  client_name: 'Elsie Fletcher',
  scheduled_start: '2026-10-20T09:00:00.000Z',
  scheduled_end: '2026-10-20T10:00:00.000Z',
  requested_by_name: 'Tom Bradley',
  target_name: 'Priya Sharma',
  message: 'Clash with training',
  is_requested_by_me: true,
  is_target_for_me: false,
  created_at: '2026-10-15T08:00:00.000Z',
}

/**
 * A request aimed at this caller, so it is the one the "Received" filter keeps — and
 * the one whose card carries the accept/decline buttons.
 *
 * The two people are swapped relative to `SWAP` on purpose. Both fixtures are drawn
 * from the same list, so identical names would put the same caption on two cards and
 * make "the card says this, the dialog says that" untestable.
 */
const OTHER_SWAP = {
  ...SWAP,
  id: 's2',
  request_type: 'transfer',
  visit_label: 'Evening call',
  client_name: 'Nora Bell',
  message: 'Carer on leave',
  requested_by_name: 'Priya Sharma',
  target_name: 'Tom Bradley',
  is_requested_by_me: false,
  is_target_for_me: true,
}

/** Shows the URL the page is actually on, so dropping a parameter is observable. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="url">{location.search}</div>
}

function renderSwap(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/swap-transfer" element={<><SwapTransferPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/homecare/swap-requests') return Promise.resolve({ data: [SWAP, OTHER_SWAP] })
    if (url === '/homecare/my-visits') return Promise.resolve({ data: [] })
    if (url === '/homecare/colleagues') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: {} })
  })
  vi.mocked(api.patch).mockResolvedValue({ data: {} })
})

describe('SwapTransferPage deep links', () => {
  it('opens the request a link names, in the dialog a row opens', async () => {
    renderSwap('/swap-transfer?swap=s1')

    // "Requested by" is a label only the dialog carries: the card in the list shows
    // the same request by name and message, so asserting on those would pass with no
    // dialog open at all.
    expect(await screen.findByText('Requested by')).toBeInTheDocument()
    expect(screen.getByText('Swap request')).toBeInTheDocument()
    expect(screen.getByText('Tom Bradley → Priya Sharma')).toBeInTheDocument()
  })

  it('opens it even when the client-side filter has hidden the row', async () => {
    // "Received" keeps only the requests aimed at this caller, which hides the one
    // they raised themselves — the request their own confirmation email links to.
    //
    // The card and the dialog name the same request differently: the card says "By
    // Tom Bradley → Priya Sharma" and the dialog's own field says "Tom Bradley →
    // Priya Sharma", which is what makes it possible to see that one is on screen
    // as a card and the other is the record the link opened.
    renderSwap('/swap-transfer?swap=s1')
    expect(await screen.findByText('By Tom Bradley → Priya Sharma')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Received'))
    // Its card is filtered out of the list…
    await waitFor(() => expect(screen.queryByText('By Tom Bradley → Priya Sharma')).not.toBeInTheDocument())
    expect(screen.getByText('Evening call')).toBeInTheDocument()

    // …and the link opened that request anyway, by id.
    expect(screen.getByText('Requested by')).toBeInTheDocument()
    expect(screen.getByText('Tom Bradley → Priya Sharma')).toBeInTheDocument()
  })

  it('opens nothing when the link names a request this caller does not have', async () => {
    renderSwap('/swap-transfer?swap=missing')

    // The list is on screen and no dialog was opened from a link that resolved to
    // nothing — and nothing was invented to fill it.
    expect(await screen.findByText('Morning call')).toBeInTheDocument()
    expect(screen.queryByText('Requested by')).not.toBeInTheDocument()
    // No per-record request: there is no such endpoint, and a call to one would be a
    // link that looks like it failed for the wrong reason.
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith(expect.stringContaining('/homecare/swap-requests/'))
  })

  it('opens nothing when there is no link at all', async () => {
    renderSwap('/swap-transfer')

    expect(await screen.findByText('Morning call')).toBeInTheDocument()
    expect(screen.queryByText('Requested by')).not.toBeInTheDocument()
  })

  it('drops the link when the record is closed, so a reload cannot reopen it', async () => {
    renderSwap('/swap-transfer?swap=s1')
    expect(await screen.findByText('Requested by')).toBeInTheDocument()
    expect(screen.getByTestId('url').textContent).toBe('?swap=s1')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByText('Requested by')).not.toBeInTheDocument())
    expect(screen.getByTestId('url').textContent).toBe('')
  })

  it('opens a card the carer clicks, while the card\'s own answer still answers it', async () => {
    // The convention the deep link rides on: cards are clickable to view, and the
    // accept/decline buttons on them act on the request instead of opening the
    // dialog behind them.
    renderSwap('/swap-transfer')
    expect(await screen.findByText('Morning call')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Evening call'))
    expect(await screen.findByText('Requested by')).toBeInTheDocument()
    expect(screen.getByText('Transfer request')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Requested by')).not.toBeInTheDocument())

    // The card's own Accept answers the request, and does not open the record: it is
    // inside the clickable card, so it has to stop the event.
    //
    // Reached with `findByRole` because the dialog is still unmounting behind its fade:
    // while a MUI modal is mounted it marks the rest of the page `aria-hidden`, so the
    // card's own button is only in the accessibility tree once the dialog has gone.
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/homecare/swap-requests/s2/respond', { status: 'accepted' }))
    expect(screen.queryByText('Requested by')).not.toBeInTheDocument()
  })
})
