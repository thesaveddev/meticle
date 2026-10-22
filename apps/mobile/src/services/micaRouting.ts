/**
 * Mica's turn dispatcher vocabulary, mirrored from the web's `useMica.ts`.
 *
 * The split is the same one the web makes: the server owns the authoritative
 * parse and the page it offered, and these matchers only decide *which
 * endpoint* an utterance goes to. A bare "yes" with nothing waiting must never
 * reach the care-note path and draft a note about nobody — the dispatcher
 * below checks confirmations before every other rule for exactly that reason.
 *
 * Kept in sync by hand with `apps/web/src/components/mica/useMica.ts` and
 * `mica.identity.ts`. If a phrase list changes there, it changes here.
 */

export type MicaActionIntent = {
  action: 'CREATE_TASK' | 'CREATE_APPOINTMENT'
  utterance: string
  prefill?: Record<string, unknown>
}

export type MicaSource = 'voice' | 'text' | 'manual'

/**
 * Does this utterance ask, rather than state? A question about an expiry
 * ("whose training is expiring") wants the roster read back, while the
 * statement ("Tom's manual handling expires soon") is a renewal task — without
 * this guard the expiry regex swallows the question and files a task nobody
 * asked for.
 */
const MICA_QUESTION_OPENER =
  /^(who|whose|which|what|when|where|why|how|is|are|was|were|do|does|did|can|could|should|would|has|have|list|show|tell|give|any|anyone)\b/i

export function looksLikeQuestion(text: string): boolean {
  const raw = text.trim()
  return /\?\s*$/.test(raw) || MICA_QUESTION_OPENER.test(raw)
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
  // Training-expiry → expiring task. A question about the same fact is not a
  // write: it falls through to the ask endpoint (see `looksLikeQuestion`).
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
 * Does this utterance ask to be taken somewhere? Anything with a navigation
 * verb at the front, or the possessive-chart shape ("Evan Turner's MAR
 * chart"), is a destination request rather than a care note, so it must reach
 * the ask endpoint — the one that can navigate.
 */
export function looksLikeNavigationIntent(text: string): boolean {
  const raw = text.trim()
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?'s\b[^.]*\b(?:mar[\s-]?charts?|marchart|medications?[\s-]?charts?)\b/i.test(raw)) return true
  return /^(open|show|take me to|go to|navigate|pull up|bring up|jump to|display|view|give me|let me see|i want to see|i need to see)\b/i.test(raw)
}

/**
 * The words that answer Mica's own question, mirrored from `AFFIRMATIVE` in
 * the server's `mica.facts.ts`. Matched whole-utterance: "yes, but what about
 * tomorrow" is a new question. "no" is absent on purpose — declining is not a
 * confirmation.
 */
const MICA_CONFIRMATIONS: readonly string[] = [
  'yes', 'yeah', 'yep', 'yup', 'aye',
  'ok', 'okay', 'sure', 'alright', 'all right',
  'go on', 'go ahead', 'go for it', 'please do', 'do it', 'open it', 'show me',
  'sounds good', 'great',
]

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
 * "close the incident" contains a stop word and must keep the session alive;
 * only a bare stop phrase ends it.
 */
const MICA_STOP_PHRASES: readonly string[] = [
  'bye',
  'byebye',
  'goodbye',
  'good bye',
  'exit',
  'stop',
  'stop listening',
  'stop mica',
  'close mica',
  'end',
  'finish',
  'finished',
  'that is all',
  "that's all",
  'thats all',
]

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
 * "Today she ate well" would hand the server the name "Today".
 */
const NOT_A_NAME = new Set([
  'today', 'tomorrow', 'yesterday', 'this', 'that', 'the', 'a', 'an', 'she', 'he', 'they', 'we', 'i',
  'it', 'there', 'then', 'just', 'also', 'and', 'but', 'so', 'had', 'has', 'was', 'were', 'is', 'went',
  'spent', 'slept', 'ate', 'drank', 'refused', 'enjoyed', 'seemed', 'appeared', 'morning', 'afternoon',
  'evening', 'night', 'note', 'care', 'resident', 'service', 'all', 'no', 'yes', 'please', 'everyone',
])

export function extractPersonNameFromUtterance(text: string): string | undefined {
  const raw = text.trim()
  const nameWord = (w?: string) => Boolean(w) && /^[A-Z][a-z]+$/.test(w as string) && !NOT_A_NAME.has((w as string).toLowerCase())

  const possessive = raw.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\b/)
  if (possessive) return possessive[1]
  const about = raw.match(/\b(?:about|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
  if (about && nameWord(about[1].split(' ')[0])) return about[1]

  const words = raw.split(/\s+/)
  if (words.length === 1 && nameWord(words[0])) return words[0]
  if (words.length === 2 && nameWord(words[0]) && nameWord(words[1])) return `${words[0]} ${words[1]}`
  const later = words.slice(1).find(nameWord)
  if (later) return later
  if (nameWord(words[0])) {
    return nameWord(words[1]) ? `${words[0]} ${words[1]}` : (words[0] as string)
  }
  return undefined
}

/**
 * Could this utterance be a write the deterministic detectors miss?
 *
 * The regexes above catch "create a task" and "book an appointment", but a
 * short spoken imperative — "book podiatry", "arrange a sight check",
 * "sort out a GP review", "remind me to call the family" — names a kind of
 * appointment or follow-up without pairing the trigger words. Those must not
 * fall through to the care-note path and draft a note about nobody: they go
 * to `/ai/mica/settle` first, and only a settled none continues as a note.
 *
 * Questions, destinations, confirmations and farewells are excluded up front:
 * a hint word inside them ("review the rota") is not a write.
 */
const WEAK_WRITE_HINT =
  /\b(book|books|booking|arrange|arranging|sort out|sorting out|schedule|scheduling|reschedule|remind me|reminds me|sight ?check|sight ?test|podiatry|optician|dentist|GP|clinic|review|check-?up|visit|task|reminder|to-?do|todo)\b/i

export function looksLikePossibleWrite(text: string): boolean {
  if (looksLikeQuestion(text) || looksLikeNavigationIntent(text) || looksLikeConfirmation(text) || isStopUtterance(text)) {
    return false
  }
  return WEAK_WRITE_HINT.test(text)
}

/**
 * Did the server reject the care note because it could not place the person?
 * These are the only server strings the client reads — a failure the carer
 * can fix by speaking one word.
 */
export function isPersonResolutionFailure(message: string): boolean {
  return /no active person named|multiple people match|person id or name is required/i.test(message)
}
