import { describe, expect, it } from 'vitest'
import { parseNavigationRequest } from './mica.navigation'
import type { MicaNavigationDestination } from './mica.navigation'

/**
 * Mica's navigation intents, pinned.
 *
 * Two properties matter here and nothing else is asserted: the sentence a carer
 * actually says ("give me Evan Turner's MAR chart for March") becomes a route
 * with the right person and month, and the utterances that already work —
 * questions, bookings, care observations — are left exactly where they were. A
 * parser that navigated on "how many incidents this month" would be worse than
 * the recital it replaces, because the answer would be replaced by a page.
 *
 * `today` is always passed explicitly: the month arithmetic is deterministic and
 * must be tested without a clock. 12 October 2026 is the phrasing test's date.
 */

const TODAY = '2026-10-12'

describe('parseNavigationRequest — a page only when the carer asked for a page', () => {
  it('keeps "give me <list>" a question, because the list is the answer', () => {
    // The regression that mattered: Mica answered "give me today's appointments"
    // via the appointments tool, and reciting it is what the carer wanted. Only a
    // *person-specific* "give me" is a request for a page.
    expect(parseNavigationRequest("give me today's appointments", TODAY)).toBeNull()
    expect(parseNavigationRequest('give me the incidents', TODAY)).toBeNull()
    expect(parseNavigationRequest('give me today\'s medication round', TODAY)).toBeNull()
  })

  it('still navigates when "give me" names a person\'s record', () => {
    expect(parseNavigationRequest("give me Evan Turner's MAR chart", TODAY)?.destination).toBe('mar-chart')
  })
})

describe('parseNavigationRequest — the phrasing that motivated it', () => {
  it('reads the chart, the person and the month out of one sentence', () => {
    const parsed = parseNavigationRequest("give me Evan Turner's mar chart for march", TODAY)
    expect(parsed).toEqual({
      destination: 'mar-chart',
      path: '/emedication',
      label: 'MAR chart',
      personName: 'Evan Turner',
      needsPerson: true,
      monthParam: 'month',
      month: '2026-03',
    })
  })

  it('reads a bare month name in the current year, never rolling forward', () => {
    // Said in October, "the March chart" is this year's March — a chart that
    // already exists. Rolling to 2027 would open an empty month.
    expect(parseNavigationRequest("show me Evan Turner's March MAR chart", TODAY)?.month).toBe('2026-03')
  })

  it('needs the recogniser\'s capitals to read a name, and shows it by its behaviour', () => {
    // A fully lowercased transcription carries no proper noun, so there is no
    // person to resolve; the request still opens the medication charts with the
    // month, which is the most it can honestly do.
    const parsed = parseNavigationRequest("give me evan turner's marchart for march", TODAY)
    expect(parsed?.destination).toBe('emedication')
    expect(parsed?.month).toBe('2026-03')
    expect(parsed?.personName).toBeUndefined()
    expect(parsed?.needsPerson).toBeUndefined()
  })

  it('reads "marchart" as the chart noun it was transcribed from', () => {
    expect(parseNavigationRequest("open Evan Turner's marchart", TODAY)?.destination).toBe('mar-chart')
  })

  it('opens a profile when a person is named', () => {
    const parsed = parseNavigationRequest("open Evan Turner's profile", TODAY)
    expect(parsed).toEqual({
      destination: 'person',
      path: '/people',
      label: 'profile',
      personName: 'Evan Turner',
      needsPerson: true,
    })
  })

  it('upgrades a person-named medication request to that person\'s chart', () => {
    const parsed = parseNavigationRequest('show me the medication chart for Evan Turner', TODAY)
    expect(parsed?.destination).toBe('mar-chart')
    expect(parsed?.personName).toBe('Evan Turner')
    expect(parsed?.needsPerson).toBe(true)
  })

  it('leaves a profile request with no person named on the question path', () => {
    // /people/:id cannot be built without an id, and opening the directory
    // instead would be answering a different question.
    expect(parseNavigationRequest('open the profile', TODAY)).toBeNull()
  })
})

describe('parseNavigationRequest — questions stay questions', () => {
  it.each([
    'who is on shift today',
    'how many incidents this month',
    'what appointments do we have today',
    'when is the next rota published',
    'where are the policies kept',
    'why is the medication chart empty',
    'list the rota',
    'tell me about the rota',
    "summarise this month's incidents",
    'give me a breakdown of incidents',
    'show me who is on shift',
    'is the MAR chart up to date',
  ])('leaves "%s" to the question path', (utterance) => {
    expect(parseNavigationRequest(utterance, TODAY)).toBeNull()
  })

  it('lets an explicit request to be taken somewhere override the question opener', () => {
    // The one override: "open" is not asking to be told, it is asking to be
    // shown. Everything else beginning with a question word stays spoken.
    expect(parseNavigationRequest('can you open the incidents', TODAY)?.destination).toBe('incidents')
    expect(parseNavigationRequest('please take me to the rota', TODAY)?.destination).toBe('rota')
  })

  it('does not treat booking or task creation as navigation', () => {
    expect(parseNavigationRequest('book an appointment for the podiatry clinic', TODAY)).toBeNull()
    expect(parseNavigationRequest('arrange a GP review for Elsie', TODAY)).toBeNull()
    expect(parseNavigationRequest('create a task to restock PPE', TODAY)).toBeNull()
    expect(parseNavigationRequest('remind me about the fire door task', TODAY)).toBeNull()
  })

  it('leaves ordinary care observations, empty input and unknown pages alone', () => {
    expect(parseNavigationRequest('Grace had a good day at the day centre', TODAY)).toBeNull()
    expect(parseNavigationRequest('', TODAY)).toBeNull()
    expect(parseNavigationRequest('   ', TODAY)).toBeNull()
    // A page that does not exist is not stretched into one that does.
    expect(parseNavigationRequest('open the staff directory', TODAY)).toBeNull()
    // While a page that does exist still resolves from a longer sentence.
    expect(parseNavigationRequest('open the settings for my account', TODAY)?.destination).toBe('settings')
  })
})

describe('parseNavigationRequest — months', () => {
  it('takes an explicit year over the current one', () => {
    expect(parseNavigationRequest("show me Evan Turner's MAR chart for March 2025", TODAY)?.month).toBe('2025-03')
  })

  it('resolves this, last and next month', () => {
    expect(parseNavigationRequest('show me the medications this month', TODAY)?.month).toBe('2026-10')
    expect(parseNavigationRequest('show me the medications for last month', TODAY)?.month).toBe('2026-09')
    expect(parseNavigationRequest('show me the medications for next month', TODAY)?.month).toBe('2026-11')
  })

  it('rolls across the year boundary in both directions', () => {
    expect(parseNavigationRequest('open the medications for last month', '2026-01-05')?.month).toBe('2025-12')
    expect(parseNavigationRequest('open the medications for next month', '2026-12-15')?.month).toBe('2027-01')
  })

  it('omits the month entirely when none was said, rather than defaulting', () => {
    const parsed = parseNavigationRequest('show me the medications', TODAY)
    expect(parsed?.destination).toBe('emedication')
    expect(parsed?.monthParam).toBe('month')
    expect(parsed?.month).toBeUndefined()
  })

  it('does not read "marchart" as the month March, or "for March" as a person', () => {
    // Both traps live in the same sentence: the chart noun contains the month
    // name, and the month follows the name preposition.
    const parsed = parseNavigationRequest("open Evan Turner's marchart for March", TODAY)
    expect(parsed?.month).toBe('2026-03')
    expect(parsed?.personName).toBe('Evan Turner')
  })
})

describe('parseNavigationRequest — every destination is reachable', () => {
  const cases: Array<[string, MicaNavigationDestination]> = [
    ['open my week', 'my-week'],
    ['show me the medications', 'emedication'],
    ["open Evan Turner's profile", 'person'],
    ['open the people directory', 'people'],
    ['open the rota planner', 'rota'],
    ['show me the appointments', 'appointments'],
    ["show me today's incidents", 'incidents'],
    ['open the tasks', 'tasks'],
    ['open the leave page', 'leave'],
    ['open the training matrix', 'training'],
    ['open the reports', 'reports'],
    ['open compliance', 'compliance'],
    ['open the policies', 'policies'],
    ['open settings', 'settings'],
    ['go to the dashboard', 'dashboard'],
    ['open the messages', 'chat'],
    ['open the goals', 'goals'],
    ['open room checks', 'room-checks'],
    ['open expenses', 'expenses'],
    ['open the shift marketplace', 'marketplace'],
    ['open the agencies', 'agencies'],
    ['open insights', 'insights'],
    ['open the live map', 'live-map'],
    ['open homecare', 'homecare'],
    ['open the payroll timesheets', 'payroll'],
  ]

  it.each(cases)('"%s" → %s', (utterance, destination) => {
    const parsed = parseNavigationRequest(utterance, TODAY)
    expect(parsed?.destination).toBe(destination)
    expect(parsed?.label.length).toBeGreaterThan(0)
  })

  it('gives every destination a path the router can push', () => {
    for (const [utterance] of cases) {
      const parsed = parseNavigationRequest(utterance, TODAY)
      expect(parsed?.path.startsWith('/'), `${utterance} must resolve to a path`).toBe(true)
    }
  })

  it('covers the whole destination union', () => {
    // If a destination is added to the type without a phrasing here, this fails
    // rather than leaving an unreachable entry in the table.
    const covered = new Set<string>(cases.map(([, destination]) => destination))
    covered.add('mar-chart')
    expect(covered.size).toBe(26)
  })
})
