import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Keeps the customer-facing guide honest.
 *
 * A privacy notice that is confidently wrong is bad for a worker reading it. A
 * *customer* guide that is confidently wrong is worse, because a registered
 * manager will make a workforce decision on it, and they will not have the
 * source in front of them to check it against. "Your staff's pay is unaffected"
 * is the kind of sentence that ends a dispute if true and starts one if not.
 *
 * So the claims that would do real damage if they drifted are asserted here
 * against the code, rather than left to review. The prohibitions come first and
 * are deliberately blunt: this document must never be the place a customer
 * learns that Meticle Care tracks people.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')
const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8')

const guide = read('docs/LOCATION_RECORDING_GUIDE.md')
/**
 * The guide as prose: line breaks collapsed and markdown emphasis removed.
 *
 * Matching a markdown document for a sentence is otherwise misleading — "It
 * is **not** a security control" is the sentence, and a test written against
 * the raw bytes fails on the asterisks and gets "fixed" by weakening the
 * assertion, which is how a guard stops guarding.
 */
const guideText = guide.replace(/\*\*/g, '').replace(/\s+/g, ' ')

describe('the customer guide, against the code it describes', () => {
  it('quotes a check-in distance threshold the API actually defaults to', () => {
    const controller = read('apps/api/src/modules/homecare/homecare.controller.ts')
    // `|| 500` in the endpoint, and the guide says 500 metres. If the default
    // ever moves, a manager reading "500 metres" is quoting a stale guarantee.
    expect(controller).toMatch(/location_threshold_meters \|\| 500/)
    expect(guide).toMatch(/500 metres by default/)
    // Sanity: the guide is actually the document, not an empty read.
    expect(guideText.length).toBeGreaterThan(2000)
  })

  it('does not promise pay is unaffected without that being true of the pay path', () => {
    // The single most load-bearing sentence in the document. A timesheet built
    // from coordinates would make it a lie told to a care provider about money.
    const repository = read('apps/api/src/modules/homecare/homecare.repository.ts')
    const timesheetInsert = repository
      .split('INSERT INTO homecare_timesheets')[1]
      ?.split('VALUES')[0] ?? ''
    expect(timesheetInsert).toBeTruthy()
    expect(timesheetInsert).not.toMatch(/latitud|longitud/)
    // And worked time comes from the two timestamps, not from a fix.
    expect(repository).toMatch(/check_out_at\).getTime\(\) - new Date\(v\.check_in_at\)/)
    expect(guideText).toMatch(/does not affect anyone'?s pay/i)
  })

  it('says the map is refused rather than silently emptied', () => {
    const dashboard = read('apps/api/src/modules/dashboard/dashboard.controller.ts')
    expect(dashboard).toMatch(/switched off for your organisation/)
    // A 403 is a deliberate choice: an empty 200 would let a stale client
    // believe it was simply a quiet day.
    expect(dashboard).toMatch(/AppError\(403,/)
    expect(guideText).toMatch(/returns a refusal from the server/)
  })

  it('does not tell a customer the overdue-call alert needs location', () => {
    // The guide recommends the alert as the answer to lone-worker safety. If it
    // ever gained a location dependency, that recommendation would be sending
    // a manager to a feature that cannot do what we said.
    const reminders = read('apps/api/src/modules/homecare/homecare.reminders.ts')
    expect(reminders).not.toMatch(/latitud|longitud/)
  })

  it('admits the proximity check is a guardrail, not a security control', () => {
    // It runs on the carer's own device, so a manager who believes it stops a
    // deliberate false check-in would be wrong about their attendance evidence.
    expect(guideText).toMatch(/not a security control/i)
  })

  it('discloses the app build, because the server guarantee and the prompt differ', () => {
    // Server-side the switch holds on any app version. The permission prompt
    // lives in the app. Shipping the one without the other is exactly the
    // state we are in, and a manager who is surprised by a prompt from a
    // switched-off feature will not trust the setting.
    expect(guideText).toMatch(/new app build is published|until that build/i)
  })
})

/**
 * Every *sentence* of the guide that mentions a dangerous phrase must deny it.
 *
 * A blunt "the document must not contain \\"live\\"" test is unusable here,
 * because the guide's job includes telling a manager *not* to say the product is
 * live — so the word has to appear, in a negation. What must never happen is
 * the word appearing in a sentence that asserts it.
 *
 * Sentence granularity, not line. That was the first version of this test and
 * it passed a document asserting that a carer's agreement makes monitoring
 * lawful: the markdown line was soft-wrapped, so the claim and the word
 * "cannot" from the *next* sentence landed on the same line, and the line
 * looked like a denial. Matching a claim against its own neighbours rather
 * than its neighbours' neighbours is the whole point.
 */
const DENIAL = /\b(do not|don't|never|nor|cannot|can't|not|no|without|rather than|instead of)\b/i

/**
 * The guide split into sentences, so a claim is judged with its own clause.
 *
 * Two levels of splitting are needed and the order matters. Bullets are split
 * first, on line boundaries, because a list item rarely ends in a full stop and
 * a whole list is otherwise judged as one enormous sentence. Within a line,
 * sentences are then split on terminators — that is what catches a claim whose
 * denial was pushed into the following sentence by a soft wrap.
 *
 * Markdown emphasis is stripped per line before splitting. "**Their agreement
 * makes it lawful.**" ends in `*`, not `.`, so a terminator-anchored split
 * sees no sentence boundary and the claim sails through wearing the bold
 * punctuation as camouflage. That is not hypothetical: it is exactly what the
 * first run of this test did.
 */
const sentences = guide
  .split('\n')
  .map(line => line.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .flatMap(line => line.split(/(?<=[.!?])\s+/))
  .map(s => s.trim())
  .filter(Boolean)

/**
 * Every sentence that mentions a loaded word must carry a denial.
 *
 * Deliberately phrased on the *claim* word rather than on the sentence that
 * denies it. The first version of this test checked for "consent makes it
 * lawful", which passed a document that said "Their agreement makes it lawful"
 * — swapping the denial for the claim removes the phrase being searched for,
 * so the prohibition is satisfied by the very edit it exists to prevent. A
 * guard keyed to a sentence can be defeated by deleting the sentence; a guard
 * keyed to the topic cannot.
 *
 * The positive assertions alongside it exist to stop the opposite dodge: deleting
 * the denials entirely would leave nothing to check, so the tests below also
 * require the true version to still be stated.
 */
const expectOnlyDenied = (topic: RegExp, what: string) => {
  const hits = sentences.filter(s => topic.test(s))
  expect(hits.length, `no sentence mentions ${what} — is the wording still there?`).toBeGreaterThan(0)
  for (const sentence of hits) {
    expect(`${what}: "${sentence.slice(0, 120)}"`).toMatch(DENIAL)
  }
  return hits
}

describe('claims the customer guide must not make', () => {
  it('never asserts that the product tracks people continuously', () => {
    // The guide must be able to tell a manager not to call it a live map, so
    // the words have to be allowed — in a negation only.
    expectOnlyDenied(/\breal-?time\b/i, 'real-time')
    // "live-in" is the name of a service type this product sells, not a claim
    // about tracking. Excluded, or the guard fails on the scope line.
    expectOnlyDenied(/\blive\b(?!-in)/i, 'live')
    // And the true version has to be stated somewhere, not merely avoided.
    expect(guideText).toMatch(/no background tracking/i)
  })

  it('never tells a manager a carer agreement makes the monitoring lawful', () => {
    // The same prohibition the carer notice carries. A sales-shaped sentence
    // here would be the most damaging line in the document, because it is the
    // one a provider would repeat to an inspector.
    expectOnlyDenied(/\blawful\b/i, 'lawful')
    expectOnlyDenied(/\bconsent\b/i, 'consent')
    // The true version has to still be stated, so deleting the denials above
    // does not turn this test green.
    expect(guideText).toMatch(/cannot consent on a staff member'?s behalf/i)
    expect(guideText).toMatch(/your assessment to document/i)
  })

  it('does not promise a refusal is free of consequence', () => {
    // A carer loses the arrival check by declining. A guide that called that
    // costless would put a manager and a carer into a disagreement that the
    // software is on the right side of.
    expect(guideText).toMatch(/nobody can check they were at the address/i)
    expect(guideText).toMatch(/costless|costs them nothing/i)
  })

  it('does not promise the switch is per branch or per location', () => {
    // Claiming finer scoping than the data model supports is a commitment we
    // cannot keep, and claiming orgs share a tenant is a real constraint.
    expect(guideText).toMatch(/per organisation, not per location/i)
    expect(guideText).toMatch(/share a single Meticle Care account/i)
  })
})
