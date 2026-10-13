/**
 * Mica's amplitude channel — the seam that keeps the microphone out of React.
 *
 * ## Why this exists
 *
 * The microphone meter samples the analyser every animation frame, and its
 * level is the only thing on screen that changes that often. Publishing it as
 * React state made it React's problem: ~60 state updates a second, each one
 * re-rendering every consumer of the session — the full-screen overlay, the
 * minimised bar, the orb — for a value that only ever reaches a `transform`.
 * Measured in `mica.renderBudget.test.tsx`: 42 commits and 2339ms of render
 * work across 30 audio frames.
 *
 * So the level is published here instead, to whoever is drawing it, and React
 * is never told about it. The orb subscribes once and writes the value into a
 * motion value; no component re-renders because the room got louder.
 *
 * The channel is created per session (`useMica` owns one) rather than being a
 * module singleton, so two mounts of the shell in a test — or a signed-out and
 * a signed-in shell — cannot leak levels into each other. Identical values are
 * dropped: a steady tone is not 60 writes, and neither is silence.
 */
export interface MicaAudioChannel {
  /** Publish a 0–1 amplitude. Values outside the range are clamped, not thrown. */
  publish(level: number): void
  /** The last published level, for a subscriber that needs it synchronously. */
  read(): number
  /**
   * Observe the amplitude. The listener is called immediately with the current
   * level — a surface that mounts mid-sentence must not start from silence —
   * and the returned function unsubscribes.
   */
  subscribe(listener: (level: number) => void): () => void
}

/**
 * A level is always a 0–1 number. A broken sample (`NaN`) reads as silence, and
 * an out-of-range one is clamped rather than discarded — a meter that spikes past
 * 1 is loud, not invalid.
 */
const clamp01 = (value: number) => (Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value)))

export function createMicaAudioChannel(): MicaAudioChannel {
  let current = 0
  const listeners = new Set<(level: number) => void>()

  return {
    publish(level: number) {
      const next = clamp01(level)
      if (next === current) return
      current = next
      for (const listener of listeners) listener(next)
    },
    read() {
      return current
    },
    subscribe(listener: (level: number) => void) {
      listeners.add(listener)
      listener(current)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
