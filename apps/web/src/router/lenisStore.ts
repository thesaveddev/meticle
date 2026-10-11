import type Lenis from 'lenis'

let instance: Lenis | null = null
const listeners = new Set<(lenis: Lenis | null) => void>()

export function setLenisInstance(next: Lenis | null) {
  instance = next
  for (const l of listeners) l(next)
}

export function getLenisInstance() {
  return instance
}

/**
 * Subscribe to the Lenis instance (or its absence). Returns an unsubscribe fn.
 * The callback is invoked immediately with the current state, then whenever the
 * instance is set or cleared (e.g. StrictMode remount).
 */
export function onLenisInstance(cb: (lenis: Lenis | null) => void) {
  listeners.add(cb)
  cb(instance)
  return () => listeners.delete(cb)
}
