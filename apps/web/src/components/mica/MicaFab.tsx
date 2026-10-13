import { Box } from '@mui/material'
import MicaOrb from './MicaOrb'
import { useMicaSession } from './MicaProvider'
import { preloadMicaSurfaces } from './mica.surfaces'
import { MICA_GEOMETRY, MICA_LABEL, MICA_Z } from './mica.identity'

/**
 * The floating Mica orb — the entry point that is present on every authenticated
 * page. It is deliberately only an entry point: the overlay and the pre-session
 * notice belong to the session itself (`MicaProvider`), so the dashboard's
 * in-page launcher and this orb cannot each mount a second copy of them.
 *
 * While a session is live this returns nothing at all, rather than hiding itself
 * with `display: none`. A hidden orb is still a mounted orb: its breathing, its
 * orbit and its glow keep running behind whatever is on screen, and there are two
 * of them on the dashboard (this one and the launcher in the dashboard card). The
 * session's own surfaces are the visible thing by then.
 *
 * The lazy surfaces are warmed on intent — pointer down, hover, or focus — so the
 * chunk is already in flight while the microphone permission probe runs, and
 * splitting them out never shows up as a delay where the orb used to be.
 */
export default function MicaFab() {
  // The shell's single session (see MicaProvider) — not a second useMica().
  const mica = useMicaSession()
  const active = mica.state !== 'idle'

  if (active) return null

  return (
    <Box
      title={mica.supported ? 'Talk to Mica' : MICA_LABEL.orbNeedsVoiceBrowser}
      onPointerEnter={preloadMicaSurfaces}
      onPointerDown={preloadMicaSurfaces}
      onFocus={preloadMicaSurfaces}
      sx={{
        position: 'fixed',
        bottom: MICA_GEOMETRY.offset,
        right: MICA_GEOMETRY.offset,
        // Below MUI's modal layer (1300) on purpose: an open dialog — the
        // medication administration dialog, a confirmation, a form — paints
        // over the orb, so the orb cannot cover anything inside a dialog.
        // Page content is protected by the shell's reserved corner instead.
        zIndex: MICA_Z.orb,
      }}
    >
      <MicaOrb state="idle" audio={mica.audio} onPress={mica.startListening} />
    </Box>
  )
}
