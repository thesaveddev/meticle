import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../services/api'

export type MicaState = 'idle' | 'listening' | 'thinking' | 'responding'

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
 * `speaking` uses the browser TTS; the amplitude the hook reports is a modelled
 * value (TTS argues its own level via ` Uttterance boundary events`), and the
 * mic level drives the LISTENING waveform.
 */
export function useMica() {
  const [state, setState] = useState<MicaState>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [responseMessage, setResponseMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const levelWindowRef = useRef<number[]>([])

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

  const speak = useCallback((text: string, onDone: () => void) => {
    try {
      const synth = window.speechSynthesis
      if (!synth) { onDone(); return }
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'en-GB'
      utter.rate = 1.02
      utter.pitch = 1.05
      // Modelled amplitude so the RESPONDING waveform reacts to speech.
      utter.onstart = () => setAudioLevel(0.45)
      utter.onboundary = () => setAudioLevel(v => (v > 0.2 ? 0.15 + Math.random() * 0.25 : v))
      utter.onend = () => { setAudioLevel(0); onDone() }
      utter.onerror = () => { setAudioLevel(0); onDone() }
      synth.cancel()
      synth.speak(utter)
    } catch {
      onDone()
    }
  }, [])

  const sendToAiRef = useRef<(t: string) => void>(() => undefined)
  const sendToAi = useCallback(async (rawTranscript: string) => {
    setState('thinking')
    try {
      const body = {
        transcription: rawTranscript,
        intent: rawTranscript,
        source: 'voice' as const,
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

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopMicMeter()
    setState('idle')
    setTranscript('')
  }, [stopMicMeter])

  // Refs so the VAD timer closure reads fresh values without re-subscribing.
  const transcriptRef = useRef('')
  const audioLevelRef = useRef(0)
  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { audioLevelRef.current = audioLevel }, [audioLevel])
  // Timer handle + cleanup on unmount.
  const setIntervalRef = useRef<number | null>(null)
  useEffect(() => () => { if (setIntervalRef.current) window.clearInterval(setIntervalRef.current) }, [])

  const startListening = useCallback(async () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    // Fail fast (and visibly) when the mic is blocked at the OS/browser level,
    // instead of opening an overlay that listens to nothing.
    try {
      const perm = await navigator.permissions?.query?.({ name: 'microphone' as PermissionName })
      if (perm && perm.state === 'denied') {
        setSupported(false)
        setError('Microphone permission is blocked. Allow mic access for this site, then try Mica again.')
        return
      }
    } catch {
      // Permissions API unavailable or query unsupported: fall through and let
      // the recognizer's own onerror path report the denial.
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

  return {
    state,
    setState,
    audioLevel,
    transcript,
    responseMessage,
    error,
    supported,
    startListening,
    stopListening,
  }
}
