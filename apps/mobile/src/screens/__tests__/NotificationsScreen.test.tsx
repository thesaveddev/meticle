import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { NotificationsScreen, mergeNotifications } from '../NotificationsScreen'
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getMyNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
}))

const mockedGet = getMyNotifications as jest.MockedFunction<typeof getMyNotifications>
const mockedMarkRead = markNotificationRead as jest.MockedFunction<typeof markNotificationRead>
const mockedMarkAll = markAllNotificationsRead as jest.MockedFunction<typeof markAllNotificationsRead>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER' },
} as AuthSession

/**
 * The notifications the supported-living API raises, as the phone receives them: each
 * carries the record path the server composed, and the two destinations are
 * deliberately different kinds — a web-only page and a screen this app has.
 */
const ROOM_CHECK = {
  id: 'n1',
  title: 'Room check overdue',
  message: '12 at Ash Grove has no room check recorded today.',
  type: 'compliance',
  read: false,
  created_at: new Date().toISOString(),
  link: '/room-checks',
}

const HANDOVER = {
  id: 'n2',
  title: 'Handover due at shift end',
  message: 'Your day shift at Ash Grove ended at 20:00 with no handover recorded.',
  type: 'shift',
  read: false,
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  link: '/scheduling?week=2026-10-16&shift=3f2504e0-4f89-41d3-9a0c-0305e82c3301',
}

/**
 * A record the phone still has no screen for. Compliance is the stand-in for that
 * whole family now that room checks have one of their own.
 */
const COMPLIANCE = {
  id: 'n4',
  title: 'DBS certificate expiring',
  message: 'A colleague\'s certificate expires in 14 days.',
  type: 'compliance',
  read: false,
  created_at: new Date(Date.now() - 7200_000).toISOString(),
  link: '/compliance',
}

const NO_LINK = {
  id: 'n3',
  title: 'Welcome',
  message: 'Your account is ready.',
  type: 'general',
  read: true,
  created_at: new Date().toISOString(),
  link: null,
}

function renderScreen(onOpenLink = jest.fn()) {
  const onUnreadChange = jest.fn()
  return {
    onOpenLink,
    onUnreadChange,
    ...render(
      <NotificationsScreen
        session={session}
        onBack={jest.fn()}
        onOpenLink={onOpenLink}
        onUnreadChange={onUnreadChange}
      />,
    ),
  }
}

describe('NotificationsScreen', () => {
  beforeEach(() => {
    mockedGet.mockResolvedValue([ROOM_CHECK, HANDOVER, NO_LINK, COMPLIANCE])
    mockedMarkRead.mockResolvedValue(undefined as any)
    mockedMarkAll.mockResolvedValue(undefined as any)
  })

  it('shows the supported-living events the server raised, unread first', async () => {
    const { findByText, getByText, getByTestId } = renderScreen()

    expect(await findByText('Room check overdue')).toBeTruthy()
    expect(getByText('12 at Ash Grove has no room check recorded today.')).toBeTruthy()
    expect(getByText('Handover due at shift end')).toBeTruthy()

    // The screen answers "what do I owe somebody?" before "what happened?".
    expect(getByText('Needs attention')).toBeTruthy()
    expect(getByText('Earlier')).toBeTruthy()
    expect(getByTestId('notification-unread-count').props.children).toBe(3)
  })

  it('says where a record lives before it is tapped', async () => {
    const { findByText } = renderScreen()

    // A screen this app has, and a page it does not: the row says which is which, so
    // a tap is never a surprise. A shift link that names a shift opens that shift's
    // handover, which is the screen the message is about.
    expect(await findByText('Opens the shift handover')).toBeTruthy()
    // Room checks now has a screen, so the row says so rather than claiming the web.
    expect(await findByText('Opens Room checks')).toBeTruthy()
    expect(await findByText('Recorded on the web — Compliance')).toBeTruthy()
  })

  it('opens the screen a record has, and marks the row read', async () => {
    const onOpenLink = jest.fn()
    const { findByText } = renderScreen(onOpenLink)

    fireEvent.press(await findByText('Handover due at shift end'))

    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith('token-1', 'n2'))
    // The path the server composed, not one the screen invented.
    expect(onOpenLink).toHaveBeenCalledWith('/scheduling?week=2026-10-16&shift=3f2504e0-4f89-41d3-9a0c-0305e82c3301')
  })

  it('opens the room-check board from an overdue nudge', async () => {
    const onOpenLink = jest.fn()
    const { findByText } = renderScreen(onOpenLink)

    // The nudge names a room the worker can walk to, and the phone can now clear it, so
    // the tap goes to that screen instead of to a message about a web page.
    fireEvent.press(await findByText('Room check overdue'))

    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith('token-1', 'n1'))
    expect(onOpenLink).toHaveBeenCalledWith('/room-checks')
  })

  it('expands a record the phone cannot open rather than tapping into nothing', async () => {
    const onOpenLink = jest.fn()
    const { findByText, queryByText } = renderScreen(onOpenLink)

    fireEvent.press(await findByText('DBS certificate expiring'))

    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith('token-1', 'n4'))
    // Web-only record: nothing to navigate to, so the row itself tells the story.
    expect(onOpenLink).not.toHaveBeenCalled()
    expect(await findByText('Recorded on the web — Compliance')).toBeTruthy()
    expect(queryByText('No notifications')).toBeNull()
  })

  it('tells the app what is unread, so the bell badge is not left stale', async () => {
    const { findByText, onUnreadChange } = renderScreen()

    // Arriving on the screen is enough to report what the server holds.
    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(3))

    // Reading one row drops the badge without waiting for the next poll.
    fireEvent.press(await findByText('DBS certificate expiring'))
    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(2))

    fireEvent.press(await findByText('Mark all read'))
    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(0))
  })

  it('shows a notification with no record as its own message', async () => {
    const onOpenLink = jest.fn()
    const { findByText } = renderScreen(onOpenLink)

    fireEvent.press(await findByText('Welcome'))

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    // Nothing to open and nothing to point at, so the tap only reveals the message.
    expect(onOpenLink).not.toHaveBeenCalled()
    expect(mockedMarkRead).not.toHaveBeenCalled()
  })

  it('asks for the page below the oldest row it holds, so a week away is reachable', async () => {
    // A full first page, then the older one: this is the carer who came back after a
    // week and needs the nudge from Monday, which used to be past the fixed twenty.
    const firstPage = Array.from({ length: 20 }, (_, i) => ({
      id: `page-${i}`,
      title: `Row ${i}`,
      message: 'Something happened',
      type: 'info',
      read: true,
      created_at: new Date(Date.now() - i * 60_000).toISOString(),
      link: null,
    }))
    const olderPage = [{
      id: 'older-1',
      title: 'Oldest handover nudge',
      message: 'A shift ended on Monday with no handover.',
      type: 'shift',
      read: true,
      created_at: new Date(Date.now() - 6 * 86400_000).toISOString(),
      link: null,
    }]
    mockedGet.mockResolvedValueOnce(firstPage as any).mockResolvedValueOnce(olderPage as any)

    const { findByTestId } = renderScreen()

    fireEvent.press(await findByTestId('notifications-load-older'))

    const oldest = firstPage[firstPage.length - 1]
    await waitFor(() => expect(mockedGet).toHaveBeenLastCalledWith('token-1', {
      limit: 20,
      before: oldest.created_at,
      beforeId: oldest.id,
    }))
    // The older row is the last of the merged list, and a virtualised list does not
    // render it in this environment — so the page it came from is asserted where it can
    // be seen: the short second page ends the history and says so.
    expect(await findByTestId('notifications-end')).toBeTruthy()
  })

  it('keeps an older page it has already fetched when the list reloads', () => {
    // The 30-second poll and the foreground refresh both replace the first page. They
    // must not take the history away with it, and the server's copy of a row wins — it
    // is where `read` was settled.
    const held = [
      { id: 'new-1', title: 'Yesterday', message: 'm', type: 'info', read: true, created_at: '2026-10-16T09:00:00.000Z', link: null },
      { id: 'old-1', title: 'Monday', message: 'm', type: 'info', read: true, created_at: '2026-10-12T09:00:00.000Z', link: null },
    ]
    const refreshed = [
      { id: 'new-1', title: 'Yesterday', message: 'm', type: 'info', read: false, created_at: '2026-10-16T09:00:00.000Z', link: null },
      { id: 'new-2', title: 'Today', message: 'm', type: 'info', read: true, created_at: '2026-10-17T09:00:00.000Z', link: null },
    ]

    const merged = mergeNotifications(held as any, refreshed as any)

    expect(merged.map(n => n.id)).toEqual(['new-2', 'new-1', 'old-1'])
    expect(merged.find(n => n.id === 'new-1')!.read).toBe(false)
  })

  it('marks everything read from the header', async () => {
    const { findByText, queryByText } = renderScreen()

    fireEvent.press(await findByText('Mark all read'))

    await waitFor(() => expect(mockedMarkAll).toHaveBeenCalledWith('token-1'))
    // Every row is history now, so the "needs attention" section is gone.
    await waitFor(() => expect(queryByText('Needs attention')).toBeNull())
    expect(queryByText('Earlier')).toBeTruthy()
  })
})
