/**
 * Guards Mica's identity contract: one state vocabulary, one accessible name
 * per surface shared with mobile, one z-index ladder, and a reserved corner in
 * the shell.
 *
 * ## What went wrong before this existed
 *
 * Mica described itself four different ways: the state union was declared
 * twice, the orb and overlay announced themselves as "MICA AI assistant" and
 * "MICA voice assistant", mobile said "Mica assistant — tap to open, press and
 * hold for emergency", and the overlay's z-index (1300) equalled MUI's modal
 * layer, so which of the overlay and a dialog painted on top depended on DOM
 * order. The floating orb also sat over page content with nothing reserved for
 * it, so the bottom-right of a dense table was reachable only by scrolling the
 * orb out of the way.
 *
 * ## What is asserted
 *
 * 1. Every state has screen-reader copy, and the copy map covers exactly the
 *    non-idle states — adding a state fails here until it is described.
 * 2. The accessible orb name and the state list are identical in the mobile
 *    theme, so the two platforms cannot drift apart one PR at a time.
 * 3. The z-index ladder is strictly ordered against MUI's modal (1300) and
 *    snackbar (1400) layers.
 * 4. The shell declares a reserved corner at least as tall as the orb's
 *    footprint and actually consumes it, so page content cannot sit under the
 *    orb.
 *
 * What this cannot prove: that a *dynamic* page never renders its own control
 * into the reserved gutter. The reserved corner plus the orb's position below
 * the modal layer are the mechanisms; a pixel-level overlap check needs a
 * browser, which is recorded as outstanding in docs/DESIGN_SYSTEM_AUDIT.md.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MICA_ANNOUNCEMENT,
  MICA_GEOMETRY,
  MICA_LABEL,
  MICA_STATE_COPY,
  MICA_STATES,
  MICA_Z,
} from './mica.identity'

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

// MUI's defaults; this app does not override them (no `zIndex` in ThemeContext).
const MUI_MODAL = 1300
const MUI_SNACKBAR = 1400

describe('Mica identity contract', () => {
  it('describes every state for screen readers, and only the real states', () => {
    for (const state of MICA_STATES) {
      expect(MICA_ANNOUNCEMENT[state], `announcement for ${state}`).toBeTypeOf('string')
    }
    const active = [...MICA_STATES].filter(s => s !== 'idle').sort()
    expect(Object.keys(MICA_STATE_COPY).sort()).toEqual(active)
    for (const state of active) {
      const copy = MICA_STATE_COPY[state as keyof typeof MICA_STATE_COPY]
      expect(copy.title, `title for ${state}`).toBeTruthy()
      expect(copy.sub, `sub for ${state}`).toBeTruthy()
      expect(copy.action, `action for ${state}`).toBeTruthy()
    }
    // The error state is a first-class state, not a reused "responding".
    expect(MICA_STATES).toContain('error')
    expect(MICA_STATE_COPY.error.sub).not.toBe(MICA_STATE_COPY.responding.sub)
  })

  it('keeps the accessible orb name and state list identical to the mobile theme', () => {
    const mobile = read('../mobile/src/theme.tsx')
    expect(mobile).toContain(MICA_LABEL.orb)
    expect(mobile).toMatch(/'idle'\s*,\s*'listening'\s*,\s*'thinking'\s*,\s*'responding'\s*,\s*'error'/)
  })

  it('orders the z-index ladder around the modal and snackbar layers', () => {
    expect(MICA_Z.orb).toBeLessThan(MUI_MODAL) // orb never covers a dialog
    expect(MICA_Z.overlay).toBeGreaterThan(MUI_MODAL) // overlay is the top surface
    expect(MICA_Z.overlay).toBeLessThan(MUI_SNACKBAR) // app feedback stays visible
    expect(MICA_Z.notice).toBeGreaterThan(MUI_SNACKBAR) // a failed start is never hidden
    // The minimised bar replaces the orb while a session is live, so it sits
    // above it — but still below the modal layer, for the same reason the orb
    // does: a medication administration dialog must paint over both.
    expect(MICA_Z.mini).toBeGreaterThan(MICA_Z.orb)
    expect(MICA_Z.mini).toBeLessThan(MUI_MODAL)
    const rungs = [MICA_Z.orb, MICA_Z.mini, MICA_Z.overlay, MICA_Z.notice]
    expect(new Set(rungs).size).toBe(rungs.length)
  })

  it('reserves the orb corner in the shell so page content cannot sit under it', () => {
    const declared = Number(read('src/index.css').match(/--mc-mica-clearance:\s*(\d+)px/)?.[1])
    expect(Number.isFinite(declared), '--mc-mica-clearance must be declared in index.css').toBe(true)
    expect(declared).toBeGreaterThanOrEqual(MICA_GEOMETRY.reservedBottom)
    // The shell has to consume it, or the reservation is just a comment.
    const layout = read('src/components/Layout.tsx')
    expect(layout).toContain('var(--mc-mica-clearance)')
  })

  it('renders the overlay and the notice in exactly one place', () => {
    // Both entry points share one session, so a second <MicaOverlay> would put
    // two identical aria-modal dialogs in the DOM and a second <Snackbar> would
    // show the same alert twice. The session provider owns both; the entry
    // points are entry points only.
    const dir = 'src/components/mica'
    const owners = ['MicaProvider.tsx', 'MicaFab.tsx', 'MicaAssistant.tsx'].filter(name =>
      read(`${dir}/${name}`).includes('<MicaOverlay'),
    )
    expect(owners).toEqual(['MicaProvider.tsx'])

    // Same for the pre-session notice.
    const noticeOwners = ['MicaProvider.tsx', 'MicaFab.tsx', 'MicaAssistant.tsx'].filter(name =>
      read(`${dir}/${name}`).includes('<Snackbar'),
    )
    expect(noticeOwners).toEqual(['MicaProvider.tsx'])

    // And for the minimised bar: a second copy would be a second live-looking
    // session on screen, contradicting the one session both entry points share.
    const miniOwners = ['MicaProvider.tsx', 'MicaFab.tsx', 'MicaAssistant.tsx', 'MicaOverlay.tsx'].filter(name =>
      read(`${dir}/${name}`).includes('<MicaMiniBar'),
    )
    expect(miniOwners).toEqual(['MicaProvider.tsx'])
  })

  it('gives the orb a footprint the reserved corner is measured against', () => {
    expect(MICA_GEOMETRY.reservedBottom).toBe(MICA_GEOMETRY.box + MICA_GEOMETRY.offset + MICA_GEOMETRY.gap)
    // A 90px box 24px from the edge is the geometry MicaFab renders.
    const fab = read('src/components/mica/MicaFab.tsx')
    expect(fab).toContain('MICA_GEOMETRY.offset')
    expect(fab).toContain('MICA_Z.orb')
  })
})
