import { Box, Snackbar, Alert } from '@mui/material'
import MicaOrb from './MicaOrb'
import MicaOverlay from './MicaOverlay'
import { useMica } from './useMica'

/**
 * Floating Mica button used across authenticated pages. Renders the idle orb
 * bottom-right and swaps it for the full-screen voice overlay when active.
 */
export default function MicaFab() {
  const mica = useMica()
  const active = mica.state !== 'idle'

  return (
    <>
      <MicaOverlay
        state={mica.state}
        audioLevel={mica.audioLevel}
        transcript={mica.transcript}
        responseMessage={mica.responseMessage}
        onCancel={mica.stopListening}
      />
      {/* Voice errors (denied mic, unsupported browser) must be visible: the
          overlay closes itself on failure, so without this the tap would look dead. */}
      <Snackbar
        open={Boolean(mica.error) && !active}
        autoHideDuration={6000}
        onClose={() => mica.setState('idle')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
          {mica.error}
        </Alert>
      </Snackbar>
      <Box
        title={mica.supported ? 'Talk to Mica' : 'Mica needs Chrome or Edge for voice'}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1200,
          display: active ? 'none' : 'block',
        }}
      >
        <MicaOrb state="idle" onPress={mica.startListening} />
      </Box>
    </>
  )
}
