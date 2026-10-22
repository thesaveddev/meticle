import React from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BackHandler } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import App from '../../App'
import type { AuthSession, MobileUser } from '../types'
import * as storage from '../services/storage'
import * as api from '../services/api'
import * as visitQueue from '../services/visitQueue'
import { getLaunchNotification } from '../services/notifications'
import { resetScreenProps, screenProps } from './screenStub'

/**
 * The tab bar is the app's spine, so this suite mounts the real App and stands in
 * for the screens it switches between. Each screen renders a marker and records
 * its props, which is enough to prove:
 *
 *   - which tabs each role gets, and in what order
 *   - which screen each tab mounts, and what the wiring passes to it
 *   - the dashboard's quick actions reaching the right tab or screen
 *   - the two unread badges and the Android back stack
 *
 * The screens themselves are covered by their own suites; mocking them here keeps
 * this test honest about the wiring rather than about any screen's contents.
 */
// The real SafeAreaProvider waits for a native layout pass before rendering its
// children, which never arrives under jest — the official mock supplies metrics.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: {},
  Inter_500Medium: {},
  Inter_600SemiBold: {},
  Inter_700Bold: {},
  Inter_800ExtraBold: {},
}))

jest.mock('../screens/LoginScreen', () => ({ LoginScreen: require('./screenStub').stub('login') }))
jest.mock('../screens/TodayScreen', () => ({
  TodayScreen: require('./screenStub').stub('today'),
  // App uses dayRange() to scope the day's visit fetch.
  dayRange: () => ({ from: '2030-01-01T00:00:00.000Z', to: '2030-01-01T23:59:59.000Z' }),
}))
jest.mock('../screens/WeekScreen', () => ({ WeekScreen: require('./screenStub').stub('week') }))
jest.mock('../screens/MileageScreen', () => ({ MileageScreen: require('./screenStub').stub('mileage') }))
jest.mock('../screens/ChatScreen', () => ({ ChatScreen: require('./screenStub').stub('chat') }))
jest.mock('../screens/SettingsScreen', () => ({ SettingsScreen: require('./screenStub').stub('settings') }))
jest.mock('../screens/ClientListScreen', () => ({ ClientListScreen: require('./screenStub').stub('clientList') }))
jest.mock('../screens/AllVisitsScreen', () => ({ AllVisitsScreen: require('./screenStub').stub('allVisits') }))
jest.mock('../screens/NotificationsScreen', () => ({ NotificationsScreen: require('./screenStub').stub('notifications') }))
jest.mock('../screens/HandoverScreen', () => ({ HandoverScreen: require('./screenStub').stub('handover') }))
jest.mock('../screens/ShiftClockScreen', () => ({ ShiftClockScreen: require('./screenStub').stub('clock') }))
jest.mock('../screens/RoomChecksScreen', () => ({ RoomChecksScreen: require('./screenStub').stub('roomChecks') }))
jest.mock('../screens/VisitScreen', () => ({ VisitScreen: require('./screenStub').stub('visit') }))
jest.mock('../screens/ClientDetailScreen', () => ({ ClientDetailScreen: require('./screenStub').stub('clientDetail') }))
jest.mock('../screens/BodyMapScreen', () => ({ BodyMapScreen: require('./screenStub').stub('bodyMap') }))
jest.mock('../screens/NutritionScreen', () => ({ NutritionScreen: require('./screenStub').stub('nutrition') }))
jest.mock('../screens/ProfileScreen', () => ({ ProfileScreen: require('./screenStub').stub('profile') }))
jest.mock('../screens/AvailabilityScreen', () => ({ AvailabilityScreen: require('./screenStub').stub('availability') }))
jest.mock('../screens/SwapTransferScreen', () => ({ SwapTransferScreen: require('./screenStub').stub('swap') }))
jest.mock('../screens/ReportIncidentScreen', () => ({ ReportIncidentScreen: require('./screenStub').stub('incident') }))
jest.mock('../screens/StaffDirectoryScreen', () => ({ StaffDirectoryScreen: require('./screenStub').stub('staffDirectory') }))
jest.mock('../screens/TimesheetsScreen', () => ({ TimesheetsScreen: require('./screenStub').stub('timesheets') }))
jest.mock('../screens/CarerTotalsScreen', () => ({ CarerTotalsScreen: require('./screenStub').stub('carerTotals') }))
jest.mock('../screens/RideShareScreen', () => ({ RideShareScreen: require('./screenStub').stub('rideShare') }))

jest.mock('../services/storage', () => ({
  readSession: jest.fn(),
  writeSession: jest.fn(),
  clearSession: jest.fn(),
  readMicaPerson: jest.fn(async () => null),
  writeMicaPerson: jest.fn(async () => {}),
}))
jest.mock('../services/api', () => ({
  getCurrentUser: jest.fn(),
  getMyVisits: jest.fn(async () => []),
  login: jest.fn(),
  logout: jest.fn(async () => {}),
  createDisruption: jest.fn(async () => ({})),
  getUnreadNotificationCount: jest.fn(async () => 0),
  getChatUnread: jest.fn(async () => ({})),
  markChatDelivered: jest.fn(async () => ({})),
  getManagerDashboard: jest.fn(async () => ({ visits: [], exceptions: [], staff: [], disruptions: [] })),
}))
jest.mock('../services/notifications', () => ({
  scheduleVisitReminder: jest.fn(async () => null),
  registerForPushNotifications: jest.fn(async () => null),
  addNotificationListeners: jest.fn(),
  removeNotificationListeners: jest.fn(),
  presentChatNotification: jest.fn(async () => 'notif-1'),
  // The notification that launched the app. Null by default: a normal cold start is
  // not a notification tap, and the effect must do nothing in that case.
  getLaunchNotification: jest.fn(async () => null),
}))
jest.mock('../services/chatLive', () => ({
  ensureChatLiveSocket: jest.fn(),
  disconnectChatLive: jest.fn(),
  subscribeChatLive: jest.fn(() => jest.fn()),
  subscribeChatUnreadTotal: jest.fn(() => jest.fn()),
  setOpenChatChannel: jest.fn(),
  getOpenChatChannel: jest.fn(() => null),
  chatLiveChannelOf: jest.fn((message: any) => message?.channel_id || message?.channel || null),
}))
jest.mock('../services/visitQueue', () => ({
  getQueue: jest.fn(async () => []),
  flushQueue: jest.fn(async () => {}),
  enqueueVisitAction: jest.fn(),
}))
jest.mock('../services/incidentQueue', () => ({
  getIncidentQueue: jest.fn(async () => []),
  flushIncidentQueue: jest.fn(async () => null),
}))

const mockReadSession = storage.readSession as jest.MockedFunction<typeof storage.readSession>
const mockGetCurrentUser = api.getCurrentUser as jest.MockedFunction<typeof api.getCurrentUser>
const mockGetUnread = api.getUnreadNotificationCount as jest.MockedFunction<typeof api.getUnreadNotificationCount>
const mockGetChatUnread = api.getChatUnread as jest.MockedFunction<typeof api.getChatUnread>
const mockGetManagerDashboard = api.getManagerDashboard as jest.MockedFunction<typeof api.getManagerDashboard>
const mockGetQueue = visitQueue.getQueue as jest.MockedFunction<typeof visitQueue.getQueue>
const mockLaunchNotification = getLaunchNotification as jest.MockedFunction<typeof getLaunchNotification>

const signInAs = (role: MobileUser['role']): AuthSession => ({
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'me@example.com', role, first_name: 'Test', last_name: 'Carer' },
})

/**
 * Boot the app into a signed-in session and wait for the tab bar to appear.
 *
 * `awaitTabs: false` is for a cold start that lands somewhere *instead of* the tabs —
 * a notification that opened a pushed screen. Waiting for a tab bar that the tap has
 * deliberately replaced would never succeed.
 */
async function mountApp(role: MobileUser['role'] = 'CARE_WORKER', options: { awaitTabs?: boolean } = {}) {
  const session = signInAs(role)
  mockReadSession.mockResolvedValue(session)
  mockGetCurrentUser.mockResolvedValue({ user: session.user, organization: null } as any)

  const screen = render(<App />)
  if (options.awaitTabs !== false) {
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0))
  }
  return { screen, session }
}

const tabLabels = (screen: ReturnType<typeof render>) =>
  screen.getAllByRole('tab').map(tab => tab.props.accessibilityLabel)

function tabNamed(screen: ReturnType<typeof render>, label: string) {
  return screen.getByRole('tab', { name: label })
}

/** Capture the Android back handlers App registers, newest last. */
function installBackHandler() {
  const handlers: Array<() => boolean> = []
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
    handlers.push(handler)
    return { remove: jest.fn() }
  }) as any)
  return handlers
}

/** Press the back button the way Android would. */
async function pressBack(handlers: Array<() => boolean>) {
  await act(async () => {
    handlers[handlers.length - 1]()
  })
}

beforeEach(() => {
  resetScreenProps()
  mockGetQueue.mockResolvedValue([])
  mockGetUnread.mockResolvedValue(0)
  mockGetChatUnread.mockResolvedValue({})
  mockLaunchNotification.mockResolvedValue(null)
})

describe('App tab bar per role', () => {
  it('gives a carer today, schedule, chat, earnings and settings in that order', async () => {
    const { screen } = await mountApp('CARE_WORKER')

    expect(tabLabels(screen)).toEqual(['Today', 'Schedule', 'Chat', 'Earnings', 'Settings'])
    expect(screen.getByText('screen:today')).toBeTruthy()
    expect(screen.queryByText('Clients')).toBeNull()
    expect(screen.queryByText('Visits')).toBeNull()
  })

  it('gives a manager the team, clients, visits, chat and settings tabs instead', async () => {
    const { screen } = await mountApp('MANAGER')

    expect(tabLabels(screen)).toEqual(['Team', 'Clients', 'Visits', 'Chat', 'Settings'])
    // The manager's Team tab is the real dashboard, not the carer's day list.
    expect(await screen.findByText('Dashboard')).toBeTruthy()
    expect(screen.queryByText('screen:today')).toBeNull()
    expect(screen.queryByText('Earnings')).toBeNull()
  })

  it('treats an org admin as a manager', async () => {
    const { screen } = await mountApp('ORG_ADMIN')

    expect(tabLabels(screen)).toEqual(['Team', 'Clients', 'Visits', 'Chat', 'Settings'])
    expect(await screen.findByText('Dashboard')).toBeTruthy()
  })
})

describe('App tab wiring', () => {
  it('mounts the screen behind each carer tab and hands it the session', async () => {
    const { screen } = await mountApp('CARE_WORKER')

    fireEvent.press(tabNamed(screen, 'Schedule'))
    expect(screen.getByText('screen:week')).toBeTruthy()

    fireEvent.press(tabNamed(screen, 'Earnings'))
    expect(screen.getByText('screen:mileage')).toBeTruthy()
    expect(screenProps.mileage.session.accessToken).toBe('token-1')

    fireEvent.press(tabNamed(screen, 'Settings'))
    expect(screen.getByText('screen:settings')).toBeTruthy()

    fireEvent.press(tabNamed(screen, 'Today'))
    expect(screen.getByText('screen:today')).toBeTruthy()
    expect(screen.queryByText('screen:mileage')).toBeNull()
  })

  it('mounts the manager screens behind the clients and visits tabs', async () => {
    const { screen } = await mountApp('MANAGER')

    fireEvent.press(tabNamed(screen, 'Clients'))
    expect(screen.getByText('screen:clientList')).toBeTruthy()

    fireEvent.press(tabNamed(screen, 'Visits'))
    expect(screen.getByText('screen:allVisits')).toBeTruthy()
  })

  it('marks only the active tab as selected', async () => {
    const { screen } = await mountApp('CARE_WORKER')

    expect(tabNamed(screen, 'Today').props.accessibilityState).toEqual({ selected: true })
    expect(tabNamed(screen, 'Chat').props.accessibilityState).toEqual({ selected: false })

    fireEvent.press(tabNamed(screen, 'Chat'))

    expect(tabNamed(screen, 'Chat').props.accessibilityState).toEqual({ selected: true })
    expect(tabNamed(screen, 'Today').props.accessibilityState).toEqual({ selected: false })
  })

  it('offers availability to a carer but not to a manager', async () => {
    const carer = await mountApp('CARE_WORKER')
    fireEvent.press(tabNamed(carer.screen, 'Settings'))
    expect(typeof screenProps.settings.onAvailability).toBe('function')
    carer.screen.unmount()

    resetScreenProps()
    const manager = await mountApp('MANAGER')
    fireEvent.press(tabNamed(manager.screen, 'Settings'))
    expect(screenProps.settings.onAvailability).toBeUndefined()
  })
})

describe('App dashboard quick actions', () => {
  it('switches to the clients tab rather than pushing a screen', async () => {
    const { screen } = await mountApp('MANAGER')

    // "Clients" is both a quick action and a tab, and the dashboard renders above
    // the tab bar, so the first match is the quick action card.
    fireEvent.press(screen.getAllByText('Clients')[0])

    expect(screen.getByText('screen:clientList')).toBeTruthy()
    expect(tabNamed(screen, 'Clients').props.accessibilityState).toEqual({ selected: true })
  })

  it('pushes the screens that have no tab of their own, and back returns to the team tab', async () => {
    const back = installBackHandler()
    const { screen } = await mountApp('MANAGER')

    const actions = [
      ['All visits', 'allVisits'],
      ['Staff', 'staffDirectory'],
      ['Timesheets', 'timesheets'],
      ['Totals', 'carerTotals'],
    ] as const

    for (const [label, marker] of actions) {
      // Wait for the dashboard's own data to resolve: mountApp only waits for the
      // tab bar, and the quick actions arrive a microtask later. Querying
      // synchronously here raced the fetch and made this test pass or fail on
      // scheduling rather than on the wiring it is meant to prove.
      await screen.findByText(label)
      fireEvent.press(screen.getByText(label))

      expect(screen.getByText(`screen:${marker}`)).toBeTruthy()
      // A pushed screen replaces the tab view entirely.
      expect(screen.queryAllByRole('tab')).toHaveLength(0)

      await pressBack(back)

      expect(screen.queryByText(`screen:${marker}`)).toBeNull()
      expect(screen.getByText('Dashboard')).toBeTruthy()
    }
  })
})

describe('App badges and back stack', () => {
  it('shows the unread notification count on the bell', async () => {
    mockGetUnread.mockResolvedValue(7)

    const { screen } = await mountApp('CARE_WORKER')

    expect(await screen.findByLabelText('Notifications, 7 unread')).toBeTruthy()
  })

  it('totals the unread chat channels and clears the badge when chat is opened', async () => {
    mockGetChatUnread.mockResolvedValue({ general: 3, 'team-north': 2 })

    const { screen } = await mountApp('CARE_WORKER')

    expect(await screen.findByText('5')).toBeTruthy()

    fireEvent.press(tabNamed(screen, 'Chat'))

    expect(screen.getByText('screen:chat')).toBeTruthy()
    expect(screen.queryByText('5')).toBeNull()
  })

  it('opens notifications from the bell and returns to the tabs on back', async () => {
    const back = installBackHandler()
    const { screen } = await mountApp('CARE_WORKER')

    fireEvent.press(screen.getByLabelText('Notifications'))
    expect(screen.getByText('screen:notifications')).toBeTruthy()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)

    await pressBack(back)

    expect(screen.queryByText('screen:notifications')).toBeNull()
    expect(screen.getByText('screen:today')).toBeTruthy()
  })

  it('puts the greeting and date on the bell row for a carer on today', async () => {
    const { screen } = await mountApp('CARE_WORKER')

    // One row: the day's greeting on the left, the bell on the right.
    expect(screen.getByText(/Good (morning|afternoon|evening), Test/)).toBeTruthy()
    expect(screen.getByLabelText('Notifications')).toBeTruthy()
  })

  it('leaves the greeting off every other tab and role', async () => {
    const { screen } = await mountApp('CARE_WORKER')
    fireEvent.press(tabNamed(screen, 'Schedule'))
    expect(screen.queryByText(/Good (morning|afternoon|evening), Test/)).toBeNull()
    expect(screen.getByLabelText('Notifications')).toBeTruthy()
  })

  it('puts the Messages title on the bell row for the chat tab', async () => {
    const { screen } = await mountApp('CARE_WORKER')
    fireEvent.press(tabNamed(screen, 'Chat'))
    // One row: the title on the left, the bell on the right — no second
    // header below it.
    expect(screen.getByText('Messages')).toBeTruthy()
    expect(screen.getByLabelText('Notifications')).toBeTruthy()
  })

  it('surfaces a live chat message with a banner and a refreshed badge', async () => {
    const chatLive = require('../services/chatLive')
    const notifications = require('../services/notifications')
    const mockSubscribe = chatLive.subscribeChatLive as jest.Mock
    const mockPresent = notifications.presentChatNotification as jest.Mock
    mockGetChatUnread.mockResolvedValue({})

    const { screen } = await mountApp('CARE_WORKER')
    await screen.findByLabelText('Notifications')
    expect(chatLive.ensureChatLiveSocket).toHaveBeenCalledWith('token-1')

    const onMessage = mockSubscribe.mock.calls[0][0]
    mockGetChatUnread.mockResolvedValue({ general: 1 })
    await act(async () => {
      onMessage({ id: 'm1', channel_id: 'chan-9', sender_id: 'other', sender_name: 'Amy Adams', message: 'Hello' })
    })

    expect(mockPresent).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'chan-9' }))
    expect(await screen.findByText('1')).toBeTruthy()
  })

  it('takes the server-pushed unread total as the badge without a reconcile fetch', async () => {
    const chatLive = require('../services/chatLive')
    const mockSubscribeTotal = chatLive.subscribeChatUnreadTotal as jest.Mock
    mockGetChatUnread.mockResolvedValue({})

    const { screen } = await mountApp('CARE_WORKER')
    await screen.findByLabelText('Notifications')

    const onTotal = mockSubscribeTotal.mock.calls[0][0]
    const reconcileCalls = mockGetChatUnread.mock.calls.length
    await act(async () => {
      onTotal(4)
    })

    expect(await screen.findByText('4')).toBeTruthy()
    // The push is the badge — no reconcile GET is spent on it.
    expect(mockGetChatUnread.mock.calls.length).toBe(reconcileCalls)
  })

  it('hides the floating mic while the Mica orb is open and brings it back on close', async () => {
    // The full-screen orb is the control on its own screen; a second mic
    // floating over it would cover the caption and offer the same thing twice.
    const { screen } = await mountApp('CARE_WORKER')

    expect(screen.getByTestId('mica-float')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Mica assistant — tap to open. Press and hold for emergency options.'))
    expect(await screen.findByText('Tap the orb and speak')).toBeTruthy()
    expect(screen.queryByTestId('mica-float')).toBeNull()

    fireEvent.press(screen.getByLabelText('Close Mica'))
    expect(screen.getByText('screen:today')).toBeTruthy()
    expect(screen.getByTestId('mica-float')).toBeTruthy()
  })
})

/**
 * A carer who taps a notification — or opens the app from one after it has been
 * killed — must land on the thing it was about. Until this existed, a cold start
 * from any notification the app did not already know was ignored entirely, and the
 * supported-living events (a handover nobody wrote, a room nobody checked) are
 * exactly the ones that arrive that way.
 */
describe('App notification cold start', () => {
  it('opens the screen a record the phone cannot show lives on', async () => {
    // A compliance notification: the phone has no compliance screen, so the message
    // itself is the destination rather than a tap that does nothing.
    mockLaunchNotification.mockResolvedValue({ type: 'compliance', link: '/compliance' } as any)

    const { screen } = await mountApp('CARE_WORKER', { awaitTabs: false })

    expect(await screen.findByText('screen:notifications')).toBeTruthy()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('opens the room-check board from an overdue nudge', async () => {
    // The sweep's link names a room the worker can walk to, and the phone now has the
    // board that clears it — so the nudge opens the record, not a message about it.
    mockLaunchNotification.mockResolvedValue({ type: 'compliance', link: '/room-checks' } as any)

    const { screen } = await mountApp('CARE_WORKER', { awaitTabs: false })

    expect(await screen.findByText('screen:roomChecks')).toBeTruthy()
  })

  it('opens the tab a shift link with no shift id is about', async () => {
    // The rota link without a shift is the week view. A malformed id lands here too,
    // rather than on a handover screen that cannot load.
    mockLaunchNotification.mockResolvedValue({
      type: 'shift',
      link: '/scheduling?week=2026-10-16',
    } as any)

    const { screen } = await mountApp('CARE_WORKER')

    expect(await screen.findByText('screen:week')).toBeTruthy()
    // A tab, not a pushed screen: the tab bar stays available.
    expect(tabNamed(screen, 'Schedule').props.accessibilityState).toEqual({ selected: true })
  })

  it('opens the shift handover a handover-due notification names', async () => {
    // The supported-living nudge carries the shift id, and the phone now has the
    // handover screen for exactly that record — so the tap is not a detour through
    // the week view to find the shift again.
    const shiftId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    mockLaunchNotification.mockResolvedValue({
      type: 'shift',
      link: `/scheduling?week=2026-10-16&shift=${shiftId}`,
    } as any)

    const { screen } = await mountApp('CARE_WORKER', { awaitTabs: false })

    expect(await screen.findByText('screen:handover')).toBeTruthy()
    expect(screenProps.handover.shiftId).toBe(shiftId)
    // Pushed over the tabs, and the back stack can return to them.
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('leaves a normal cold start on the tabs', async () => {
    const { screen } = await mountApp('CARE_WORKER')

    expect(screen.getByText('screen:today')).toBeTruthy()
    expect(screen.queryByText('screen:notifications')).toBeNull()
  })
})

describe('App session boot', () => {
  it('shows the login screen when no session is stored', async () => {
    mockReadSession.mockResolvedValue(null)

    const screen = render(<App />)

    expect(await screen.findByText('screen:login')).toBeTruthy()
    expect(mockGetManagerDashboard).not.toHaveBeenCalled()
  })
})

/**
 * The safe-area guarantee. A screen that renders its own header from y=0 draws
 * it under the clock and battery, and AnnualLeaveScreen did exactly that once.
 * The fix was structural rather than a patch on that one screen: every stack
 * screen is mounted through one frame that applies the insets, so there is no
 * per-screen decision left to get wrong. These tests are what stop it drifting
 * back.
 */
describe('App safe-area insets', () => {
  const appSource = readFileSync(join(__dirname, '..', '..', 'App.tsx'), 'utf8')

  it('mounts every stack screen through the one frame that applies the insets', () => {
    // The old EmergencyLayer applied no insets at all and left each screen to
    // remember. It is gone, and cannot come back unnoticed.
    expect(appSource).not.toMatch(/function EmergencyLayer|<EmergencyLayer/)

    // Every `case` in the screen switch returns through `frame(...)`, bar the one
    // that is not a stack screen at all. If a new screen is added and returns raw
    // JSX, the two counts stop matching.
    const caseNames = Array.from(appSource.matchAll(/^ {4}case '([^']+)'/gm), match => match[1])
    const framed = appSource.match(/return frame\(/g) || []
    expect(caseNames).toContain('tabs')
    expect(caseNames.length).toBeGreaterThan(1)
    expect(framed).toHaveLength(caseNames.length - 1)
  })

  it('leaves no screen applying its own top inset, which would pad it twice', () => {
    const screenDir = join(__dirname, '..', 'screens')
    const offenders = readdirSync(screenDir)
      .filter(file => file.endsWith('.tsx'))
      .filter(file => {
        const source = readFileSync(join(screenDir, file), 'utf8')
        return /edges=\{\['top'\]\}/.test(source) || /insets\.top/.test(source)
      })
    expect(offenders).toEqual([])
  })

  it('keeps the tab bar clear of the iOS home indicator', async () => {
    const { screen } = await mountApp('CARE_WORKER')

    const areas = screen.UNSAFE_queryAllByType(SafeAreaView)
    expect(areas.length).toBeGreaterThan(0)
    for (const area of areas) {
      expect(area.props.edges).toEqual(expect.arrayContaining(['top', 'bottom']))
    }
  })

  it('keeps a stack screen below the status bar', async () => {
    const { screen } = await mountApp('CARE_WORKER')
    const back = installBackHandler()

    await act(async () => { fireEvent.press(tabNamed(screen, 'Settings')) })
    await act(async () => { screenProps.settings.onProfile() })
    expect(screen.getByText('screen:profile')).toBeTruthy()

    const areas = screen.UNSAFE_queryAllByType(SafeAreaView)
    expect(areas.length).toBeGreaterThan(0)
    for (const area of areas) {
      expect(area.props.edges).toEqual(expect.arrayContaining(['top']))
    }

    await pressBack(back)
    expect(screen.getByText('screen:settings')).toBeTruthy()
  })
})
