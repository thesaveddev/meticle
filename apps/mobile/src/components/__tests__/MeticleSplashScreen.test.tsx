import React from 'react'
import { AccessibilityInfo } from 'react-native'
import { render, screen, waitFor } from '@testing-library/react-native'
import MeticleSplashScreen from '../MeticleSplashScreen'
import MeticleSplashBackground from '../MeticleSplashBackground'

// The splash is the branded continuation of the native launch screen: a centred,
// motionless logo over three independently drifting wave layers. These tests
// cover that composition and the reduced-motion path. They deliberately do not
// assert animation frames — the reanimated mock in jest.setup.ts is static, and
// motion belongs in a real-device check.
describe('MeticleSplashScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as any)
  })

  it('shows the MeticleCare logo over the wave background', () => {
    render(<MeticleSplashScreen />)

    expect(screen.getByTestId('splash-logo')).toBeTruthy()
    expect(screen.getByTestId('splash-background')).toBeTruthy()
  })

  it('renders all three wave layers, each carrying its own brand colour', () => {
    render(<MeticleSplashScreen />)

    const blue = screen.getByTestId('splash-layer-blue')
    const cyan = screen.getByTestId('splash-layer-cyan')
    const teal = screen.getByTestId('splash-layer-teal')

    expect(blue).toBeTruthy()
    expect(cyan).toBeTruthy()
    expect(teal).toBeTruthy()

    const flat = (node: any) => {
      const style = Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style.filter(Boolean))
        : node.props.style
      return style?.backgroundColor
    }
    expect(flat(blue)).toBe('#3B9FE8')
    expect(flat(cyan)).toBe('#39C5D9')
    expect(flat(teal)).toBe('#4FD9B1')
  })

  it('parks the layers instead of animating when reduce motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    render(<MeticleSplashBackground />)

    // The layers must still be present, just not moving.
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled())
    expect(screen.getByTestId('splash-layer-blue')).toBeTruthy()
    expect(screen.getByTestId('splash-layer-cyan')).toBeTruthy()
    expect(screen.getByTestId('splash-layer-teal')).toBeTruthy()
  })

  it('does not intercept touches, so it cannot block the app beneath', () => {
    render(<MeticleSplashScreen />)
    expect(screen.getByTestId('splash-background').props.pointerEvents).toBe('none')
  })
})
