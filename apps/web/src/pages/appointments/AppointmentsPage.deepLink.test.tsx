import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import AppointmentsPage from './AppointmentsPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The appointments page as a deep-link target.
 *
 * A booking Mica has just made ends by offering the page the record is on, and
 * what it offers is a URL — so this page has to be able to arrive with one, open
 * that record, and show the day it falls on. Two shapes matter, and they are the
 * two halves of the same product decision:
 *
 *   - the record is not in the day on screen (the usual case: an appointment
 *     booked for next week while the page sits on today), so it is read by id and
 *     its day becomes the day shown; and
 *   - the record *is* already in the list, which must open it without a second
 *     read and without disturbing the day.
 *
 * What the assertions are pinned to is the dialog, not the page: an appointment
 * titled the same as another must still be the one that was linked to.
 */

const TODAY = new Date().toISOString().slice(0, 10)
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

const NEXT_WEEK = {
  id: 'a-next-week',
  title: 'Podiatry clinic',
  description: 'Routine foot care',
  notes: 'Bring the podiatry bag',
  person_name: 'Elsie Fletcher',
  staff_name: 'Tom Bradley',
  start_time: `${TOMORROW}T13:00:00.000Z`,
  end_time: `${TOMORROW}T14:00:00.000Z`,
  status: 'scheduled',
  recurrence: 'once',
}

const TODAYS = {
  ...NEXT_WEEK,
  id: 'a-today',
  notes: 'Review the pressure areas',
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="current-url">{location.pathname + location.search}</span>
}

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/appointments" element={<><AppointmentsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The dialog's own text, so a row in the table cannot stand in for it. */
async function dialogText(text: string) {
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  return within(screen.getByRole('dialog')).getByText(text)
}

function mockApi(options: { day?: (date: string) => any[]; single?: typeof NEXT_WEEK | 'missing' } = {}) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/appointments?')) {
      const date = url.split('date=')[1] || ''
      return Promise.resolve({ data: { appointments: options.day ? options.day(date) : [] } })
    }
    if (url.startsWith('/appointments/')) {
      if (options.single === 'missing') return Promise.reject(new Error('not found'))
      return Promise.resolve({ data: options.single ?? NEXT_WEEK })
    }
    if (url.startsWith('/people')) return Promise.resolve({ data: { people: [] } })
    if (url === '/staff/org-members') return Promise.resolve({ data: { admins: [], staff: [] } })
    return Promise.resolve({ data: {} })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi()
})

describe('AppointmentsPage deep links', () => {
  it('opens the appointment the link names, and shows the day it falls on', async () => {
    // An appointment booked for next week, while the page sits on today.
    mockApi({ day: date => (date === TOMORROW ? [NEXT_WEEK] : []), single: NEXT_WEEK })

    renderPage(`/appointments?appointment=${NEXT_WEEK.id}`)

    // Read by id, because the day on screen does not hold it.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/appointments/${NEXT_WEEK.id}`))
    expect(await dialogText('Bring the podiatry bag')).toBeInTheDocument()

    // …and the page moved to the appointment's own day, so its row is in the
    // table behind the dialog rather than the carer being left on today. The
    // title appears twice: once as the row, once as the dialog's heading.
    await waitFor(() => expect(screen.getByDisplayValue(TOMORROW)).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByText(NEXT_WEEK.title).length).toBeGreaterThan(1))
  })

  it('opens a linked appointment that is already in the day on screen, without reading it twice', async () => {
    mockApi({ day: date => (date === TODAY ? [TODAYS] : []) })

    renderPage(`/appointments?appointment=${TODAYS.id}`)

    expect(await dialogText('Review the pressure areas')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith(`/appointments/${TODAYS.id}`)
    expect(screen.getByDisplayValue(TODAY)).toBeInTheDocument()
  })

  it('clears the link when the record is closed', async () => {
    mockApi({ day: date => (date === TOMORROW ? [NEXT_WEEK] : []), single: NEXT_WEEK })

    renderPage(`/appointments?appointment=${NEXT_WEEK.id}`)
    await dialogText('Bring the podiatry bag')

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    // The URL is the state that opens this dialog, so leaving the link in it would
    // re-open the record on the next render.
    await waitFor(() => expect(screen.getByTestId('current-url')).toHaveTextContent('/appointments'))
    expect(screen.getByTestId('current-url')).not.toHaveTextContent('appointment=')
    // Past the dialog's own exit transition.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says so when the link names a record that is not there', async () => {
    mockApi({ single: 'missing' })

    renderPage('/appointments?appointment=gone')

    await waitFor(() => expect(screen.getByText('That appointment could not be opened.')).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
