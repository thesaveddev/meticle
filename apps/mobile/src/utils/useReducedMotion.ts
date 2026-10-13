import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Does the device ask for motion to be kept to a minimum?
 *
 * One implementation for every animated surface (the launch splash and the Mica
 * orb both use it). It reads the setting — not just the getter's promise, but
 * the change event, so a user who turns Reduce Motion on while the app is open
 * does not have to restart it — and it gives up quietly rather than crashing on
 * a platform where the API is missing.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let cancelled = false

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!cancelled) setReduced(enabled)
      })
      .catch(() => {})

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      cancelled = true
      subscription?.remove?.()
    }
  }, [])

  return reduced
}
