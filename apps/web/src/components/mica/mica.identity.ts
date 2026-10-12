/**
 * Mica's identity contract — the single source of truth for its states, its
 * accessible names, its geometry and its place in the z-index ladder.
 *
 * ## Why this file exists
 *
 * Mica had grown four independent descriptions of itself: the state union was
 * declared twice (`MicaOrb.tsx` and `useMica.ts`), the accessible names were
 * three different strings for three surfaces ("MICA AI assistant" on the orb,
 * "MICA voice assistant" on the overlay, "Mica assistant — tap to open…" on
 * mobile), the geometry was inline magic numbers (`bottom: 24, right: 24` and a
 * 90px box on the web; `screenH - 160` and `screenH - BTN_SIZE - 40` on
 * mobile), and the overlay's z-index (1300) was exactly MUI's modal layer, so
 * which of a dialog and the overlay painted on top depended on DOM order.
 *
 * Every one of those is now declared here and read by the components, and the
 * tests in `mica.identity.test.ts` fail if a value drifts — including a check
 * that the mobile theme still carries the same accessible name.
 *
 * ## The error state
 *
 * `error` is a *session* failure (the AI call or the speech pipeline failed
 * while the overlay was open), and it is deliberately distinct from the
 * non-modal notices useMica raises before a session starts — a blocked mic or
 * an unsupported browser — which stay a Snackbar. A full-screen modal for
 * "your browser has no speech recognition" would be worse than the toast.
 */

/** Mica's lifecycle. One definition, imported by the hook and the components. */
export type MicaState = 'idle' | 'listening' | 'thinking' | 'responding' | 'error'

/** Ordered for documentation and for the drift test against the mobile theme. */
export const MICA_STATES: readonly MicaState[] = ['idle', 'listening', 'thinking', 'responding', 'error']

/**
 * Accessible names. `orb` and `overlay` are the two names a screen reader
 * announces most often, so they are the ones pinned; mobile carries the same
 * `orb` wording (plus its long-press clause) in `apps/mobile/src/theme.tsx`,
 * and a test asserts the two cannot diverge.
 *
 * The product name is written "Mica", not "MICA": every visible surface in the
 * product already says "Mica", and a screen reader spells an all-caps acronym
 * out letter by letter ("em-eye-see-ay"), which is not what anybody calls it.
 */
export const MICA_LABEL = {
  orb: 'Mica assistant',
  overlay: 'Mica voice assistant',
  type: 'Type to Mica',
  send: 'Send to Mica',
  suggestions: 'Mica suggestions',
  orbNeedsVoiceBrowser: 'Mica needs Chrome or Edge for voice',
} as const

/**
 * Geometry. `box` is the idle orb wrapper's footprint (the visible orb is 62px
 * inside a 90px box, so the box is what has to stay clear of page content),
 * `offset` is its distance from the viewport edges, and `gap` is the breathing
 * room between the box and anything reserved for it.
 *
 * `reservedBottom` is the space the shell gives back to page content at the
 * bottom of the document (`--mc-mica-clearance`) so that the last row of a
 * table, a pagination control or a form's action bar can never sit under the
 * orb. Proven in `mica.identity.test.ts` against both this value and
 * `Layout.tsx`.
 */
export const MICA_GEOMETRY = {
  box: 90,
  offset: 24,
  gap: 8,
  get reservedBottom() {
    return this.box + this.offset + this.gap
  },
} as const

/**
 * The z-index ladder, with every rung distinct so nothing is resolved by DOM
 * order by accident. MUI's defaults are `modal: 1300` and `snackbar: 1400`
 * (this app does not override them).
 *
 * - `orb` 1200 — above page content, **below** dialogs, so the floating orb can
 *   never paint over a medication administration dialog, a confirmation or a
 *   form. That, plus the shell's reserved corner, is why the orb cannot cover
 *   a control the user needs.
 * - `overlay` 1350 — above dialogs (it is the top-level surface while open),
 *   below app snackbars, so unrelated app feedback is still visible.
 * - `notice` 1500 — above everything: a blocked-mic explanation must never be
 *   hidden behind the surface that failed to open.
 */
export const MICA_Z = {
  orb: 1200,
  overlay: 1350,
  notice: 1500,
} as const

/** Visible copy for each active state. `error` is required by the type. */
export const MICA_STATE_COPY: Record<Exclude<MicaState, 'idle'>, { title: string; sub: string; action: string }> = {
  listening: { title: 'Mica', sub: 'is listening…', action: 'Tap to cancel · Esc' },
  thinking: { title: 'Mica', sub: 'is thinking…', action: 'Esc to cancel' },
  responding: { title: 'Mica', sub: 'responding…', action: 'Done · Esc' },
  error: { title: 'Mica', sub: 'could not finish that', action: 'Close · Esc' },
}

/**
 * Screen-reader announcements for state changes that carry no response text.
 * The spoken response itself is the priority announcement when one exists.
 */
export const MICA_ANNOUNCEMENT: Record<MicaState, string> = {
  idle: '',
  listening: 'Mica is listening. Speak your care note, or press Escape to cancel.',
  thinking: 'Mica is thinking.',
  responding: 'Mica is responding.',
  error: 'Mica could not complete that request. The message above explains why. Press Escape to close.',
}
