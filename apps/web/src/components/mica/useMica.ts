import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../services/api'
import { MICA_STOP_PHRASES, type MicaState } from './mica.identity'

/** Re-exported so existing importers keep working; the union lives in one place. */
export type { MicaState }

export interface MicaPerson {
  id: string
  name: string
}

/** A page Mica has opened on the user's behalf, as returned by the API. */
export interface MicaNavigateTarget {
  /** Route to push, query string included. */
  path: string
  /** What to say and show about the destination, e.g. "Evan Turner's March MAR chart". */
  label: string
  /** The person the destination is about, when the server resolved one. */
  person?: MicaPerson
}

const PERSON_STORAGE_KEY = 'mica.selectedPerson'
/**
 * Follow-up memory handle. The server issues an opaque sessionId on each
 * answered question; we echo it back on the next ask so "what about
 * tomorrow?" resolves against "who is on shift today?". Persisted per tab
 * session (not localStorage — conversation memory should not outlive the
 * browser session on a shared device), and invalidated whenever Mica's
 * subject person changes, since a new person starts a new topic.
 */
const micaSessionIdRef: { current: string | null } = { current: null }

/** How the words reached Mica. Voice is the only entry point the overlay has. */
export type MicaSource = 'voice' | 'text' | 'manual'

/**
 * Detects Mica write-action intents (task/appointment) in a sentence.
 *
 * Training-expiry phrasing is an implicit task intent: "Aisha's medication
 * training expires next month" — no "task" or "remind me" word is said, but
 * the natural response is a follow-up task so the renewal gets booked. The
 * extracted names/pre-phrase go into the draft as prefilled input; the
 * CREATE_TASK gateway still resolves the assignee and asks for
 * clarification when ambiguous, and nothing persists until the user taps
 * the review card — the draft-then-confirm contract is unchanged.
 *
 * Pure, so the routing it drives is testable without a recogniser.
 */
export interface MicaActionIntent {
  action: 'CREATE_TASK' | 'CREATE_APPOINTMENT'
  utterance: string
  prefill?: Record<string, unknown>
}

export function extractExpiringSubject(text: string): { name?: string; what?: string } {
  const owner = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\b/)
  const words = text.toLowerCase()
  const knownModules = ['medication', 'manual handling', 'safeguarding', 'fire', 'infection', 'first aid', 'dbs', 'moving and handling', 'food hygiene']
  const what = knownModules.find(m => words.includes(m))
  return { name: owner?.[1], what }
}

export function detectMicaActionIntent(text: string, source: MicaSource = 'voice'): MicaActionIntent | null {
  if (/\b(create|add|make|set|remind me (about|to)|schedule|book|arrange)\b/i.test(text) && /\b(task|reminder|to-do|todo)\b/i.test(text)) {
    return { action: 'CREATE_TASK', utterance: text }
  }
  if (/\b(book|schedule|arrange|add)\b/i.test(text) && /\b(appointment|visit|clinic|check-?up|review)\b/i.test(text)) {
    return { action: 'CREATE_APPOINTMENT', utterance: text }
  }
  // Training-expiry → expiring task, e.g. "Tom's manual handling expires soon".
  const expiry = /\b(training|certificate|certification)\b/i.test(text) && /\b(expir\w+|runs? out|needs? renew\w*|due for renewal|renew\w*)\b/i.test(text)
  if (expiry) {
    const subject = extractExpiringSubject(text)
    return {
      action: 'CREATE_TASK',
      utterance: text,
      prefill: {
        title: subject ? `${subject.name}'s ${subject.what} renewal` : 'Training renewal follow-up',
        description: `Detected from: "${text}"`,
        ...(subject?.name ? { assigneeName: subject.name } : {}),
        priority: 'medium',
        source,
      },
    }
  }
  return null
}

/**
 * Does this utterance ask to be taken somewhere?
 *
 * The server owns the authoritative parse (`mica.navigation.ts`) and returns the
 * resolved route; this only decides *which endpoint* the utterance goes to.
 * Anything with a navigation verb at the front, or the possessive-chart shape
 * ("Evan Turner's MAR chart"), is a destination request rather than a care
 * note, so it must reach the ask endpoint — the one that can navigate — instead
 * of falling through to the care-note path and being drafted as a note about
 * whoever happened to be in Mica's memory.
 */
export function looksLikeNavigationIntent(text: string): boolean {
  const raw = text.trim()
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?'s\b[^.]*\b(?:mar[\s-]?charts?|marchart|medications?[\s-]?charts?)\b/i.test(raw)) return true
  return /^(open|show|take me to|go to|navigate|pull up|bring up|jump to|display|view|give me|let me see|i want to see|i need to see)\b/i.test(raw)
}

/**
 * The words that answer Mica's own question — "want me to open the rota planner?"
 * — mirrored from `AFFIRMATIVE` in the server's `mica.facts.ts`.
 *
 * The mirroring is deliberate and is the same split `looksLikeNavigationIntent`
 * already makes: the server owns the authoritative parse and the page it offered,
 * and this only decides *which endpoint* the word goes to. It has to, because the
 * routing table below would otherwise send a bare "yes" to the care-note path and
 * draft a note about nobody — the failure this prevents.
 *
 * Matched whole-utterance, like the stop phrases: "yes, but what about tomorrow"
 * is a new question, and a carer who says it must not be pulled onto the rota
 * mid-sentence. "no" is absent on purpose — declining is not a confirmation.
 */
const MICA_CONFIRMATIONS: readonly string[] = [
  'yes', 'yeah', 'yep', 'yup', 'aye',
  'ok', 'okay', 'sure', 'alright', 'all right',
  'go on', 'go ahead', 'go for it', 'please do', 'do it', 'open it', 'show me',
  'sounds good', 'great',
]

/**
 * Is this the answer to the page Mica just offered? Only meaningful alongside an
 * outstanding offer — see `offeredPageRef` — because a bare "yes" with nothing
 * waiting is not a request to go anywhere.
 */
export function looksLikeConfirmation(text: string): boolean {
  const normalised = text
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalised) return false
  return MICA_CONFIRMATIONS.includes(normalised.replace(/\s+(?:please|thanks|thank you)$/, ''))
}

/**
 * A phrase that ends the conversation, matched against the whole utterance.
 *
 * The whole-utterance rule is the safety property — see MICA_STOP_PHRASES. A
 * sentence that merely contains a stop word ("close the incident") keeps the
 * session alive.
 */
export function isStopUtterance(text: string): boolean {
  const normalised = text
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return MICA_STOP_PHRASES.includes(normalised)
}

/**
 * Words that start a sentence but never name a person. Without this list
 * "Today she ate well" and "Just a quiet morning" would hand the server the
 * names "Today" and "Just".
 */
const NOT_A_NAME = new Set([
  'today', 'tomorrow', 'yesterday', 'this', 'that', 'the', 'a', 'an', 'she', 'he', 'they', 'we', 'i',
  'it', 'there', 'then', 'just', 'also', 'and', 'but', 'so', 'had', 'has', 'was', 'were', 'is', 'went',
  'spent', 'slept', 'ate', 'drank', 'refused', 'enjoyed', 'seemed', 'appeared', 'morning', 'afternoon',
  'evening', 'night', 'note', 'care', 'resident', 'service', 'all', 'no', 'yes', 'please', 'everyone',
])

/**
 * The person named in an utterance, read from capitalisation, or undefined.
 *
 * Used as the care-note target: Mica no longer requires the carer to pick a
 * person from a list, so when a note names someone ("Grace had a good lunch",
 * "Grace's appetite was poor") that name is what gets resolved. A lowercased
 * transcription simply yields undefined, and Mica asks aloud who the note is
 * about — a spoken question the carer answers by speaking, not a picker.
 *
 * A wrong guess is safe by construction: the name is resolved against the
 * organisation's own roster, and an unmatched name turns into a question rather
 * than a note filed against the wrong person.
 */
export function extractPersonNameFromUtterance(text: string): string | undefined {
  const raw = text.trim()
  const nameWord = (w?: string) => Boolean(w) && /^[A-Z][a-z]+$/.test(w as string) && !NOT_A_NAME.has((w as string).toLowerCase())

  const possessive = raw.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\b/)
  if (possessive) return possessive[1]
  const about = raw.match(/\b(?:about|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
  if (about && nameWord(about[1].split(' ')[0])) return about[1]

  const words = raw.split(/\s+/)
  // Nothing but a name: this is the carer answering "who is this note about?".
  if (words.length === 1 && nameWord(words[0])) return words[0]
  if (words.length === 2 && nameWord(words[0]) && nameWord(words[1])) return `${words[0]} ${words[1]}`
  // A capitalised word after the first is the likeliest name in a sentence that
  // is not about its first word.
  const later = words.slice(1).find(nameWord)
  if (later) return later
  // A care note usually opens with its subject — "Grace had a good lunch" — so
  // the first word is the candidate unless it is a sentence-starter word above.
  if (nameWord(words[0])) {
    return nameWord(words[1]) ? `${words[0]} ${words[1]}` : (words[0] as string)
  }
  return undefined
}

/**
 * Did the server reject the care note because it could not place the person?
 *
 * Two shapes, both answered by saying the name again: nobody matched the spoken
 * name, or more than one person did ("Multiple people match \"Grace\". Please
 * choose one." — the message the old picker existed to satisfy, now answered by
 * voice). The third is the note arriving with no subject at all. These are the
 * only server strings this client reads, and the alternative — leaving a
 * failure the carer can fix by speaking one word — would be worse.
 */
export function isPersonResolutionFailure(message: string): boolean {
  return /no active person named|multiple people match|person id or name is required/i.test(message)
}

// ── Session vocabulary ────────────────────────────────────────────────

/** Consecutive silent ends a continuous session tolerates before giving up. */
const SILENT_END_LIMIT = 3
/** How long the room must be quiet before Mica decides the sentence is over. */
const VAD_SILENCE_MS = 1200

interface PendingClarification {
  kind: 'careNote' | 'action'
  /** What Mica asked aloud; the next utterance is the answer to it. */
  question: string
  /** People the server offered, when it offered any. */
  candidates: MicaPerson[]
  /** The utterance that triggered the question, resent with the answer. */
  original: string
  /** For an action clarification: which action to resend. */
  action?: 'CREATE_TASK' | 'CREATE_APPOINTMENT'
}

const readStoredPerson = (): MicaPerson | null => {
  try {
    const raw = window.localStorage.getItem(PERSON_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MicaPerson
    return parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string' ? parsed : null
  } catch {
    return null
  }
}

interface MicaVoiceResult {
  result?: unknown
  person?: { id: string; name: string }
  question?: string
  needClarification?: boolean
  candidates?: Array<{ id: string; name: string }>
}

/**
 * Web Speech API types are not in lib.dom for the TS versions this repo
 * builds against, so keep local minimal shapes — the codebase already uses
 * `(window as any).SpeechRecognition` elsewhere.
 */
interface SpeechResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const getRecognitionCtor = (): SpeechRecognitionCtor | null => {
  const w = window as unknown as Record<string, unknown>
  return ((w.SpeechRecognition || w.webkitSpeechRecognition) as SpeechRecognitionCtor) || null
}

/**
 * Mica's session on the web — a voice-first, always-on assistant.
 *
 * ## What this hook is for now
 *
 * Mica used to be a modal: tap the orb, say one sentence, hear one reply, and
 * the session closed. It also required a person to be picked from a list before
 * a care note could be drafted, and it answered destination requests
 * ("give me Evan Turner's MAR chart for March") by reciting text instead of
 * opening the chart. Three consequences followed, and this hook is the fix for
 * each:
 *
 *   1. **No picker, no gate.** The care-note target is the person named in the
 *      utterance. When the server cannot tell who a note is about it asks
 *      aloud, and the carer answers by speaking — the clarification is part of
 *      the conversation, not a dropdown blocking it.
 *   2. **Navigation is an outcome.** When a reply carries a `navigate` target,
 *      the route is pushed and the session drops into the minimised bar: Mica
 *      gets out of the way of the page it just opened while staying live.
 *   3. **The conversation stays open.** After a reply, listening resumes on its
 *      own, so the carer can keep talking ("and February?") without touching the
 *      screen. It ends only when the carer says a stop phrase, closes the
 *      overlay, or the room stays silent long enough that Mica gives up — three
 *      consecutive silent turns, spoken rather than silent-failing.
 *
 * IDLE → (tap) LISTENING → (VAD ends the sentence) THINKING → RESPONDING → LISTENING …
 *
 * RESPONDING plays Mica's reply through real TTS audio (POST /ai/tts → MP3 →
 * Web Audio), with an AnalyserNode feeding the orb the literal output
 * amplitude. When server TTS is unavailable (no OpenAI key, budget cap,
 * offline) it falls back to browser speechSynthesis, where audio cannot be
 * tapped through Web Audio and the amplitude is an envelope driven by the
 * utterance's word-boundary events.
 */
export function useMica(options: { onNavigate?: (target: MicaNavigateTarget) => void } = {}) {
  const [state, setState] = useState<MicaState>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [responseMessage, setResponseMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  /** The bar surface: the session is live but out of the way of the page. */
  const [minimised, setMinimised] = useState(false)
  /** Where Mica last took the user, for the confirmation line in both surfaces. */
  const [lastNavigation, setLastNavigation] = useState<MicaNavigateTarget | null>(null)
  /**
   * Who the current care note is about. This is *remembered context*, not a
   * setting: it is filled from a name the carer spoke (or from a navigation
   * target the server resolved), and it is what makes a follow-up ("and her
   * mood?") land on the same person. Nothing waits on it.
   */
  const [selectedPerson, setSelectedPerson] = useState<MicaPerson | null>(() => readStoredPerson())
  const selectedPersonRef = useRef<MicaPerson | null>(selectedPerson)
  /**
   * True while the server is holding a page Mica offered to open (the `offer` on
   * the last answer). This is a routing fact, not the page itself: what will be
   * opened is decided server-side, and this only says that a short word like
   * "yes" should be sent to the endpoint that can open it instead of being
   * drafted as a care note.
   */
  const offeredPageRef = useRef(false)

  useEffect(() => {
    selectedPersonRef.current = selectedPerson
    try {
      if (selectedPerson) window.localStorage.setItem(PERSON_STORAGE_KEY, JSON.stringify(selectedPerson))
      else window.localStorage.removeItem(PERSON_STORAGE_KEY)
    } catch {
      // Storage unavailable (private mode): the in-memory context still works.
    }
  }, [selectedPerson])

  // Switching the subject starts a new topic: drop follow-up memory so "what
  // about tomorrow?" cannot resolve against a conversation about someone else.
  const lastPersonIdRef = useRef<string | null>(selectedPerson?.id ?? null)
  useEffect(() => {
    const id = selectedPerson?.id ?? null
    if (lastPersonIdRef.current !== id) {
      lastPersonIdRef.current = id
      micaSessionIdRef.current = null
      // A new subject starts a new topic: a page offered about the last one is
      // not this conversation's to open.
      offeredPageRef.current = false
    }
  }, [selectedPerson])

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const levelWindowRef = useRef<number[]>([])
  // Server-TTS playback: context, buffer source and rAF for the amplitude meter.
  const ttsCtxRef = useRef<AudioContext | null>(null)
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const ttsRafRef = useRef<number | null>(null)
  /**
   * The one flag that says the session is live. Set when a session starts and
   * cleared only by stopListening, so the recogniser's onend can tell "the room
   * went quiet, restart" from "the user ended this, tear down".
   */
  const continuousRef = useRef(false)
  /** Consecutive turns that ended with nothing heard. */
  const silentEndsRef = useRef(0)
  /** The spoken question the next utterance answers, if Mica asked one. */
  const pendingRef = useRef<PendingClarification | null>(null)

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()))
  }, [])

  const stopMicMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    levelWindowRef.current = []
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    setAudioLevel(0)
  }, [])

  /** Stops any in-flight server-TTS playback and its amplitude meter. */
  const stopTtsPlayback = useCallback(() => {
    if (ttsRafRef.current !== null) { cancelAnimationFrame(ttsRafRef.current); ttsRafRef.current = null }
    try { ttsSourceRef.current?.stop() } catch { /* already stopped */ }
    ttsSourceRef.current = null
    if (ttsCtxRef.current) { ttsCtxRef.current.close().catch(() => undefined); ttsCtxRef.current = null }
    setAudioLevel(0)
  }, [])

  const startMicMeter = useCallback(async () => {
    // One mic stream for the whole session: continuous listening must not
    // re-open (and re-close) the microphone on every turn.
    if (streamRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const rms = sum / data.length / 255
        // Keep a rolling window so the orb breathes rather than flickers.
        levelWindowRef.current.push(rms)
        if (levelWindowRef.current.length > 6) levelWindowRef.current.shift()
        const smoothed = levelWindowRef.current.reduce((a, b) => a + b, 0) / levelWindowRef.current.length
        setAudioLevel(Math.max(0, Math.min(1, smoothed * 2.4)))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // Mic denied / unavailable: Mica still listens via the recognizer; the
      // orb simply rests at zero amplitude rather than dying.
    }
  }, [])

  /**
   * Speaks a reply through real TTS audio and drives the orb from its literal
   * amplitude.
   *
   * Primary path: POST /ai/tts returns MP3 bytes, decoded and played through
   * Web Audio with an AnalyserNode — the orb then reacts to what is actually
   * playing, not a synthetic envelope. Fallback: browser speechSynthesis (no
   * Web Audio tap exists for it), which keeps the word-boundary envelope from
   * the original implementation so the orb still breathes in browsers/offline
   * orgs without an OpenAI key.
   */
  const speak = useCallback(async (text: string, onDone: () => void) => {
    // Tear down any previous TTS playback before starting a new one.
    stopTtsPlayback()

    // ---- Primary: server TTS through Web Audio -------------------------
    try {
      const res = await api.post('/ai/tts', { text }, { responseType: 'arraybuffer' })
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtor()
      ttsCtxRef.current = ctx
      const decoded = await ctx.decodeAudioData(res.data.slice(0))
      const source = ctx.createBufferSource()
      source.buffer = decoded
      const gain = ctx.createGain()
      // Web Audio requires a user gesture to start; Mica always starts from a
      // tap, so this resumes rather than hanging silently.
      if (ctx.state === 'suspended') await ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(gain)
      gain.connect(analyser)
      analyser.connect(ctx.destination)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const rms = sum / data.length / 255
        // Same rolling-window smoothing as the mic meter so the orb's two
        // meters (listening vs responding) read consistently.
        levelWindowRef.current.push(rms)
        if (levelWindowRef.current.length > 6) levelWindowRef.current.shift()
        const smoothed = levelWindowRef.current.reduce((a, b) => a + b, 0) / levelWindowRef.current.length
        setAudioLevel(Math.max(0, Math.min(1, smoothed * 2.4)))
        ttsRafRef.current = requestAnimationFrame(tick)
      }
      ttsRafRef.current = requestAnimationFrame(tick)
      source.onended = () => {
        stopTtsPlayback()
        setAudioLevel(0)
        onDone()
      }
      ttsSourceRef.current = source
      source.start()
      return
    } catch {
      // TTS endpoint unavailable (no OpenAI key, budget exceeded, offline).
      // Fall through to the browser synthesiser rather than failing the turn.
    }

    // ---- Fallback: browser speechSynthesis + word-boundary envelope ----
    try {
      const synth = window.speechSynthesis
      if (!synth) { onDone(); return }
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'en-GB'
      utter.rate = 1.02
      utter.pitch = 1.05

      // Web Speech audio cannot be tapped through Web Audio, so the envelope
      // tracks the utterance's word stream: onboundary fires per spoken word
      // with its charIndex, each word's shape sets the level target and an rAF
      // envelope eases toward it. Between words the level decays to a quiet
      // rest instead of holding a spike.
      let raf: number | null = null
      let level = 0
      let target = 0
      let lastBoundaryAt = 0
      const tick = (now: number) => {
        if (now - lastBoundaryAt > 650) target = 0.08
        level += (target - level) * 0.3
        setAudioLevel(Math.max(0, Math.min(1, level)))
        raf = requestAnimationFrame(tick)
      }
      const stopEnvelope = () => {
        if (raf !== null) cancelAnimationFrame(raf)
        raf = null
        setAudioLevel(0)
      }
      const wordWeight = (word: string) => {
        const w = word.replace(/[^\p{L}\p{N}']/gu, '')
        if (!w) return 0.12
        const vowels = (w.match(/[aeiouy]/gi) || []).length
        let weight = 0.3 + Math.min(0.4, vowels * 0.11 + w.length * 0.015)
        if (w.length > 1 && w === w.toUpperCase()) weight = Math.min(0.85, weight + 0.2)
        return weight
      }
      utter.onstart = () => {
        lastBoundaryAt = performance.now()
        target = 0.35
        raf = requestAnimationFrame(tick)
      }
      utter.onboundary = (e) => {
        lastBoundaryAt = performance.now()
        const word = text.slice(e.charIndex).split(/\s+/)[0] || ''
        const phraseBreak = /[.!?;:,]\s*$/.test(text.slice(0, e.charIndex))
        target = phraseBreak ? 0.08 : wordWeight(word)
      }
      utter.onend = () => { stopEnvelope(); onDone() }
      utter.onerror = () => { stopEnvelope(); onDone() }
      synth.cancel()
      synth.speak(utter)
    } catch {
      onDone()
    }
  }, [stopTtsPlayback])

  const stopListening = useCallback(() => {
    // Clear the live flag first: the recogniser's onend reads it to decide
    // whether the session ended on purpose.
    continuousRef.current = false
    pendingRef.current = null
    silentEndsRef.current = 0
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopMicMeter()
    stopTtsPlayback()
    setState('idle')
    setTranscript('')
    setResponseMessage(null)
    setMinimised(false)
    // Dismissing clears a session failure too — an error the user has closed
    // must not reappear on the next tap.
    setError(null)
  }, [stopMicMeter, stopTtsPlayback])

  /**
   * The carer said a stop phrase: confirm it aloud, then close the session.
   *
   * The exit names the way back in — the orb, which is the only way back in.
   * There is no wake word, so the copy must not imply one.
   */
  const endWithFarewell = useCallback(() => {
    setResponseMessage('Okay — I’ll stop listening. Tap the orb when you need me.')
    setState('responding')
    speak('Okay, I will stop listening. Tap the orb when you need me.', () => stopListening())
  }, [speak, stopListening])

  // ── Turn plumbing ────────────────────────────────────────────────────

  const transcriptRef = useRef('')
  const audioLevelRef = useRef(0)
  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { audioLevelRef.current = audioLevel }, [audioLevel])

  const sendToAiRef = useRef<(t: string, source?: MicaSource) => void>(() => undefined)
  const beginRecognitionRef = useRef<() => void>(() => undefined)
  const stopListeningRef = useRef<() => void>(stopListening)
  useEffect(() => { stopListeningRef.current = stopListening })

  const onNavigateRef = useRef<((target: MicaNavigateTarget) => void) | undefined>(options.onNavigate)
  useEffect(() => { onNavigateRef.current = options.onNavigate })

  /**
   * The end of a turn. This is where Mica's new default lives: a reply does not
   * close the session, it reopens the microphone.
   */
  const finishTurn = useCallback(() => {
    setResponseMessage(null)
    setTranscript('')
    if (!continuousRef.current) {
      setState('idle')
      return
    }
    beginRecognitionRef.current()
  }, [])

  /** Speaks a reply, then continues the conversation (or ends it, if asked to). */
  const reply = useCallback((message: string, opts: { end?: boolean } = {}) => {
    setResponseMessage(message)
    setState('responding')
    speak(message, () => (opts.end ? stopListeningRef.current() : finishTurn()))
  }, [finishTurn, speak])

  /**
   * A failure: still spoken (a voice-first user must hear it), then either the
   * conversation continues or Mica rests in the error state.
   *
   * The split matters. A transient failure (the provider timed out, the network
   * dropped) is worth another turn, so listening resumes. A *configuration*
   * failure — AI not configured, feature off, budget exceeded — will fail
   * identically however many times the carer speaks, so the session stops the
   * microphone and holds the error state with its danger ring instead of
   * looping a failure the user cannot talk their way out of.
   */
  const fail = useCallback((message: string, opts: { fatal?: boolean } = {}) => {
    setResponseMessage(message)
    setState('responding')
    speak(message, () => {
      if (opts.fatal) {
        continuousRef.current = false
        recognitionRef.current?.stop()
        recognitionRef.current = null
        stopMicMeter()
        setMinimised(false)
        setState('error')
        return
      }
      if (continuousRef.current) {
        setResponseMessage(null)
        setTranscript('')
        beginRecognitionRef.current()
        return
      }
      setState('error')
    })
  }, [speak, stopMicMeter])

  /**
   * The message and severity of an API failure, in one place.
   *
   * 402 (budget exceeded) and 403 (feature disabled) end the session: no
   * sentence the carer says next changes either, so listening on would only
   * invite the same failure again. 400 deliberately does *not* — the Mica gates
   * and the person-resolution errors share that status, and one of those,
   * "multiple people match", is fixed by simply saying the full name.
   *
   * A gate failure also does not loop on its own: after it is spoken, listening
   * resumes, and three silent turns end the session (see SILENT_END_LIMIT).
   */
  const apiFailure = (e: unknown, fallback: string): { message: string; fatal: boolean } => {
    const status = (e as { response?: { status?: number } })?.response?.status
    const message =
      (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || fallback
    return { message, fatal: status === 402 || status === 403 }
  }

  /** A draft or clarification from the write-action gateway, read back verbatim. */
  const handleActionResult = useCallback((data: Record<string, unknown>, resData: Record<string, unknown>) => {
    const clarification = data as { needClarification?: boolean; prompt?: string; candidates?: Array<{ id: string; name: string }> }
    if (clarification.needClarification) {
      // Keep the question and the original utterance so the next thing said is
      // treated as the answer — the conversational equivalent of the picker
      // this flow no longer has.
      pendingRef.current = {
        kind: 'action',
        question: clarification.prompt || 'Who is that for?',
        candidates: clarification.candidates || [],
        original: String(resData.utterance || ''),
        action: resData.action as 'CREATE_TASK' | 'CREATE_APPOINTMENT',
      }
    }
    const msg = (data.summary as string) || clarification.prompt || 'I could not prepare that. Check the screen for details.'
    if (data.draft) {
      try { window.sessionStorage.setItem('mica.pendingDraft', JSON.stringify(resData)) } catch { /* unavailable */ }
    }
    reply(msg)
  }, [reply])

  const sendAction = useCallback(async (
    action: 'CREATE_TASK' | 'CREATE_APPOINTMENT',
    utterance: string,
    input: Record<string, unknown>,
  ) => {
    setState('thinking')
    try {
      const res = await api.post('/ai/mica/actions', { action, utterance, input: { utterance, source: 'voice', ...input } })
      const data = res.data as Record<string, unknown>
      const err = (data as { error?: { message?: string } }).error
      if (err?.message) throw Object.assign(new Error(err.message), { handled: true })
      handleActionResult(data, { ...data, utterance, action })
    } catch (e: unknown) {
      const err = e as { handled?: boolean; message?: string }
      if (err.handled && err.message) {
        fail(err.message)
        return
      }
      const failure = apiFailure(e, 'Mica could not prepare that. Check AI settings.')
      fail(failure.message, { fatal: failure.fatal })
    }
  }, [fail, handleActionResult])

  /**
   * The care-note path. A statement about someone is drafted as a note, and the
   * note's subject is the name spoken in it. When the server cannot identify
   * that person it asks aloud, and the next utterance is the answer.
   */
  const sendCareNote = useCallback(async (utterance: string, personName?: string, personId?: string) => {
    setState('thinking')
    try {
      const res = await api.post('/ai/voice/notes', {
        transcription: utterance,
        intent: utterance,
        ...(personId ? { personId } : {}),
        ...(personName ? { personName } : {}),
        ...(!personId && !personName && selectedPersonRef.current ? { personId: selectedPersonRef.current.id } : {}),
        source: 'voice',
        noteDate: new Date().toISOString().split('T')[0],
      })
      const data = res.data as MicaVoiceResult
      if (data?.needClarification) {
        const question = data.question || 'Who is this note about?'
        pendingRef.current = {
          kind: 'careNote',
          question,
          candidates: data.candidates || [],
          original: utterance,
        }
        reply(question)
        return
      }
      if (data?.person?.id && data.person.name) setSelectedPerson({ id: data.person.id, name: data.person.name })
      const msg =
        (typeof data?.question === 'string' && data.question)
          ? data.question
          : typeof (data as { result?: { message?: string } })?.result?.message === 'string'
            ? (data as { result: { message: string } }).result.message
            : 'Care note drafted. Check the daily note for details.'
      reply(msg)
    } catch (e: unknown) {
      const failure = apiFailure(e, 'Mica could not reach the AI service. Check AI settings.')
      // A note whose subject could not be placed is not a dead end: Mica asks
      // aloud, and the next sentence is the answer. This is where the person
      // picker used to be, and a spoken question is the whole replacement.
      if (isPersonResolutionFailure(failure.message)) {
        pendingRef.current = { kind: 'careNote', question: failure.message, candidates: [], original: utterance }
        reply(failure.message)
        return
      }
      fail(failure.message, { fatal: failure.fatal })
    }
  }, [fail, reply])

  /**
   * The question/navigation path.
   *
   * The server answers the question, and — when the utterance was a request to
   * go somewhere — returns the route it resolved. That route is pushed, and the
   * session minimises itself so the page it opened is not covered by the
   * overlay Mica opened it from. Listening continues either way.
   */
  const askMica = useCallback(async (question: string) => {
    setState('thinking')
    try {
      const res = await api.post('/ai/mica/ask', {
        question,
        ...(micaSessionIdRef.current ? { sessionId: micaSessionIdRef.current } : {}),
        ...(selectedPersonRef.current ? { personName: selectedPersonRef.current.name } : {}),
      })
      const data = res.data as {
        answer?: string
        sessionId?: string
        navigate?: { path?: string; label?: string; person?: { id: string; name: string } }
        /** The page Mica offered in this answer, waiting on the carer's next word. */
        offer?: unknown
      }
      if (data?.sessionId) micaSessionIdRef.current = data.sessionId
      // Whether a page is waiting on the next word. The server keeps the offer
      // itself and retires it with the turn that follows; this only routes the
      // answer back to the endpoint that can open it.
      offeredPageRef.current = Boolean(data?.offer)

      // Navigation first: the point of the turn was to reach the page, and the
      // spoken line is a confirmation of what Mica did, not a substitute for it.
      const target = data?.navigate
      if (target?.path) {
        const nav: MicaNavigateTarget = {
          path: target.path,
          label: target.label || 'that page',
          ...(target.person ? { person: target.person } : {}),
        }
        setLastNavigation(nav)
        onNavigateRef.current?.(nav)
        // The bar, not the modal: the page is the subject now, Mica is the
        // passenger. This also keeps the overlay from covering what it opened.
        setMinimised(true)
      }

      const msg = data?.answer || (target?.path ? `Opening ${target.label || 'that page'}.` : 'I could not answer that. Try asking again.')
      reply(msg)
    } catch (e: unknown) {
      const failure = apiFailure(e, 'Mica could not reach the AI service. Check AI settings.')
      fail(failure.message, { fatal: failure.fatal })
    }
  }, [fail, reply])

  /**
   * The turn dispatcher. Voice is the only entry point, so this is the whole
   * routing table:
   *
   *   stop phrase            → farewell, session ends
   *   answer to a question   → the pending clarification is resolved by voice
   *   write intent           → confirm-before-persist draft (unchanged)
   *   question or destination → /ai/mica/ask, which may also navigate
   *   anything else          → care note, subject resolved from the utterance
   */
  const sendToAi = useCallback(async (rawTranscript: string) => {
    const text = rawTranscript.trim()
    if (!text) return

    if (isStopUtterance(text)) {
      endWithFarewell()
      return
    }

    const pending = pendingRef.current
    if (pending) {
      pendingRef.current = null
      // The answer is whoever/whatever the carer just said. A candidate whose
      // name was spoken resolves to its id; otherwise the utterance itself is
      // the name the server should try.
      const spoken = text.toLowerCase()
      const match = pending.candidates.find(c => spoken.includes(c.name.toLowerCase()))
      if (pending.kind === 'careNote') {
        await sendCareNote(pending.original, match ? match.name : text, match?.id)
      } else if (pending.action) {
        await sendAction(pending.action, pending.original, match ? { personId: match.id, personName: match.name } : { personName: text })
      }
      return
    }

    // The carer's answer to the page Mica just offered ("yes", "go on"). Checked
    // before every other path because a confirmation is a reply to Mica's own
    // question: it names no destination, asks nothing, and above all is not a
    // note — drafting a care note from the word "yes" is the bug this prevents.
    if (offeredPageRef.current && looksLikeConfirmation(text)) {
      offeredPageRef.current = false
      await askMica(text)
      return
    }

    const intent = detectMicaActionIntent(text, 'voice')
    if (intent) {
      await sendAction(intent.action, intent.utterance, intent.prefill || {})
      return
    }

    if (looksLikeNavigationIntent(text) || /^(who|what|when|where|how|why|is|are|do|does|did|can|could|should|show|list|tell|give|any|anyone|how many|what's|whats|where's)\b/i.test(text)) {
      await askMica(text)
      return
    }

    await sendCareNote(text, extractPersonNameFromUtterance(text))
  }, [askMica, endWithFarewell, sendAction, sendCareNote])

  useEffect(() => { sendToAiRef.current = (t) => { void sendToAi(t) } }, [sendToAi])

  // Leaving the shell must not leave the microphone open. Runs once, on unmount:
  // the meter and the TTS helpers are stable callbacks.
  useEffect(() => () => {
    continuousRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopMicMeter()
    stopTtsPlayback()
  }, [stopMicMeter, stopTtsPlayback])

  /**
   * Opens the recogniser for one sentence. Called once per turn; the mic stream
   * itself is opened once per session (startMicMeter), so continuous listening
   * does not renegotiate the microphone between turns.
   */
  const beginRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      continuousRef.current = false
      setState('idle')
      return
    }
    // Never two recognisers: a duplicate would double every transcript.
    if (recognitionRef.current) return
    setTranscript('')
    setState('listening')
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    rec.onresult = (e) => {
      let full = ''
      for (let i = e.resultIndex; i < e.results.length; i++) full += e.results[i][0].transcript
      if (full) {
        setTranscript(full)
        silentEndsRef.current = 0
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission denied.')
        continuousRef.current = false
        stopListeningRef.current()
        setState('idle')
      }
      // 'no-speech' and 'aborted' are normal for a sentence-length listen; let onend decide.
    }
    rec.onend = () => {
      recognitionRef.current = null
      // stopListening clears the flag before stopping us: an intentional end
      // must not be restarted by the code below.
      if (!continuousRef.current) return
      if (transcriptRef.current) {
        silentEndsRef.current = 0
        sendToAiRef.current(transcriptRef.current)
        return
      }
      // Nothing heard. The browser ends continuous recognition on its own after
      // a long quiet spell, so restart — but stop after a few empty turns
      // rather than listening to an empty room indefinitely.
      silentEndsRef.current += 1
      if (silentEndsRef.current > SILENT_END_LIMIT) {
        reply('I couldn’t hear anything, so I’ll stop listening. Tap the orb when you need me.', { end: true })
        return
      }
      beginRecognitionRef.current()
    }
    // Voice Activity Detection: after speech goes quiet for a beat, stop
    // listening. Uses refs so the timer closure never reads stale state.
    let lastVoiceAt = Date.now()
    let hadVoice = false
    const vadTimer = window.setInterval(() => {
      if (!recognitionRef.current) {
        window.clearInterval(vadTimer)
        return
      }
      if (transcriptRef.current) hadVoice = true
      if (hadVoice && Date.now() - lastVoiceAt > VAD_SILENCE_MS && audioLevelRef.current < 0.06) {
        window.clearInterval(vadTimer)
        rec.stop()
      }
      if (audioLevelRef.current >= 0.06) lastVoiceAt = Date.now()
    }, 200)
    recognitionRef.current = rec
    rec.start()
  }, [reply])

  useEffect(() => { beginRecognitionRef.current = beginRecognition })

  /** Where the conversation begins: the orb's tap. */
  const startListening = useCallback(async () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    // Fail fast (and visibly) when the mic is actually unusable, instead of
    // opening the display that listens to nothing. The Permissions API advisory
    // state is NOT trusted as a denial: some embedded webviews report 'denied'
    // while getUserMedia succeeds, which would block a working mic forever.
    // The gate below is the ground truth — whether a real mic stream opens.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach(t => t.stop())
    } catch {
      setSupported(false)
      setError('Microphone permission is blocked. Allow mic access for this site, then try Mica again.')
      return
    }
    setError(null)
    setTranscript('')
    setResponseMessage(null)
    setLastNavigation(null)
    setMinimised(false)
    silentEndsRef.current = 0
    pendingRef.current = null
    // A session that just started has heard no offer, whatever the server still
    // holds: the carer did not hear it in this session either.
    offeredPageRef.current = false
    // From here the session is live until the carer says so.
    continuousRef.current = true
    await startMicMeter()
    beginRecognition()
  }, [beginRecognition, startMicMeter])

  return {
    state,
    setState,
    audioLevel,
    transcript,
    responseMessage,
    error,
    supported,
    selectedPerson,
    setSelectedPerson,
    /** True while the session runs in the bottom bar instead of the modal. */
    minimised,
    minimise: useCallback(() => setMinimised(true), []),
    expand: useCallback(() => setMinimised(false), []),
    lastNavigation,
    startListening,
    stopListening,
  }
}
