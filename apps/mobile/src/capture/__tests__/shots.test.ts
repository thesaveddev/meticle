/**
 * The shot list is the contract with the store listing: seven images, in this
 * order, showing these things. Renumbering the listing means editing
 * `src/capture/shots.ts`, and these tests fail if it stops being seven, stops
 * being ordered, or starts pointing at a fixture that no longer exists.
 */
import { CAPTURE_IDS, captureRoutes, captureVisits } from '../fixtures'
import { CAPTURE_SHOTS, LOGIN_SHOT, TOUR_SHOTS, captureShotById } from '../shots'

describe('capture shot list', () => {
  it('is the seven screenshots the runbook promises', () => {
    expect(CAPTURE_SHOTS).toHaveLength(7)
    expect(CAPTURE_SHOTS.map(shot => shot.title)).toEqual([
      'Sign in',
      'Today — the visit list',
      'Visit in progress — tasks, location and check-out',
      'Client record — care plan, risks, medication, body map',
      'Report an incident',
      'Chat — the care team',
      'Offline sync rail — actions waiting to send',
    ])
  })

  it('numbers the files so the store listing order is readable off the disk', () => {
    expect(CAPTURE_SHOTS.map(shot => shot.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const shot of CAPTURE_SHOTS) {
      expect(shot.id).toBe(`${String(shot.index).padStart(2, '0')}-${shot.id.slice(3)}`)
    }
    expect(new Set(CAPTURE_SHOTS.map(shot => shot.id)).size).toBe(7)
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
    expect(CAPTURE_SHOTS[6].scene).toBe('offline-queue')
    expect(CAPTURE_SHOTS[CAPTURE_SHOTS.length - 1].id).toBe('06-offline-sync')
  })

  it('is addressable by id, so a single shot can be recaptured', () => {
    expect(captureShotById('05-chat')?.index).toBe(5)
    expect(captureShotById('99-nope')).toBeUndefined()
  })

  // The login shot is the only one the tour does not drive, because capture
  // mode signs the app in before the tour starts. These assertions are what
  // stop that exception quietly becoming "the login shot shows a signed-in
  // app" — the exact defect that would make the listing's first image a lie.
  it('excludes the login shot from the tour', () => {
    expect(TOUR_SHOTS).toHaveLength(CAPTURE_SHOTS.length - 1)
    expect(TOUR_SHOTS.map(shot => shot.id)).not.toContain('00-login')
    expect(LOGIN_SHOT.id).toBe('00-login')
    expect(LOGIN_SHOT.target.kind).toBe('login')
  })

  it('puts the login shot first, because it is the first screen a user meets', () => {
    expect(CAPTURE_SHOTS[0].id).toBe('00-login')
  })
})
