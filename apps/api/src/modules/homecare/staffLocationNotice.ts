/**
 * Which version of the carer location notice is current.
 *
 * The text itself is a client asset, because it has to be readable on a phone
 * with no connection — the app asks the question at a gate, and a gate that
 * needs the network is a gate that fails open. So the wording lives in
 * `apps/mobile/src/content/staffLocationNotice.ts` and is bundled.
 *
 * That split is a drift risk: the browser app has no copy of the text and so
 * cannot work out which version a worker is agreeing to. Rather than duplicate
 * 150 lines of legally loaded prose in a second place and hope the two stay in
 * step, the server states the current version and the clients stamp what they
 * were given.
 *
 * `homecare.staffLocationNotice.test.ts` reads the mobile file and fails if the
 * two ever disagree, so bumping one without the other is a red build rather than
 * a set of records stamped with a version nobody was shown.
 */
export const STAFF_LOCATION_NOTICE_KEY = 'staff_location'

/** Must equal STAFF_LOCATION_NOTICE_VERSION in the mobile content module. */
export const STAFF_LOCATION_NOTICE_VERSION = '1.2'
