import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Alert, Snackbar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useMica, type MicaNavigateTarget } from './useMica'
import MicaOverlay from './MicaOverlay'
import MicaMiniBar from './MicaMiniBar'
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
 * surfaces and the conversation memory are one thing whichever entry point the
 * user reached for.
 *
 * ## What it does now
 *
 * The provider is also where Mica's navigation is actually performed, because
 * it is the only place in the Mica tree that sits both inside the router and
 * above every page: `Layout` is a route, so `useNavigate` is available here, and
 * a route pushed from here keeps the session alive across the change — the carer
 * lands on the MAR chart with the microphone still open and the bar still up.
 *
 * It owns the three surfaces that must exist **once** per session: the overlay,
 * the minimised bar, and the notice for a failure that happens before a session
 * starts (a blocked mic, an unsupported browser). They used to be rendered by
 * each entry point, which would put two identical modal dialogs, two copies of
 * the same alert and two status strips in the DOM at the same time.
 */
export function MicaProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const mica = useMica({
    onNavigate: useCallback((target: MicaNavigateTarget) => {
      navigate(target.path)
    }, [navigate]),
  })
  // Destructured so the narrowing below survives into the JSX: the bar is only
  // ever rendered for a live session, and its props say so.
  const { state } = mica
  const active = state !== 'idle'
  // One surface at a time: the overlay while the carer is looking at Mica, the
  // bar once Mica has opened a page and got out of its way.
  const showMini = mica.minimised && active

  return (
    <MicaContext.Provider value={mica}>
      {children}
      {!showMini && (
        <MicaOverlay
          state={state}
          audioLevel={mica.audioLevel}
          transcript={mica.transcript}
          responseMessage={mica.responseMessage}
          lastNavigation={mica.lastNavigation}
          onMinimise={mica.minimise}
          onCancel={mica.stopListening}
        />
      )}
      <AnimatePresence>
        {showMini && (
          <MicaMiniBar
            state={state}
            audioLevel={mica.audioLevel}
            transcript={mica.transcript}
            responseMessage={mica.responseMessage}
            lastNavigation={mica.lastNavigation}
            onExpand={mica.expand}
            onEnd={mica.stopListening}
          />
        )}
      </AnimatePresence>
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
