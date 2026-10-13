import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Box, Button, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import MicaOrb, { type MicaState } from './MicaOrb'
import { MICA_ANNOUNCEMENT, MICA_LABEL, MICA_STATE_COPY, MICA_Z } from './mica.identity'
import type { MicaNavigateTarget } from './useMica'

export type { MicaState }

interface MicaOverlayProps {
  state: MicaState
  audioLevel: number
  transcript: string
  responseMessage: string | null
  /** The page Mica last opened, shown as a confirmation rather than a claim. */
  lastNavigation: MicaNavigateTarget | null
  /** Drop to the bottom bar and keep the session (and the microphone) live. */
  onMinimise: () => void
  /** End the conversation. */
  onCancel: () => void
}

/**
 * Full-screen Mica, while the carer is looking at Mica rather than at a page.
 *
 * Two things are deliberately absent from this surface, and their absence is
 * the point:
 *
 *   1. **No typing box.** Mica is the voice assistant; a text field in the
 *      middle of it invites a second, quieter conversation that the room cannot
 *      hear and that the continuous-listening flow then talks over.
 *   2. **No "who is this about?" picker.** A dropdown is a demand for data entry
 *      in the middle of a spoken sentence. The subject now comes from the
 *      utterance, and when it genuinely cannot be told, Mica asks aloud and the
 *      carer answers — see useMica's pending-clarification handling.
 *
 * What replaces them: the destination chip, which says where Mica just took the
 * user, and a minimise control, because a reply that opens a page should get out
 * of that page's way instead of covering it.
 */
export default function MicaOverlay({
  state,
  audioLevel,
  transcript,
  responseMessage,
  lastNavigation,
  onMinimise,
  onCancel,
}: MicaOverlayProps) {
  // Focus management refs.
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const active = state !== 'idle'

  // ARIA live region text: announces what the assistant is doing without
  // requiring sight. The spoken-response text is the priority announcement;
  // state copy is the fallback for transitions with no response yet.
  const liveText = responseMessage ?? MICA_ANNOUNCEMENT[state]

  // Escape ends the conversation, and a Tab focus trap while the dialog is open.
  // Tab-handling must run only while state !== 'idle': at idle the overlay
  // returns null and the close button (inside the dialog subtree) is gone.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Cycle focus within the dialog: find focusable descendants and wrap
        // at either end. With no focusable elements the trap holds focus on
        // the dialog itself, which is still reachable and labelled.
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
        if (list.length === 0) return
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel])

  // Focus handoff: move focus into the dialog on open, restore it on close.
  // The first control inside the dialog is a stable, always-present target, so
  // initial focus lands somewhere sensible whichever state we open into.
  useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      const raf = requestAnimationFrame(() => {
        const target = dialogRef.current?.querySelector<HTMLElement>('button')
        ;(target ?? dialogRef.current)?.focus()
      })
      return () => cancelAnimationFrame(raf)
    }
    const prev = previousFocusRef.current
    if (prev && document.contains(prev)) {
      prev.focus()
    }
    previousFocusRef.current = null
    return undefined
  }, [active])

  if (state === 'idle') {
    return null
  }
  const copy = MICA_STATE_COPY[state]

  return (
    <AnimatePresence>
      <motion.div
        key="mica-overlay"
        ref={dialogRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'fixed',
          inset: 0,
          // Above MUI's modal layer (1300) — see MICA_Z: the overlay is the
          // top-level surface whenever it is open, so a dialog must not sit
          // over it by accident of DOM order.
          zIndex: MICA_Z.overlay,
          background: 'rgba(15, 23, 42, 0.62)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={MICA_LABEL.overlay}
        tabIndex={-1}
      >
        {/* Announcements for screen readers: the live region is always in the
            tree while the overlay is open so politeness changes are queued
            reliably, not only when a response text happens to appear. */}
        <div aria-live="polite" aria-atomic="true" role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
          {liveText}
        </div>
        <Box
          component="div"
          sx={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3 }}
        >
          <MicaOrb state={state} audioLevel={audioLevel} />

          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <Typography
              variant="h4"
              component="div"
              sx={{ color: '#FFFFFF', fontWeight: 600, letterSpacing: 2, mt: 3, textAlign: 'center' }}
            >
              {copy.title}
            </Typography>
            <Typography
              variant="subtitle1"
              component="div"
              sx={{ color: 'rgba(255,255,255,0.82)', textAlign: 'center', mt: 0.5 }}
            >
              {copy.sub}
            </Typography>
          </motion.div>

          {state === 'listening' && transcript && (
            <Box sx={{ mt: 2, px: 2, py: 1.5, width: '100%', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
                “{transcript}”
              </Typography>
            </Box>
          )}

          {/* Where Mica just took the user. Stated as a fact, because it is one:
              the route was pushed before this line was spoken. */}
          {lastNavigation && state !== 'listening' && (
            <Box
              data-mica-destination={lastNavigation.path}
              sx={{
                mt: 2,
                px: 1.75,
                py: 0.75,
                borderRadius: 'var(--radius-pill, 999px)',
                bgcolor: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(16, 185, 129, 0.42)',
                maxWidth: '100%',
              }}
            >
              <Typography variant="caption" sx={{ color: 'var(--mc-success-soft)' }}>
                {MICA_LABEL.opened} {lastNavigation.label}
              </Typography>
            </Box>
          )}

          <AnimatePresence>
            {(state === 'responding' || state === 'error') && responseMessage && (
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ width: '100%', marginTop: 24 }}
              >
                <Box
                  data-mica-message={state}
                  sx={{
                    bgcolor: state === 'error' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.14)',
                    border: state === 'error' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 3,
                    px: 2.5,
                    py: 2,
                    width: '100%',
                    backdropFilter: 'blur(14px)',
                  }}
                >
                  <Typography variant="body1" sx={{ color: '#FFFFFF', lineHeight: 1.5 }}>
                    {responseMessage}
                  </Typography>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

          <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {state !== 'error' && (
              <Button
                onClick={onMinimise}
                startIcon={<MinimizeIcon />}
                aria-label={MICA_LABEL.minimise}
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-pill, 999px)',
                  px: 2.5,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.4)' },
                }}
              >
                Minimise and keep listening
              </Button>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Button
                onClick={onCancel}
                aria-label={`End the conversation with Mica (or press Escape). ${copy.action}`}
                sx={{
                  width: 56,
                  height: 56,
                  minWidth: 0,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: '#FFFFFF',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
                }}
              >
                <CloseIcon />
              </Button>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
                {copy.action}
              </Typography>
            </Box>
          </Box>
        </Box>
      </motion.div>
    </AnimatePresence>
  )
}
