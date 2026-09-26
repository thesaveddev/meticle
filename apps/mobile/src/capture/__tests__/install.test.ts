/**
 * `captureMisses` is the link between the router and the host script's warning.
 *
 * A test of the tour alone would pass even if `installCaptureMode` never kept
 * hold of the router, because the tour just calls whatever function it is
 * given. These tests use the real fixtures and the real router, so they fail if
 * the handle is dropped again — which is exactly how the warning died the first
 * time.
 */
import { installCaptureMode, captureMisses } from '../install'
import { createCaptureRouter } from '../router'
import { captureRoutes } from '../fixtures'

// The session write is the only thing here that touches the device, and it is
// not what is under test. `mock` is the prefix jest allows its hoisted factory
// to close over.
const mockWriteSession = jest.fn(async (_session: unknown) => {})
jest.mock('../../services/storage', () => ({ writeSession: (session: unknown) => mockWriteSession(session) }))

describe('captureMisses', () => {
  it('reports nothing when every fixture answered', async () => {
    const { router } = await installCaptureMode(new Date('2026-09-26T09:00:00.000Z'))
    // Touch every endpoint the shot list needs, the way the tour does.
    router.handle('GET', '/auth/me')
    router.handle('GET', '/homecare/my-visits')
    expect(captureMisses()).toEqual([])
  })

  it('reports an endpoint the fixtures do not answer', async () => {
    const { router } = await installCaptureMode(new Date('2026-09-26T09:00:00.000Z'))
    router.handle('GET', '/homecare/visits/cap-visit-1/tasks')
    router.handle('GET', '/homecare/a-brand-new-endpoint')
    expect(captureMisses()).toEqual(['GET /homecare/a-brand-new-endpoint'])
  })

  it('is the same router the app fetches through, so misses cannot diverge from what was asked', async () => {
    await installCaptureMode(new Date('2026-09-26T09:00:00.000Z'))
    const before = global.fetch
    const response = await global.fetch('https://meticlecare.com/api/homecare/not-a-real-endpoint')
    expect(response.status).toBe(404)
    expect(captureMisses()).toEqual(['GET /homecare/not-a-real-endpoint'])
    global.fetch = before
  })

  it('lists each miss once however many times the screen asks for it', async () => {
    const router = createCaptureRouter(captureRoutes())
    router.handle('GET', '/nope')
    router.handle('GET', '/nope')
    router.handle('GET', '/nope')
    expect(router.misses()).toEqual(['GET /nope'])
  })
})
