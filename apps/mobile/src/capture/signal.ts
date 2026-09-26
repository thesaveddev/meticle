/**
 * The handshake between the app and the host capture script.
 *
 * The script cannot see into the app, so the app says what it is showing: after
 * each screen has finished rendering it writes one small JSON file, and the
 * script polls that file for the shot to photograph. This is why no tap
 * coordinates are involved anywhere — nothing has to know where a button is, or
 * stay correct after a layout change.
 *
 * The file lives in the app's documents directory, which is readable from the
 * host on both platforms for a debug build: `xcrun simctl get_app_container
 * booted <bundle-id> data` on iOS, `adb shell run-as <package> cat files/...` on
 * Android. A release build cannot get here — see `mode.ts`.
 */
import { File, Paths } from 'expo-file-system'
import { CAPTURE_STEP_FILE, CAPTURE_DONE } from './mode'

export type CaptureState = 'shot' | 'done' | 'error'

export interface CaptureSignal {
  state: CaptureState
  /** Monotonic counter, so a repeat of the same shot still registers as a change. */
  seq: number
  shot?: string
  index?: number
  title?: string
  /** Endpoints the fixtures did not answer. Non-empty means the set is incomplete. */
  misses?: string[]
  error?: string
}

let seq = 0

function stepFile(): File {
  return new File(Paths.document, CAPTURE_STEP_FILE)
}

export async function readCaptureSignal(): Promise<CaptureSignal | null> {
  try {
    const file = stepFile()
    if (!file.exists) return null
    return JSON.parse(await file.text()) as CaptureSignal
  } catch {
    return null
  }
}

async function write(payload: Omit<CaptureSignal, 'seq'>): Promise<CaptureSignal> {
  seq += 1
  const signal: CaptureSignal = { ...payload, seq }
  const file = stepFile()
  if (file.exists) file.delete()
  file.create()
  file.write(JSON.stringify(signal))
  return signal
}

export function announceShot(shot: { id: string; index: number; title: string }): Promise<CaptureSignal> {
  return write({ state: 'shot', shot: shot.id, index: shot.index, title: shot.title })
}

export function announceDone(misses: string[] = []): Promise<CaptureSignal> {
  return write({ state: 'done', misses })
}

export function announceError(error: string): Promise<CaptureSignal> {
  return write({ state: 'error', error })
}

export { CAPTURE_DONE }
