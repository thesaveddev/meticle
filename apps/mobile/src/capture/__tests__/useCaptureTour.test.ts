/**
 * The tour is the thing that makes the screenshots repeatable, so it is worth
 * knowing it walks the six shots in order, sets up each shot's scene before
 * navigating to it, and only announces a shot once the screen has had time to
 * settle. The sleeps are injected, so this runs in milliseconds.
 */
import { renderHook, waitFor } from '@testing-library/react-native'
import { useCaptureTour } from '../useCaptureTour'
import { CAPTURE_SHOTS } from '../shots'
import { CAPTURE_IDS } from '../fixtures'

// The tour is inert unless a dev build was bundled with EXPO_PUBLIC_CAPTURE_MODE=1,
// so the gate is stood in for here rather than reaching for a real device build.
// The gate itself is asserted in mode.test.ts.
jest.mock('../mode', () => ({
  isCaptureMode: () => true,
  CAPTURE_MODE: true,
  CAPTURE_STEP_FILE: 'capture-step.json',
  CAPTURE_DONE: 'done',
}))

jest.mock('../signal', () => ({
  announceShot: jest.fn(async () => ({ state: 'shot' })),
  announceDone: jest.fn(async () => ({ state: 'done' })),
  announceError: jest.fn(async () => ({ state: 'error' })),
}))

const { announceShot, announceDone, announceError } = require('../signal')

const noSleep = async () => {}

function renderTour(ready = true) {
  const onScene = jest.fn()
  const onTarget = jest.fn()
  const view = renderHook(() => useCaptureTour({ ready, onScene, onTarget, sleep: noSleep }))
  return { ...view, onScene, onTarget }
}

describe('capture tour', () => {
  it('walks every shot in order and announces each one', async () => {
    const { onTarget } = renderTour()
    await waitFor(() => expect(announceDone).toHaveBeenCalledTimes(1))

    const announced = announceShot.mock.calls.map((call: any[]) => call[0].id)
    expect(announced).toEqual(CAPTURE_SHOTS.map(shot => shot.id))
    expect(onTarget).toHaveBeenCalledTimes(CAPTURE_SHOTS.length)
    expect(announceError).not.toHaveBeenCalled()
  })

  it('sets each shot\u2019s scene before navigating to it, so the offline rail is populated before the screenshot', async () => {
    const sequence: string[] = []
    const onScene = jest.fn((scene: string) => { sequence.push(`scene:${scene}`) })
    const onTarget = jest.fn((target: { kind: string }) => { sequence.push(`target:${target.kind}`) })
    renderHook(() => useCaptureTour({ ready: true, onScene, onTarget, sleep: noSleep }))
    await waitFor(() => expect(announceDone).toHaveBeenCalled())
    expect(sequence).toEqual([
      'scene:default', 'target:tab',
      'scene:default', 'target:visit',
      'scene:default', 'target:clientDetail',
      'scene:default', 'target:incident',
      'scene:default', 'target:chatChannel',
      'scene:offline-queue', 'target:tab',
    ])
  })

  it('asks for the screens the shot list names', async () => {
    const { onTarget } = renderTour()
    await waitFor(() => expect(announceDone).toHaveBeenCalled())
    expect(onTarget.mock.calls.map((call: any[]) => call[0])).toEqual([
      { kind: 'tab', tab: 'today' },
      { kind: 'visit', visitId: CAPTURE_IDS.visitInProgress },
      { kind: 'clientDetail', personId: CAPTURE_IDS.personEileen },
      { kind: 'incident', personId: CAPTURE_IDS.personEileen, visitId: CAPTURE_IDS.visitMorning },
      { kind: 'chatChannel', channelId: CAPTURE_IDS.channelCareTeam },
      { kind: 'tab', tab: 'today' },
    ])
  })

  it('waits for the app to be signed in and loaded before it starts', () => {
    renderTour(false)
    expect(announceShot).not.toHaveBeenCalled()
    expect(announceDone).not.toHaveBeenCalled()
  })

  it('reports a failure rather than leaving the host script waiting for a timeout', async () => {
    const onTarget = jest.fn(() => { throw new Error('no such visit') })
    renderHook(() => useCaptureTour({ ready: true, onScene: jest.fn(), onTarget, sleep: noSleep }))
    await waitFor(() => expect(announceError).toHaveBeenCalledWith('no such visit'))
    expect(announceDone).not.toHaveBeenCalled()
  })
})
