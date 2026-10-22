import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../services/api'
import { localDate } from '../../utils/dateFormat'
import { MICA_STOP_PHRASES, type MicaState } from './mica.identity'
import { createMicaAudioChannel, type MicaAudioChannel } from './mica.audio'
import { createMicaTimings, type MicaTimingsRecorder } from './mica.timings'

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

/**
 * A record Mica has prepared and is waiting for the carer to save.
 *
 * This is the client half of the confirm-before-persist contract the action
 * gateway has always had (`apps/api/src/modules/ai/actions/`): the server
 * resolves and disambiguates, answers with a draft, and the row exists only when
 * `/ai/mica/actions/confirm` is called with that same envelope. The draft used
 * to be written to `sessionStorage` and read by nobody, so no write prepared by
 * voice could ever be saved — the card below is the missing half.
 */
export interface MicaDraft {
  action: 'CREATE_TASK' | 'CREATE_APPOINTMENT'
  /** The server's own read-back of the draft, as it was spoken aloud. */
  summary: string
  /** The fields the draft would create, for the card to list. */
  output: Record<string, unknown>
  /**
   * The reply from `/ai/mica/actions`, verbatim: the envelope `confirm`
   * expects back. Held whole rather than rebuilt, because the server
   * re-validates it as the thing it issued.
   */
  envelope: Record<string, unknown>
}

/**
 * The page a saved record lives on, waiting on the carer's next word.
 *
 * Returned by both read and write flows under the same key (`offer`), so the
 * *spoken* route into a record is one thing. This is the visible half: the
 * server holds the same page for a bare "yes", and tapping the control sends
 * the carer to the identical path.
 */
export interface MicaOffer {
  path: string
  label: string
  /** The question the reply ended with, e.g. "Want me to open the new task?". */
  question: string
}

const PERSON_STORAGE_KEY = 'mica.selectedPerson'
const DRAFT_STORAGE_KEY = 'mica.pendingDraft'
const SESSION_STORAGE_KEY = 'mica.sessionId'
/**
 * Follow-up memory handle. The server issues an opaque sessionId on each
 * answered question; we echo it back on the next ask so "what about
 * tomorrow?" resolves against "who is on shift today?". Persisted per tab
 * session (not localStorage — conversation memory should not outlive the
 * browser session on a shared device), and invalidated whenever Mica's
 * subject person changes, since a new person starts a new topic.
 */
const micaSessionIdRef: { current: string | null } = { current: null }

/**
 * Writes the session id down as well as holding it.
 *
 * The id is opaque and scoped server-side to (organizationId, userId), so a copy
 * in this tab's storage is a handle, not a transcript — the module header above
 * has always claimed this persistence and the code did not do it. It matters
 * now for one concrete reason: a record Mica prepared survives a reload, and the
 * offer that follows saving it is only answerable by the conversation it was
 * prepared in. Without the id, a reloaded draft would save and then leave the
 * carer's "yes" addressing a conversation the server no longer has.
 */
const rememberSessionId = (id: string | undefined): void => {
  if (!id) return
  micaSessionIdRef.current = id
  try { window.sessionStorage.setItem(SESSION_STORAGE_KEY, id) } catch { /* unavailable */ }
}

/** Clears the handle from memory *and* from the tab, so neither can outlive its topic. */
const forgetSessionId = (): void => {
  micaSessionIdRef.current = null
  try { window.sessionStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* unavailable */ }
}

/**
 * The draft this tab was in the middle of, if any.
 *
 * Restored rather than re-prepared: a reload is not a decision to abandon the
 * record Mica read back, and the card is one tap from saving it. Validation is
 * deliberately strict — a shape this does not recognise is discarded rather than
 * handed to a card that would render blanks and a Save button.
 */
const readStoredDraft = (): MicaDraft | null => {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MicaDraft
    const usable =
      parsed &&
      (parsed.action === 'CREATE_TASK' || parsed.action === 'CREATE_APPOINTMENT') &&
      typeof parsed.summary === 'string' &&
      !!parsed.envelope && typeof parsed.envelope === 'object'
    if (!usable) return null
    return { ...parsed, output: parsed.output && typeof parsed.output === 'object' ? parsed.output : {} }
  } catch {
    return null
  }
}

/** The session id this tab was last using, read once on the first hook mount. */
let sessionIdRestored = false
const restoreSessionId = (): void => {
  if (sessionIdRestored) return
  sessionIdRestored = true
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) micaSessionIdRef.current = stored
  } catch {
    // Storage unavailable (private mode): the in-memory handle still works.
  }
}

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

/**
 * Does this utterance ask, rather than state?
 *
 * The expiry intent below is Mica's one *implicit* write: a statement that
 * someone's training has run out — "Tom's manual handling expires soon" — is a
 * renewal task, and has been since the voice path was built. A question about the
 * same fact is a different request entirely: "whose training is expiring" and
 * "which staff training has expired" want the roster read back, and the server
 * answers those from the organisation's own rows with no provider at all
 * (`mica.facts.ts`). Without this guard the expiry regex swallowed the question
 * and drafted a generic "Training renewal follow-up" task out of it — the answer
 * never arrived, and a task nobody asked for was filed instead.
 *
 * A leading question word is the signal, and a trailing question mark catches the
 * sentences whose opener is not one of them ("Priya's MAR chart is overdue?").
 */
const MICA_QUESTION_OPENER =
  /^(who|whose|which|what|when|where|why|how|is|are|was|were|do|does|did|can|could|should|would|has|have|list|show|tell|give|any|anyone)\b/i

export function looksLikeQuestion(text: string): boolean {
  const raw = text.trim()
  return /\?\s*$/.test(raw) || MICA_QUESTION_OPENER.test(raw)
}

export function detectMicaActionIntent(text: string, source: MicaSource = 'voice'): MicaActionIntent | null {
  if (/\b(create|add|make|set|remind me (about|to)|schedule|book|arrange)\b/i.test(text) && /\b(task|reminder|to-do|todo)\b/i.test(text)) {
    return { action: 'CREATE_TASK', utterance: text }
  }
  if (/\b(book|schedule|arrange|add)\b/i.test(text) && /\b(appointment|visit|clinic|check-?up|review)\b/i.test(text)) {
    return { action: 'CREATE_APPOINTMENT', utterance: text }
  }
  // Training-expiry → expiring task, e.g. "Tom's manual handling expires soon".
  // A question about the same fact is not a write: it is answered from the roster
  // (see `looksLikeQuestion`), so it must fall through to the ask endpoint.
  const expiry = !looksLikeQuestion(text)
    && /\b(training|certificate|certification)\b/i.test(text)
    && /\b(expir\w+|runs? out|needs? renew\w*|due for renewal|renew\w*)\b/i.test(text)
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
const VAD_SILENCE_MS = 800

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
  const [state, setStateRaw] = useState<MicaState>('idle')
  /**
   * The voice-pipeline timings, one recorder per session.
   *
   * Held in a ref for the same reason the amplitude channel is: eight marks per
   * turn are written by the pipeline and read by whoever is looking, and none of
   * them may cost a render of the assistant. See `mica.timings.ts`.
   */
  const timingsRef = useRef<MicaTimingsRecorder | null>(null)
  if (!timingsRef.current) timingsRef.current = createMicaTimings()
  const timings = timingsRef.current

  /**
   * Every entry into a state, in one place, so the timings cannot miss a path.
   *
   * Two of Mica's states are also two of the eight stages — `listening` and
   * `idle` — and they are entered from about a dozen places: every reply path,
   * the dispatcher, the recogniser's own error and end handlers, the tear-down,
   * and `MicaProvider` closing the notice. Marking at each call site would be one
   * omission away from a stage that silently reads "never happened", which is the
   * failure `mica.timings.ts` is most careful about.
   *
   * Wrapping keeps the name `setState`, so every existing call site — including
   * the one `MicaProvider` holds — and every dependency array is untouched and
   * all of them are now instrumented. The wrapper is stable (its only dependency
   * is the ref-held recorder), so it is a drop-in for React's own setter.
   */
  const setState = useCallback((next: MicaState) => {
    if (next === 'listening') timings.mark('listening')
    else if (next === 'idle') timings.mark('idle')
    setStateRaw(next)
  }, [timings])
  /**
   * The amplitude channel, and the reason it is not `useState`.
   *
   * The microphone meter samples the analyser every animation frame, and the
   * level is consumed by exactly one thing: the orb's transform. As state it
   * was a render of the whole assistant per frame (measured: 42 commits and
   * 2339ms of render work across 30 audio frames — see
   * `mica.renderBudget.test.tsx`). As a channel it reaches the orb directly and
   * React never hears about it.
   *
   * `audioLevelRef` is kept in step from the same subscription, because the
   * voice-activity detection in `beginRecognition` reads the level from a timer
   * and must not depend on a render having happened.
   */
  const audioChannelRef = useRef<MicaAudioChannel | null>(null)
  if (!audioChannelRef.current) audioChannelRef.current = createMicaAudioChannel()
  const audio = audioChannelRef.current
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

  /**
   * The record Mica has prepared and not yet saved.
   *
   * Restored from the tab on mount (see `readStoredDraft`): a draft is
   * work-in-progress, not session state, so it outlives a reload and a session
   * that ended — nothing is written server-side until it is approved, so dropping
   * it silently would be losing data the carer asked for.
   */
  const [draft, setDraft] = useState<MicaDraft | null>(() => {
    restoreSessionId()
    return readStoredDraft()
  })
  const draftRef = useRef<MicaDraft | null>(draft)
  /** True while the draft is being saved, so the card's control can say so. */
  const [savingDraft, setSavingDraft] = useState(false)
  const savingDraftRef = useRef(false)
  /** The page the last saved record lives on, waiting on the carer's word. */
  const [offer, setOffer] = useState<MicaOffer | null>(null)

  // The ref is what the turn dispatcher reads: it decides *which endpoint* the
  // next word reaches, inside a callback that must not be rebuilt (and must not
  // see a stale draft) on every render.
  useEffect(() => { draftRef.current = draft }, [draft])

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
      forgetSessionId()
      // A new subject starts a new topic: a page offered about the last one is
      // not this conversation's to open, and an offer still on screen belongs to
      // the conversation that ended.
      offeredPageRef.current = false
      setOffer(null)
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
    audio.publish(0)
  }, [audio])

  /** Stops any in-flight server-TTS playback and its amplitude meter. */
  const stopTtsPlayback = useCallback(() => {
    if (ttsRafRef.current !== null) { cancelAnimationFrame(ttsRafRef.current); ttsRafRef.current = null }
    try { ttsSourceRef.current?.stop() } catch { /* already stopped */ }
    ttsSourceRef.current = null
    if (ttsCtxRef.current) { ttsCtxRef.current.close().catch(() => undefined); ttsCtxRef.current = null }
    audio.publish(0)
  }, [audio])

  /**
   * Opens the session's microphone.
   *
   * Returns whether a real stream is now feeding the meter, rather than
   * swallowing the failure. The caller needs to know: the `micReady` timing stage
   * must not report a microphone that never opened, and a failed open is the
   * difference between "the room is quiet" and "there is nothing to hear".
   */
  const startMicMeter = useCallback(async (): Promise<boolean> => {
    // One mic stream for the whole session: continuous listening must not
    // re-open (and re-close) the microphone on every turn.
    if (streamRef.current) return true
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
        audio.publish(Math.max(0, Math.min(1, smoothed * 2.4)))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      return true
    } catch {
      // Mic denied / unavailable: Mica still listens via the recognizer; the
      // orb simply rests at zero amplitude rather than dying.
      return false
    }
  }, [audio])

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

    /**
     * The reply has finished playing. This is the `done` stage.
     *
     * Wrapped rather than marked at each exit, because this function has four ways
     * out — the server-TTS `onended`, the synthesiser's `onend`, its `onerror`, and
     * the two fallbacks that give up entirely — and a missed one would leave the
     * last turn reading as a session that is still talking.
     */
    const complete = () => {
      timings.mark('done')
      onDone()
    }

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
        audio.publish(Math.max(0, Math.min(1, smoothed * 2.4)))
        ttsRafRef.current = requestAnimationFrame(tick)
      }
      ttsRafRef.current = requestAnimationFrame(tick)
      source.onended = () => {
        stopTtsPlayback()
        audio.publish(0)
        complete()
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
      if (!synth) { complete(); return }
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
        audio.publish(Math.max(0, Math.min(1, level)))
        raf = requestAnimationFrame(tick)
      }
      const stopEnvelope = () => {
        if (raf !== null) cancelAnimationFrame(raf)
        raf = null
        audio.publish(0)
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
      utter.onend = () => { stopEnvelope(); complete() }
      utter.onerror = () => { stopEnvelope(); complete() }
      synth.cancel()
      synth.speak(utter)
    } catch {
      complete()
    }
  }, [audio, stopTtsPlayback, timings])

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
    // A stop phrase is answered without a request, but it is still Mica beginning
    // a reply — so the stage fires here too, and the turn is complete rather than
    // missing `replyStarted` because it took the no-request path.
    timings.mark('replyStarted')
    setResponseMessage('Okay — I’ll stop listening. Tap the orb when you need me.')
    setState('responding')
    speak('Okay, I will stop listening. Tap the orb when you need me.', () => stopListening())
  }, [speak, stopListening, timings])

  // ── Turn plumbing ────────────────────────────────────────────────────

  const transcriptRef = useRef('')
  const audioLevelRef = useRef(0)
  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  // Mirror the channel into the ref the VAD timer reads. No state, no render.
  useEffect(() => audio.subscribe(level => { audioLevelRef.current = level }), [audio])

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
    // The first reply content that exists. On this pipeline the endpoint is not
    // streamed, so this is the whole response arriving — see `firstToken` in
    // `mica.timings.ts` before quoting this as a time-to-first-token.
    timings.mark('firstToken')
    setResponseMessage(message)
    setState('responding')
    speak(message, () => (opts.end ? stopListeningRef.current() : finishTurn()))
  }, [finishTurn, speak, timings])

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
    // A failure is still a reply the carer hears, so the stage fires and the turn
    // is readable. Without this, every failed turn would look like a turn where
    // Mica never answered, which is a different (and wrong) diagnosis.
    timings.mark('firstToken')
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
  }, [speak, stopMicMeter, timings])

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

  /**
   * Holds the draft Mica just read back, on screen and in the tab.
   *
   * A new prepared record replaces the previous one: the carer has moved on, and
   * two drafts on one card would be a queue with no ordering. Writing it to the
   * tab is what makes the card survive a reload (`readStoredDraft`) — the same
   * write the hook always made, now with a reader.
   */
  const keepDraft = useCallback((next: MicaDraft) => {
    setDraft(next)
    draftRef.current = next
    try { window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next)) } catch { /* unavailable */ }
  }, [])

  /** Drops the draft everywhere it is held: saved, or discarded by the carer. */
  const forgetDraft = useCallback(() => {
    setDraft(null)
    draftRef.current = null
    try { window.sessionStorage.removeItem(DRAFT_STORAGE_KEY) } catch { /* unavailable */ }
  }, [])

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
      // The reply ends by asking to save it ("Shall I save it?"), so the draft has
      // to be somewhere the carer can approve it: on the card, and in the tab.
      keepDraft({
        action: resData.action as MicaDraft['action'],
        summary: msg,
        output: (data.output as Record<string, unknown>) || {},
        envelope: resData,
      })
      // A prepared record is the newest thing said, so anything the last turn
      // offered is no longer waiting on an answer.
      offeredPageRef.current = false
      setOffer(null)
    }
    reply(msg)
  }, [keepDraft, reply])

  /**
   * Saves the draft on the card — the only path from a spoken request to a row.
   *
   * The envelope goes back exactly as the server issued it (`/ai/mica/actions`
   * re-validates its own draft at confirm), the session goes with it so the offer
   * that follows is answerable in the conversation it was prepared in, and the
   * reply that comes back is the same shape a list answer returns: what was saved,
   * and the page it lives on.
   */
  const saveDraft = useCallback(async () => {
    const current = draftRef.current
    if (!current || savingDraftRef.current) return
    savingDraftRef.current = true
    setSavingDraft(true)
    timings.mark('replyStarted')
    setState('thinking')
    try {
      const res = await api.post('/ai/mica/actions/confirm', {
        draft: current.envelope,
        ...(micaSessionIdRef.current ? { sessionId: micaSessionIdRef.current } : {}),
      })
      const data = res.data as {
        sessionId?: string
        offer?: { path?: string; label?: string; offer?: string }
      }
      if (data?.sessionId) rememberSessionId(data.sessionId)
      forgetDraft()
      const page = data?.offer
      if (page?.path) {
        setOffer({
          path: page.path,
          label: page.label || 'the new record',
          question: page.offer || `Want me to open ${page.label || 'it'}?`,
        })
        // The server is holding the same page, so the carer can answer by voice
        // ("yes") or by tapping the control — both land on the record.
        offeredPageRef.current = true
      }
      // The question the server asks is the last thing said, exactly as it is for
      // a list answer that ends by offering its page — and the verb follows the
      // action through the flow the way the card's own control does: the button
      // says "Book appointment", so the reply says "Booked." rather than "Saved.".
      const done = current.action === 'CREATE_APPOINTMENT' ? 'Booked.' : 'Saved.'
      reply(page?.offer ? `${done} ${page.offer}` : done)
    } catch (e: unknown) {
      const failure = apiFailure(e, 'Mica could not save that. Try again.')
      // The draft is deliberately *not* dropped: a failure here is usually
      // transient, and the card is the retry. The reason is spoken and shown in
      // the message above the card rather than hidden behind it.
      fail(failure.message, { fatal: failure.fatal })
    } finally {
      savingDraftRef.current = false
      setSavingDraft(false)
    }
  }, [fail, forgetDraft, reply, setState, timings])

  /** Drops the draft: the carer's other answer to "shall I save it?". */
  const discardDraft = useCallback(() => {
    if (!draftRef.current) return
    forgetDraft()
    reply('Okay — I’ve dropped that draft.')
  }, [forgetDraft, reply])

  /**
   * Opens the page a saved record lives on, from a tap rather than a word.
   *
   * The same route the server would return if the carer said "yes" — the page is
   * pushed, the session drops into the bar, and the thing Mica just saved is what
   * the carer is now looking at.
   */
  const openOffer = useCallback(() => {
    if (!offer) return
    const nav: MicaNavigateTarget = { path: offer.path, label: offer.label }
    setOffer(null)
    // A tap answered the offer, so nothing is waiting on a word any more.
    offeredPageRef.current = false
    setLastNavigation(nav)
    onNavigateRef.current?.(nav)
    setMinimised(true)
  }, [offer, setLastNavigation, setMinimised])

  const sendAction = useCallback(async (
    action: 'CREATE_TASK' | 'CREATE_APPOINTMENT',
    utterance: string,
    input: Record<string, unknown>,
  ) => {
    timings.mark('replyStarted')
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
  }, [fail, handleActionResult, timings])

  /**
   * The care-note path. A statement about someone is drafted as a note, and the
   * note's subject is the name spoken in it. When the server cannot identify
   * that person it asks aloud, and the next utterance is the answer.
   */
  const sendCareNote = useCallback(async (utterance: string, personName?: string, personId?: string) => {
    timings.mark('replyStarted')
    setState('thinking')
    try {
      const res = await api.post('/ai/voice/notes', {
        transcription: utterance,
        intent: utterance,
        ...(personId ? { personId } : {}),
        ...(personName ? { personName } : {}),
        ...(!personId && !personName && selectedPersonRef.current ? { personId: selectedPersonRef.current.id } : {}),
        source: 'voice',
        // The day the carer is speaking, in their own timezone: a night-shift
        // note taken at 00:30 would otherwise be filed on the previous date.
        noteDate: localDate(),
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
    timings.mark('replyStarted')
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
        offer?: { path?: string; label?: string; offer?: string }
      }
      if (data?.sessionId) rememberSessionId(data.sessionId)
      // The page this answer offered, if any — the same state a saved record
      // fills, so one control answers both. The server keeps the authoritative
      // copy and retires it with the turn that follows; this is the copy the carer
      // can see and tap, and the `offer` flag below is what routes "yes" back to
      // the endpoint that can open it.
      const offered = data?.offer
      offeredPageRef.current = Boolean(offered?.path)
      setOffer(offered?.path
        ? {
          path: offered.path,
          label: offered.label || 'that page',
          question: offered.offer || `Want me to open ${offered.label || 'that page'}?`,
        }
        : null)

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
        // The carer is being taken there, so nothing is waiting on a word.
        setOffer(null)
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

    // A prepared record waiting for approval. The server's draft ends by asking
    // "shall I save it?", and the words that answer it are the same ones that
    // answer an offered page — but the outcome is a write, and the draft on the
    // card is the only thing that knows what to write. Checked before the offer
    // because a draft and an offer are never both waiting, and before every
    // routing rule below, because a bare "yes" reaching the care-note path is a
    // note drafted about nobody.
    if (draftRef.current && looksLikeConfirmation(text)) {
      await saveDraft()
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

    // A question — or an imperative that wants the answer spoken ("show me the
    // rota") — goes to the endpoint that answers it. The question shapes are the
    // same ones the server reads, and "whose"/"which"/"has" are here because the
    // list facts ask that way now ("whose training is expiring").
    if (looksLikeNavigationIntent(text) || looksLikeQuestion(text)) {
      await askMica(text)
      return
    }

    await sendCareNote(text, extractPersonNameFromUtterance(text))
  }, [askMica, endWithFarewell, saveDraft, sendAction, sendCareNote])

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
      // e.results is cumulative for the whole turn: rebuilding from 0 keeps
      // every segment. Slicing from e.resultIndex dropped earlier finals on
      // multi-event turns, so a long sentence arrived as its last few words.
      let full = ''
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
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
      // Trimmed: an interim result of only spaces is truthy but says nothing —
      // sending it made sendToAi return early with no reply and no restart, so
      // the session sat in `listening` with no recogniser running (no response,
      // ever). An empty turn is a silent turn instead: listen again or give up.
      const said = transcriptRef.current.trim()
      if (said) {
        silentEndsRef.current = 0
        // The sentence is over: the recogniser has a final transcript and nothing
        // further is coming from this turn. Marked *before* dispatch, so the gap
        // to `replyStarted` is the turn dispatcher's own cost and not the
        // recogniser's — which is the distinction that tells you whether to look
        // at the routing table or at the speech API.
        timings.mark('speechDone')
        sendToAiRef.current(said)
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
    let lastSeenLen = 0
    const vadTimer = window.setInterval(() => {
      if (!recognitionRef.current) {
        window.clearInterval(vadTimer)
        return
      }
      const said = transcriptRef.current
      if (said.trim()) hadVoice = true
      // Words still arriving count as voice even when the meter reads low (mic
      // meter denied or unavailable, quiet mic): without this the sentence was
      // cut VAD_SILENCE_MS after it began no matter how long the carer kept
      // talking, because lastVoiceAt only ever moved on audio level.
      if (said.length !== lastSeenLen) {
        lastSeenLen = said.length
        lastVoiceAt = Date.now()
      }
      if (audioLevelRef.current >= 0.06) lastVoiceAt = Date.now()
      if (hadVoice && Date.now() - lastVoiceAt > VAD_SILENCE_MS && audioLevelRef.current < 0.06) {
        window.clearInterval(vadTimer)
        rec.stop()
      }
    }, 200)
    recognitionRef.current = rec
    rec.start()
  }, [reply, timings])

  useEffect(() => { beginRecognitionRef.current = beginRecognition })

  /** Where the conversation begins: the orb's tap. */
  const startListening = useCallback(async () => {
    // The origin of the turn: this callback *is* the tap, so everything the carer
    // waits for afterwards is measured from here.
    timings.mark('tap')
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    // The session is live from the tap, not from the microphone.
    //
    // Everything below this point is asynchronous, and the slowest of them is the
    // probe — it is where the browser asks for permission, so on a first use it
    // waits for a person to answer a dialog. Awaiting it first meant a tap showed
    // *nothing*: no overlay, no pendant, no cue that anything had happened, for
    // as long as the person took to decide. The state change is what the press is
    // owed, and it costs nothing to give it first.
    continuousRef.current = true
    setError(null)
    setTranscript('')
    setResponseMessage(null)
    setLastNavigation(null)
    setMinimised(false)
    setState('listening')
    silentEndsRef.current = 0
    pendingRef.current = null
    // A session that just started has heard no offer, whatever the server still
    // holds: the carer did not hear it in this session either. A draft is left
    // alone — it is prepared work, not something this session heard.
    offeredPageRef.current = false
    setOffer(null)

    // Fail fast (and visibly) when the mic is actually unusable, instead of
    // opening the display that listens to nothing. The Permissions API advisory
    // state is NOT trusted as a denial: some embedded webviews report 'denied'
    // while getUserMedia succeeds, which would block a working mic forever.
    // The gate below is the ground truth — whether a real mic stream opens.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach(t => t.stop())
    } catch {
      // Close the session this tap opened, and only then say why: a listening
      // overlay over a microphone the browser refused would be a lie the user
      // cannot correct, while the notice is the house treatment for a failure
      // that never started a session.
      if (continuousRef.current) {
        stopListening()
        setSupported(false)
        setError('Microphone permission is blocked. Allow mic access for this site, then try Mica again.')
      }
      return
    }
    // The permission dialog is exactly where a session can end underneath us —
    // Escape and the end control are both reachable, because the overlay is up
    // while the probe runs. Opening a recogniser after that would listen to a
    // room nobody asked us to hear.
    if (!continuousRef.current) return
    // A real microphone stream is open from here — the first moment the orb is
    // driven by an actual input instead of resting at zero. `startMicMeter`
    // reports the failure rather than swallowing it, so a denied mic leaves this
    // stage absent instead of claiming an instant open.
    if (await startMicMeter()) timings.mark('micReady')
    if (!continuousRef.current) return
    beginRecognition()
  }, [beginRecognition, startMicMeter, stopListening, timings])

  return {
    state,
    setState,
    /** The session's amplitude channel; the orb subscribes, React does not. */
    audio,
    /**
     * The session's voice-pipeline timings. Returned so the readout panel and the
     * `window.__micaTimings` handle can read the numbers the pipeline wrote;
     * neither of them writes any, and nothing here sends them anywhere.
     */
    timings,
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
    /**
     * The record Mica has prepared and not yet saved, if any: what the review card
     * renders. Restored from the tab, so a reload mid-draft does not throw away
     * the record the carer asked for.
     */
    draft,
    /** True while that draft is being saved, so the card can say so. */
    savingDraft,
    /** Approve it. The only path from a prepared draft to a stored row. */
    saveDraft,
    /** Drop it, which is the carer's other answer to "shall I save it?". */
    discardDraft,
    /**
     * The page the last answer or save offered, waiting to be opened — shown as a
     * control, and answerable by voice as well (a bare "yes" reaches the server
     * that asked, which is holding the same page).
     */
    offer,
    openOffer,
    startListening,
    stopListening,
  }
}
