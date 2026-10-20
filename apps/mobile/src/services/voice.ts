import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import * as Speech from 'expo-speech'

/**
 * Mica's ears and voice on the phone.
 *
 * Speech recognition is the one phone capability that is not in Expo Go: the
 * native Swift/Kotlin only exists in dev and EAS builds (see the
 * `expo-speech-recognition` plugin in app.json). Every entry point here
 * degrades instead of throwing on a build without it, so a carer on an older
 * build gets a spoken reason rather than a crash — and the orb shows its error
 * state instead of hanging on listening.
 *
 * The screen owns the conversation; this module owns the peripherals:
 * permission, availability, one recognition run at a time, and reading replies
 * aloud. It never calls the API and never decides what was said.
 */

export interface VoiceTranscriptHandlers {
  /** Interim transcript while the carer is still speaking. */
  onPartial?: (text: string) => void
  /** Final transcript for the turn. Empty means silence, not a question. */
  onFinal?: (text: string) => void
  /**
   * A recognition failure. Fatal means asking again cannot help (permission
   * denied, recogniser unavailable); anything else is silence or a blip the
   * screen answers by listening again.
   */
  onSpeechError?: (message: string, fatal: boolean) => void
  /** Room level as 0–1, for the orb to breathe with while listening. */
  onVolume?: (level: number) => void
}

interface Subscription {
  remove: () => void
}

let subscriptions: Subscription[] = []
let listening = false

function clearSubscriptions() {
  for (const sub of subscriptions) {
    try { sub.remove() } catch { /* a half-torn-down recogniser owes nothing */ }
  }
  subscriptions = []
}

/**
 * Whether this build can recognise speech at all. False on Expo Go, on a
 * build raised before the plugin was added, and on a device with no
 * recogniser — all of which the screen answers the same way.
 */
export async function isVoiceInputSupported(): Promise<boolean> {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable() === true
  } catch {
    return false
  }
}

/** Asks for microphone + speech-recognition permission. True when granted. */
export async function requestVoicePermission(): Promise<boolean> {
  try {
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    return res?.granted === true
  } catch {
    return false
  }
}

/**
 * The `volumechange` event reports a float from -2 (inaudible) to 10 (loud).
 * The orb wants 0–1, so anything at or below silence reads as stillness and
 * the top of the range saturates rather than spiking past it.
 */
export function normaliseVolume(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, (value + 2) / 8))
}

function transcriptOf(event: unknown): string {
  const results = (event as { results?: Array<{ transcript?: unknown }> } | null)?.results
  const first = Array.isArray(results) ? results[0]?.transcript : undefined
  return typeof first === 'string' ? first : ''
}

/**
 * Opens the recogniser for one sentence in en-GB. Returns true when listening
 * actually started; false means the screen should say why instead of waiting
 * on a transcript that is never coming.
 *
 * Never two recognisers: a duplicate would double every transcript, so a
 * second start while one is running is refused rather than layered.
 */
export async function startListening(handlers: VoiceTranscriptHandlers): Promise<boolean> {
  if (listening) return false
  const addListener = (ExpoSpeechRecognitionModule as unknown as {
    addListener?: (event: string, fn: (e: unknown) => void) => Subscription
  }).addListener
  if (typeof addListener !== 'function') {
    handlers.onSpeechError?.('Voice input is not available in this build.', true)
    return false
  }
  try {
    subscriptions.push(
      addListener.call(ExpoSpeechRecognitionModule, 'result', (event: unknown) => {
        const text = transcriptOf(event).trim()
        const isFinal = (event as { isFinal?: unknown })?.isFinal === true
        if (isFinal) {
          listening = false
          handlers.onFinal?.(text)
        } else if (text) {
          handlers.onPartial?.(text)
        }
      }),
      addListener.call(ExpoSpeechRecognitionModule, 'volumechange', (event: unknown) => {
        handlers.onVolume?.(normaliseVolume((event as { value?: unknown })?.value))
      }),
      addListener.call(ExpoSpeechRecognitionModule, 'nomatch', () => {
        listening = false
        handlers.onFinal?.('')
      }),
      addListener.call(ExpoSpeechRecognitionModule, 'error', (event: unknown) => {
        const code = (event as { error?: unknown })?.error
        // Silence and cancellation are normal ends to a sentence-length listen,
        // not failures: the screen answers both by listening again.
        if (code === 'no-speech' || code === 'speech-timeout' || code === 'aborted') {
          listening = false
          handlers.onFinal?.('')
          return
        }
        listening = false
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          handlers.onSpeechError?.('Microphone permission denied. Mica cannot hear you until it is allowed in Settings.', true)
        } else if (code === 'network') {
          handlers.onSpeechError?.('Speech recognition needs a connection. Check yours and try again.', false)
        } else if (code === 'language-not-supported') {
          handlers.onSpeechError?.('This device cannot recognise speech in English.', true)
        } else {
          handlers.onSpeechError?.('Mica did not catch that. Try again.', false)
        }
      }),
    )
    await ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true, continuous: false })
    listening = true
    return true
  } catch {
    clearSubscriptions()
    listening = false
    handlers.onSpeechError?.('Voice input is not available in this build.', true)
    return false
  }
}

/** Ends the current listen and releases its listeners. Safe to call idle. */
export async function stopListening(): Promise<void> {
  clearSubscriptions()
  listening = false
  try {
    await ExpoSpeechRecognitionModule.stop()
  } catch {
    // Already stopped, or never started: there is nothing to end.
  }
}

export function isListening(): boolean {
  return listening
}

/**
 * Reads a reply aloud in en-GB. Fire-and-forget by design — the callbacks
 * report the ending, and `stopSpeaking` is the interruption — so a screen
 * never awaits a voice to continue its own state machine.
 */
export function speakReply(
  text: string,
  handlers?: { onDone?: () => void; onStopped?: () => void; onError?: () => void },
): void {
  const line = text.trim()
  if (!line) {
    handlers?.onDone?.()
    return
  }
  try {
    Speech.speak(line, {
      language: 'en-GB',
      onDone: handlers?.onDone,
      onStopped: handlers?.onStopped,
      onError: handlers?.onError,
    })
  } catch {
    handlers?.onError?.()
  }
}

/** Interrupts whatever is being read. Safe to call when nothing is speaking. */
export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop()
  } catch {
    // Nothing was speaking, or the voice stack is absent: either way it is quiet now.
  }
}
