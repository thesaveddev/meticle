import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const get = vi.fn()
vi.mock('../../services/api', () => ({
  default: { get: (...args: any[]) => get(...args) },
}))

import NotificationsPage from './NotificationsPage'

function row(id: string, title: string, createdAt: string, read = true) {
  return { id, type: 'call_assigned', title, message: `${title} body`, read, created_at: createdAt, link: null }
}

/** The query string of an inbox request, so a test can assert the cursor. */
function inboxQuery(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] || '')
}

/**
 * The inbox is the one screen whose whole promise is "you can still see the
 * oldest thing that happened". A single fixed page silently decided a carer's
 * older events did not exist; these tests pin the cursor contract that replaced
 * it, because a page that fetches but cannot continue is indistinguishable from
 * the bug it fixed.
 */
beforeEach(() => {
  get.mockReset()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )
}

describe('notifications inbox paging', () => {
  it('asks for one page and offers no way to continue when the page is short', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { count: 2 } })
      return Promise.resolve({ data: [row('a', 'Missed call', '2026-10-18T09:00:00Z', false)] })
    })

    renderPage()

    await screen.findByText('Missed call')
    // A short page is the end of the list: the API only returns fewer than it was
    // asked for when there is nothing behind it.
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('2 unread')).toBeInTheDocument())

    const first = get.mock.calls.find(([url]) => String(url).startsWith('/notifications?'))
    expect(inboxQuery(first![0]).get('limit')).toBe('30')
    expect(inboxQuery(first![0]).get('before')).toBeNull()
  })

  it('continues from the last row already on screen, not from an offset', async () => {
    const first = Array.from({ length: 30 }, (_, i) =>
      row(`p1-${i}`, `Page one ${i}`, new Date(Date.UTC(2026, 9, 18, 12, 0, 0) - i * 60_000).toISOString()),
    )
    get.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { count: 30 } })
      if (!url.includes('before=')) return Promise.resolve({ data: first })
      // The second page is short, so the list ends there.
      return Promise.resolve({ data: [row('older-1', 'The oldest thing that happened', '2026-10-11T09:00:00Z')] })
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /load older/i }))

    await screen.findByText('The oldest thing that happened')
    // The cursor is the (created_at, id) of the row the reader can actually see at
    // the bottom of page one — passing anything else would skip or repeat rows.
    const second = get.mock.calls.filter(([url]) => String(url).includes('before=')).pop()
    const query = inboxQuery(second![0])
    expect(query.get('before')).toBe(first[29].created_at)
    expect(query.get('beforeId')).toBe('p1-29')
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument()
  })

  it('reports the server unread total rather than counting loaded rows', async () => {
    get.mockImplementation((url: string) => {
      // 9 unread exist; only one of them is on this page.
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { count: 9 } })
      return Promise.resolve({ data: [row('a', 'Latest', '2026-10-18T09:00:00Z', false)] })
    })

    renderPage()

    await screen.findByText('Latest')
    await waitFor(() => expect(screen.getByText('9 unread')).toBeInTheDocument())
  })

  it('says the inbox could not be read instead of showing an empty one', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { count: 0 } })
      return Promise.reject(new Error('Network Error'))
    })

    renderPage()

    // An empty inbox and an unreadable one look identical unless the failure is
    // named — and "No notifications" would be a lie about a network error.
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument()
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument()
  })
})
