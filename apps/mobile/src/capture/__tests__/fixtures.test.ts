/**
 * The fixtures are time-dependent by necessity and must be time-*independent*
 * in appearance. The Today screen works out whether a visit is past, under way
 * or next by comparing it to the real clock, so a fixed set of visit times would
 * produce a different screenshot at 09:00 and at 21:00 — and a reviewer
 * comparing two runs would notice. These tests hold the line by running the same
 * fixtures against several very different hours of the day.
 */
import { captureQueue, captureVisits, captureRoutes, CAPTURE_IDS, CAPTURE_SESSION } from '../fixtures'

/** The same classification TodayScreen.classifyVisits performs, for the test. */
function kinds(now: Date) {
  let foundNext = false
  return captureVisits(now).map(visit => {
    if (['completed', 'missed'].includes(visit.status)) return 'past'
    if (visit.status === 'checked_in') return 'current'
    if (now <= new Date(visit.scheduled_start)) {
      if (!foundNext) { foundNext = true; return 'next' }
    }
    return 'future'
  })
}

const byId = (now: Date, id: string) => captureVisits(now).find(visit => visit.id === id)

const HOURS = [
  new Date('2026-09-26T00:20:00'),
  new Date('2026-09-26T07:05:00'),
  new Date('2026-09-26T13:40:00'),
  new Date('2026-09-26T22:50:00'),
]

describe('capture visit fixtures', () => {
  it.each(HOURS)('always shows a call under way and the next one (%s)', now => {
    // The hour decides how many calls bracket those two — a capture at 00:20
    // has no finished call behind it and a capture at 22:50 has nothing after —
    // but a call under way and the next one must always be there, because that
    // spread is what makes the screenshot legible.
    const labels = kinds(now)
    expect(labels.filter(label => label === 'current')).toHaveLength(1)
    expect(labels.filter(label => label === 'next')).toHaveLength(1)
    expect(labels.filter(label => label === 'past' || label === 'future')).toHaveLength(labels.length - 2)
  })

  it('never puts another day\u2019s call in today\u2019s list', () => {
    // The Today screen is given one day of visits, so a capture that ran at
    // 00:20 must not include the 21:00 call from the evening before.
    for (const now of HOURS) {
      for (const visit of captureVisits(now)) {
        expect(new Date(visit.scheduled_start).getDate()).toBe(now.getDate())
      }
    }
  })

  it('snaps every call time to the half hour, so the clock never reads oddly', () => {
    for (const now of HOURS) {
      for (const visit of captureVisits(now)) {
        for (const value of [visit.scheduled_start, visit.scheduled_end]) {
          const date = new Date(value)
          expect([0, 30]).toContain(date.getMinutes())
          expect(date.getSeconds()).toBe(0)
        }
      }
    }
  })

  it('keeps the call under way started before now and ending after it', () => {
    for (const now of [...HOURS, new Date('2026-09-26T13:59:59'), new Date('2026-09-26T00:00:01')]) {
      const inProgress = byId(now, CAPTURE_IDS.visitInProgress)
      expect(inProgress).toBeDefined()
      expect(new Date(inProgress!.scheduled_start).getTime()).toBeLessThanOrEqual(now.getTime())
      expect(new Date(inProgress!.scheduled_end).getTime()).toBeGreaterThan(now.getTime())
      expect(inProgress!.check_in_at).not.toBeNull()
      expect(inProgress!.check_out_at).toBeNull()
    }
  })

  it('gives the finished call a check-in and a check-out', () => {
    for (const now of HOURS) {
      const morning = byId(now, CAPTURE_IDS.visitMorning)
      if (!morning) continue // a capture in the first three hours of the day
      expect(morning.status).toBe('completed')
      expect(morning.check_in_at).not.toBeNull()
      expect(morning.check_out_at).not.toBeNull()
      expect(new Date(morning.scheduled_end).getTime()).toBeLessThan(now.getTime())
    }
  })

  it('keeps the call after next in the future', () => {
    for (const now of HOURS) {
      const later = byId(now, CAPTURE_IDS.visitLater)
      if (!later) continue // a capture late enough that the call falls tomorrow
      expect(new Date(later.scheduled_start).getTime()).toBeGreaterThan(now.getTime())
      expect(later.status).toBe('scheduled')
    }
  })

  it('shows a two-person call on the visit that needs one', () => {
    const inProgress = byId(new Date(), CAPTURE_IDS.visitInProgress)!
    expect(inProgress.requires_two_staff).toBe(true)
    expect(inProgress.second_staff_name).toBe('Rosa Mendes')
  })

  it('gives every visit a client, an address and coordinates', () => {
    for (const visit of captureVisits()) {
      expect(visit.person_name).toBeTruthy()
      expect(visit.person_address).toBeTruthy()
      expect(typeof visit.person_latitude).toBe('number')
      expect(typeof visit.person_longitude).toBe('number')
      expect(visit.label).toBeTruthy()
    }
  })
})

describe('capture queue fixture', () => {
  it('is at least two actions all waiting to sync, with none the server has refused', () => {
    const queue = captureQueue()
    expect(queue.length).toBeGreaterThanOrEqual(2)
    expect(queue.every(item => item.state === 'pending')).toBe(true)
    expect(new Set(queue.map(item => item.action))).toEqual(new Set(['check-in', 'check-out']))
  })

  it('only holds actions for visits that exist, and does not repeat one visit when a call is missing', () => {
    for (const now of HOURS) {
      const ids = new Set(captureVisits(now).map(visit => visit.id))
      const queue = captureQueue(now)
      for (const item of queue) expect(ids.has(item.visitId)).toBe(true)
      expect(new Set(queue.map(item => item.id)).size).toBe(queue.length)
    }
  })
})

describe('capture session fixture', () => {
  it('is a care worker in a supported-living organisation, so the medication tab is shown', () => {
    // ClientDetailScreen hides medication for domiciliary organisations, and the
    // client-record screenshot is meant to show it.
    expect(CAPTURE_SESSION.user.role).toBe('CARE_WORKER')
    expect(CAPTURE_SESSION.organization?.service_types).toEqual(['supported_living'])
    expect(CAPTURE_SESSION.organization?.name).toBe('Brightwater Home Care')
  })

  it('has the emergency contacts the app reads straight off the session', () => {
    expect(CAPTURE_SESSION.organization?.emergency_contact_1_phone).toBeTruthy()
    expect(CAPTURE_SESSION.organization?.emergency_contact_2_phone).toBeTruthy()
  })
})

describe('capture route fixture', () => {
  it('serves a chat conversation that is worth photographing', () => {
    const routes = captureRoutes()
    const conversation = routes['GET /chat/channels/:channel/messages'] as { messages: { body: string }[] }
    expect(conversation.messages.length).toBeGreaterThanOrEqual(5)
    expect(conversation.messages.some(message => /blood pressure/i.test(message.body))).toBe(true)
  })

  it('serves a client record with a medication list, a body map entry and a risk note', () => {
    const routes = captureRoutes()
    expect((routes['GET /emedication/records'] as unknown[]).length).toBeGreaterThan(0)
    expect((routes[`GET /body-map/person/${CAPTURE_IDS.personEileen}/active`] as unknown[]).length).toBeGreaterThan(0)
    const person = routes[`GET /people/${CAPTURE_IDS.personEileen}`] as Record<string, unknown>
    expect(String(person.care_summary)).toMatch(/Eileen/)
    expect(String(person.risk_notes)).toMatch(/Falls risk/)
  })
})
