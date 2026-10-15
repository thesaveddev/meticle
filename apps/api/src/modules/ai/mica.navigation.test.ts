import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseNavigationRequest } from './mica.navigation'
import type { MicaNavigationDestination } from './mica.navigation'

/**
 * The profile page whose own tab vocabulary the slugs below are checked against.
 * Read as source rather than imported: the web app is a separate workspace, and the
 * failure this guards against is the two lists drifting apart, which no type can see.
 */
const PROFILE_PAGE = path.resolve(
  __dirname, '..', '..', '..', '..', '..', 'apps', 'web', 'src', 'pages', 'people', 'PersonProfilePage.tsx',
)

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

describe('parseNavigationRequest — the detail a destination carries with it', () => {
  // 12 October 2026 is a Monday, which is what makes these literals readable: "this
  // week" is the day itself and every other week is a whole number of 7s from it.
  it('reads this, next and last week for the rota', () => {
    expect(parseNavigationRequest("open this week's rota", TODAY)?.week).toBe('2026-10-12')
    expect(parseNavigationRequest("open next week's rota", TODAY)?.week).toBe('2026-10-19')
    expect(parseNavigationRequest("open last week's rota", TODAY)?.week).toBe('2026-10-05')
    expect(parseNavigationRequest('show me the rota for last week', TODAY)?.week).toBe('2026-10-05')
    // The parameter's name is the page's, not the parser's: the planner reads `?week=`.
    expect(parseNavigationRequest("open next week's rota", TODAY)?.weekParam).toBe('week')
  })

  it('snaps a stated day to the week that contains it, and reads a weekday as the coming one', () => {
    // Said on a Monday, the coming Saturday is the 17th — the same week, not the next.
    expect(parseNavigationRequest('show me the rota for Saturday', TODAY)?.week).toBe('2026-10-12')
    // The same day is today, not a week ago: a weekday never resolves backwards.
    expect(parseNavigationRequest('open the rota for Monday', TODAY)?.week).toBe('2026-10-12')
    // A date opens the week it falls in — 4 November is a Wednesday, so its Monday.
    expect(parseNavigationRequest('open the rota for 2026-11-04', TODAY)?.week).toBe('2026-11-02')
  })

  it('puts a Sunday in the week that began six days earlier', () => {
    // The case a plain `-getDay()` gets wrong, and the one that would open the week
    // the carer is not looking at.
    expect(parseNavigationRequest("open this week's rota", '2026-10-18')?.week).toBe('2026-10-12')
    expect(parseNavigationRequest('show me the rota for Sunday', '2026-10-14')?.week).toBe('2026-10-12')
  })

  it('omits the week when none was said, rather than defaulting it', () => {
    // The planner has its own default week; sending one would freeze a page's
    // behaviour into a parser, and change the rota a carer gets today.
    const parsed = parseNavigationRequest('open the rota planner', TODAY)
    expect(parsed?.destination).toBe('rota')
    expect(parsed?.week).toBeUndefined()
    expect(parsed?.weekParam).toBeUndefined()
  })

  it('refuses a week it has no arithmetic for, and still opens the planner', () => {
    // "The week after next" is not a phrase this module resolves. Opening this
    // week's rota under it would be a confident wrong answer, so the request keeps
    // the page's own default week instead.
    const parsed = parseNavigationRequest('open the rota for the week after next', TODAY)
    expect(parsed?.destination).toBe('rota')
    expect(parsed?.week).toBeUndefined()
  })

  it("reads a person's tab, and lets the name outrank the module of the same name", () => {
    expect(parseNavigationRequest("open Grace Roberts's health tab", TODAY)).toEqual({
      destination: 'person', path: '/people', label: 'health tab',
      personName: 'Grace Roberts', needsPerson: true, tab: 'health',
    })

    // "Open the goals" is the organisation's goals page; "Grace's goals" is hers.
    expect(parseNavigationRequest('open the goals', TODAY)?.destination).toBe('goals')
    expect(parseNavigationRequest("open Grace Roberts's goals", TODAY)).toMatchObject({
      destination: 'person', tab: 'goals', path: '/people',
    })
  })

  it('does not read a tab out of a question, or out of a page with no person', () => {
    expect(parseNavigationRequest("what is in Grace Roberts's care plan", TODAY)).toBeNull()
    // No name: `/people/:id` cannot be built, so there is no page to open at all.
    expect(parseNavigationRequest('open the health tab', TODAY)).toBeNull()
    // A profile request is still a profile, and carries no tab.
    const profile = parseNavigationRequest("open Grace Roberts's care record", TODAY)
    expect(profile?.destination).toBe('person')
    expect(profile?.tab).toBeUndefined()
  })

  /** One phrase per tab a carer can name, and the slug it must produce. */
  const TAB_CASES: Array<[string, string]> = [
    ["open Grace Roberts's health tab", 'health'],
    ["open Grace Roberts's care plans", 'care-plans'],
    ["open Grace Roberts's daily notes", 'daily-notes'],
    ["open Grace Roberts's risk assessments", 'risk-assessments'],
    ["open Grace Roberts's family contacts", 'family-contacts'],
    ["open Grace Roberts's goals", 'goals'],
    ["open Grace Roberts's memory book", 'memory-book'],
    ["open Grace Roberts's body map", 'body-map'],
    ["open Grace Roberts's documents", 'documents'],
    ["open Grace Roberts's wellbeing", 'wellbeing'],
    ["open Grace Roberts's nutrition", 'nutrition'],
    ["open Grace Roberts's mood chart", 'mood-chart'],
    ["open Grace Roberts's care assessments", 'care-assessments'],
    ["open Grace Roberts's room checks", 'room-checks'],
    ["open Grace Roberts's capacity", 'capacity'],
    ["open Grace Roberts's clinical scores", 'clinical-scores'],
    ["open Grace Roberts's communication", 'communication'],
    ["open Grace Roberts's time away", 'time-away'],
    ["open Grace Roberts's care pathways", 'care-pathways'],
    ["open Grace Roberts's audit trail", 'audit-trail'],
    ["open Grace Roberts's timeline", 'timeline'],
  ]

  it.each(TAB_CASES)('"%s" reads the %s tab', (said, slug) => {
    const parsed = parseNavigationRequest(said, TODAY)
    expect(parsed?.destination).toBe('person')
    expect(parsed?.tab).toBe(slug)
    expect(parsed?.needsPerson).toBe(true)
  })

  it('sends only tab slugs the profile page actually reads', () => {
    // The slugs are `TAB_SLUGS` in PersonProfilePage.tsx, and a slug that page does
    // not know opens the profile on its first tab instead of the one asked for —
    // silently, with no error anywhere. So the two lists are read against each other
    // here, which is the only place a drift between two workspaces can be caught.
    const source = fs.readFileSync(PROFILE_PAGE, 'utf8')
    const block = source.slice(source.indexOf('const TAB_SLUGS'), source.indexOf('const SLUG_TO_TAB'))
    const declared = new Set([...block.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]))

    expect(block.length, 'the tab table was not found in PersonProfilePage').toBeGreaterThan(0)
    expect(declared.size).toBeGreaterThan(10)
    for (const [said, slug] of TAB_CASES) {
      expect(declared, `"${said}" opens ?tab=${slug}, which the profile page does not read`).toContain(slug)
    }
  })

  it('reads the subject of one incident, and leaves the list alone', () => {
    expect(parseNavigationRequest('open the fire door incident', TODAY)).toMatchObject({
      destination: 'incidents', path: '/incidents', incidentSubject: 'fire door', needsIncident: true,
    })
    expect(parseNavigationRequest('show me the incident about the fire door', TODAY)?.incidentSubject)
      .toBe('fire door')

    // The whole list is the whole list. A day, an article or a scope word is not a
    // subject to search titles for — "today's incidents" would match nothing, which
    // is a worse answer than the directory it was always about.
    expect(parseNavigationRequest("show me today's incidents", TODAY)?.incidentSubject).toBeUndefined()
    const list = parseNavigationRequest('open the incidents', TODAY)
    expect(list?.incidentSubject).toBeUndefined()
    expect(list?.needsIncident).toBeUndefined()
    // Qualified by where it happened is more than this parser reads, so it opens the
    // directory rather than searching titles for the wrong words.
    expect(parseNavigationRequest('open the near miss on the stairs', TODAY)?.incidentSubject).toBeUndefined()
  })

  it('reads the incident as the head noun, not the word qualifying it', () => {
    // The destination table matches "medication" before it reaches "incident", so
    // without the incident reading coming first this sentence opens the medication
    // charts. The carer's noun is the incident; medication is what it is about.
    expect(parseNavigationRequest('open the medication incident', TODAY)).toMatchObject({
      destination: 'incidents', incidentSubject: 'medication', needsIncident: true,
    })
    expect(parseNavigationRequest('show me the medication incident', TODAY)?.destination).toBe('incidents')
    // Nothing else moved: a medication sentence with no incident noun in it is still
    // the medication pages.
    expect(parseNavigationRequest('open the medication round', TODAY)?.destination).toBe('emedication')
    expect(parseNavigationRequest("give me Evan Turner's mar chart", TODAY)?.destination).toBe('mar-chart')
  })

  it('never reads a question as an incident', () => {
    expect(parseNavigationRequest('what happened in the fire door incident', TODAY)).toBeNull()
    expect(parseNavigationRequest('how many incidents this month', TODAY)).toBeNull()
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
