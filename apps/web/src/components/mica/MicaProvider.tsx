import { createContext, useContext, type ReactNode } from 'react'
import { Alert, Snackbar } from '@mui/material'
import { useMica } from './useMica'
import MicaOverlay from './MicaOverlay'
import { MICA_Z } from './mica.identity'

type MicaSession = ReturnType<typeof useMica>

const MicaContext = createContext<MicaSession | null>(null)

/**
 * One Mica session for the whole authenticated shell.
 *
 * ## Why this exists
 *
 * `MicaFab` (mounted in `Layout`) and `MicaAssistant` (mounted on the
 * dashboard) each called `useMica()`, so the dashboard ran two independent
 * sessions at once: two orb states, two speech recognisers, and two overlays
 * that could be open simultaneously — the second one painted over the first.
 * Both entry points now resolve to this single session, so the orb state, the
 * overlay and the conversation memory are one thing whichever entry point the
 * user reached for.
 *
 * The provider also owns the two surfaces that must exist **once** per session:
 * the overlay, and the notice for a failure that happens before a session starts
 * (a blocked mic, an unsupported browser). They used to be rendered by each entry
 * point, which — once the entry points share a session — would put two identical
 * modal dialogs and two copies of the same alert in the DOM at the same time.
 */
export function MicaProvider({ children }: { children: ReactNode }) {
  const mica = useMica()
  const active = mica.state !== 'idle'

  return (
    <MicaContext.Provider value={mica}>
      {children}
      <MicaOverlay
        state={mica.state}
        audioLevel={mica.audioLevel}
        transcript={mica.transcript}
        responseMessage={mica.responseMessage}
        person={mica.selectedPerson}
        onPersonChange={mica.setSelectedPerson}
        onSendText={mica.sendText}
        onCancel={mica.stopListening}
      />
      {/* A failure that never opened the overlay must still be visible, or the
          tap looks dead. Above the overlay so it can never be hidden. */}
      <Snackbar
        open={Boolean(mica.error) && !active}
        autoHideDuration={6000}
        onClose={() => mica.setState('idle')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: MICA_Z.notice }}
      >
        <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
          {mica.error}
        </Alert>
      </Snackbar>
    </MicaContext.Provider>
  )
}

/** The shared session. Throws loudly rather than silently starting a second one. */
export function useMicaSession(): MicaSession {
  const session = useContext(MicaContext)
  if (!session) throw new Error('useMicaSession must be used inside <MicaProvider>')
  return session
}
