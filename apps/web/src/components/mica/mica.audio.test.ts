import { describe, expect, it, vi } from 'vitest'
import { createMicaAudioChannel } from './mica.audio'

/**
 * The channel is the seam that keeps the microphone out of React, so what is
 * pinned here is the behaviour everything above it relies on: levels are always
 * a 0–1 number, a steady level is not a stream of writes, and a surface that
 * mounts mid-sentence starts from the level that is actually playing.
 */
describe('MicaAudioChannel', () => {
  it('clamps everything it publishes', () => {
    const audio = createMicaAudioChannel()
    const heard: number[] = []
    audio.subscribe(level => heard.push(level))

    audio.publish(5)
    audio.publish(-2)
    audio.publish(Number.NaN)
    audio.publish(Number.POSITIVE_INFINITY)
    audio.publish(0.42)

    expect(heard).toEqual([0, 1, 0, 1, 0.42])
    expect(audio.read()).toBe(0.42)
  })

  it('does not wake subscribers for a level that has not changed', () => {
    // The meter samples a steady tone sixty times a second. Passing it on sixty
    // times would be sixty style writes for no visible change.
    const audio = createMicaAudioChannel()
    const listener = vi.fn()
    audio.subscribe(listener)
    listener.mockClear()

    for (let i = 0; i < 30; i += 1) audio.publish(0.5)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('hands a new subscriber the current level, then only changes', () => {
    const audio = createMicaAudioChannel()
    audio.publish(0.75)

    const heard: number[] = []
    const unsubscribe = audio.subscribe(level => heard.push(level))
    expect(heard).toEqual([0.75])

    audio.publish(0.75)
    expect(heard).toEqual([0.75])

    audio.publish(0.2)
    expect(heard).toEqual([0.75, 0.2])

    // Unsubscribed for real: a stopped session's orb must not keep drawing.
    unsubscribe()
    audio.publish(0.9)
    expect(heard).toEqual([0.75, 0.2])
  })

  it('keeps sessions separate', () => {
    const first = createMicaAudioChannel()
    const second = createMicaAudioChannel()
    const firstHeard = vi.fn()
    const secondHeard = vi.fn()
    first.subscribe(firstHeard)
    second.subscribe(secondHeard)
    firstHeard.mockClear()
    secondHeard.mockClear()

    first.publish(0.6)

    expect(firstHeard).toHaveBeenCalledWith(0.6)
    expect(secondHeard).not.toHaveBeenCalled()
    expect(second.read()).toBe(0)
  })
})
