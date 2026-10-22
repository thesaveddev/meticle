/**
 * The dispatcher vocabulary is a mirror: the phone must route an utterance to
 * the same endpoint the web would send it to, or the same words get different
 * answers on different devices. These tests pin the routing table's safety
 * properties — the bare "yes" that must never become a care note, the stop
 * word inside a sentence that must not end the session, the question about an
 * expiry that must be answered rather than filed.
 */
import {
  detectMicaActionIntent,
  extractPersonNameFromUtterance,
  isPersonResolutionFailure,
  isStopUtterance,
  looksLikeConfirmation,
  looksLikeNavigationIntent,
  looksLikePossibleWrite,
  looksLikeQuestion,
} from '../micaRouting'

describe('looksLikeQuestion', () => {
  it('asks on a question mark or a question opener', () => {
    expect(looksLikeQuestion('Who is on shift today?')).toBe(true)
    expect(looksLikeQuestion('whose training is expiring')).toBe(true)
    expect(looksLikeQuestion('show me the rota')).toBe(true)
  })

  it('states are not questions', () => {
    expect(looksLikeQuestion("Tom's manual handling expires soon")).toBe(false)
    expect(looksLikeQuestion('Grace had a good lunch')).toBe(false)
  })
})

describe('detectMicaActionIntent', () => {
  it('detects an explicit task request', () => {
    // The matcher needs the word itself: "remind me about the fire door task"
    // names the task, while a bare "remind me to order grip rails" names none
    // and falls through to the care-note path — on the web too.
    expect(detectMicaActionIntent('remind me about the fire door task')?.action).toBe('CREATE_TASK')
    expect(detectMicaActionIntent('add a task to check the fire doors')?.action).toBe('CREATE_TASK')
  })

  it('detects an appointment request', () => {
    expect(detectMicaActionIntent('book a podiatry appointment for tomorrow')?.action).toBe('CREATE_APPOINTMENT')
  })

  it('drafts a renewal task from a training-expiry statement', () => {
    const intent = detectMicaActionIntent("Priya Sharma's medication training expires next month")
    expect(intent?.action).toBe('CREATE_TASK')
    expect(intent?.prefill).toMatchObject({ priority: 'medium', source: 'voice' })
  })

  it('does not draft from a question about the same fact', () => {
    expect(detectMicaActionIntent('whose training is expiring')).toBeNull()
    expect(detectMicaActionIntent('which staff training has expired')).toBeNull()
  })

  it('does not draft from ordinary care statements', () => {
    expect(detectMicaActionIntent('Grace had a good lunch')).toBeNull()
    expect(detectMicaActionIntent('who is on shift today')).toBeNull()
  })
})

describe('looksLikeNavigationIntent', () => {
  it('routes destination requests to the endpoint that can navigate', () => {
    expect(looksLikeNavigationIntent('open the room checks')).toBe(true)
    expect(looksLikeNavigationIntent("show me Evan Turner's MAR chart")).toBe(true)
    expect(looksLikeNavigationIntent('take me to my schedule')).toBe(true)
  })

  it('leaves care statements for the care-note path', () => {
    expect(looksLikeNavigationIntent('Grace had a good lunch')).toBe(false)
  })
})

describe('looksLikeConfirmation', () => {
  it('hears the words that answer Mica’s own question', () => {
    for (const word of ['yes', 'yeah', 'go on', 'sounds good', 'yes please']) {
      expect(looksLikeConfirmation(word)).toBe(true)
    }
  })

  it('a longer sentence is a new turn, not an answer', () => {
    expect(looksLikeConfirmation('yes, but what about tomorrow')).toBe(false)
    expect(looksLikeConfirmation('no')).toBe(false)
    expect(looksLikeConfirmation('')).toBe(false)
  })
})

describe('isStopUtterance', () => {
  it('ends on a bare stop phrase', () => {
    expect(isStopUtterance('bye')).toBe(true)
    expect(isStopUtterance('stop listening')).toBe(true)
    expect(isStopUtterance("that's all")).toBe(true)
  })

  it('a sentence containing a stop word keeps the session alive', () => {
    expect(isStopUtterance('close the incident')).toBe(false)
    expect(isStopUtterance('stop the fire door task')).toBe(false)
  })
})

describe('extractPersonNameFromUtterance', () => {
  it('reads the subject from capitalisation', () => {
    expect(extractPersonNameFromUtterance('Grace had a good lunch')).toBe('Grace')
    expect(extractPersonNameFromUtterance("Grace's appetite was poor")).toBe('Grace')
    expect(extractPersonNameFromUtterance('a note about Evan Turner')).toBe('Evan Turner')
  })

  it('refuses sentence-starter words as names', () => {
    expect(extractPersonNameFromUtterance('Today she ate well')).toBeUndefined()
    expect(extractPersonNameFromUtterance('just a quiet morning')).toBeUndefined()
  })
})

describe('looksLikePossibleWrite', () => {
  it('flags the short imperatives the regexes miss, for the settle fallback', () => {
    for (const text of [
      'book podiatry',
      'arrange a sight check',
      'sort out a GP review',
      'remind me to call the family',
    ]) {
      expect(detectMicaActionIntent(text)).toBeNull()
      expect(looksLikePossibleWrite(text)).toBe(true)
    }
  })

  it('leaves questions, destinations, confirmations and farewells alone', () => {
    expect(looksLikePossibleWrite('open the rota')).toBe(false)
    expect(looksLikePossibleWrite('book an appointment for the podiatry clinic?')).toBe(false)
    expect(looksLikePossibleWrite('yes')).toBe(false)
    expect(looksLikePossibleWrite('bye')).toBe(false)
  })

  it('leaves ordinary care statements for the care-note path', () => {
    expect(looksLikePossibleWrite('Grace had a good lunch')).toBe(false)
    expect(looksLikePossibleWrite('close the incident')).toBe(false)
  })
})

describe('isPersonResolutionFailure', () => {
  it('recognises the failures a spoken name can fix', () => {
    expect(isPersonResolutionFailure('No active person named "Grac" found in this organisation')).toBe(true)
    expect(isPersonResolutionFailure('Multiple people match "Grace". Please choose one.')).toBe(true)
    expect(isPersonResolutionFailure('Person ID or name is required')).toBe(true)
  })

  it('leaves other failures alone', () => {
    expect(isPersonResolutionFailure('AI not configured. Configure AI provider in Settings first.')).toBe(false)
  })
})
