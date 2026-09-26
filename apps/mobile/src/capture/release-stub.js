/**
 * What the app gets instead of capture mode when no capture build is requested.
 *
 * `metro.config.js` points every import under `src/capture` here, so the real
 * modules — and the invented care records inside `fixtures.ts` — are never part
 * of the module graph. A static import and a `require` inside a function are
 * both graph edges Metro always follows, so the only reliable way to keep the
 * data out of a store binary is to stop resolving it. This is that stopping
 * point; the alternative is shipping roughly 26 KB of fake client names, care
 * plans and medication in a care app, which reads badly in a store review or a
 * security questionnaire even though nothing can execute it.
 *
 * Every export is inert. `isCaptureMode()` is `false`, so each call site already
 * skips its capture branch, and the remaining functions are unreachable. They
 * are still defined so the app's imports resolve and so that a mistake here
 * fails as a no-op rather than as a crash in production.
 *
 * `verify-no-fixtures-in-bundle` asserts the substitution actually happened.
 */
const noCapture = false

/** Capture mode is off in every build that uses this stub. */
export function isCaptureMode() {
  return noCapture
}

/** Never called, because `isCaptureMode()` is false. */
export async function installCaptureMode() {
  return null
}

export function captureQueueFor() {
  return []
}

export function captureMisses() {
  return []
}

export const CAPTURE_INCIDENT_DRAFT = undefined

/** A no-op that still obeys the rules of hooks: it takes no state of its own. */
export function useCaptureTour() {}
