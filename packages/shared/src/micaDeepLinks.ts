/**
 * Where a record lives: the link to it, and the query parameter the page behind
 * that link reads.
 *
 * Why this is shared rather than written twice. A deep link is one string with
 * two ends: the API composes it when Mica has just saved a task, and a page reads
 * it to open that task's dialog. Nothing at either end fails loudly if the two
 * disagree — the server would return a link with `?task=` in it and the page would
 * go on looking for something else, landing the carer on an unfiltered list with
 * no explanation. So the parameter names and the paths live here, in the package
 * both apps already import.
 *
 * The generated page-access table answers "may this caller open that page"; this
 * answers "which record on that page". A record page is the instance of a page Mica
 * already knows how to open: `MicaRecordPage` (`mica.recordPages.ts`) holds the
 * spoken vocabulary and the gate, and this holds the address.
 *
 * **One contract, every channel.** These links started as what Mica *says* — "want
 * me to open the new task?" — and the same link is what a notification carries, what
 * a colleague pastes into chat and what an email's button points at. Three channels
 * composing three paths by hand is the drift this module exists to prevent, so
 * nothing outside it builds a record URL: call `micaRecordPath` (in-app) or
 * `micaRecordUrl` (absolute, for email) and the page's reader is the only other
 * half.
 *
 * A kind is a *record*, not an entity the app already names: the row a channel
 * refers to, and the page that opens it. The ref is a discriminated union rather
 * than one loose shape because each kind's link needs exactly the ids it takes to
 * open it and no others — a care note with no person is not a link that is merely
 * less specific, it is a link to nothing, and a shift with no week is a link to a
 * grid the reader cannot orient.
 *
 * Two kinds are here without a query parameter at all. `incident` is opened by the
 * route itself (`/incidents/:id`), which the detail page already reads. Everything
 * else names its parameter, because the pages that show those records are lists that
 * a parameter filters or a dialog inside a tabbed page.
 */

/** The records a channel can link to. */
export type MicaRecordKind =
  | 'task'
  | 'appointment'
  | 'care-note'
  | 'incident'
  | 'leave-request'
  | 'overtime-claim'
  | 'swap-request'
  | 'shift'
  | 'visit'
  | 'medication-chart'
  | 'staff-compliance'
  /** One family's submitted ratings for a visit, read on the homecare page's feedback tab. */
  | 'family-feedback';

/** The kinds whose page reads a query parameter (`incident` is opened by its route). */
export type MicaRecordParamKind = Exclude<MicaRecordKind, 'incident'>;

/**
 * The query parameter each page reads to open one record.
 *
 * `care-note` is `source` rather than `note` because it is read on
 * `PersonProfilePage` beside `?tab=`, where the profile's other panels already
 * earn their own parameter names, and `source` says what it is: which record on
 * this tab to open.
 *
 * `visit` and `date` are `CallSchedulingPage`'s own existing params, and
 * `personId`/`month` are `EMedicationPage`'s: where a page already reads a date or
 * a person to put itself in the right place, the record link reuses that name
 * rather than inventing a second way to say the same thing.
 */
export const MICA_RECORD_PARAMS: Readonly<Record<MicaRecordParamKind, string>> = {
  task: 'task',
  appointment: 'appointment',
  'care-note': 'source',
  'leave-request': 'request',
  'overtime-claim': 'claim',
  'swap-request': 'swap',
  shift: 'shift',
  visit: 'visit',
  'medication-chart': 'personId',
  'staff-compliance': 'record',
  'family-feedback': 'feedback',
}

/**
 * The profile tab a care note is opened on. `PersonProfilePage`'s own slug (its
 * `TAB_SLUGS`), which is the one string here a page and this contract could
 * disagree about — a slug that page does not know would open the profile on its
 * first tab instead of the notes.
 */
export const MICA_CARE_NOTE_TAB = 'daily-notes'

/**
 * The staff-profile tab a compliance record is opened on: the same slug
 * `StaffProfilePage` uses for its own compliance section.
 */
export const MICA_STAFF_COMPLIANCE_TAB = 'compliance'

/**
 * The homecare tab submitted family feedback is read on: the same label
 * `HomecarePage` matches against `?tab=` to open its feedback board.
 */
export const MICA_FAMILY_FEEDBACK_TAB = 'feedback'

/** A record, with exactly the ids (and, for a week-scoped page, the date) it takes. */
export type MicaRecordRef =
  | { kind: 'task'; id: string }
  | { kind: 'appointment'; id: string }
  | { kind: 'care-note'; id: string; personId: string }
  | { kind: 'incident'; id: string }
  | { kind: 'leave-request'; id: string }
  | { kind: 'overtime-claim'; id: string }
  | { kind: 'swap-request'; id: string }
  /** `week`: the ISO day the rota grid opens on, which is how the shift is found. */
  | { kind: 'shift'; id: string; week: string }
  /** `date`: the day the call board opens on. */
  | { kind: 'visit'; id: string; date: string }
  /** A person's MAR chart for a month, which is the page a medication alert is read on. */
  | { kind: 'medication-chart'; id: string; personId: string; month: string }
  /** A staff member's compliance record, on that staff member's profile. */
  | { kind: 'staff-compliance'; id: string; staffId: string }
  /** One submitted family-feedback row, opened as a dialog on the feedback tab. */
  | { kind: 'family-feedback'; id: string }

const encode = (value: string) => encodeURIComponent(value)

/**
 * The in-app link to one record.
 *
 * Relative on purpose: the client pushes it, and a relative path is what keeps the
 * link working on whatever origin the app is served from. Email cannot use it —
 * see `micaRecordUrl`.
 */
export function micaRecordPath(ref: MicaRecordRef): string {
  switch (ref.kind) {
    case 'task':
      return `/tasks?${MICA_RECORD_PARAMS.task}=${encode(ref.id)}`
    case 'appointment':
      return `/appointments?${MICA_RECORD_PARAMS.appointment}=${encode(ref.id)}`
    case 'care-note':
      return `/people/${encode(ref.personId)}?tab=${MICA_CARE_NOTE_TAB}&${MICA_RECORD_PARAMS['care-note']}=${encode(ref.id)}`
    case 'incident':
      // No parameter: the route names the incident, and the detail page already
      // reads it. A second way to say "which incident" would be a second way to
      // disagree about it.
      return `/incidents/${encode(ref.id)}`
    case 'leave-request':
      return `/leave?${MICA_RECORD_PARAMS['leave-request']}=${encode(ref.id)}`
    case 'overtime-claim':
      return `/scheduling/overtime-claims?${MICA_RECORD_PARAMS['overtime-claim']}=${encode(ref.id)}`
    case 'swap-request':
      return `/swap-transfer?${MICA_RECORD_PARAMS['swap-request']}=${encode(ref.id)}`
    case 'shift':
      return `/scheduling?week=${encode(ref.week)}&${MICA_RECORD_PARAMS.shift}=${encode(ref.id)}`
    case 'visit':
      return `/call-scheduling/day?date=${encode(ref.date)}&${MICA_RECORD_PARAMS.visit}=${encode(ref.id)}`
    case 'medication-chart':
      return `/emedication?${MICA_RECORD_PARAMS['medication-chart']}=${encode(ref.personId)}&month=${encode(ref.month)}`
    case 'staff-compliance':
      return `/staff/${encode(ref.staffId)}?tab=${MICA_STAFF_COMPLIANCE_TAB}&${MICA_RECORD_PARAMS['staff-compliance']}=${encode(ref.id)}`
    case 'family-feedback':
      // The tab first, then the record: the page opens the board from `tab` and
      // the board opens the dialog from `feedback`, so a reader that only honours
      // one half still lands somewhere useful rather than nowhere.
      return `/homecare?tab=${MICA_FAMILY_FEEDBACK_TAB}&${MICA_RECORD_PARAMS['family-feedback']}=${encode(ref.id)}`
  }
}

/**
 * The absolute URL to one record, for the places a link has to leave the app: email
 * above all, where a relative path is a dead string in the recipient's client.
 *
 * The base is a parameter rather than read from the environment here, because this
 * package runs in the browser as well, where the API's `FRONTEND_URL` does not
 * exist — and because the only place that knows a public origin is the server that
 * is about to send the mail (`email.service.ts`).
 */
export function micaRecordUrl(ref: MicaRecordRef, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}${micaRecordPath(ref)}`
}
