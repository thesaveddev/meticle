import { Box } from '@mui/material'
import MicaOrb from './MicaOrb'
import { useMicaSession } from './MicaProvider'
import { MICA_GEOMETRY, MICA_LABEL, MICA_Z } from './mica.identity'

/**
 * The floating Mica orb — the entry point that is present on every authenticated
 * page. It is deliberately only an entry point: the overlay and the pre-session
 * notice belong to the session itself (`MicaProvider`), so the dashboard's
 * in-page launcher and this orb cannot each mount a second copy of them.
 */
export default function MicaFab() {
  // The shell's single session (see MicaProvider) — not a second useMica().
  const mica = useMicaSession()
  const active = mica.state !== 'idle'

  return (
    <Box
      title={mica.supported ? 'Talk to Mica' : MICA_LABEL.orbNeedsVoiceBrowser}
      sx={{
        position: 'fixed',
        bottom: MICA_GEOMETRY.offset,
        right: MICA_GEOMETRY.offset,
        // Below MUI's modal layer (1300) on purpose: an open dialog — the
        // medication administration dialog, a confirmation, a form — paints
        // over the orb, so the orb cannot cover anything inside a dialog.
        // Page content is protected by the shell's reserved corner instead.
        zIndex: MICA_Z.orb,
        display: active ? 'none' : 'block',
      }}
    >
      <MicaOrb state="idle" onPress={mica.startListening} />
    </Box>
  )
}
