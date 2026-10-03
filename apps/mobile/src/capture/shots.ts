/**
 * The six store screenshots, in the order a reviewer reads them.
 *
 * This is the shot list from `docs/STORE_RELEASE_RUNBOOK.md`, unchanged: the
 * whole point of this module is that the order and the subject of each image are
 * written down once, here, rather than remembered by whoever is holding the
 * phone. Renumbering a store listing means editing this array.
 *
 * `scene` is app state that has to be in place before the shot is taken, and it
 * is part of the shot rather than the fixture because two of the six need
 * different state: the Today screen appears twice, and the second time it has
 * to be showing the sync rail with actions waiting, not an empty list.
 */
import { CAPTURE_IDS } from './fixtures'

/** Where the tour should send the app. Mirrors the `Screen` union in App.tsx. */
export type CaptureTarget =
  | { kind: 'login' }
  | { kind: 'tab'; tab: 'today' | 'schedule' | 'chat' | 'mileage' | 'settings' }
  | { kind: 'visit'; visitId: string }
  | { kind: 'clientDetail'; personId: string }
  | { kind: 'incident'; personId: string; visitId: string }
  | { kind: 'chatChannel'; channelId: string }

export type CaptureScene = 'default' | 'offline-queue'

export interface CaptureShot {
  /** 1-based, and the order the images are numbered in the store listing. */
  index: number
  /** File name stem. Change it and the store listing has to be renumbered. */
  id: string
  /** What the shot is, for the manifest the host script writes. */
  title: string
  /** The line that goes under the image in the listing. */
  storeCaption: string
  scene: CaptureScene
  target: CaptureTarget
  /** How long the screen stays up after it has finished rendering. */
  dwellMs: number
}

/**
 * How long a shot is held on screen before the tour moves on.
 *
 * This was 1200ms, which assumed the screen was already rendered when its shot
 * was announced. On a slow machine the app is still booting at that point —
 * fonts, splash, fixture hydration — so the whole seven-shot tour announced
 * itself in about nine seconds and every capture landed on the same unrendered
 * frame. Three of the seven came out byte-identical and one was blank, all of
 * them valid 1080x1920 PNGs that passed Play's format rules.
 *
 * 8s puts the tour at roughly a minute, which is long enough for a slow first
 * render and still a short enough run to repeat freely. The host script reads
 * these same values out of this file and waits the same length after taking its
 * picture, so the two sides cannot drift apart.
 *
 * Screens that load several requests ask for a little more on top of this.
 */
const SETTLE_MS = 8000

/**
 * This shot is the odd one out, and it is the reason it is here at all.
 *
 * Capture mode signs the app in with fixture data before the normal boot path
 * looks for a session, which is what makes the other shots repeatable. It also
 * means `LoginScreen` is never mounted during a tour, so the screen a user
 * meets first is the one screen a capture run cannot reach on its own.
 *
 * So it is announced by the bootstrap rather than by the tour hook — before
 * `installCaptureMode()` — and it is the one shot that therefore requires the
 * app to be *cold-started*. A reload from Metro leaves the session in place and
 * this shot is silently skipped, which is why `App.tsx` announces it explicitly
 * and the host script says so on timeout.
 *
 * The comment sits outside the object on purpose. The host script reads this
 * file as text with a regex, and a block comment *inside* an entry widened the
 * gap between `storeCaption` and `dwellMs` enough for that regex to run past
 * the end of this object and swallow the one after it — which silently deleted
 * `01-today` from the shot list and logged `00-login` twice.
 */
export const CAPTURE_SHOTS: CaptureShot[] = [
  {
    index: 0,
    id: '00-login',
    title: 'Sign in',
    storeCaption: 'One sign-in for the whole care team. Second factor, no shared logins.',
    scene: 'default',
    target: { kind: 'login' },
    dwellMs: SETTLE_MS,
  },
  {
    index: 1,
    id: '01-today',
    title: 'Today — the visit list',
    storeCaption: 'Your whole day, in order. Calls, times and who you are with.',
    scene: 'default',
    target: { kind: 'tab', tab: 'today' },
    dwellMs: SETTLE_MS,
  },
  {
    index: 2,
    id: '02-visit-in-progress',
    title: 'Visit in progress — tasks, location and check-out',
    storeCaption: 'Arrive, check in, and record what you did — down to the last task.',
    scene: 'default',
    target: { kind: 'visit', visitId: CAPTURE_IDS.visitInProgress },
    dwellMs: SETTLE_MS + 600,
  },
  {
    index: 3,
    id: '03-client-detail',
    title: 'Client record — care plan, risks, medication, body map',
    storeCaption: 'Everything you need to know about the person, on one screen.',
    scene: 'default',
    target: { kind: 'clientDetail', personId: CAPTURE_IDS.personEileen },
    dwellMs: SETTLE_MS + 800,
  },
  {
    index: 4,
    id: '04-report-incident',
    title: 'Report an incident',
    storeCaption: 'Report a fall, a missed dose or a near miss in under a minute.',
    scene: 'default',
    target: { kind: 'incident', personId: CAPTURE_IDS.personEileen, visitId: CAPTURE_IDS.visitMorning },
    dwellMs: SETTLE_MS,
  },
  {
    index: 5,
    id: '05-chat',
    title: 'Chat — the care team',
    storeCaption: 'Message the team mid-visit. Handover, questions and cover, in the moment.',
    scene: 'default',
    target: { kind: 'chatChannel', channelId: CAPTURE_IDS.channelCareTeam },
    dwellMs: SETTLE_MS + 800,
  },
  {
    index: 6,
    id: '06-offline-sync',
    title: 'Offline sync rail — actions waiting to send',
    storeCaption: 'No signal, no problem. Evidence is saved on the phone and syncs itself later.',
    scene: 'offline-queue',
    target: { kind: 'tab', tab: 'today' },
    dwellMs: SETTLE_MS,
  },
]

export function captureShotById(id: string): CaptureShot | undefined {
  return CAPTURE_SHOTS.find(shot => shot.id === id)
}

/**
 * The one shot the tour does not drive.
 *
 * Derived from the array rather than written out a second time. A duplicate
 * literal here looked harmless but was a real defect: the host script reads
 * this file as text and matched it, so `00-login` appeared twice in the plan
 * and the shot count guard failed.
 */
export const LOGIN_SHOT: CaptureShot = (() => {
  const login = CAPTURE_SHOTS.find(shot => shot.target.kind === 'login')
  if (!login) throw new Error('No login shot in CAPTURE_SHOTS; the bootstrap cannot announce it')
  return login
})()

/** Shots the tour walks to, as opposed to the one the bootstrap announces. */
export const TOUR_SHOTS: CaptureShot[] = CAPTURE_SHOTS.filter(shot => shot.target.kind !== 'login')
