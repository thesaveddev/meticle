/**
 * The access token lasts 15 minutes and the refresh token 7 days, and the
 * server treats each refresh token as single-use. These tests pin the two
 * behaviours that follow from that: an expired access token must be repaired
 * without signing the carer out, and parallel 401s must share one refresh
 * rather than racing each other into a "token already used" rejection.
 */
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockDeleteItem = jest.fn()

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: any[]) => mockGetItem(...args),
  setItemAsync: (...args: any[]) => mockSetItem(...args),
  deleteItemAsync: (...args: any[]) => mockDeleteItem(...args),
}))

import { getCurrentUser, login, ApiError } from '../api'

const SESSION = {
  accessToken: 'expired-access-token',
  refreshToken: 'refresh-token',
  user: { id: 'u1', email: 'carer@example.com', role: 'CARE_WORKER' },
}

function jsonResponse(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) } as any
}

beforeEach(() => {
  mockGetItem.mockReset()
  mockSetItem.mockReset()
  mockDeleteItem.mockReset()
  mockGetItem.mockImplementation(async (key: string) =>
    key === 'meticlecare.session' ? JSON.stringify(SESSION) : null
  )
  global.fetch = jest.fn() as any
})

describe('access token refresh', () => {
  it('refreshes and retries when the access token has expired', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-access', refreshToken: 'next-refresh' }))
      .mockResolvedValueOnce(jsonResponse(200, { user: SESSION.user }))

    await expect(getCurrentUser('expired-access-token')).resolves.toMatchObject({ user: SESSION.user })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/me')
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')
    expect(fetchMock.mock.calls[1][1].body).toContain('refresh-token')
    // The retry must carry the new token, not the expired one.
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh-access')
  })

  it('shares one refresh between concurrent expired requests', async () => {
    const fetchMock = global.fetch as jest.Mock
    // Both /auth/me calls 401 before either refresh completes.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-access', refreshToken: 'next-refresh' }))
      .mockResolvedValueOnce(jsonResponse(200, { user: SESSION.user }))
      .mockResolvedValueOnce(jsonResponse(200, { user: SESSION.user }))

    await Promise.all([getCurrentUser('expired-access-token'), getCurrentUser('expired-access-token')])

    // A single-use refresh token means a second concurrent refresh would be
    // rejected, so exactly one refresh call is allowed through.
    const refreshCalls = fetchMock.mock.calls.filter(call => String(call[0]).includes('/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)
  })

  it('clears the stored session when the refresh token is spent', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Refresh token has already been used' }))

    await expect(getCurrentUser('expired-access-token')).rejects.toBeInstanceOf(ApiError)
    expect(mockDeleteItem).toHaveBeenCalledWith('meticlecare.session')
  })

  it('does not attempt a refresh for the login call itself', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Invalid credentials' }))

    await expect(login('carer@example.com', 'wrong-password')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 401 that survives the refresh attempt', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-access', refreshToken: 'next-refresh' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Account deactivated' }))

    await expect(getCurrentUser('expired-access-token')).rejects.toMatchObject({ status: 401 })
  })
})
