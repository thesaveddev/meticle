/**
 * The store version counters.
 *
 * Both stores reject an upload whose build number has not increased, and they
 * reject it at upload time — after the listing is filled in and, for iOS, after
 * the review queue. `ios.buildNumber` and `android.versionCode` are two
 * separate keys with nothing in the toolchain holding them together, so a bump
 * that moves one and not the other is invisible until it costs a release.
 * `scripts/bump-store-version.mjs` moves both; this asserts they are actually in
 * step, so a hand-edit cannot quietly break the pairing.
 */
import appJson from '../../app.json'

const expo = (appJson as any).expo

describe('store version counters', () => {
  it('keeps the iOS build number and Android version code in step', () => {
    expect(expo.ios.buildNumber).toBe(String(expo.android.versionCode))
  })

  it('uses the integer forms both stores require', () => {
    // A build number of "1.0" or a version code of "1" is rejected or ignored
    // depending on the store, which is a confusing failure either way.
    expect(expo.ios.buildNumber).toMatch(/^\d+$/)
    expect(expo.android.versionCode).toBe(Number.isInteger(expo.android.versionCode) ? expo.android.versionCode : null)
    expect(Number(expo.ios.buildNumber)).toBeGreaterThan(0)
    expect(expo.android.versionCode).toBeGreaterThan(0)
  })

  it('has a user-facing release version in semver form', () => {
    expect(expo.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('still points at production, so a store build talks to the real API', () => {
    expect(expo.extra.apiBaseUrl).toBe('https://meticlecare.com/api')
  })
})
