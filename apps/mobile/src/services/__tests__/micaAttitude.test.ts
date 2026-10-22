/**
 * Mica's attitude, pinned: three blink types with sane timings, glances that
 * look both ways, fillers that only ever touch read-only answers, and
 * backchannels that are caption text rather than speech.
 */
import {
  pickBackchannel,
  pickBlink,
  pickBlinkDelay,
  pickGlance,
  pickGlanceDelay,
  pickThinkingCaption,
  withAttitude,
} from '../micaAttitude'

/** A random source that returns the given values in order, then repeats. */
function fixed(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('pickBlink', () => {
  it('blinks single most of the time, double sometimes, sleepy rarely', () => {
    expect(pickBlink(fixed(0.1)).kind).toBe('single')
    expect(pickBlink(fixed(0.7)).kind).toBe('double')
    expect(pickBlink(fixed(0.95)).kind).toBe('sleepy')
  })

  it('keeps every blink inside a blink-length envelope', () => {
    for (const roll of [0.05, 0.3, 0.61, 0.63, 0.8, 0.85, 0.87, 0.99]) {
      const spec = pickBlink(fixed(roll, 0.5))
      expect(spec.closeMs).toBeGreaterThanOrEqual(60)
      expect(spec.shutMs + spec.closeMs + spec.openMs).toBeLessThan(700)
      expect(spec.scale).toBeGreaterThan(0)
      expect(spec.scale).toBeLessThanOrEqual(0.3)
    }
  })

  it('gives the double blink a pause between shuts and the others none', () => {
    expect(pickBlink(fixed(0.7, 0.5)).gapMs).toBeGreaterThan(0)
    expect(pickBlink(fixed(0.1, 0.5)).gapMs).toBe(0)
    expect(pickBlink(fixed(0.95, 0.5)).gapMs).toBe(0)
  })

  it('keeps blink intervals unlearnable: 2.2s to 5.6s', () => {
    expect(pickBlinkDelay(fixed(0))).toBe(2200)
    expect(pickBlinkDelay(fixed(0.9999))).toBeLessThanOrEqual(5600)
  })
})

describe('pickGlance', () => {
  it('looks both left and right', () => {
    expect(pickGlance(fixed(0.1, 0.5, 0.5, 0.5)).dxFraction).toBeLessThan(0)
    expect(pickGlance(fixed(0.9, 0.5, 0.5, 0.5)).dxFraction).toBeGreaterThan(0)
  })

  it('keeps the drift small: a glance, not a stare', () => {
    for (const first of [0.1, 0.9]) {
      const glance = pickGlance(fixed(first, 0.99, 0.5, 0.5, 0.5))
      expect(Math.abs(glance.dxFraction)).toBeLessThanOrEqual(0.1)
      expect(Math.abs(glance.dxFraction)).toBeGreaterThanOrEqual(0.05)
      expect(glance.outMs + glance.holdMs + glance.backMs).toBeLessThan(1600)
    }
  })

  it('spaces glances wider than blinks: 6s to 14s', () => {
    expect(pickGlanceDelay(fixed(0))).toBe(6000)
    expect(pickGlanceDelay(fixed(0.9999))).toBeLessThanOrEqual(14000)
  })
})

describe('withAttitude', () => {
  it('sometimes opens a long answer with a soft filler', () => {
    const line = 'Nia, Sam and Priya are on shift today, with cover until late.'
    // rand() < 0.22 takes the filler branch; the second draw picks the opener.
    expect(withAttitude(line, 'answer', fixed(0.1, 0.1))).toBe(`Mm, ${line}`)
    expect(withAttitude(line, 'answer', fixed(0.1, 0.9))).toBe(`Uh — ${line}`)
    // Usually, the line is untouched.
    expect(withAttitude(line, 'answer', fixed(0.9))).toBe(line)
  })

  it('never touches short answers', () => {
    expect(withAttitude('Opening the rota.', 'answer', fixed(0.01, 0.01))).toBe('Opening the rota.')
  })

  it.each(['approval', 'saved', 'offer', 'navigate', 'farewell', 'error'] as const)(
    'never touches a %s line, however long',
    (kind) => {
      const line = 'A very long line that would certainly earn a filler were it an answer to a question.'
      expect(withAttitude(line, kind, fixed(0.01, 0.01))).toBe(line)
    },
  )
})

describe('captions', () => {
  it('thinks quietly most of the time, and aloud sometimes', () => {
    expect(pickThinkingCaption(fixed(0.1))).toBe('Thinking…')
    expect(['Uh, let me check…', 'Mm, one sec…']).toContain(pickThinkingCaption(fixed(0.8, 0.1)))
  })

  it('backchannels from a fixed vocabulary', () => {
    expect(['uh-huh…', 'mm…', 'go on…']).toContain(pickBackchannel(fixed(0.5)))
  })
})
