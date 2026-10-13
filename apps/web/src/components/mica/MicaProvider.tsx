import { createContext, useCallback, useContext, useEffect, useRef, Suspense, type ReactNode } from 'react'
import { Alert, Box, Snackbar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useMica, type MicaNavigateTarget } from './useMica'
import MicaOrb from './MicaOrb'
import { MicaMiniBarSurface, MicaOverlaySurface, preloadMicaSurfaces } from './mica.surfaces'
import { MICA_ANNOUNCEMENT, MICA_Z, type MicaActiveState, type MicaState } from './mica.identity'
import type { MicaAudioChannel } from './mica.audio'

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
 *
 * ## What it deliberately does not do
 *
 * It holds no microphone-derived state. The amplitude channel the session
 * carries goes straight to the orb (see `mica.audio.ts`); if this component
 * subscribed to it, every audio frame would re-render the whole shell — which is
 * the defect the channel exists to remove.
 *
 * The overlay and the bar arrive through `mica.surfaces.tsx`, so the assistant's
 * UI is not in the bundle of every page. The overlay exists only while a session
 * is live; the bar, which has an exit animation, is mounted from the first time
 * it is needed and then kept mounted with `open` telling it whether to be there.
 *
 * A split like that can turn into its own delay, so the two things that would
 * cause one are handled here: the chunk is warmed the moment a session exists —
 * including one started by a keyboard or assistive technology, which never fires
 * the entry points' pointer intents — and the boundary below draws the live orb
 * itself while the chunk is still in flight.
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

  // Fire-and-forget: the bundler caches the module, so this is a no-op on every
  // session after the first. It runs after the commit that made the session
  // live, which is early enough to be *in flight* for the whole of the
  // microphone probe that follows.
  useEffect(() => {
    if (active) preloadMicaSurfaces()
  }, [active])

  /**
   * Has the bar ever been needed in this session?
   *
   * Latched, so the chunk is fetched when a minimised session first exists and
   * not on a page where Mica is never used — while the bar itself has to stay
   * mounted to animate out.
   */
  const barMounted = useRef(false)
  if (showMini) barMounted.current = true

  /**
   * The last state the session was actually in. The bar animates its exit after
   * the session has already ended, and a bar that says "is listening…" while it
   * fades out would be reporting a session that is over.
   */
  const lastActiveState = useRef<MicaActiveState>('listening')
  if (active) lastActiveState.current = state as MicaActiveState

  return (
    <MicaContext.Provider value={mica}>
      {children}
      {!showMini && active && (
        <Suspense fallback={<MicaPendingSurface state={state} audio={mica.audio} />}>
          <MicaOverlaySurface
            state={state}
            audio={mica.audio}
            transcript={mica.transcript}
            responseMessage={mica.responseMessage}
            lastNavigation={mica.lastNavigation}
            onMinimise={mica.minimise}
            onCancel={mica.stopListening}
          />
        </Suspense>
      )}
      {barMounted.current && (
        <Suspense fallback={null}>
          <MicaMiniBarSurface
            open={showMini}
            state={lastActiveState.current}
            audio={mica.audio}
            transcript={mica.transcript}
            responseMessage={mica.responseMessage}
            lastNavigation={mica.lastNavigation}
            onExpand={mica.expand}
            onEnd={mica.stopListening}
          />
        </Suspense>
      )}
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

/**
 * What is on screen between the press and the assistant's own surface arriving.
 *
 * The overlay is a lazy chunk, and the entry point that was just pressed removes
 * itself the moment a session exists — so with a bare `fallback={null}` the first
 * tap on a cold cache was *invisible*: nothing on screen until the chunk landed.
 * The live orb is drawn here instead, on the next frame, centred in the same place
 * the overlay will keep it, so the press is always acknowledged and the copy
 * simply fades in underneath. Deliberately free of the animation library the
 * surfaces use: the shell must not pull it back in for a fallback.
 */
function MicaPendingSurface({ state, audio }: { state: MicaState; audio?: MicaAudioChannel }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: MICA_Z.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(15, 23, 42, 0.62)',
        // Nothing to tap yet: the session is already live, and the surface it is
        // waiting for brings its own controls.
        pointerEvents: 'none',
      }}
    >
      {/* The state is announced here as well, because the overlay's own live
          region is inside the chunk that has not arrived — and a tap that says
          nothing at all reads as a tap that did nothing. */}
      <div aria-live="polite" aria-atomic="true" role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
        {MICA_ANNOUNCEMENT[state]}
      </div>
      {/* The overlay draws this orb again a moment later, and the copy that goes
          with it is what carries the state on screen; the stand-in is hidden from
          the accessibility tree rather than announced twice. */}
      <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MicaOrb state={state} audio={audio} />
      </Box>
    </Box>
  )
}

/** The shared session. Throws loudly rather than silently starting a second one. */
export function useMicaSession(): MicaSession {
  const session = useContext(MicaContext)
  if (!session) throw new Error('useMicaSession must be used inside <MicaProvider>')
  return session
}
