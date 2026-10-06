jest.mock('expo-secure-store', () => {
  let values = new Map<string, string>()
  let failOnKey: string | null = null
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      if (failOnKey === key) throw new Error('SecureStore write failed')
      values.set(key, value)
    }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key) }),
    __clear: () => { values = new Map(); failOnKey = null },
    __values: () => values,
    __failOn: (key: string | null) => { failOnKey = key },
  }
})

import * as SecureStore from 'expo-secure-store'
import { readIncidentQueue, writeIncidentQueue } from '../storage'
import type { QueuedIncidentReport } from '../../types'

const secureStore = SecureStore as typeof SecureStore & {
  __clear: () => void
  __values: () => Map<string, string>
  __failOn: (key: string | null) => void
}

function report(overrides: Partial<QueuedIncidentReport> = {}): QueuedIncidentReport {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ownerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    organizationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    title: 'Fall in hallway',
    description: 'Found on the floor',
    severity: 'high',
    incident_date: '2026-10-06',
    createdAt: '2026-10-06T10:00:00.000Z',
    state: 'pending',
    attempts: 0,
    ...overrides,
  }
}

beforeEach(() => secureStore.__clear())

describe('offline incident SecureStore persistence', () => {
  it('round-trips long text through bounded SecureStore chunks', async () => {
    const item = report({ description: '🩺'.repeat(800) })
    await writeIncidentQueue([item])

    expect(await readIncidentQueue()).toEqual([item])
    const values = secureStore.__values()
    expect([...values.keys()].filter(key => key.includes('.item.')).length).toBeGreaterThan(2)
    for (const [key, value] of values) {
      if (key.endsWith('.count') || key === 'meticlecare.incident-queue') continue
      if (key.includes('.item.')) expect(Array.from(value).length).toBeLessThanOrEqual(100)
    }
  })

  it('keeps the previous complete queue if the index swap is interrupted', async () => {
    const original = report()
    await writeIncidentQueue([original])
    const oldIndex = secureStore.__values().get('meticlecare.incident-queue')
    const replacement = report({ title: 'Updated local state', attempts: 1, state: 'failed' })
    const nextSlot = JSON.parse(oldIndex!)[0].endsWith('a') ? 'b' : 'a'
    secureStore.__failOn(`meticlecare.incident-queue.item.${replacement.id}${nextSlot}.count`)

    await expect(writeIncidentQueue([replacement])).rejects.toThrow('SecureStore write failed')
    secureStore.__failOn(null)
    expect(secureStore.__values().get('meticlecare.incident-queue')).toBe(oldIndex)
    expect(await readIncidentQueue()).toEqual([original])
  })

  it('ignores a truncated indexed item without breaking other items', async () => {
    const first = report({ description: 'x'.repeat(800) })
    const second = report({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Second report' })
    await writeIncidentQueue([first, second])
    const values = secureStore.__values()
    const index = JSON.parse(values.get('meticlecare.incident-queue')!) as string[]
    const firstPrefix = `meticlecare.incident-queue.item.${index[0]}`
    const firstCount = Number(values.get(`${firstPrefix}.count`))
    await SecureStore.setItemAsync(`${firstPrefix}.${firstCount - 1}`, '{truncated')
    expect(await readIncidentQueue()).toEqual([second])
  })

  it('keeps unchanged reports indexed when another report gets a retry update', async () => {
    const first = report()
    const second = report({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Second report' })
    await writeIncidentQueue([first, second])
    const originalIndex = JSON.parse(secureStore.__values().get('meticlecare.incident-queue')!) as string[]
    await writeIncidentQueue([{ ...first, attempts: 1, state: 'failed' }, second])

    const updatedIndex = JSON.parse(secureStore.__values().get('meticlecare.incident-queue')!) as string[]
    expect(updatedIndex[1]).toBe(originalIndex[1])
    expect(updatedIndex[0]).not.toBe(originalIndex[0])
    expect(await readIncidentQueue()).toEqual([{ ...first, attempts: 1, state: 'failed' }, second])
  })

  it('rejects invalid queue data before changing the persisted index', async () => {
    const existing = report()
    await writeIncidentQueue([existing])
    const index = secureStore.__values().get('meticlecare.incident-queue')

    await expect(writeIncidentQueue([report({ id: 'invalid-id' })])).rejects.toThrow('invalid report')
    expect(secureStore.__values().get('meticlecare.incident-queue')).toBe(index)
    expect(await readIncidentQueue()).toEqual([existing])
  })
})
