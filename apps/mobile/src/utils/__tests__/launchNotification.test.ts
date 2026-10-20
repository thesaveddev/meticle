/**
 * The cold-start contract: a tap on a notification is acted on exactly once.
 *
 * Expo keeps the last notification response on the device across restarts, so a
 * response read without being consumed makes the next ordinary launch replay an old
 * tap. These tests pin the two halves of the fix — one read per process, and the
 * stored response cleared once it has been routed — against a fake module, which is
 * the same shape `services/notifications` supplies.
 */

import { createLaunchNotificationReader, type LaunchNotificationModule } from '../launchNotification'

const LAUNCH_RESPONSE = {
  notification: {
    request: { content: { data: { type: 'room_check_overdue', link: '/room-checks' } } },
  },
}

function fakeModule(overrides: Partial<LaunchNotificationModule> = {}) {
  const module: LaunchNotificationModule = {
    getLastNotificationResponseAsync: jest.fn(async () => LAUNCH_RESPONSE),
    clearLastNotificationResponseAsync: jest.fn(async () => {}),
    ...overrides,
  }
  return module
}

describe('launch notification', () => {
  it('returns the data of the notification that opened the app', async () => {
    const reader = createLaunchNotificationReader(async () => fakeModule())

    await expect(reader.read()).resolves.toEqual({
      type: 'room_check_overdue',
      link: '/room-checks',
    })
  })

  it('clears the stored response so the next launch does not replay the tap', async () => {
    const module = fakeModule()
    const reader = createLaunchNotificationReader(async () => module)

    await reader.read()

    expect(module.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1)
  })

  it('reads at most once per process, however often the app asks', async () => {
    const module = fakeModule()
    const reader = createLaunchNotificationReader(async () => module)

    await reader.read()
    // Two reads of the same launch would push two copies of the same screen.
    await expect(reader.read()).resolves.toBeNull()
    expect(module.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1)
  })

  it('is a normal launch when nothing opened the app', async () => {
    const module = fakeModule({ getLastNotificationResponseAsync: jest.fn(async () => null) })
    const reader = createLaunchNotificationReader(async () => module)

    await expect(reader.read()).resolves.toBeNull()
    // Nothing to clear: an unrelated response must not be dropped on our behalf.
    expect(module.clearLastNotificationResponseAsync).not.toHaveBeenCalled()
  })

  it('does not consume a launch it could not read', async () => {
    // The module is unavailable on the first attempt — Expo Go on Android has no
    // remote push — so the tap must still be there if it becomes readable.
    const attempts: Array<LaunchNotificationModule | null> = [null, fakeModule()]
    const reader = createLaunchNotificationReader(async () => attempts.shift() ?? null)

    await expect(reader.read()).resolves.toBeNull()
    await expect(reader.read()).resolves.toMatchObject({ link: '/room-checks' })
  })

  it('still routes the launch when the device cannot clear the response', async () => {
    const module = fakeModule({
      clearLastNotificationResponseAsync: jest.fn(async () => { throw new Error('native module unavailable') }),
    })
    const reader = createLaunchNotificationReader(async () => module)

    await expect(reader.read()).resolves.toMatchObject({ link: '/room-checks' })
  })

  it('treats a module that throws on read as no launch', async () => {
    const reader = createLaunchNotificationReader(async () => {
      throw new Error('expo-notifications is not installed')
    })

    await expect(reader.read()).resolves.toBeNull()
  })

  it('reads again after a reset, which is what the test seam is for', async () => {
    const reader = createLaunchNotificationReader(async () => fakeModule())

    await reader.read()
    reader.reset()

    await expect(reader.read()).resolves.toMatchObject({ link: '/room-checks' })
  })
})
