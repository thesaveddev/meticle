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

/** Screens that load several requests need longer than the default before a shot. */
const SETTLE_MS = 1200

export const CAPTURE_SHOTS: CaptureShot[] = [
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
