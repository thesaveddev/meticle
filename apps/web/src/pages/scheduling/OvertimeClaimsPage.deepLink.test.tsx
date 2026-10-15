import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OvertimeClaimsPage from './OvertimeClaimsPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The deep link an overtime email ends on: `?claim=<id>`.
 *
 * The claim has to open whether or not it is on screen. The page already fetches
 * every list the caller can see — their own claims, the pending queue, the approved
 * ones — and the link arrives from outside the tab and the status filter that decide
 * which of them is rendered, so what is asserted here is that the claim opens *and*
 * that the view behind it is moved to the claim's own tab: a dialog over a table the
 * claim is not in is a record the manager has to hunt for the moment they close it,
 * which is the thing a link is supposed to save them.
 *
 * A claim no list holds is the one case with nothing honest to show, and the page
 * says so rather than opening an empty frame.
 */
const MY_CLAIM = {
  assignment_id: 'as1',
  shift_id: 'sh1',
  staff_id: 'st1',
  assignment_status: 'pending',
  start_time: '2026-10-20T08:00:00.000Z',
  end_time: '2026-10-20T20:00:00.000Z',
  location_name: 'Oak House',
  shift_type: 'day',
  su_first_name: 'Elsie',
  su_last_name: 'Fletcher',
  claimed_at: '2026-10-19T09:00:00.000Z',
}

const PENDING_CLAIM = {
  assignment_id: 'as2',
  shift_id: 'sh2',
  staff_id: 'st2',
  assignment_status: 'pending',
  first_name: 'Tom',
  last_name: 'Bradley',
  start_time: '2026-10-21T20:00:00.000Z',
  end_time: '2026-10-22T08:00:00.000Z',
  location_name: 'Ash Grove',
  shift_type: 'wake_night',
  su_first_name: 'Nora',
  su_last_name: 'Blythe',
  claimed_at: '2026-10-19T10:00:00.000Z',
}

function renderClaims(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/scheduling/overtime-claims" element={<OvertimeClaimsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // The page reads the role from the stored session to decide which claim lists it
  // may fetch; a manager sees the pending queue the second claim lives in.
  localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'ORG_ADMIN' }))
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/shifts/my-claims') return Promise.resolve({ data: [MY_CLAIM] })
    if (url === '/shifts/pending-claims') return Promise.resolve({ data: [PENDING_CLAIM] })
    if (url === '/shifts/approved-claims') return Promise.resolve({ data: [] })
    if (url === '/shifts/unclaimed') return Promise.resolve({ data: [] })
    if (url === '/shifts/staff') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: {} })
  })
})

describe('OvertimeClaimsPage deep links', () => {
  it('opens the claim a link names when it is a row the page already has', async () => {
    renderClaims('/scheduling/overtime-claims?claim=as1')

    expect(await screen.findByText('Overtime claim')).toBeInTheDocument()
    // Read from the list it already fetched: nothing was requested for the record.
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith('/shifts/as1')
  })

  it('opens a claim that is not on the tab the page opens on, and shows its own tab behind it', async () => {
    renderClaims('/scheduling/overtime-claims?claim=as2')

    expect(await screen.findByText('Overtime claim')).toBeInTheDocument()
    // The row is behind the dialog rather than three tabs away.
    //
    // Read with `hidden: true` because the record is open over it: a MUI dialog marks
    // everything behind it `aria-hidden`, and the tab this asserts on is deliberately
    // the one behind the dialog rather than beside it.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Pending/, hidden: true })).toHaveAttribute('aria-selected', 'true'),
    )
  })

  it('opens the one claim on a shift when the link was built from the shift id', async () => {
    // 'sh2' is not an assignment id: it is the id of a shift, which is all an email
    // composed from a shift has to hand. The second claim is the only one on it, so
    // it opens — and the Pending tab proves it is that claim and not the first.
    renderClaims('/scheduling/overtime-claims?claim=sh2')

    expect(await screen.findByText('Overtime claim')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pending/, hidden: true })).toHaveAttribute('aria-selected', 'true')
  })

  it('says so rather than opening an empty record when no list holds the claim', async () => {
    renderClaims('/scheduling/overtime-claims?claim=nothing-claims-this')

    expect(await screen.findByText('That overtime claim could not be opened.')).toBeInTheDocument()
    expect(screen.queryByText('Overtime claim')).not.toBeInTheDocument()
  })

  it('closes the record the link opened, and does not re-open it on a later render', async () => {
    renderClaims('/scheduling/overtime-claims?claim=as1')
    expect(await screen.findByText('Overtime claim')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Overtime claim')).not.toBeInTheDocument())

    // Moving to another tab re-renders the page; the link must not drag the dialog
    // back open — the URL that carried it has been cleared.
    await userEvent.click(screen.getByRole('tab', { name: /Approved/ }))
    expect(screen.queryByText('Overtime claim')).not.toBeInTheDocument()
  })

  it('opens nothing when no link is present', async () => {
    renderClaims('/scheduling/overtime-claims')

    expect(await screen.findByText('Oak House')).toBeInTheDocument()
    expect(screen.queryByText('Overtime claim')).not.toBeInTheDocument()
  })
})
