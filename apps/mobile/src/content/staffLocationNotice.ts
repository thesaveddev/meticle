/**
 * The carer-facing notice about location.
 *
 * Shown once at first launch after signing in, with the acceptance recorded
 * server-side so an employer can evidence that a given worker was told.
 *
 * Every line here is a claim about what the software does, so each one is
 * written against verified behaviour rather than against intent. Where the
 * honest answer is "we don't know" it says that instead of filling the gap.
 * A notice that guesses here is worse than one that admits the gap, because
 * the worker cannot tell which parts are reliable.
 *
 * The retention section is the one that had to change most in 1.3. It used to
 * say only "ask your employer", which was true and useless: it described an
 * absence of mechanism as though it were a policy. There is now a setting, a
 * nightly job that enforces it, and a written record of every deletion, so the
 * notice says how that works — while still being clear that Meticle Care does
 * not choose the number and ships no default, because it would be answering a
 * question the DPIA escalated to a DPO.
 *
 * The `evidence` field on each item is the comment that proves it. It is not
 * shown to the carer; it exists so a reviewer, a solicitor, or the next
 * engineer changing the location code can check the notice against the code
 * instead of against memory. `staffLocationNotice.test.ts` does exactly that.
 */

/** Bump when the text changes materially. Triggers re-acknowledgement. */
export const STAFF_LOCATION_NOTICE_VERSION = '1.3'

/** Stable key, so a future notice is a new key rather than a confused version. */
export const STAFF_LOCATION_NOTICE_KEY = 'staff_location'

/** What one capture point does, and where the value ends up. */
export type CapturePoint = {
  /** Where in the app the carer does this. */
  trigger: string
  /** Plain statement of what happens. */
  what: string
  /**
   * Whether the value reaches the employer. This is the distinction that
   * matters most and the one a worker will read twice.
   */
  sent: 'sent_to_employer' | 'stays_on_your_phone'
  /** The code comment that proves it. Not shown to the carer. */
  evidence: string
}

export const CAPTURE_POINTS: CapturePoint[] = [
  {
    trigger: 'When you press Check in or Check out',
    what:
      'The app takes one reading of your position at that moment and sends it to your ' +
      'employer\'s account, where it is saved on the visit record together with the time. ' +
      'It also records how accurate the reading was, so a fix taken in a car park is not ' +
      'recorded as precisely as one taken at the door.',
    sent: 'sent_to_employer',
    evidence:
      'homecare.repository.ts checkIn/checkOut write check_in_latitude/longitude/accuracy and ' +
      'check_out_latitude/longitude/accuracy. Mobile: VisitScreen.execute calls getVisitLocation ' +
      'at the button press only.',
  },
  {
    trigger: 'When you tap "Check my distance"',
    what:
      'The app takes one reading to show you how far you are from the address of the call ' +
      'you are about to make. The result is shown to you and is not sent anywhere.',
    sent: 'stays_on_your_phone',
    evidence:
      'measureVisitDistance computes haversineDistance on device and only sets local state. ' +
      'No request() call on that path.',
  },
  {
    trigger: 'When you open the navigation sheet',
    what:
      'The app takes one reading to estimate how far the call is and roughly how long it ' +
      'will take you. The estimate is shown to you and is not sent anywhere.',
    sent: 'stays_on_your_phone',
    evidence:
      'MapPickerModal computes distance and ETA on device and only sets travelInfo state. ' +
      'No request() call on that path.',
  },
]

export type NoticeSection = {
  heading: string
  body: string[]
  /** Bullets, rendered under the body. */
  points?: string[]
}

/**
 * The notice itself.
 *
 * Deliberately not stating a retention period, and deliberately not claiming
 * the worker consented. Both are load-bearing omissions:
 *
 *  - Retention for carer location has not been decided. The DPIA escalated it
 *    to the DPO rather than guessing, and v1.0 of that document asserted a
 *    "recommended 8 years" that nobody could evidence. The notice therefore
 *    explains the mechanism and who sets the number, rather than inventing one.
 *    Saying "we keep it for 90 days" when the provider has not chosen 90 days
 *    would be a claim about a system that does not exist, and a worker who
 *    relied on it would be relying on nothing.
 *  - MeticleCare is a processor. It cannot give a worker a lawful basis for
 *    their employer's monitoring, and consent is in any case a poor fit for an
 *    employment relationship where one party holds the job. Saying "you
 *    consented" would be MeticleCare manufacturing an agreement it has no
 *    standing to create, and it would shift the burden onto the worker.
 */
export const STAFF_LOCATION_NOTICE: NoticeSection[] = [
  {
    heading: 'Who this is about',
    body: [
      'This explains how your location is used in the Meticle Care app, and what your ' +
        'employer can see.',
      'Your employer is the care provider. They decide whether your location is used at all, ' +
        'and why. Meticle Care is the software they use — we do not decide this, we do it on ' +
        'their instructions, and we do not use your location for anything of our own.',
    ],
  },
  {
    heading: 'When the app reads your position',
    body: [
      'The app reads your position at three moments, and only when you do something that ' +
        'causes it. Two of the three never leave your phone.',
    ],
    points: CAPTURE_POINTS.map(p => `${p.trigger} — ${p.what}`),
  },
  {
    heading: 'What the app does not do',
    body: [
      'These are the things people reasonably assume a location feature does, and which this ' +
        'one does not:',
    ],
    points: [
      'It does not follow you in the background. The app has no location tracking running when ' +
        'it is closed, and none running while you are between visits.',
      'It does not watch your position continuously while a visit is open. It reads a single ' +
        'fix at the moment you press a button, not a stream of readings.',
      'It does not record where you are during a visit, only where you were when you checked ' +
        'in and when you checked out.',
      'It is not used for advertising, for profiling, or for any artificial intelligence ' +
        'feature in the product. Your position is never sent to an AI provider.',
      'Your employer\'s managers do not see a live feed. The map shows the position recorded at ' +
        'check-in, which is where you were at that moment, not where you are now.',
    ],
  },
  {
    heading: 'What your employer can see',
    body: [
      'If your employer has location recording switched on, they can see, against your name ' +
        'and the visit:',
    ],
    points: [
      'Your name, and the name and address of the person you were visiting.',
      'The position recorded when you checked in, and the time you did.',
      'The position recorded when you checked out, and the time you did.',
      'How accurate each of those readings was.',
      // Corrected in 1.2. This used to say the attempt was "visible to them",
      // and that was not true. VisitScreen stops a too-far check-in on the
      // device and returns before it makes any request, so nothing reaches the
      // server and there is no attempt for the employer to see. The claim
      // looked reassuring to the worker and was reassuring in the wrong
      // direction: it told them they were being watched trying.
      'If you try to check in from too far away. The app stops the check-in and tells you ' +
        'how far off you are, and why. That attempt does not leave your phone — your employer ' +
        'is not told that you tried, and there is no record of it for them to look at.',
      'Who has opened the visit check-in map, and when. Opening the map is recorded.',
    ],
  },
  {
    heading: 'Your phone\'s location permission',
    body: [
      // Corrected in 1.2. This keyed the permission requirement on the
      // employer's switch alone, which stopped being the whole of it when the
      // per-worker decision landed. A worker who has said no is not asked for
      // permission at all, and a notice that says otherwise makes them believe
      // they are being prompted for something they have already refused.
      'The app needs your phone\'s location permission to check in — but only if your ' +
        'employer has location recording switched on and you have agreed to it. If you ' +
        'have said no, the app never asks for the permission in the first place.',
      'If you have agreed, turning that permission off means you will not be able to check ' +
        'in, and the visit stays unchecked, which your employer can see.',
      'You can change the permission at any time in your phone\'s settings for the ' +
        'Meticle Care app, without telling anyone.',
    ],
  },
  {
    heading: 'If your employer switches location recording off',
    body: [
      'The app stops reading your position at check-in and check-out, and the check-in map ' +
        'stops working. Visits, care notes, timesheets and pay are unaffected.',
      'One thing is lost with it: the app can no longer check that you were at the person\'s ' +
        'address, because it would not be reading your position to do that.',
      'Switching it off stops new positions being collected. Your employer is then asked what ' +
        'to do about the positions already collected, and is shown how many there are and how ' +
        'old the oldest is before they choose. They can keep them, delete them, or apply the ' +
        'retention period described below. Nothing is deleted without that answer.',
    ],
  },
  {
    heading: 'How long it is kept',
    body: [
      'Your employer sets this, in their settings, and it is their decision rather than Meticle ' +
        'Care\'s. Meticle Care does not choose a number for them and does not ship a default, ' +
        'because a default would quietly become the policy of every provider who never opens ' +
        'the setting.',
      'If they have not set a period, nothing is deleted automatically. The positions simply ' +
        'stay on the visit, with no deletion date at all, and their settings screen says so in ' +
        'those words rather than looking like a long default.',
      'Once they have set a period, a job runs overnight and deletes every position older than ' +
        'that, without anyone pressing a button. It reaches all three places a position is ' +
        'written — the visit record, the copy in the audit log, and SecureVisit check-ins — ' +
        'because clearing only the visit would be a deletion that appeared to have worked ' +
        'without having done so.',
      'Each of those runs is written down, with the date, how many positions it removed and ' +
        'what caused it, so they can show that their policy is being enforced rather than ' +
        'merely written down.',
      'Deleting a position does not delete the visit, the timesheet or the pay. Those are built ' +
        'from the two timestamps and what you entered. What is lost is the ability to check ' +
        'afterwards that you were at the person\'s address, for visits that old.',
      'If you want to know how long it is kept, ask your employer.',
    ],
  },
  {
    heading: 'Your choice',
    body: [
      'After reading this you can say yes or no to your employer recording your position at ' +
        'check-in and check-out. Saying yes records that you were told this and agreed to it. ' +
        'Saying no records that you were told this and did not agree.',
      'If you say no, the app stops sending your position when you check in and check out, and ' +
        'your location is kept off the check-in map. Your visits, care notes, timesheets and pay ' +
        'are unaffected — you can still check in, do the call, and check out normally.',
      'One thing is lost with it: nobody can then check that you were at the person\'s address, ' +
        'because the app would not be reading your position to do that. That is a real cost, and ' +
        'it is yours to weigh against the alternative, not something the app decides for you.',
      'You can change your answer at any time, in either direction, without giving a reason.',
    ],
    points: [
      'Saying no does not stop you using the app, and does not stop your visits being recorded.',
      'Your employer can see that you have declined and when, because they have to be able to ' +
        'evidence who agreed — but they cannot change your answer for you.',
    ],
  },
  {
    heading: 'Seeing what is held, or objecting',
    body: [
      'The app does not show you a history of your own recorded positions, so you cannot check ' +
        'from the app what has been kept. To find out, or to ask for it to be corrected, or to ' +
        'object to your employer collecting it at all, contact your employer — they are the ones ' +
        'who hold it and who decide how it is used.',
      'Your employer is required to have a way for you to raise a concern about this. If you ' +
        'feel your position is being monitored in a way that is unfair, or that you have not ' +
        'agreed to, that is a matter for them to answer, and for your union or representative ' +
        'if you have one.',
    ],
  },
]

/**
 * Whether this worker still needs to see the notice.
 *
 * Keyed on the version, not a boolean. A revised notice has to be shown again,
 * and a worker who accepted an earlier version has not accepted this one.
 */
export function needsAcknowledgement(
  accepted: { notice_key: string | null; notice_version: string | null } | null | undefined
): boolean {
  if (!accepted) return true
  if (accepted.notice_key !== STAFF_LOCATION_NOTICE_KEY) return true
  return accepted.notice_version !== STAFF_LOCATION_NOTICE_VERSION
}

/**
 * Whether this worker has answered the agree-or-decline question.
 *
 * Separate from the acknowledgement on purpose, and the two are not merged. "I
 * have read this" and "I agree to my employer recording my position" are
 * different answers to different questions, and a provider who needs to show
 * that a worker agreed cannot be given the first one in place of the second.
 *
 * A worker who has read the notice but not answered is not collecting, because
 * collection requires an agreement that does not exist yet. That is the same
 * fail-closed rule the API applies, stated here so the two cannot drift.
 */
export function needsDecision(decision: string | null | undefined): boolean {
  return decision !== 'agreed' && decision !== 'declined'
}
