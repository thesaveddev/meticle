import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../services/api'

export type MicaState = 'idle' | 'listening' | 'thinking' | 'responding'

export interface MicaPerson {
  id: string
  name: string
}

const PERSON_STORAGE_KEY = 'mica.selectedPerson'
/**
 * Follow-up memory handle. The server issues an opaque sessionId on each
 * answered question; we echo it back on the next ask so "what about
 * tomorrow?" resolves against "who is on shift today?". Persisted per tab
 * session (not localStorage — conversation memory should not outlive the
 * browser session on a shared device), and invalidated whenever Mica's
 * selected person changes, since a new care-note target starts a new topic.
 */
const micaSessionIdRef: { current: string | null } = { current: null }

/** How the words reached Mica: spoken through the mic, or typed into the overlay. */
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
 * Pure and source-parametrised so the voice entry point and the text entry
 * point draft renewal tasks identically — the only thing that differs is what
 * the draft records about where the words came from.
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
  needClarification?: boolean
  question?: string
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
 * Mica state machine on the web.
 *
 * IDLE → (tap) LISTENING → (stops speaking) THINKING → (response ready) RESPONDING → IDLE
 *
 * RESPONDING plays Mica's reply through real TTS audio (POST /ai/tts → MP3 →
 * Web Audio), with an AnalyserNode feeding the orb the literal output
 * amplitude — the same meter path as the LISTENING mic level. When the server
 * TTS is unavailable (no OpenAI key, budget cap, offline) it falls back to
 * browser speechSynthesis, where audio cannot be tapped through Web Audio and
 * the amplitude is an envelope driven by the utterance's word-boundary events.
 */
export function useMica() {
  const [state, setState] = useState<MicaState>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [responseMessage, setResponseMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  // Who the current voice note is about. The API requires a person for care
  // notes, so without a selection Mica asks for one instead of POSTing and
  // failing with "Person ID or name is required".
  const [selectedPerson, setSelectedPerson] = useState<MicaPerson | null>(() => readStoredPerson())
  const selectedPersonRef = useRef<MicaPerson | null>(selectedPerson)

  useEffect(() => {
    selectedPersonRef.current = selectedPerson
    try {
      if (selectedPerson) window.localStorage.setItem(PERSON_STORAGE_KEY, JSON.stringify(selectedPerson))
      else window.localStorage.removeItem(PERSON_STORAGE_KEY)
    } catch {
      // Storage unavailable (private mode): the in-memory selection still works.
    }
  }, [selectedPerson])

  // Switching the care-note target starts a new topic: drop follow-up memory
  // so "what about tomorrow?" can't resolve against a conversation about a
  // different person.
  const lastPersonIdRef = useRef<string | null>(selectedPerson?.id ?? null)
  useEffect(() => {
    const id = selectedPerson?.id ?? null
    if (lastPersonIdRef.current !== id) {
      lastPersonIdRef.current = id
      micaSessionIdRef.current = null
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

  const sendToAiRef = useRef<(t: string, source?: MicaSource) => void>(() => undefined)
  const startListeningRef = useRef<() => void>(() => undefined)
  /**
   * Questions are the Mica-wide path: "who is on shift today", "who is
   * supporting Grace Roberts", "give me today's appointments" — none of them
   * need a person selection, and the server picks the tools itself. A question
   * is anything question-shaped or any utterance when no person is selected
   * (the server clarifies care-note needs; no dead-end error, no re-tap).
   */
  const isQuestion = (text: string) =>
    !selectedPersonRef.current ||
    /^(who|what|when|where|how|why|is|are|do|does|did|can|could|should|show|list|tell|give|any|anyone|how many|what's|whats|where's)\b/i.test(text.trim())

  // Typed entry shares this exact pipeline: the same question routing, the
  // same action-intent detection, the same confirm-before-persist gateway.
  // Only `source` differs (see sendText below), so a typed sentence drafts a
  // renewal task identically to a spoken one.
  const sendToAi = useCallback(async (rawTranscript: string, source: MicaSource = 'voice') => {
    if (isQuestion(rawTranscript)) {
      setState('thinking')
      try {
        const res = await api.post('/ai/mica/ask', {
          question: rawTranscript,
          ...(micaSessionIdRef.current ? { sessionId: micaSessionIdRef.current } : {}),
        })
        const data = res.data as { answer?: string; sessionId?: string }
        const msg = data?.answer || 'I could not answer that. Try asking again.'
        if (data?.sessionId) micaSessionIdRef.current = data.sessionId
        setResponseMessage(msg)
        setState('responding')
        speak(msg, () => {
          setState('idle')
          setResponseMessage(null)
          setTranscript('')
        })
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
          'Mica could not reach the AI service. Check AI settings.'
        setResponseMessage(msg)
        setState('responding')
        speak(msg, () => {
          setState('idle')
          setResponseMessage(null)
        })
      }
      return
    }
    // Write-action intents go through the confirm-before-persist gateway.
    const intent = detectMicaActionIntent(rawTranscript, source)
    if (intent) {
      setState('thinking')
      try {
        const res = await api.post('/ai/mica/actions', {
          action: intent.action,
          utterance: intent.utterance,
          input: {
            utterance: intent.utterance,
            source,
            // Training-expiry phrasing pre-fills the task so the review card
            // opens ready to confirm; the server re-resolves names anyway.
            ...(intent.prefill || {}),
          },
        })
        const data = res.data as { draft?: boolean; summary?: string; error?: { message?: string }; needClarification?: boolean; prompt?: string }
        if (data?.error?.message) throw Object.assign(new Error(data.error.message), { handled: true })
        // Draft or clarification — both are read back to the user verbatim.
        // Persisting stays a deliberate tap on the review card in the overlay;
        // voice alone never writes, matching the care-note flow.
        const msg = data?.summary || data?.prompt || 'I could not prepare that. Check the screen for details.'
        setResponseMessage(msg)
        if ((res.data as Record<string, unknown>).draft) {
          try { window.sessionStorage.setItem('mica.pendingDraft', JSON.stringify(res.data)) } catch { /* unavailable */ }
        }
        setState('responding')
        speak(msg, () => {
          setState('idle')
          setResponseMessage(null)
          setTranscript('')
        })
      } catch (e: unknown) {
        const err = e as { handled?: boolean; message?: string; response?: { data?: { error?: { message?: string } } } }
        const msg = (err.handled ? err.message : (err.response?.data?.error?.message || '')) || 'Mica could not prepare that. Check AI settings.'
        setResponseMessage(msg)
        setState('responding')
        speak(msg, () => {
          setState('idle')
          setResponseMessage(null)
        })
      }
      return
    }
    // Care-note flow: the utterance is a statement and a person is selected.
    // Regex matched nothing and the utterance wasn't question-shaped — but
    // short imperatives like "book podiatry" or "arrange a sight check" name
    // a kind of appointment without the trigger word pairing the regexes
    // look for. One server-side classification call settles it: a write
    // intent routes on, anything else stays on the care-note path below.
    setState('thinking')
    try {
      const settleRes = await api.post('/ai/mica/settle', { utterance: rawTranscript })
      const settled = settleRes.data as { intent?: { action: 'CREATE_TASK' | 'CREATE_APPOINTMENT'; utterance: string; title?: string; personName?: string; priority?: string } | null; action?: string }
      if (settled?.intent) {
        // Same draft-round as the regex path: straight into /actions with the
        // server's subject/personName as prefill. Confirm-before-persist
        // still applies — nothing is written by voice alone.
        try {
          const actRes = await api.post('/ai/mica/actions', {
            action: settled.intent.action,
            utterance: settled.intent.utterance,
            input: {
              utterance: settled.intent.utterance,
              source,
              title: settled.intent.title,
              personName: settled.intent.personName,
              ...(settled.intent.priority ? { priority: settled.intent.priority } : {}),
            },
          })
          const actData = actRes.data as { draft?: boolean; summary?: string; error?: { message?: string }; prompt?: string }
          if (actData?.error?.message) throw Object.assign(new Error(actData.error.message), { handled: true })
          const msg = actData?.summary || actData?.prompt || 'I could not prepare that. Check the screen for details.'
          setResponseMessage(msg)
          if ((actRes.data as Record<string, unknown>).draft) {
            try { window.sessionStorage.setItem('mica.pendingDraft', JSON.stringify(actRes.data)) } catch { /* unavailable */ }
          }
          setState('responding')
          speak(msg, () => {
            setState('idle')
            setResponseMessage(null)
            setTranscript('')
          })
        } catch (e: unknown) {
          const err = e as { handled?: boolean; message?: string; response?: { data?: { error?: { message?: string } } } }
          const msg = (err.handled ? err.message : (err.response?.data?.error?.message || '')) || 'Mica could not prepare that. Check AI settings.'
          setResponseMessage(msg)
          setState('responding')
          speak(msg, () => {
            setState('idle')
            setResponseMessage(null)
          })
        }
        return
      }
      // intent: null or action 'none'/'unclassified' — nothing write-shaped;
      // fall through to the care-note flow which is what remains.
    } catch {
      // Settle endpoint unreachable (offline, provider down): keep the
      // care-note behaviour for this utterance rather than failing.
    }
    try {
      const body = {
        transcription: rawTranscript,
        intent: rawTranscript,
        personId: selectedPersonRef.current?.id,
        source,
        noteDate: new Date().toISOString().split('T')[0],
      }
      const res = await api.post('/ai/voice/notes', body)
      const data = res.data as MicaVoiceResult
      const msg =
        (data && (data as { question?: string }).question) ? (data as { question: string }).question
          : typeof (data as { result?: { message?: string } })?.result?.message === 'string'
            ? (data as { result: { message: string } }).result.message
            : 'Care note drafted. Check the daily note for details.'
      setResponseMessage(msg)
      setState('responding')
      speak(msg, () => {
        setState('idle')
        setResponseMessage(null)
        setTranscript('')
      })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        'Mica could not reach the AI service. Check AI settings.'
      setResponseMessage(msg)
      setState('responding')
      speak(msg, () => {
        setState('idle')
        setResponseMessage(null)
      })
    }
  }, [speak])

  /**
   * The text/keyboard Mica entry point — the same sendToAi pipeline the voice
   * recogniser feeds, with only the source changed. A typed sentence goes
   * through the identical question routing, action-intent detection (including
   * the implicit training-expiry task), and confirm-before-persist gateway, so
   * "Aisha's medication training expires next month" drafts the same reviewable
   * renewal task whether it was spoken or typed. Replies are shown, not
   * spoken: the user chose the keyboard, so reading back with TTS would
   * restart a conversation the room can hear but the typist already finished.
   */
  const sendText = useCallback((typed: string) => {
    const trimmed = typed.trim()
    if (!trimmed) return
    setTranscript(trimmed)
    void sendToAi(trimmed, 'text')
  }, [sendToAi])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopMicMeter()
    stopTtsPlayback()
    setState('idle')
    setTranscript('')
  }, [stopMicMeter, stopTtsPlayback])

  // Refs so the VAD timer closure reads fresh values without re-subscribing.
  const transcriptRef = useRef('')
  const audioLevelRef = useRef(0)
  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { audioLevelRef.current = audioLevel }, [audioLevel])
  // Timer handle + cleanup on unmount.
  const setIntervalRef = useRef<number | null>(null)
  useEffect(() => () => { if (setIntervalRef.current) window.clearInterval(setIntervalRef.current) }, [])
  useEffect(() => () => stopTtsPlaybackRef.current(), [])
  const stopTtsPlaybackRef = useRef<() => void>(stopTtsPlayback)
  useEffect(() => { stopTtsPlaybackRef.current = stopTtsPlayback })

  const startListening = useCallback(async () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    // Fail fast (and visibly) when the mic is actually unusable, instead of
    // opening an overlay that listens to nothing. The Permissions API advisory
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
    setState('listening')
    await startMicMeter()
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    rec.onresult = (e) => {
      let full = ''
      for (let i = e.resultIndex; i < e.results.length; i++) full += e.results[i][0].transcript
      if (full) setTranscript(full)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission denied.')
        setState('idle')
        stopMicMeter()
      }
      // 'no-speech' and 'aborted' are normal for a sentence-length listen; let onend decide.
    }
    rec.onend = () => {
      recognitionRef.current = null
      stopMicMeter()
      // If the interval is still alive it will see no recognizer and let VAD logic expire.
      // Only treat as "finished speaking" when we actually heard something and it wasn't
      // an explicit cancel (stopListening nulls the ref before this fires).
      if (transcriptRef.current) {
        sendToAiRef.current(transcriptRef.current)
      } else {
        setState('idle')
      }
    }
    // Voice Activity Detection: after speech goes quiet for a beat, stop
    // listening. Uses refs so the timer closure never reads stale state.
    const VAD_SILENCE_MS = 1200
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
    setIntervalRef.current = vadTimer
    recognitionRef.current = rec
    rec.start()
  }, [startMicMeter, stopMicMeter])

  // Post-render wiring: keep sendToAiRef pointing at the current callback.
  useEffect(() => { sendToAiRef.current = sendToAi })
  // startListening is declared below sendToAi, so it reaches it via ref too.
  useEffect(() => { startListeningRef.current = startListening })

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
    startListening,
    stopListening,
    sendText,
  }
}
