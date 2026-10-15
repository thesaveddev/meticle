import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The notifications page, as a way into the records it names.
 *
 * The bell and this page are the two places a carer reads a notification, and both
 * carry the same `link` — the relative record path `micaRecordPath` builds and an
 * email's button points at — so the row opens the record instead of only dimming.
 *
 * Three things are pinned here, and they are separate:
 *
 *   1. The row shows the row's own copy. The API's field is `message`; the page used
 *      to read `body`, which is nothing on any notification this API has ever
 *      written, so every row rendered a blank second line.
 *   2. A row with a record opens it, in the running app.
 *   3. A row without one opens nothing. A billing notice or a survey invitation is
 *      not a record, and inventing a destination for it would take the reader
 *      somewhere plausible and wrong.
 */

const NOTIFICATION = {
  id: 'n1',
  type: 'general',
  title: 'New Task Assigned',
  message: 'You have been assigned: "Order new grip rails" (high)',
  read: false,
  created_at: new Date().toISOString(),
  link: '/tasks?task=t1',
}

const WITHOUT_A_RECORD = {
  id: 'n2',
  type: 'billing',
  title: 'Subscription renewed',
  message: 'Your subscription renewed for another month.',
  read: true,
  created_at: new Date().toISOString(),
  link: null,
}

/** Shows the route the page ends on, so "opened nothing" is observable. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderNotifications() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      {/* The probe sits outside the routes so the URL is observable wherever the
          page ends up — including on the record it opened, which is the point. */}
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/tasks" element={<div data-testid="page-tasks">Tasks Page</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: [NOTIFICATION, WITHOUT_A_RECORD] })
  vi.mocked(api.patch).mockResolvedValue({ data: {} })
})

describe('NotificationsPage record links', () => {
  it('shows the copy the row actually carries', async () => {
    renderNotifications()

    expect(await screen.findByText('New Task Assigned')).toBeInTheDocument()
    expect(screen.getByText(NOTIFICATION.message)).toBeInTheDocument()
    expect(screen.getByText(WITHOUT_A_RECORD.message)).toBeInTheDocument()
  })

  it('opens the record a notification names, and marks it read', async () => {
    renderNotifications()

    fireEvent.click(await screen.findByText('New Task Assigned'))

    await waitFor(() => expect(screen.getByTestId('page-tasks')).toBeInTheDocument())
    expect(screen.getByTestId('location').textContent).toBe('/tasks?task=t1')
    expect(vi.mocked(api.patch)).toHaveBeenCalledWith('/notifications/n1/read')
  })

  it('opens nothing for a notification that is about no record', async () => {
    renderNotifications()

    fireEvent.click(await screen.findByText('Subscription renewed'))

    // The page it was already on — no invented destination, and the row is not
    // re-marked because it was already read.
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/notifications'))
    expect(screen.queryByTestId('page-tasks')).not.toBeInTheDocument()
    expect(vi.mocked(api.patch)).not.toHaveBeenCalled()
  })
})
