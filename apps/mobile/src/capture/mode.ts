/**
 * Store-screenshot capture mode.
 *
 * The store listing needs six screenshots of the real app, and re-shooting them
 * by hand after every rebuild is slow and not repeatable: each run lands on a
 * different time of day, a different client and a different sync state. Capture
 * mode makes that run deterministic. The app serves its own fixture data, skips
 * every permission prompt and every network call, and walks the six screens in
 * the order a reviewer reads them, announcing each one so the host script knows
 * when to take the picture.
 *
 * Two conditions must both hold, and they are deliberately independent of each
 * other:
 *
 * - `__DEV__` — a release bundle cannot enter capture mode at all, whatever the
 *   environment says. This is the guard that matters: a store build must never
 *   be able to show invented data.
 * - `EXPO_PUBLIC_CAPTURE_MODE=1` — Metro inlines this at bundle time, so a build
 *   made without it has no way to switch capture mode on.
 *
 * Neither of those removes the fixture *data* from a store bundle. Both are
 * runtime conditions, and a static import — or a `require` inside a function —
 * is a module-graph edge Metro follows regardless of whether the code can ever
 * run, so a release build still shipped every invented care record. It shipped
 * the AAB that started this: a client called Eileen, a care plan and a
 * medication list, present and unreachable.
 *
 * So the data never enters the graph in the first place. `metro.config.js`
 * resolves everything under `src/capture` to `release-stub.js` unless this flag
 * is `1`, which is keyed on the same variable so the two cannot disagree.
 * `npm run verify:no-fixtures` bundles the app the way a release does and fails
 * if any of it reappears. The claim here is tested, not asserted.
 *
 * See `docs/STORE_RELEASE_RUNBOOK.md` for how the host script drives this.
 */

export const CAPTURE_MODE = __DEV__ && process.env.EXPO_PUBLIC_CAPTURE_MODE === '1'

export function isCaptureMode(): boolean {
  return CAPTURE_MODE
}

/** The file the app writes and the host script polls to know what is on screen. */
export const CAPTURE_STEP_FILE = 'capture-step.json'

/** Marks the end of the tour, so the host script does not wait for a timeout. */
export const CAPTURE_DONE = 'done'
