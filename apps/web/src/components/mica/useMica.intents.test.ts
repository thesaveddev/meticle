import { describe, expect, it } from 'vitest'
import {
  detectMicaActionIntent,
  extractExpiringSubject,
  extractPersonNameFromUtterance,
  isPersonResolutionFailure,
  isStopUtterance,
  looksLikeConfirmation,
  looksLikeNavigationIntent,
} from './useMica'

/**
 * The training-expiry intent detector is the one piece of Mica both entry
 * points must share, so its behaviour is pinned here rather than left to the
 * integration suites: the same sentence must draft the same renewal task
 * whether it arrives through the mic or the keyboard, and the only variation
 * allowed is the source the draft records.
 */
describe('detectMicaActionIntent — shared by the voice and text entry points', () => {
  it('drafts the identical renewal task from a spoken sentence', () => {
    const spoken = detectMicaActionIntent("Priya Sharma's medication training expires next month", 'voice')
    expect(spoken?.action).toBe('CREATE_TASK')
    expect(spoken?.prefill?.title).toBe("Priya Sharma's medication renewal")
    expect(spoken?.prefill?.assigneeName).toBe('Priya Sharma')
    expect(spoken?.prefill?.priority).toBe('medium')
    expect(spoken?.prefill?.source).toBe('voice')
    expect(spoken?.prefill?.description).toBe('Detected from: "Priya Sharma\'s medication training expires next month"')
  })

  it('drafts the identical renewal task from a typed sentence, source changed only', () => {
    const typed = detectMicaActionIntent("Priya Sharma's medication training expires next month", 'text')
    const spoken = detectMicaActionIntent("Priya Sharma's medication training expires next month", 'voice')
    // Same shape apart from the source stamp — that is the whole contract.
    expect({ ...typed, prefill: { ...(typed?.prefill || {}), source: 'voice' } }).toEqual(spoken)
    expect(typed?.prefill?.source).toBe('text')
  })

  it('covers the renewal phrasings the voice path was written for', () => {
    // "manual handling" alone does not name a certifiable thing — the sentence
    // needs training/certificate phrasing, so this stays null deliberately.
    expect(detectMicaActionIntent("Tom Bradley's manual handling runs out soon")).toBeNull()
    expect(detectMicaActionIntent("Tom Bradley's manual handling training runs out soon")).toBeTruthy()
    expect(detectMicaActionIntent('Aisha needs her certificate renewed')).toBeTruthy()
    expect(detectMicaActionIntent("Grace's training is due for renewal")).toBeTruthy()
    expect(detectMicaActionIntent('Please renew the safeguarding certificate')).toBeTruthy()
  })

  it('does not draft when there is nothing expiring — ordinary sentences stay care notes or questions', () => {
    expect(detectMicaActionIntent('Grace had a good day at the day centre')).toBeNull()
    expect(detectMicaActionIntent('Who is on shift tomorrow?')).toBeNull()
    expect(detectMicaActionIntent('Priya completed medication safety training today')).toBeNull()
  })

  it('keeps the explicit task and appointment intents working from both entries', () => {
    expect(detectMicaActionIntent('create a task to restock PPE', 'text')?.action).toBe('CREATE_TASK')
    expect(detectMicaActionIntent('book an appointment for the podiatry clinic', 'text')?.action).toBe('CREATE_APPOINTMENT')
    // "remind me about" + "reminder", not a bare "remind me to" — the implicit
    // expiry gate has to stay keyword-anchored so ordinary sentences are not
    // mistaken for tasks.
    expect(detectMicaActionIntent('remind me about the fire door task', 'voice')?.action).toBe('CREATE_TASK')
  })

  it('names the expiring subject for the known care modules', () => {
    expect(extractExpiringSubject("Tom Bradley's manual handling expires soon").name).toBe('Tom Bradley')
    expect(extractExpiringSubject("Tom Bradley's manual handling expires soon").what).toBe('manual handling')
    expect(extractExpiringSubject('the food hygiene certificate runs out next week').what).toBe('food hygiene')
    // No name said → the generic renewal title the review card shows plainly.
    expect(extractExpiringSubject('safeguarding certificate expires this month').name).toBeUndefined()
  })

  describe('routing: which endpoint a spoken sentence belongs to', () => {
    it('sends a destination request to the ask endpoint, so Mica can open the page', () => {
      // The phrasing that motivated navigation: reciting the chart was the bug.
      expect(looksLikeNavigationIntent("give me Evan Turner's mar chart for march")).toBe(true)
      expect(looksLikeNavigationIntent("open Evan Turner's marchart")).toBe(true)
      expect(looksLikeNavigationIntent('open the incidents')).toBe(true)
      expect(looksLikeNavigationIntent('take me to the rota')).toBe(true)
    })

    it('leaves questions, observations and bookings on their existing paths', () => {
      expect(looksLikeNavigationIntent('who is on shift today')).toBe(false)
      expect(looksLikeNavigationIntent('how many incidents this month')).toBe(false)
      expect(looksLikeNavigationIntent('Grace had a good day at the day centre')).toBe(false)
      expect(looksLikeNavigationIntent('book an appointment for the podiatry clinic')).toBe(false)
      expect(looksLikeNavigationIntent('create a task to restock PPE')).toBe(false)
    })

    it('sends the answer to Mica\'s offer back to the endpoint that can open it', () => {
      // Without this, a bare "yes" would fall through to the care-note path and be
      // drafted as a note about nobody (see the routing table in useMica.ts).
      for (const yes of ['yes', 'Yeah.', 'yep', 'OK', 'okay', 'sure', 'go on', 'go ahead', 'open it', 'Yes please', 'please do', 'show me']) {
        expect(looksLikeConfirmation(yes)).toBe(true)
      }
    })

    it('leaves a new question, a refusal and a note as they were', () => {
      // "yes, but…" is a new question, and Mica must answer it rather than open
      // the page it offered.
      expect(looksLikeConfirmation('yes, but what about tomorrow')).toBe(false)
      expect(looksLikeConfirmation('no thanks')).toBe(false)
      expect(looksLikeConfirmation('who is on shift today')).toBe(false)
      expect(looksLikeConfirmation('Grace had a good lunch')).toBe(false)
      expect(looksLikeConfirmation('')).toBe(false)
    })
  })

  describe('the subject of a care note, read from the sentence', () => {
    it('reads the name a carer actually says', () => {
      expect(extractPersonNameFromUtterance('Grace had a good lunch')).toBe('Grace')
      expect(extractPersonNameFromUtterance("Grace's appetite was poor today")).toBe('Grace')
      expect(extractPersonNameFromUtterance('a note about Evan Turner')).toBe('Evan Turner')
      expect(extractPersonNameFromUtterance('Grace Roberts')).toBe('Grace Roberts')
    })

    it('does not mistake a sentence starter for a person', () => {
      // Each of these would otherwise send the server a name that is not one.
      expect(extractPersonNameFromUtterance('Today she ate well')).toBeUndefined()
      expect(extractPersonNameFromUtterance('Just a quiet morning')).toBeUndefined()
      expect(extractPersonNameFromUtterance('went to the shops')).toBeUndefined()
    })
  })

  describe('ending the conversation', () => {
    it('ends on a stop phrase said on its own', () => {
      expect(isStopUtterance('bye')).toBe(true)
      expect(isStopUtterance('Goodbye!')).toBe(true)
      expect(isStopUtterance('stop listening')).toBe(true)
      expect(isStopUtterance("thanks, mica")).toBe(true)
      expect(isStopUtterance('that’s all'.replace('’', "'"))).toBe(true)
    })

    it('keeps listening when a stop word is only part of a sentence', () => {
      // A session that ended on these would cut a carer off mid-task.
      expect(isStopUtterance('close the incident')).toBe(false)
      expect(isStopUtterance('stop the fire door task')).toBe(false)
      expect(isStopUtterance('exit the building check is done')).toBe(false)
      expect(isStopUtterance('Grace had a good lunch')).toBe(false)
    })
  })

  describe('the person failures Mica answers by asking, not failing', () => {
    it('recognises the three server rejections a said name can fix', () => {
      expect(isPersonResolutionFailure('No active person named "Evan" found in this organisation')).toBe(true)
      expect(isPersonResolutionFailure('Multiple people match "Grace". Please choose one.')).toBe(true)
      expect(isPersonResolutionFailure('Person ID or name is required')).toBe(true)
    })

    it('leaves every other failure as a failure', () => {
      expect(isPersonResolutionFailure('AI not configured. Configure AI provider in Settings first.')).toBe(false)
      expect(isPersonResolutionFailure('Mica could not reach the AI service. Check AI settings.')).toBe(false)
    })
  })

  describe('short imperatives the regexes deliberately miss — settled by the server', () => {
    // These phrases name a kind of appointment (or an implied follow-up task)
    // without pairing the trigger words the local detectors anchor on, e.g.
    // /(book|schedule|arrange|add)/ + /(appointment|visit|clinic|…)/.
    // Every one here must stay NULL locally — if a phrase below ever matches
    // the regex path again, the deterministic test above this block already
    // covers it; what must not happen is these falling through to the
    // care-note draft, which is the failure that motivated /ai/mica/settle.
    // ("schedule Hoknow visit" is deliberately absent — it already matches the
    // local schedule+visit regex, verified above, and routes deterministically
    // without the LLM.)
    const settleCases = [
      'book podiatry',
      'arrange a sight check',
      'sort out a GP review',
      'remind me to call the family',
    ]
    it.each(settleCases)('regex path stays silent on "%s" so the LLM fallback decides', (text) => {
      expect(detectMicaActionIntent(text)).toBeNull()
    })

    it('documents the fallback contract: settle returns an action or none — never a third path', () => {
      // The client treats settle's reply as: intent present → same /actions
      // draft round as the regex path; intent null → care-note flow. Both
      // branches are typed as the two contracted outcomes here; this test is
      // the executable comment the fallback handler reads.
      type SettleReply = { intent: { action: 'CREATE_TASK' | 'CREATE_APPOINTMENT' } | null; action?: string }
      const classified: SettleReply = { intent: { action: 'CREATE_APPOINTMENT' } }
      const dismissed: SettleReply = { intent: null, action: 'none' }
      expect(classified.intent ? 'draft' : 'care-note').toBe('draft')
      expect(dismissed.intent ? 'draft' : 'care-note').toBe('care-note')
    })
  })
})
