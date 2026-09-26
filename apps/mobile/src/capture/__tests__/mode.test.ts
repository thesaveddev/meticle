/**
 * The gate itself. A store build must never be able to show invented data, so
 * the default — no environment variable, which is every build made without it —
 * has to be off, and the whole capture path compiles out.
 */
import { isCaptureMode, CAPTURE_MODE } from '../mode'

describe('capture mode gate', () => {
  it('is off in a build that did not ask for it', () => {
    expect(process.env.EXPO_PUBLIC_CAPTURE_MODE).toBeUndefined()
    expect(isCaptureMode()).toBe(false)
    expect(CAPTURE_MODE).toBe(false)
  })

  it('has a development-build check as well as the environment variable', () => {
    // Both conditions are required. __DEV__ is the one that protects a release
    // bundle, and it cannot be set by an environment variable at build time.
    expect(CAPTURE_MODE).toBe(__DEV__ && process.env.EXPO_PUBLIC_CAPTURE_MODE === '1')
  })
})
