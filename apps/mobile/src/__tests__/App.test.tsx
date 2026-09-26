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
}))
jest.mock('../services/api', () => ({
  getCurrentUser: jest.fn(),
  getMyVisits: jest.fn(async () => []),
  login: jest.fn(),
  logout: jest.fn(async () => {}),
  createDisruption: jest.fn(async () => ({})),
  getUnreadNotificationCount: jest.fn(async () => 0),
  getChatUnread: jest.fn(async () => ({})),
  getManagerDashboard: jest.fn(async () => ({ visits: [], exceptions: [], staff: [], disruptions: [] })),
}))
jest.mock('../services/notifications', () => ({
  scheduleVisitReminder: jest.fn(async () => null),
  registerForPushNotifications: jest.fn(async () => null),
  addNotificationListeners: jest.fn(),
  removeNotificationListeners: jest.fn(),
}))
jest.mock('../services/visitQueue', () => ({
  getQueue: jest.fn(async () => []),
  flushQueue: jest.fn(async () => {}),
  enqueueVisitAction: jest.fn(),
}))

const mockReadSession = storage.readSession as jest.MockedFunction<typeof storage.readSession>
const mockGetCurrentUser = api.getCurrentUser as jest.MockedFunction<typeof api.getCurrentUser>
const mockGetUnread = api.getUnreadNotificationCount as jest.MockedFunction<typeof api.getUnreadNotificationCount>
const mockGetChatUnread = api.getChatUnread as jest.MockedFunction<typeof api.getChatUnread>
const mockGetManagerDashboard = api.getManagerDashboard as jest.MockedFunction<typeof api.getManagerDashboard>
const mockGetQueue = visitQueue.getQueue as jest.MockedFunction<typeof visitQueue.getQueue>

const signInAs = (role: MobileUser['role']): AuthSession => ({
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'me@example.com', role, first_name: 'Test', last_name: 'Carer' },
})

/** Boot the app into a signed-in session and wait for the tab bar to appear. */
async function mountApp(role: MobileUser['role'] = 'CARE_WORKER') {
  const session = signInAs(role)
  mockReadSession.mockResolvedValue(session)
  mockGetCurrentUser.mockResolvedValue({ user: session.user, organization: null } as any)

  const screen = render(<App />)
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0))
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
