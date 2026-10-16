import { getMyEarnings } from '../api'

/**
 * A rejected request must be visible somewhere.
 *
 * The pay screen sent its month range as ISO timestamps, the API answered 400 on
 * every load, and the screen rendered that as "No earnings data" — for weeks,
 * with nothing in any log to say why. The screen's own swallow is deliberate (a
 * carer should still see the rest of the page), so the one place that can make
 * the failure diagnosable is here.
 */
describe('request failures', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('logs the status and the path, and still throws so the caller can decide', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Validation failed' }),
    })) as unknown as typeof fetch

    await expect(getMyEarnings('token-1', '2026-10-01T00:00:00.000Z', '2026-10-31T23:59:59.000Z')).rejects.toThrow('Validation failed')

    expect(warn).toHaveBeenCalledTimes(1)
    const line = String(warn.mock.calls[0][0])
    expect(line).toContain('/homecare/my-earnings')
    expect(line).toContain('400')
  })

  it('does not log a 401, which is the token-refresh path', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
    })) as unknown as typeof fetch

    // No token: the refresh-and-retry branch cannot apply, so this reaches the throw.
    await expect(getMyEarnings('', '2026-10-01', '2026-10-31')).rejects.toThrow('Unauthorized')
    expect(warn).not.toHaveBeenCalled()
  })
})
