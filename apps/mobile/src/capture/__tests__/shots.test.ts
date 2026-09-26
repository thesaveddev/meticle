/**
 * The shot list is the contract with the store listing: six images, in this
 * order, showing these things. Renumbering the listing means editing
 * `src/capture/shots.ts`, and these tests fail if it stops being six, stops
 * being ordered, or starts pointing at a fixture that no longer exists.
 */
import { CAPTURE_IDS, captureRoutes, captureVisits } from '../fixtures'
import { CAPTURE_SHOTS, captureShotById } from '../shots'

describe('capture shot list', () => {
  it('is the six screenshots the runbook promises', () => {
    expect(CAPTURE_SHOTS).toHaveLength(6)
    expect(CAPTURE_SHOTS.map(shot => shot.title)).toEqual([
      'Today — the visit list',
      'Visit in progress — tasks, location and check-out',
      'Client record — care plan, risks, medication, body map',
      'Report an incident',
      'Chat — the care team',
      'Offline sync rail — actions waiting to send',
    ])
  })

  it('numbers the files so the store listing order is readable off the disk', () => {
    expect(CAPTURE_SHOTS.map(shot => shot.index)).toEqual([1, 2, 3, 4, 5, 6])
    for (const shot of CAPTURE_SHOTS) {
      expect(shot.id).toBe(`${String(shot.index).padStart(2, '0')}-${shot.id.slice(3)}`)
    }
    expect(new Set(CAPTURE_SHOTS.map(shot => shot.id)).size).toBe(6)
  })

  it('gives every shot a caption and enough dwell time for a screenshot', () => {
    for (const shot of CAPTURE_SHOTS) {
      expect(shot.storeCaption.length).toBeGreaterThan(20)
      expect(shot.dwellMs).toBeGreaterThanOrEqual(1000)
    }
  })

  it('only points at visits, people and channels that exist in the fixtures', () => {
    const visitIds = new Set<string>(captureVisits().map(visit => visit.id))
    const routes = captureRoutes()
    const channelIds = new Set<string>((routes['GET /chat/channels'] as { id: string }[]).map(channel => channel.id))
    const personIds = new Set<string>([CAPTURE_IDS.personEileen, CAPTURE_IDS.personPriya])

    for (const shot of CAPTURE_SHOTS) {
      const target = shot.target
      if (target.kind === 'visit') expect(visitIds.has(target.visitId)).toBe(true)
      if (target.kind === 'clientDetail') expect(personIds.has(target.personId)).toBe(true)
      if (target.kind === 'incident') expect(personIds.has(target.personId)).toBe(true)
      if (target.kind === 'chatChannel') expect(channelIds.has(target.channelId)).toBe(true)
    }
  })

  it('shows Today twice: once clean, and once with actions waiting to sync', () => {
    const today = CAPTURE_SHOTS.filter(shot => shot.target.kind === 'tab' && shot.target.tab === 'today')
    expect(today.map(shot => shot.scene)).toEqual(['default', 'offline-queue'])
  })

  it('puts the offline shot last, because it is the differentiator', () => {
    expect(CAPTURE_SHOTS[5].scene).toBe('offline-queue')
  })

  it('is addressable by id, so a single shot can be recaptured', () => {
    expect(captureShotById('05-chat')?.index).toBe(5)
    expect(captureShotById('99-nope')).toBeUndefined()
  })
})
