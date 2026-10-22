/**
 * Mica's attitude: the small human things that make the orb feel alive.
 *
 * Two halves, deliberately split by testability:
 *
 *   - The *pickers* below are pure: given a random source they return a blink,
 *     a glance, a filler line or a caption. Tests drive them with fixed
 *     sources, so "Mica blinks three ways" is proved rather than asserted.
 *   - The *scheduling* (when the next blink fires) lives in `MicaOrbCore`,
 *     which owns the shared values, and the *speaking* lives in
 *     `MicaHomeScreen`, which owns the caption and the TTS line.
 *
 * ## What "attitude" means here
 *
 *   - **Fillers in speech.** One read-only answer in a handful opens with a
 *     soft "Mm," or "Uh —", the way a person gathers a thought. Writes,
 *     confirmations, navigation, farewells and errors are never touched: a
 *     "Saved." with a stutter would read as uncertainty about the save.
 *   - **Backchannels while listening.** A caption-only "uh-huh…" or "mm…"
 *     after several seconds of continuous speech. Caption only, never spoken —
 *     Mica talking over the carer would be rude, and the transcript the turn
 *     dispatches on is untouched.
 *   - **Three blinks, not one.** A quick single shut most of the time,
 *     an occasional double, and a rare slow sleepy lid. Random intervals, so
 *     the rhythm cannot be learned.
 *   - **Glances.** Every few seconds the gaze drifts left or right and comes
 *     back, a little further and a little longer each — never while the user
 *     asked for reduced motion, which parks everything.
 */

export type BlinkKind = 'single' | 'double' | 'sleepy'

export interface BlinkSpec {
  kind: BlinkKind
  /** ms to close the lid. */
  closeMs: number
  /** ms held shut. */
  shutMs: number
  /** ms to reopen. */
  openMs: number
  /** double blink only: ms open between the two shuts. */
  gapMs: number
  /** scaleY at full shut: 0.06 is a blink, 0.3 is a drowsy lid. */
  scale: number
}

export function pickBlink(rand: () => number = Math.random): BlinkSpec {
  const roll = rand()
  if (roll < 0.62) {
    // The everyday blink: shut for ~90ms every few seconds.
    return { kind: 'single', closeMs: 80, shutMs: 70 + Math.floor(rand() * 40), openMs: 140, gapMs: 0, scale: 0.08 }
  }
  if (roll < 0.86) {
    // The "did you say…?" double-take: two quick shuts with a breath between.
    return { kind: 'double', closeMs: 70, shutMs: 60, openMs: 110, gapMs: 130 + Math.floor(rand() * 90), scale: 0.08 }
  }
  // The rare sleepy lid: slower, and never fully shut.
  return { kind: 'sleepy', closeMs: 190, shutMs: 170 + Math.floor(rand() * 120), openMs: 260, gapMs: 0, scale: 0.3 }
}

/** ms until the next blink: 2.2s–5.6s, so the rhythm cannot be learned. */
export function pickBlinkDelay(rand: () => number = Math.random): number {
  return 2200 + Math.floor(rand() * 3400)
}

export interface GlanceSpec {
  /** fraction of the orb size to drift, signed: negative looks left. */
  dxFraction: number
  /** ms to drift out. */
  outMs: number
  /** ms held off-centre. */
  holdMs: number
  /** ms to return. */
  backMs: number
}

export function pickGlance(rand: () => number = Math.random): GlanceSpec {
  const direction = rand() < 0.5 ? -1 : 1
  return {
    dxFraction: direction * (0.05 + rand() * 0.05),
    outMs: 220 + Math.floor(rand() * 90),
    holdMs: 350 + Math.floor(rand() * 400),
    backMs: 280 + Math.floor(rand() * 110),
  }
}

/** ms until the next glance: 6s–14s, rarer than a blink. */
export function pickGlanceDelay(rand: () => number = Math.random): number {
  return 6000 + Math.floor(rand() * 8000)
}

/** What Mica may say aloud that is not the answer itself. */
export type MicaLineKind =
  | 'answer'
  | 'approval'
  | 'saved'
  | 'offer'
  | 'navigate'
  | 'farewell'
  | 'error'

const FILLER_OPENERS = ['Mm, ', 'Uh — '] as const

/**
 * Gives a spoken line its attitude, or leaves it alone.
 *
 * Only a read-only *answer* long enough to breathe in ever gains an opener,
 * and only about one time in five — everything else (a save, an offer, a
 * navigation, a farewell, an error, a draft approval) is spoken exactly as
 * composed, because a stutter there would read as doubt about the outcome.
 */
export function withAttitude(line: string, kind: MicaLineKind, rand: () => number = Math.random): string {
  if (kind !== 'answer') return line
  if (line.trim().length < 24) return line
  if (rand() >= 0.22) return line
  return `${FILLER_OPENERS[Math.floor(rand() * FILLER_OPENERS.length)]}${line}`
}

const THINKING_CAPTIONS = ['Thinking…', 'Uh, let me check…', 'Mm, one sec…'] as const

/** The caption while Mica works: usually quiet, sometimes thinking aloud. */
export function pickThinkingCaption(rand: () => number = Math.random): string {
  if (rand() < 0.55) return THINKING_CAPTIONS[0]
  return THINKING_CAPTIONS[1 + Math.floor(rand() * (THINKING_CAPTIONS.length - 1))]
}

const LISTEN_BACKCHANNELS = ['uh-huh…', 'mm…', 'go on…'] as const

/**
 * A caption-only murmur appended to a long partial transcript ("… — mm…").
 * Never spoken and never part of the dispatched transcript: it is the orb
 * nodding along, not an interruption.
 */
export function pickBackchannel(rand: () => number = Math.random): string {
  return LISTEN_BACKCHANNELS[Math.floor(rand() * LISTEN_BACKCHANNELS.length)]
}
