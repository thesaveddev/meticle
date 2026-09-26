/**
 * The capture fixtures have to answer every request the six screens make. A
 * gap does not throw — a screen that gets a 404 from an endpoint it has already
 * guarded with `.catch()` still renders, just emptier, so a missing fixture
 * shows up in the store listing as a blank panel rather than as an error. These
 * tests are the only thing standing between that and a published screenshot.
 */
import { CAPTURE_IDS, captureRoutes, CAPTURE_SESSION } from '../fixtures'
import { createCaptureFetch, createCaptureRouter, normalisePath } from '../router'

const EILEEN = CAPTURE_IDS.personEileen

/**
 * What the six store screens actually request. Every entry here corresponds to a
 * line in a screen's loader; a new screen in the shot list means a new entry.
 */
const REQUIRED_REQUESTS: [string, string][] = [
  // Boot: the app signs in, loads the day and fills the badges.
  ['GET', '/api/auth/me'],
  ['GET', '/api/homecare/my-visits?from=2026-09-26&to=2026-10-10'],
  ['GET', '/api/homecare/ride-share-requests'],
  ['GET', '/api/notifications/unread-count'],
  ['GET', '/api/chat/unread'],
  // Today, and the open-call card when the organisation is domiciliary.
  ['GET', '/api/shifts/open'],
  ['GET', '/api/shifts/my-claims'],
  // Visit in progress.
  ['GET', `/api/homecare/visits/${CAPTURE_IDS.visitInProgress}/tasks`],
  ['GET', '/api/homecare/settings/location-threshold'],
  ['GET', '/api/homecare/settings/require-photo'],
  // Client record.
  ['GET', `/api/people/${EILEEN}`],
  ['GET', `/api/people/${EILEEN}/assessments`],
  ['GET', `/api/people/${EILEEN}/timeline`],
  ['GET', `/api/people/${EILEEN}/daily-notes`],
  ['GET', `/api/people/${EILEEN}/wellbeing`],
  ['GET', `/api/people/${EILEEN}/documents`],
  ['GET', `/api/people/${EILEEN}/clinical-scores`],
  ['GET', `/api/people/${EILEEN}/capacity`],
  ['GET', `/api/people/${EILEEN}/care-pathways`],
  ['GET', `/api/people/${EILEEN}/communication-log`],
  ['GET', `/api/people/${EILEEN}/time-away`],
  ['GET', `/api/emedication/records?personId=${EILEEN}`],
  [`GET`, `/api/body-map/person/${EILEEN}/stats`],
  // Chat.
  ['GET', '/api/chat/ensure-general'],
  ['GET', '/api/chat/channels'],
  ['GET', `/api/chat/channels/${CAPTURE_IDS.channelCareTeam}/messages?limit=80`],
  [`GET`, `/api/chat/channels/${CAPTURE_IDS.channelCareTeam}/read-receipts`],
  [`GET`, `/api/chat/channels/${CAPTURE_IDS.channelCareTeam}/members`],
  ['GET', '/api/chat/org-members'],
]

describe('capture router', () => {
  it('answers every request the six store screens make', () => {
    const router = createCaptureRouter(captureRoutes())
    const unanswered = REQUIRED_REQUESTS
      .map(([method, path]) => ({ request: `${method} ${path}`, status: router.handle(method, `https://meticlecare.com${path}`).status }))
      .filter(entry => entry.status !== 200)
    expect(unanswered).toEqual([])
    expect(router.misses()).toEqual([])
  })

  it('serves a session that identifies a care worker in a real-looking organisation', () => {
    const router = createCaptureRouter(captureRoutes())
    const { body } = router.handle('GET', '/auth/me')
    expect(body).toEqual({ user: CAPTURE_SESSION.user, organization: CAPTURE_SESSION.organization })
    expect((body as any).user.role).toBe('CARE_WORKER')
  })

  it('ignores the query string, so the same screen asked for twice gets the same answer', () => {
    const router = createCaptureRouter(captureRoutes())
    const monday = router.handle('GET', '/homecare/my-visits?from=2026-09-28&to=2026-09-28')
    const friday = router.handle('GET', '/homecare/my-visits?from=2026-10-02&to=2026-10-09')
    expect(monday.body).toEqual(friday.body)
  })

  it('matches an id segment whatever the id is', () => {
    const router = createCaptureRouter(captureRoutes())
    expect(router.handle('GET', '/homecare/visits/some-other-visit/tasks').status).toBe(200)
  })

  it('prefers the longer path when two could match', () => {
    const router = createCaptureRouter(captureRoutes())
    const person = router.handle('GET', `/people/${EILEEN}`)
    const notes = router.handle('GET', `/people/${EILEEN}/daily-notes`)
    expect(Array.isArray(person.body)).toBe(false)
    expect(Array.isArray(notes.body)).toBe(true)
  })

  it('does not let a different method reach a fixture', () => {
    const router = createCaptureRouter(captureRoutes())
    expect(router.handle('POST', '/auth/me').status).toBe(404)
  })

  it('records what it could not answer instead of inventing an empty list', () => {
    const router = createCaptureRouter(captureRoutes())
    expect(router.handle('GET', '/homecare/something-new').status).toBe(404)
    expect(router.misses()).toEqual(['GET /homecare/something-new'])
  })

  it('drops the deployment prefix, so a fixture key does not change with the API base', () => {
    expect(normalisePath('https://meticlecare.com/api/auth/me?x=1')).toBe('/auth/me')
    expect(normalisePath('https://staging.example.test/api/homecare/my-visits')).toBe('/homecare/my-visits')
    expect(normalisePath('http://10.0.2.2:3000/api/people/abc')).toBe('/people/abc')
    expect(normalisePath('/people/abc')).toBe('/people/abc')
    const router = createCaptureRouter(captureRoutes())
    expect(router.handle('GET', 'http://10.0.2.2:3000/api/auth/me').status).toBe(200)
  })

  it('rejects a route that is not written as "METHOD /path"', () => {
    expect(() => createCaptureRouter({ 'homecare/my-visits': [] })).toThrow(/GET \/path/)
  })

  it('replaces fetch without touching the network', async () => {
    const router = createCaptureRouter(captureRoutes())
    const fakeFetch = createCaptureFetch(router)
    const response = await fakeFetch('https://meticlecare.com/api/homecare/my-visits?from=x')
    expect(response.status).toBe(200)
    expect((await response.json()).length).toBeGreaterThan(0)
    expect(router.misses()).toEqual([])
  })
})
