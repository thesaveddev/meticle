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
import { LogBox } from 'react-native'
import { writeSession } from '../services/storage'
import type { AuthSession, OfflineVisitAction } from '../types'
import { buildCaptureFixtures, captureQueue, captureVisits } from './fixtures'
import { createCaptureFetch, createCaptureRouter, type CaptureRouter } from './router'

export interface CaptureHandle {
  session: AuthSession
  router: CaptureRouter
}

let activeRouter: CaptureRouter | null = null

/**
 * The endpoints the fixtures could not answer, so far.
 *
 * The router is created once, here, and the rest of the app only ever sees the
 * `fetch` it produced. That makes the router easy to lose: it was returned from
 * `installCaptureMode` and then dropped on the floor at the call site, which
 * left nothing able to report a missing fixture — and a missing fixture shows up
 * as a plausible-looking screenshot with an empty panel on it, not as an error.
 * Keeping the handle here means the report does not depend on the caller doing
 * the right thing with a return value.
 */
export function captureMisses(): string[] {
  return activeRouter ? activeRouter.misses() : []
}

export async function installCaptureMode(now: Date = new Date()): Promise<CaptureHandle> {
  const fixtures = buildCaptureFixtures(now)
  const router = createCaptureRouter(fixtures.routes)
  activeRouter = router
  global.fetch = createCaptureFetch(router)
  suppressDevChrome()
  await writeSession(fixtures.session)
  return { session: fixtures.session, router }
}

/**
 * Hide the development-only overlays before a screenshot is taken.
 *
 * A capture build is a development build, so React Native's LogBox toasts sit on
 * top of the app. That chrome does not exist in a store build, so a screenshot
 * showing it misrepresents the product — and it covers exactly the content the
 * shot exists to show. One run produced seven perfectly Play-compliant images
 * with a red error toast across the bottom of every one of them.
 *
 * `LogBox.ignoreAllLogs()` is deliberate rather than a workaround: the warnings
 * it hides are still reported to Metro's log and still surface in the normal
 * development workflow. Only the on-screen toast is suppressed, and only here,
 * which is reachable solely from `isCaptureMode()` — that is `__DEV__` *and*
 * `EXPO_PUBLIC_CAPTURE_MODE=1`, so a release bundle cannot run this at all.
 *
 * The dev client's floating menu button is dismissed separately, by hand, because
 * `expo-dev-menu` is not a declared dependency of this app and importing it here
 * would reach into a package this project does not own.
 */
function suppressDevChrome(): void {
  try {
    LogBox.ignoreAllLogs(true)
  } catch {
    // A missing dev overlay must never stop the capture itself.
  }
}

/** The day's visits, for a caller that needs them before the tour starts. */
export function captureVisitsFor(now: Date = new Date()) {
  return captureVisits(now)
}

/** The unsynced actions the offline screenshot is taken with. */
export function captureQueueFor(now: Date = new Date()): OfflineVisitAction[] {
  return captureQueue(now)
}
