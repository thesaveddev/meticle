/**
 * The fixture-miss report is the only thing standing between a missing fixture
 * and a screenshot that looks fine but shows an empty panel.
 *
 * The chain has four links: the router records what it could not answer, the
 * capture handle carries the router, the tour reads the misses, and the final
 * `done` signal writes them out for the host script to print in the manifest.
 * Three of those links were written; the third never was, so `announceDone()`
 * was always called with no argument and the report was always empty. A run
 * would finish "successfully", write `fixtureMisses: []`, and the person
 * uploading the listing would never learn that a screen was half-blank.
 *
 * These tests hold the whole chain, so it cannot quietly come apart again.
 */
import { renderHook, waitFor } from '@testing-library/react-native'
import { useCaptureTour } from '../useCaptureTour'

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

const { announceDone, announceError } = require('../signal')

const noSleep = async () => {}

/** Render the tour with a fixed miss list, the way App.tsx will supply it. */
function renderTourWithMisses(misses: string[]) {
  renderHook(() =>
    useCaptureTour({
      ready: true,
      onScene: jest.fn(),
      onTarget: jest.fn(),
      sleep: noSleep,
      misses: () => misses,
    }),
  )
}

describe('fixture misses reach the host script', () => {
  it('writes the misses into the done signal rather than always reporting none', async () => {
    const misses = ['GET /homecare/my-visits', 'GET /people/cap-person-1/care-pathways']
    renderTourWithMisses(misses)
    await waitFor(() => expect(announceDone).toHaveBeenCalledTimes(1))
    expect(announceDone).toHaveBeenCalledWith(misses)
  })

  it('still reports an empty list when every fixture answered', async () => {
    renderTourWithMisses([])
    await waitFor(() => expect(announceDone).toHaveBeenCalledTimes(1))
    expect(announceDone).toHaveBeenCalledWith([])
  })

  it('reads the misses when the tour ends, not when it starts, so late requests count', async () => {
    const misses: string[] = []
    const missesNow = () => misses
    renderHook(() =>
      useCaptureTour({
        ready: true,
        onScene: jest.fn(),
        onTarget: jest.fn(),
        sleep: noSleep,
        misses: missesNow,
      }),
    )
    // A screen can ask for something only once it is on screen, after the tour
    // has already started, so reading the list early would under-report it.
    misses.push('GET /chat/channels/cap-channel-1/messages')
    await waitFor(() => expect(announceDone).toHaveBeenCalledTimes(1))
    expect(announceDone).toHaveBeenCalledWith(['GET /chat/channels/cap-channel-1/messages'])
  })

  it('does not announce a clean run after a failure', async () => {
    const onTarget = jest.fn(() => { throw new Error('no such visit') })
    renderHook(() =>
      useCaptureTour({
        ready: true,
        onScene: jest.fn(),
        onTarget,
        sleep: noSleep,
        misses: () => ['GET /whatever'],
      }),
    )
    await waitFor(() => expect(announceError).toHaveBeenCalledWith('no such visit'))
    expect(announceDone).not.toHaveBeenCalled()
  })
})
