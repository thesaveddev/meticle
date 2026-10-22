import React from 'react'
import { render } from '@testing-library/react-native'
import { MicaFace } from '../MicaFace'
import type { MicaOrbState } from '../../theme'

/**
 * The face speaks the web orb's language: a gradient core with bar eyes, orbit
 * rings and a travelling waveform while Mica is working, and a still danger
 * ring on error. There is no mouth — the state lives in the rings, the wave
 * and the ring, exactly where the web orb puts it — so these pin the face
 * itself (two bar eyes in every state) and whichChrome each state carries, so
 * a state with no signal of its own cannot slip back in.
 */
describe('MicaFace', () => {
  it.each(['idle', 'listening', 'thinking', 'responding', 'error'] as MicaOrbState[])(
    'shows two bar eyes in the %s state',
    (state) => {
      const screen = render(<MicaFace state={state} />)
      expect(screen.getByTestId('mica-face')).toBeTruthy()
      expect(screen.getByTestId('mica-core-eye-left')).toBeTruthy()
      expect(screen.getByTestId('mica-core-eye-right')).toBeTruthy()
    },
  )

  it('rests with a small orbit and no waveform, and never an error ring', () => {
    const idle = render(<MicaFace state="idle" />)
    expect(idle.getByTestId('mica-face-orbit')).toBeTruthy()
    expect(idle.queryByTestId('mica-face-waveform')).toBeNull()
    expect(idle.queryByTestId('mica-face-error-ring')).toBeNull()
  })

  it.each(['listening', 'thinking', 'responding'] as MicaOrbState[])(
    'works with an orbit and a travelling wave in the %s state, and no error ring',
    (state) => {
      const screen = render(<MicaFace state={state} />)
      expect(screen.getByTestId('mica-face-orbit')).toBeTruthy()
      expect(screen.getByTestId('mica-face-waveform')).toBeTruthy()
      expect(screen.queryByTestId('mica-face-error-ring')).toBeNull()
    },
  )

  it('fails still: the danger ring, and nothing to meter', () => {
    const error = render(<MicaFace state="error" />)
    expect(error.getByTestId('mica-face-error-ring')).toBeTruthy()
    expect(error.queryByTestId('mica-face-waveform')).toBeNull()
  })
})
