/**
 * The orb's core is the web core's pixels: the 135° four-stop gradient, the
 * white bar eyes, and the inner energy wave while working. These pin the
 * structure the two platforms share, so a future restyle cannot silently drop
 * the wave or the gradient on one of them.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { MicaOrbCore } from '../MicaOrbCore'
import type { MicaOrbState } from '../../theme'

describe('MicaOrbCore', () => {
  it.each(['idle', 'listening', 'thinking', 'responding', 'error'] as MicaOrbState[])(
    'paints the gradient core with two bar eyes in the %s state',
    (state) => {
      const screen = render(<MicaOrbCore size={170} state={state} />)
      expect(screen.getByTestId('mica-core-gradient')).toBeTruthy()
      expect(screen.getByTestId('mica-core-eyes')).toBeTruthy()
      expect(screen.getByTestId('mica-core-eye-left')).toBeTruthy()
      expect(screen.getByTestId('mica-core-eye-right')).toBeTruthy()
    },
  )

  it('hides the inner energy wave at rest and shows it while working', () => {
    expect(render(<MicaOrbCore size={170} state="idle" />).queryByTestId('mica-core-wave')).toBeNull()
    for (const state of ['listening', 'thinking', 'responding', 'error'] as MicaOrbState[]) {
      expect(render(<MicaOrbCore size={170} state={state} />).getByTestId('mica-core-wave')).toBeTruthy()
    }
  })
})
