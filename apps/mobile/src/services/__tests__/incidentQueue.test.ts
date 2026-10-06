jest.mock('./../storage', () => {
  let queue: any[] = []
  return {
    readIncidentQueue: jest.fn(async () => queue.map(item => ({ ...item }))),
    writeIncidentQueue: jest.fn(async (next: any[]) => { queue = next.map(item => ({ ...item })) }),
    __getQueue: () => queue,
    __setQueue: (next: any[]) => { queue = next.map(item => ({ ...item })) },
  }
})

jest.mock('../api', () => ({ reportIncident: jest.fn() }))

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      getRandomValues: jest.fn((bytes: Uint8Array) => bytes),
    },
  })
})

import { reportIncident } from '../api'
import { flushIncidentQueue, getIncidentQueue, submitIncidentReport } from '../incidentQueue'
const storage = require('../storage')

const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'
const ORG_ID = '33333333-3333-4333-8333-333333333333'
const payload = {
  title: 'Fall in hallway',
  description: 'Found on the floor',
  witnesses: 'Jordan Smith',
  severity: 'high' as const,
  incident_date: '2026-10-06',
  is_near_miss: false,
}
const api = reportIncident as jest.MockedFunction<typeof reportIncident>

beforeEach(() => {
  jest.useRealTimers()
  storage.__setQueue([])
  api.mockReset()
})

describe('offline incident report queue', () => {
  it('sends online with a UUID submission key and leaves no queued copy', async () => {
    api.mockResolvedValue({ id: 'incident-1' })

    const result = await submitIncidentReport('token', USER_ID, ORG_ID, payload)

    expect(result.queued).toBe(false)
    expect(api).toHaveBeenCalledWith('token', expect.objectContaining({
      title: payload.title,
      client_submission_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }))
    expect(api.mock.calls[0][1]).not.toHaveProperty('ownerId')
    expect(api.mock.calls[0][1]).not.toHaveProperty('organizationId')
    expect(api.mock.calls[0][1]).not.toHaveProperty('attempts')
    expect(api.mock.calls[0][1].person_ids).toBeUndefined()
    expect(api.mock.calls[0][1].visit_id).toBeUndefined()
    expect(api.mock.calls[0][1].witnesses).toBe(payload.witnesses)
    expect(storage.__getQueue()).toHaveLength(0)
  })

  it('keeps the same key across a network failure and successful retry', async () => {
    api.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce({ id: 'incident-1' })

    const submitted = await submitIncidentReport('token', USER_ID, ORG_ID, payload)
    expect(submitted.queued).toBe(true)
    expect(storage.__getQueue()).toHaveLength(1)
    expect(storage.__getQueue()[0].state).toBe('failed')
    const submissionKey = storage.__getQueue()[0].id

    jest.useFakeTimers().setSystemTime(Date.now() + 3_000)
    const result = await flushIncidentQueue('token', USER_ID, ORG_ID)

    expect(api.mock.calls[0][1].client_submission_id).toBe(submissionKey)
    expect(api.mock.calls[1][1].client_submission_id).toBe(submissionKey)
    expect(result).toEqual({ synced: 1, failed: 0, remaining: 0 })
    expect(storage.__getQueue()).toHaveLength(0)
  })

  it('keeps a permanently refused report queued for correction or manager review', async () => {
    api.mockRejectedValueOnce(Object.assign(new Error('Invalid category'), { status: 422 }))

    await expect(submitIncidentReport('token', USER_ID, ORG_ID, payload)).rejects.toThrow('Invalid category')
    expect(storage.__getQueue()).toHaveLength(1)
    expect(storage.__getQueue()[0].permanent).toBe(true)
    const callsBeforeRetry = api.mock.calls.length
    await flushIncidentQueue('token', USER_ID, ORG_ID)
    expect(api).toHaveBeenCalledTimes(callsBeforeRetry)
  })

  it('keeps resident and visit links in an incident draft for eventual retry', async () => {
    api.mockRejectedValueOnce(new Error('offline'))
    const incident = { ...payload, person_ids: ['44444444-4444-4444-8444-444444444444'], visit_id: '55555555-5555-4555-8555-555555555555' }
    await submitIncidentReport('token', USER_ID, ORG_ID, incident)
    jest.useFakeTimers().setSystemTime(Date.now() + 3_000)
    api.mockRejectedValueOnce(new Error('offline again'))

    await flushIncidentQueue('token', USER_ID, ORG_ID)

    expect(api.mock.calls[1][1].person_ids).toEqual(incident.person_ids)
    expect(api.mock.calls[1][1].visit_id).toBe(incident.visit_id)
    expect(api.mock.calls[1][1].witnesses).toBe(payload.witnesses)
  })

  it('keeps reports scoped to their submitting user and organisation', async () => {
    api.mockRejectedValue(new Error('offline'))
    await submitIncidentReport('token', USER_ID, ORG_ID, payload)

    expect(await getIncidentQueue(USER_ID, ORG_ID)).toHaveLength(1)
    expect(await getIncidentQueue(OTHER_USER_ID, ORG_ID)).toHaveLength(0)
    expect(await getIncidentQueue(USER_ID, null)).toHaveLength(0)
  })

  it('backs off after transient retry failures', async () => {
    api.mockRejectedValueOnce(new Error('offline'))
    await submitIncidentReport('token', USER_ID, ORG_ID, payload)
    api.mockRejectedValueOnce(new Error('still offline'))

    const firstRetry = await flushIncidentQueue('token', USER_ID, ORG_ID)
    expect(firstRetry.failed).toBe(0) // Not due for retry yet.
    expect(api).toHaveBeenCalledTimes(1)

    jest.useFakeTimers().setSystemTime(Date.now() + 3_000)
    api.mockRejectedValueOnce(new Error('still offline'))
    const dueRetry = await flushIncidentQueue('token', USER_ID, ORG_ID)
    expect(dueRetry.failed).toBe(1)
    expect(storage.__getQueue()[0].nextAttemptAt).toBeTruthy()
  })

  it('serializes concurrent flush calls so a report is sent once', async () => {
    storage.__setQueue([{
      ...payload,
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ownerId: USER_ID,
      organizationId: ORG_ID,
      createdAt: new Date().toISOString(),
      state: 'pending',
      attempts: 0,
    }])
    let finishRequest!: (value: any) => void
    let markStarted!: () => void
    const started = new Promise<void>(resolve => { markStarted = resolve })
    api.mockImplementationOnce(() => {
      markStarted()
      return new Promise(resolve => { finishRequest = resolve })
    })

    const first = flushIncidentQueue('token', USER_ID, ORG_ID)
    const second = flushIncidentQueue('token', USER_ID, ORG_ID)
    await started
    expect(api).toHaveBeenCalledTimes(1)

    finishRequest({ id: 'incident-1' })
    await Promise.all([first, second])
    expect(api).toHaveBeenCalledTimes(1)
    expect(storage.__getQueue()).toHaveLength(0)
  })
})
