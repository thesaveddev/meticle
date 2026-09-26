/**
 * A check-in or check-out recorded offline is visit evidence: a timestamp, a
 * GPS fix, and often a photo. Losing one to a momentary network drop is a
 * safeguarding problem, so a transient failure has to be retried. These tests
 * pin that, and pin the opposite rule for a payload the server will never
 * accept, which retrying forever would only obscure.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

// In-memory stand-in for SecureStore so the queue's own persistence is exercised.
jest.mock('../storage', () => {
  let store: any[] = []
  return {
    readQueue: jest.fn(async () => store.map(item => ({ ...item }))),
    writeQueue: jest.fn(async (queue: any[]) => { store = queue.map(item => ({ ...item })) }),
    readSession: jest.fn(async () => null),
    writeSession: jest.fn(),
    clearSession: jest.fn(),
    __store: () => store,
    __setStore: (next: any[]) => { store = next },
  }
})

import { flushQueue, enqueueVisitAction } from '../visitQueue'
import { executeVisitAction, ApiError } from '../api'
const storage = require('../storage')

jest.mock('../api', () => ({
  executeVisitAction: jest.fn(),
  // Named distinctly from the import it shadows. The export key is unchanged, so
  // the test still constructs the same class the mocked module exposes and
  // `instanceof` checks inside visitQueue still match.
  ApiError: class MockApiError extends Error {
    status: number
    constructor(status: number, message: string) { super(message); this.status = status }
  },
}))

const mockExecute = executeVisitAction as jest.MockedFunction<typeof executeVisitAction>

let store: any[] = []

beforeEach(() => {
  store = []
  storage.__setStore(store)
  mockExecute.mockReset()
})

const seed = (overrides: Record<string, any> = {}) => {
  storage.__setStore([{
    id: 'action-1', visitId: 'visit-1', action: 'check-in',
    payload: { latitude: 53.8, longitude: -1.5 },
    createdAt: new Date().toISOString(), state: 'pending', attempts: 0, ...overrides,
  } as any])
  store = storage.__store()
}

describe('offline visit action queue', () => {
  const queue = () => storage.__store()

  it('sends a pending action and clears it once it succeeds', async () => {
    seed()
    mockExecute.mockResolvedValue({} as any)

    const result = await flushQueue('token')

    expect(result.synced).toBe(1)
    expect(queue()).toHaveLength(0)
  })

  it('retries an action that failed on a network error', async () => {
    // A dropped connection reaches the app as an error with no HTTP status.
    mockExecute.mockRejectedValueOnce(new Error('Network request failed'))
    seed()
    await flushQueue('token')
    expect(queue()[0].state).toBe('failed')
    expect(queue()[0].permanent).toBe(false)

    // The next sync must try again rather than abandoning the check-in.
    mockExecute.mockResolvedValueOnce({} as any)
    const result = await flushQueue('token')

    expect(mockExecute).toHaveBeenCalledTimes(2)
    expect(result.synced).toBe(1)
    expect(queue()).toHaveLength(0)
  })

  it('retries after an expired session, since that resolves itself', async () => {
    mockExecute.mockRejectedValueOnce(new ApiError(401, 'Token expired'))
    seed()
    await flushQueue('token')
    expect(queue()[0].permanent).toBe(false)

    mockExecute.mockResolvedValueOnce({} as any)
    await flushQueue('token')
    expect(queue()).toHaveLength(0)
  })

  it('does not keep retrying a payload the server refuses', async () => {
    mockExecute.mockRejectedValue(new ApiError(422, 'Outside the scheduled window'))
    seed()
    await flushQueue('token')

    expect(queue()[0].permanent).toBe(true)
    const callsAfterFirstSync = mockExecute.mock.calls.length

    await flushQueue('token')
    await flushQueue('token')

    expect(mockExecute).toHaveBeenCalledTimes(callsAfterFirstSync)
    expect(queue()).toHaveLength(1)
  })

  it('stops retrying after repeated transient failures but keeps the record', async () => {
    mockExecute.mockRejectedValue(new Error('Network request failed'))
    seed()

    for (let attempt = 0; attempt < 8; attempt++) await flushQueue('token')

    expect(queue()).toHaveLength(1)
    expect(queue()[0].attempts).toBeGreaterThan(5)
    expect(mockExecute.mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('records a fresh action as pending with no attempts yet', async () => {
    const item = await enqueueVisitAction('visit-9', 'check-out', { latitude: 1, longitude: 2 })
    expect(item.state).toBe('pending')
    expect(item.attempts).toBe(0)
    expect(queue()).toHaveLength(1)
  })
})
