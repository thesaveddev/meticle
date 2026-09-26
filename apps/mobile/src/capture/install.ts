/**
 * Turning capture mode on.
 *
 * Two things happen here, and both are deliberately small so that the app needs
 * no capture-specific boot path: the session is written where the app already
 * looks for it, and `fetch` is replaced. After that the app signs itself in, loads
 * the day's visits, refreshes the badges and opens the six screens through exactly
 * the code a real launch runs — which is the only way these screenshots can be
 * trusted to be screenshots of the app.
 */
import { writeSession } from '../services/storage'
import type { AuthSession, OfflineVisitAction } from '../types'
import { buildCaptureFixtures, captureQueue, captureVisits } from './fixtures'
import { createCaptureFetch, createCaptureRouter, type CaptureRouter } from './router'

export interface CaptureHandle {
  session: AuthSession
  router: CaptureRouter
}

export async function installCaptureMode(now: Date = new Date()): Promise<CaptureHandle> {
  const fixtures = buildCaptureFixtures(now)
  const router = createCaptureRouter(fixtures.routes)
  global.fetch = createCaptureFetch(router)
  await writeSession(fixtures.session)
  return { session: fixtures.session, router }
}

/** The day's visits, for a caller that needs them before the tour starts. */
export function captureVisitsFor(now: Date = new Date()) {
  return captureVisits(now)
}

/** The unsynced actions the offline screenshot is taken with. */
export function captureQueueFor(now: Date = new Date()): OfflineVisitAction[] {
  return captureQueue(now)
}
