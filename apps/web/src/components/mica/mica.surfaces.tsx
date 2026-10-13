import { lazy } from 'react'

/**
 * The two surfaces that are *not* the orb, loaded on demand.
 *
 * ## Why they are not in the shell
 *
 * The orb has to be on screen as soon as the shell is, so it is imported by the
 * shell. The overlay and the minimised bar are not: they exist only while a
 * session is live, which is a moment the user creates by pressing the orb. They
 * were nevertheless imported by `MicaProvider`, so every page in the product
 * parsed and evaluated the whole assistant — modal, transcript, destination chip,
 * bar, and the animation library they use for their entrances — before the orb
 * could paint. Splitting them out is most of the win in "the orb takes too long
 * to appear": the entry chunk stopped carrying them at all.
 *
 * ## Why the prefetch exists
 *
 * A split that is fetched at the moment it is needed can *add* latency, which is
 * the one thing this work is trying to remove. So the entry points warm the chunk
 * on intent — pointer down, focus, or hover on the orb — while the microphone
 * permission probe and the recogniser are already taking longer than the fetch.
 * By the time a session is live the surfaces are in memory. The call is
 * idempotent: the bundler caches the module, so later calls are free.
 */
export const MicaOverlaySurface = lazy(() => import('./MicaOverlay'))
export const MicaMiniBarSurface = lazy(() => import('./MicaMiniBar'))

export function preloadMicaSurfaces(): void {
  void import('./MicaOverlay')
  void import('./MicaMiniBar')
}
