/**
 * Walks the app through the six store screenshots.
 *
 * The hook owns the timing and nothing else: it asks the app to navigate, waits
 * for the screen to settle, announces the shot so the host script can take the
 * picture, holds the screen for the shot's dwell time, and moves on. Because the
 * app announces *after* the screen has settled, the screenshot is never taken
 * half-rendered, and a run does not need a fixed guess at how long a screen
 * takes.
 *
 * Nothing here runs unless `EXPO_PUBLIC_CAPTURE_MODE=1` is set in a dev build.
 */
import { useEffect, useRef } from 'react'
import { isCaptureMode } from './mode'
import { CAPTURE_SHOTS, type CaptureScene, type CaptureTarget } from './shots'
import { announceDone, announceError, announceShot } from './signal'

/** How long a screen is given to finish its own requests before the shot. */
export const CAPTURE_SETTLE_MS = 1200

export interface CaptureTourOptions {
  /** False until the session exists and the day's visits have loaded. */
  ready: boolean
  onScene: (scene: CaptureScene) => void
  onTarget: (target: CaptureTarget) => void
  /** Overridable so the tour can be driven in a test without real timers. */
  sleep?: (ms: number) => Promise<void>
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useCaptureTour({ ready, onScene, onTarget, sleep = delay }: CaptureTourOptions): void {
  const started = useRef(false)

  useEffect(() => {
    if (!isCaptureMode() || started.current) return
    if (!ready) return
    started.current = true

    let cancelled = false
    ;(async () => {
      try {
        for (const shot of CAPTURE_SHOTS) {
          if (cancelled) return
          onScene(shot.scene)
          onTarget(shot.target)
          await sleep(CAPTURE_SETTLE_MS)
          if (cancelled) return
          await announceShot(shot)
          await sleep(shot.dwellMs)
        }
        if (!cancelled) await announceDone()
      } catch (error) {
        if (!cancelled) await announceError(error instanceof Error ? error.message : String(error))
      }
    })()

    return () => { cancelled = true }
  }, [ready, onScene, onTarget, sleep])
}
