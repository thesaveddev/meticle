import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Image } from 'react-native'
import { useTheme, type MicaOrbState } from '../theme'
import { spacing } from '../theme'
import { MICA_ORB_IMAGE, MICA_IDLE_IMAGE } from '../components/FloatingMicaOrb'
import { useReducedMotion } from '../utils/useReducedMotion'
import type { AuthSession } from '../types'
import {
  ApiError,
  approveVoiceNote,
  askMica,
  confirmMicaAction,
  prepareMicaAction,
  requestVoiceNote,
  type MicaActionPrepareResponse,
  type MicaCareNoteResponse,
} from '../services/api'
import {
  detectMicaActionIntent,
  extractPersonNameFromUtterance,
  isPersonResolutionFailure,
  isStopUtterance,
  looksLikeConfirmation,
  looksLikeNavigationIntent,
  looksLikeQuestion,
} from '../services/micaRouting'
import { localDate } from '../utils/localDay'
import { notificationTarget } from '../utils/notificationLinks'
import {
  isVoiceInputSupported,
  requestVoicePermission,
  speakReply,
  startListening,
  stopListening,
  stopSpeaking,
} from '../services/voice'
import { hapticLight, hapticMedium, hapticWarning } from '../services/haptics'

interface Props {
  navigation: {
    pop: () => void
  }
  session: AuthSession | null
  /** Opens a record link Mica answered with, the same destinations as a notification tap. */
  onNavigate: (link: string) => void
  onCloseSheet: () => void
  onOpenSheet: () => void
}

interface Offer {
  path: string
  label: string
  question: string
}

interface PendingClarification {
  kind: 'careNote' | 'action'
  question: string
  candidates: Array<{ id: string; name: string }>
  original: string
  action?: 'CREATE_TASK' | 'CREATE_APPOINTMENT'
}

interface PendingDraft {
  kind: 'action' | 'note'
  action?: 'CREATE_TASK' | 'CREATE_APPOINTMENT'
  summary: string
  envelope?: Record<string, unknown>
  noteResult?: Record<string, unknown>
  notePersonId?: string
  noteShift?: string
  noteDate?: string
}

const FAREWELL = 'Goodbye — tap the orb whenever you need me.'

/**
 * An offer the phone can honestly keep. The server offers the record's own
 * page, which is usually a web-only route (`/tasks?task=…`, `/people/:id…`)
 * that lands on the notifications list here — so "want me to open it?"
 * would be a promise the tap cannot keep. Only a destination with a native
 * screen becomes a spoken offer; anything else ends at "Saved." the way the
 * server ends at a plain sentence for a caller who cannot open the page.
 */
function offerIfNative(page: { path?: string; label?: string; offer?: string } | undefined | null): Offer | null {
  if (!page?.path) return null
  const target = notificationTarget(page.path)
  if (target.kind === 'notifications') return null
  return {
    path: page.path,
    label: page.label || 'that page',
    question: page.offer || `Want me to open ${page.label || 'that page'}?`,
  }
}
const SAVE_QUESTION = 'Shall I save it?'
const NOTE_SAVE_QUESTION = 'Say yes to save it, or no to drop it.'
/** Consecutive silent turns tolerated before the orb rests instead of re-listening. */
const SILENT_LIMIT = 3

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Mica, orb-only: the whole screen is the orb reacting to the conversation.
 *
 * Nothing on screen apart from the orb and its one-line caption — no thread,
 * no composer, no cards. The carer taps, speaks, and Mica answers aloud; what
 * was heard is the caption while it is being heard, and then it is gone. This
 * is the same assistant as the web, not a poster for it: the same
 * `POST /ai/mica/ask` endpoint for questions, the same `/ai/mica/actions`
 * confirm-before-persist gateway for tasks and appointments, and the same
 * `/ai/voice/notes` + `/ai/daily-notes/approve` path for care notes — with the
 * same routing table deciding which endpoint an utterance goes to.
 *
 * The one deliberate difference from the typed screen this replaces: a draft
 * has no card to sit on, so approval is spoken. Mica reads the summary, asks
 * "shall I save it?", and the carer's next word saves or drops it — the
 * draft-then-confirm contract is unchanged, only the surface moved from tap
 * to voice.
 *
 * Voice needs a dev or EAS build (the recogniser is native code, absent from
 * Expo Go) and microphone permission. Without either, the orb says so aloud
 * and shows its error state instead of hanging on listening.
 */
export function MicaHomeScreen({ session, onNavigate }: Props) {
  const { colors: c } = useTheme()
  const reducedMotion = useReducedMotion()
  const [orbState, setOrbState] = useState<MicaOrbState>('idle')
  /** The single caption line: what Mica heard, or what it is doing. */
  const [caption, setCaption] = useState('Tap the orb and speak')
  const sessionIdRef = useRef<string | undefined>(undefined)
  const offerRef = useRef<Offer | null>(null)
  const pendingRef = useRef<PendingClarification | null>(null)
  const draftRef = useRef<PendingDraft | null>(null)
  const busyRef = useRef(false)
  const silentRef = useRef(0)
  const mountedRef = useRef(true)
  const token = session?.accessToken || ''

  const level = useSharedValue(0)
  const breathe = useSharedValue(1)
  const glow = useSharedValue(0.35)
  const ripple = useSharedValue(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      busyRef.current = false
      void stopListening()
      void stopSpeaking()
    }
  }, [])

  /* ─── Orb motion: the same vocabulary as the floating orb ─── */
  useEffect(() => {
    cancelAnimation(breathe)
    cancelAnimation(glow)
    cancelAnimation(ripple)
    if (reducedMotion) {
      breathe.value = 1
      glow.value = orbState === 'error' ? 0.24 : 0.35
      ripple.value = 0
      return
    }
    const breath = (to: number, ms: number) =>
      withRepeat(
        withSequence(
          withTiming(to, { duration: ms, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: ms, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )
    const pulse = (to: number, ms: number) =>
      withRepeat(
        withSequence(
          withTiming(to, { duration: ms, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: ms, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )
    if (orbState === 'idle') {
      breathe.value = breath(1.03, 2400)
      glow.value = pulse(0.5, 2600)
    } else if (orbState === 'listening') {
      breathe.value = breath(1.06, 600)
      glow.value = pulse(0.95, 600)
      ripple.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      )
    } else if (orbState === 'thinking') {
      breathe.value = breath(1.045, 450)
      glow.value = pulse(0.8, 450)
    } else if (orbState === 'error') {
      breathe.value = 1
      glow.value = 0.24
      ripple.value = 0
    } else {
      breathe.value = breath(1.04, 700)
      glow.value = pulse(0.72, 700)
    }
  }, [breathe, glow, ripple, orbState, reducedMotion])

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.22 }],
  }))
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.55,
    transform: [{ scale: 1 + ripple.value * 0.9 }],
  }))

  /* ─── Speaking ─── */

  /** Speaks a reply, then listens for the next turn unless the session ended. */
  const say = useCallback((line: string, opts?: { thenListen?: boolean }) => {
    if (!mountedRef.current) return
    setOrbState('responding')
    setCaption(line)
    speakReply(line, {
      onDone: () => {
        if (!mountedRef.current) return
        if (opts?.thenListen === false) {
          setOrbState('idle')
        } else {
          void listen()
        }
      },
      onStopped: () => {
        if (!mountedRef.current) return
        setOrbState('idle')
      },
      onError: () => {
        if (!mountedRef.current) return
        // The words are already the caption: a silent voice stack costs the
        // conversation nothing, so keep listening rather than failing.
        void listen()
      },
    })
  }, [])

  const fail = useCallback((line: string, opts?: { fatal?: boolean }) => {
    if (!mountedRef.current) return
    hapticWarning()
    if (opts?.fatal) {
      setOrbState('error')
      setCaption(line)
      speakReply(line, { onDone: () => mountedRef.current && setOrbState('idle') })
      return
    }
    say(line)
  }, [])

  /* ─── Listening ─── */

  const listen = useCallback(async () => {
    if (!mountedRef.current || busyRef.current) return
    if (!token) {
      fail('You are signed out, so Mica cannot reach your organisation. Sign in and try again.', { fatal: true })
      return
    }
    if (!(await isVoiceInputSupported())) {
      fail('Voice input needs the staff app build — it is not available in Expo Go. Rebuild with the development client and try again.', { fatal: true })
      return
    }
    if (!(await requestVoicePermission())) {
      fail('Microphone permission denied. Mica cannot hear you until it is allowed in Settings.', { fatal: true })
      return
    }
    hapticLight()
    setOrbState('listening')
    setCaption('Listening…')
    level.value = 0
    const started = await startListening({
      onPartial: text => {
        if (mountedRef.current && text) setCaption(text)
      },
      onFinal: text => {
        if (!mountedRef.current) return
        level.value = 0
        if (!text) {
          silentRef.current += 1
          if (silentRef.current >= SILENT_LIMIT) {
            silentRef.current = 0
            say('I did not hear anything. Tap the orb when you are ready.', { thenListen: false })
            return
          }
          setCaption('Did not catch that — try again')
          void listen()
          return
        }
        silentRef.current = 0
        void dispatch(text)
      },
      onSpeechError: (message, fatal) => {
        if (!mountedRef.current) return
        level.value = 0
        fail(message, { fatal })
      },
      onVolume: v => {
        level.value = v
      },
    })
    if (!started && mountedRef.current) {
      setOrbState('idle')
      setCaption('Tap the orb and speak')
    }
  }, [token])

  /** The orb tap: interrupt and listen, or stop an open listen. */
  const onOrbPress = useCallback(() => {
    hapticMedium()
    void stopSpeaking()
    // Tapping while listening ends the turn rather than layering a second
    // recogniser over it — a duplicate would double every transcript.
    void stopListening().then(() => {
      if (mountedRef.current && !busyRef.current) void listen()
    })
  }, [listen])

  /* ─── Turn dispatcher: the web's routing table, spoken ─── */

  const ask = useCallback(async (question: string) => {
    setOrbState('thinking')
    setCaption('Thinking…')
    try {
      const res = await askMica(token, question, sessionIdRef.current)
      if (!mountedRef.current) return
      if (res.sessionId) sessionIdRef.current = res.sessionId
      offerRef.current = offerIfNative(res.offer)
      if (res.navigate?.path) {
        const label = res.navigate.label || 'that page'
        offerRef.current = null
        onNavigate(res.navigate.path)
        say(res.answer || `Opening ${label}.`)
        return
      }
      const offered = offerRef.current
      const line = res.answer || 'I could not answer that. Try asking again.'
      say(offered ? `${line} ${offered.question}` : line)
    } catch (err) {
      if (mountedRef.current) fail(messageOf(err, 'Mica could not reach the AI service. Check AI settings.'))
    }
  }, [token, onNavigate, say, fail])

  const sendAction = useCallback(async (
    action: 'CREATE_TASK' | 'CREATE_APPOINTMENT',
    utterance: string,
    input: Record<string, unknown>,
  ) => {
    setOrbState('thinking')
    setCaption('Preparing…')
    try {
      const data = await prepareMicaAction(token, action, utterance, input)
      if (!mountedRef.current) return
      const err = data.error
      if (err?.message) throw new ApiError(400, err.message)
      handleActionResult(data, { action, utterance })
    } catch (err) {
      if (mountedRef.current) fail(messageOf(err, 'Mica could not prepare that. Check AI settings.'))
    }
  }, [token])

  const handleActionResult = useCallback((data: MicaActionPrepareResponse, meta: { action: 'CREATE_TASK' | 'CREATE_APPOINTMENT'; utterance: string }) => {
    if (data.needClarification) {
      pendingRef.current = {
        kind: 'action',
        question: data.prompt || 'Who is that for?',
        candidates: data.candidates || [],
        original: meta.utterance,
        action: meta.action,
      }
      say(data.prompt || 'Who is that for?')
      return
    }
    const summary = data.summary || 'I could not prepare that. Check the screen for details.'
    if (data.draft) {
      // No card on this screen: the draft waits on the carer's next word.
      draftRef.current = {
        kind: 'action',
        action: meta.action,
        summary,
        envelope: { ...(data as unknown as Record<string, unknown>) },
      }
      offerRef.current = null
      say(`${summary} ${SAVE_QUESTION}`)
      return
    }
    say(summary)
  }, [])

  const saveDraft = useCallback(async () => {
    const current = draftRef.current
    if (!current) return
    setOrbState('thinking')
    setCaption('Saving…')
    try {
      if (current.kind === 'action' && current.envelope) {
        const data = await confirmMicaAction(token, current.envelope, sessionIdRef.current)
        if (!mountedRef.current) return
        if (data.sessionId) sessionIdRef.current = data.sessionId
        draftRef.current = null
        const offered = offerIfNative(data.offer)
        offerRef.current = offered
        const done = current.action === 'CREATE_APPOINTMENT' ? 'Booked.' : 'Saved.'
        say(offered ? `${done} ${offered.question}` : done)
        return
      }
      if (current.kind === 'note' && current.noteResult && current.notePersonId) {
        const data = await approveVoiceNote(token, current.notePersonId, current.noteResult, {
          shift: current.noteShift,
          noteDate: current.noteDate,
        })
        if (!mountedRef.current) return
        draftRef.current = null
        // A saved note ends on itself where the phone can show it: the reply
        // carries the note it just wrote, and the page it lives on only when
        // that page is native — the profile is web-only, so this is usually
        // a plain sentence rather than an offer.
        const offered = offerIfNative(data.offer)
        offerRef.current = offered
        say(offered ? `Care note saved. ${offered.question}` : 'Care note saved.')
        return
      }
      throw new ApiError(400, 'That draft is no longer waiting. Say it again and I will prepare it fresh.')
    } catch (err) {
      // The draft is deliberately *not* dropped: a failure here is usually
      // transient, and the next "yes" retries it.
      if (mountedRef.current) fail(messageOf(err, 'Mica could not save that. Try again.'))
    }
  }, [token, say, fail])

  const discardDraft = useCallback(() => {
    if (!draftRef.current && !pendingRef.current) return
    draftRef.current = null
    pendingRef.current = null
    say('Okay — I have dropped that.')
  }, [])

  const sendCareNote = useCallback(async (utterance: string, personName?: string, personId?: string) => {
    setOrbState('thinking')
    setCaption('Drafting…')
    try {
      const data: MicaCareNoteResponse = await requestVoiceNote(token, utterance, {
        ...(personId ? { personId } : {}),
        ...(personName ? { personName } : {}),
        noteDate: localDate(),
      })
      if (!mountedRef.current) return
      if (data.needClarification) {
        const question = data.question || 'Who is this note about?'
        pendingRef.current = {
          kind: 'careNote',
          question,
          candidates: data.candidates || [],
          original: utterance,
        }
        say(question)
        return
      }
      if (!data.person?.id || !data.result) {
        throw new ApiError(400, 'Mica could not draft that note. Try again.')
      }
      // No review card on this screen: the draft waits on the carer's word.
      draftRef.current = {
        kind: 'note',
        summary: `Care note for ${data.person.name} prepared.`,
        noteResult: data.result as Record<string, unknown>,
        notePersonId: data.person.id,
        noteShift: data.noteContext?.shift,
        noteDate: data.noteContext?.noteDate,
      }
      offerRef.current = null
      const readBack =
        (typeof data.question === 'string' && data.question) ||
        (typeof (data.result as { message?: unknown }).message === 'string'
          ? (data.result as { message: string }).message
          : `Care note for ${data.person.name} prepared.`)
      say(`${readBack} ${NOTE_SAVE_QUESTION}`)
    } catch (err) {
      if (!mountedRef.current) return
      const message = messageOf(err, 'Mica could not reach the AI service. Check AI settings.')
      // A note whose subject could not be placed is not a dead end: Mica asks
      // aloud, and the next sentence is the answer.
      if (isPersonResolutionFailure(message)) {
        pendingRef.current = { kind: 'careNote', question: message, candidates: [], original: utterance }
        say(message)
        return
      }
      fail(message)
    }
  }, [token])

  const dispatch = useCallback(async (rawTranscript: string) => {
    const text = rawTranscript.trim()
    if (!text || busyRef.current) return
    busyRef.current = true
    try {
      if (isStopUtterance(text)) {
        pendingRef.current = null
        draftRef.current = null
        offerRef.current = null
        hapticLight()
        say(FAREWELL, { thenListen: false })
        return
      }

      // The answer to Mica's own question: whoever or whatever was just said.
      const pending = pendingRef.current
      if (pending) {
        pendingRef.current = null
        const spoken = text.toLowerCase()
        const match = pending.candidates.find(candidate => spoken.includes(candidate.name.toLowerCase()))
        if (pending.kind === 'careNote') {
          await sendCareNote(pending.original, match ? match.name : text, match?.id)
        } else if (pending.action) {
          await sendAction(pending.action, pending.original, match ? { personId: match.id, personName: match.name } : { personName: text })
        }
        return
      }

      // A prepared record waiting for approval. Checked before the offer
      // because a draft and an offer are never both waiting, and before every
      // routing rule below, because a bare "yes" reaching the care-note path
      // is a note drafted about nobody.
      if (draftRef.current && looksLikeConfirmation(text)) {
        await saveDraft()
        return
      }
      if (draftRef.current && /^(no|nope|nah|discard|drop it|cancel|forget it)\b/i.test(text)) {
        discardDraft()
        return
      }

      // The answer to the page Mica just offered. Checked before every other
      // path because a confirmation names no destination and asks nothing.
      if (offerRef.current && looksLikeConfirmation(text)) {
        const target = offerRef.current
        offerRef.current = null
        onNavigate(target.path)
        say(`Opening ${target.label}.`)
        return
      }

      const intent = detectMicaActionIntent(text, 'voice')
      if (intent) {
        await sendAction(intent.action, intent.utterance, intent.prefill || {})
        return
      }

      if (looksLikeNavigationIntent(text) || looksLikeQuestion(text)) {
        await ask(text)
        return
      }

      await sendCareNote(text, extractPersonNameFromUtterance(text))
    } finally {
      busyRef.current = false
    }
  }, [])

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.stage}>
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
        {orbState === 'listening' && (
          <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />
        )}
        <Animated.View style={orbStyle}>
          <Pressable
            onPress={onOrbPress}
            style={styles.orbPress}
            accessibilityRole="button"
            accessibilityLabel={
              orbState === 'listening'
                ? 'Mica is listening. Tap to stop.'
                : orbState === 'thinking'
                  ? 'Mica is thinking.'
                  : orbState === 'responding'
                    ? 'Mica is speaking. Tap to interrupt.'
                    : 'Talk to Mica. Tap and speak.'
            }
          >
            <Image
              source={orbState === 'idle' ? MICA_IDLE_IMAGE : MICA_ORB_IMAGE}
              style={styles.orb}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        </Animated.View>
        <Text
          style={[styles.caption, { color: c.muted }]}
          accessibilityLiveRegion="polite"
          numberOfLines={3}
        >
          {caption}
        </Text>
      </View>
    </View>
  )
}

const ORB_SIZE = 208

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  glow: {
    position: 'absolute',
    width: ORB_SIZE + 48,
    height: ORB_SIZE + 48,
    borderRadius: (ORB_SIZE + 48) / 2,
    backgroundColor: '#03C6B1',
  },
  ripple: {
    position: 'absolute',
    width: ORB_SIZE + 24,
    height: ORB_SIZE + 24,
    borderRadius: (ORB_SIZE + 24) / 2,
    borderWidth: 2,
    borderColor: '#03C6B1',
  },
  orbPress: { borderRadius: ORB_SIZE / 2 },
  orb: { width: ORB_SIZE, height: ORB_SIZE },
  caption: {
    marginTop: spacing.xl,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
})
