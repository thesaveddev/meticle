import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { SettingsScreen } from '../SettingsScreen'
import { IconBell, IconWarning } from '../../components/Icons'
import { requestReminderPermission } from '../../services/notifications'
import { isHapticEnabled, setHapticEnabled } from '../../services/haptics'
import type { MobileUser } from '../../types'

jest.mock('../../services/notifications', () => ({
  requestReminderPermission: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  isHapticEnabled: jest.fn(),
  setHapticEnabled: jest.fn(),
}))

const mockedPermission = requestReminderPermission as jest.MockedFunction<typeof requestReminderPermission>
const mockedIsHapticEnabled = isHapticEnabled as jest.MockedFunction<typeof isHapticEnabled>
const mockedSetHapticEnabled = setHapticEnabled as jest.MockedFunction<typeof setHapticEnabled>

const user: MobileUser = {
  id: 'user-1',
  email: 'carer@example.com',
  role: 'CARE_WORKER',
  first_name: 'Test',
  last_name: 'Carer',
}

function renderScreen() {
  return render(
    <SettingsScreen
      user={user}
      onSignOut={jest.fn()}
      onSync={jest.fn()}
      onProfile={jest.fn()}
      onLearn={jest.fn()}
      onAvailability={jest.fn()}
    />
  )
}

/**
 * The screen asks for notification permission on mount, and the toggle's state comes
 * from that answer. Tests let that promise chain settle before interacting.
 */
async function settleMountPermissionCheck(): Promise<void> {
  expect(requestReminderPermission).toHaveBeenCalledTimes(1)
  await act(async () => {
    await Promise.resolve()
  })
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockedPermission.mockResolvedValue(true)
    mockedIsHapticEnabled.mockResolvedValue(true)
    mockedSetHapticEnabled.mockResolvedValue(undefined)
  })

  it('labels the reminder row as visit reminders', async () => {
    const screen = renderScreen()
    expect(screen.getByText('Visit reminders')).toBeTruthy()
    expect(screen.getByText('Alerts before your assigned calls')).toBeTruthy()
    await settleMountPermissionCheck()
  })

  it('shows the notification bell for visit reminders rather than a warning icon', async () => {
    const screen = renderScreen()
    // The row is a reminder, not a warning: the amber triangle it used to render
    // read as "something is wrong".
    expect(screen.UNSAFE_getByType(IconBell)).toBeTruthy()
    expect(screen.UNSAFE_queryByType(IconWarning)).toBeNull()
    await settleMountPermissionCheck()
  })

  it('turns reminders off without asking for permission again', async () => {
    const screen = renderScreen()
    await settleMountPermissionCheck()

    fireEvent.press(screen.getByText('Visit reminders'))

    await waitFor(() => expect(screen.getByText('Visit reminders disabled.')).toBeTruthy())
    expect(requestReminderPermission).toHaveBeenCalledTimes(1)
  })

  it('enables reminders when a previously denied permission is granted', async () => {
    mockedPermission.mockResolvedValue(false)
    const screen = renderScreen()
    await settleMountPermissionCheck()

    fireEvent.press(screen.getByText('Visit reminders'))
    await waitFor(() => expect(screen.getByText('Permission not granted.')).toBeTruthy())

    mockedPermission.mockResolvedValue(true)
    fireEvent.press(screen.getByText('Visit reminders'))

    await waitFor(() => expect(screen.getByText('Visit reminders enabled.')).toBeTruthy())
    expect(screen.queryByText('Permission not granted.')).toBeNull()
  })

  it('reports the denial instead of claiming reminders were enabled', async () => {
    mockedPermission.mockResolvedValue(false)
    const screen = renderScreen()
    await settleMountPermissionCheck()

    fireEvent.press(screen.getByText('Visit reminders'))

    await waitFor(() => expect(screen.getByText('Permission not granted.')).toBeTruthy())
    expect(screen.queryByText('Visit reminders enabled.')).toBeNull()
  })

  it('persists the haptic feedback preference using the stored value', async () => {
    const screen = renderScreen()
    await settleMountPermissionCheck()

    fireEvent.press(screen.getByText('Haptic feedback'))

    await waitFor(() => expect(setHapticEnabled).toHaveBeenCalledWith(false))
  })

  it('offers the learning centre for a carer', async () => {
    const screen = renderScreen()
    expect(screen.getByText('Learn how to use Meticle Care')).toBeTruthy()
    expect(screen.getByText('Find features, steps, and field guidance')).toBeTruthy()
    await settleMountPermissionCheck()
  })

  it('offers availability and sign out for a carer', async () => {
    const screen = renderScreen()
    expect(screen.getByText('Submit availability')).toBeTruthy()
    expect(screen.getByText('Sign out')).toBeTruthy()
    await settleMountPermissionCheck()
  })
})
