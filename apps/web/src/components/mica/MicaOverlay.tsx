import { Fragment, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import CheckIcon from '@mui/icons-material/Check'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import MicaOrb, { type MicaState } from './MicaOrb'
import { MICA_ANNOUNCEMENT, MICA_LABEL, MICA_STATE_COPY, MICA_Z } from './mica.identity'
import { P } from '../../styles/tokens'
import type { MicaAudioChannel } from './mica.audio'
import type { MicaDraft, MicaNavigateTarget, MicaOffer } from './useMica'

export type { MicaState }

interface MicaOverlayProps {
  state: MicaState
  /**
   * The session's amplitude channel, handed straight to the orb.
   *
   * It is deliberately not a number. As a prop it was React state changing sixty
   * times a second, which re-rendered this entire dialog — transcript, message,
   * destination chip and all — once per animation frame, for a value the orb
   * turns into a `scale()`. See `mica.audio.ts`.
   */
  audio?: MicaAudioChannel
  transcript: string
  responseMessage: string | null
  /** The page Mica last opened, shown as a confirmation rather than a claim. */
  lastNavigation: MicaNavigateTarget | null
  /**
   * The record Mica prepared and has not saved, if any. Its presence is what makes
   * the card below appear; the draft itself is the server's, held by the hook.
   */
  draft?: MicaDraft | null
  /** True while that draft is being saved. */
  savingDraft?: boolean
  /** Save it — the only path from a prepared draft to a stored row. */
  onSaveDraft?: () => void
  /** Drop it. */
  onDiscardDraft?: () => void
  /** The page an answer or a save offered, waiting to be opened. */
  offer?: MicaOffer | null
  /** Open it now, without waiting for the carer to say "yes". */
  onOpenOffer?: () => void
  /** Drop to the bottom bar and keep the session (and the microphone) live. */
  onMinimise: () => void
  /** End the conversation. */
  onCancel: () => void
}

/**
 * The rows the review card lists, from the draft's own output.
 *
 * Only what the server actually put in the draft: a missing owner or due date is
 * a blank the card does not show, not a rendered "undefined". The names are the
 * ones the server resolved from what was said, so the card and the spoken summary
 * cannot disagree about who the record is for.
 */
function draftRows(draft: MicaDraft): Array<{ label: string; value: string }> {
  const output = draft.output || {}
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
  const rows: Array<{ label: string; value: string }> = []

  const title = text(output.title)
  if (title) rows.push({ label: 'Title', value: title })
  const person = text(output.personName)
  if (person) rows.push({ label: 'For', value: person })

  if (draft.action === 'CREATE_APPOINTMENT') {
    const staff = text(output.staffName)
    if (staff) rows.push({ label: 'With', value: staff })
    const start = text(output.startTime)
    const when = start ? new Date(start) : null
    if (when && !Number.isNaN(when.getTime())) {
      rows.push({
        label: 'Starts',
        value: when.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
      })
    }
  } else {
    const owner = text(output.assigneeName)
    if (owner) rows.push({ label: 'Owner', value: owner })
    const due = text(output.dueDate)
    if (due) {
      // Formatted in UTC on purpose: `new Date('2026-10-20')` is UTC midnight,
      // which is the 19th west of Greenwich — the due date read back one day early.
      rows.push({
        label: 'Due',
        value: new Date(`${due}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
      })
    }
    const priority = text(output.priority)
    if (priority) rows.push({ label: 'Priority', value: priority[0].toUpperCase() + priority.slice(1) })
  }

  return rows
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
 *
 * One thing is deliberately *added* here, because its absence made a whole flow
 * unreachable: the review card for a record Mica has prepared. The action gateway
 * has always drafted before persisting (`apps/api/src/modules/ai/actions/`), but
 * the draft had no surface anywhere in the client, so no task or appointment could
 * ever be saved. The card lists what the draft would create, saves on a tap or on
 * the word "yes", and — like a list answer — ends by offering the page the new
 * record lives on.
 */
export default function MicaOverlay({
  state,
  audio,
  transcript,
  responseMessage,
  lastNavigation,
  draft,
  savingDraft = false,
  onSaveDraft,
  onDiscardDraft,
  offer,
  onOpenOffer,
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
          <MicaOrb state={state} audio={audio} />

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

          {/*
            The record Mica prepared, waiting to be saved.

            This is the client half of the gateway's confirm-before-persist
            contract: the spoken request produced a draft and nothing else, so the
            draft has to be somewhere the carer can approve it — and somewhere a
            voice-first user can also answer by simply saying "yes".
          */}
          {draft && (
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', marginTop: 16 }}
            >
              <Box
                role="group"
                aria-label={MICA_LABEL.draft}
                data-mica-draft={draft.action}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  borderRadius: 3,
                  px: 2.5,
                  py: 2,
                  backdropFilter: 'blur(14px)',
                }}
              >
                <Typography
                  variant="overline"
                  component="p"
                  sx={{ color: P.greenOnDark, letterSpacing: 1.2 }}
                >
                  {draft.action === 'CREATE_APPOINTMENT' ? 'Ready to book' : 'Ready to save'}
                </Typography>

                <Box
                  component="dl"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr)',
                    columnGap: 2,
                    rowGap: 0.5,
                    m: 0,
                    mt: 1,
                  }}
                >
                  {draftRows(draft).map(row => (
                    <Fragment key={row.label}>
                      <Typography component="dt" variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>
                        {row.label}
                      </Typography>
                      <Typography
                        component="dd"
                        variant="caption"
                        sx={{ color: '#FFFFFF', fontWeight: 600, m: 0, minWidth: 0, overflowWrap: 'anywhere' }}
                      >
                        {row.value}
                      </Typography>
                    </Fragment>
                  ))}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    onClick={onSaveDraft}
                    disabled={savingDraft}
                    variant="contained"
                    startIcon={
                      savingDraft
                        ? <CircularProgress size={14} sx={{ color: '#FFFFFF' }} />
                        : <CheckIcon sx={{ fontSize: 18 }} />
                    }
                    sx={{
                      // The product's action green, not the brand emerald: white on
                      // #10B981 is about 2.3:1, and this is the button a carer reads
                      // before approving a record. `P.action` is the same green the
                      // tasks and appointments pages already use for their own
                      // completion actions, and `P.actionHover` is it pressed.
                      bgcolor: P.action,
                      color: '#FFFFFF',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': { bgcolor: P.actionHover },
                    }}
                  >
                    {savingDraft
                      ? (draft.action === 'CREATE_APPOINTMENT' ? 'Booking…' : 'Saving…')
                      : (draft.action === 'CREATE_APPOINTMENT' ? 'Book appointment' : 'Save task')}
                  </Button>
                  <Button
                    onClick={onDiscardDraft}
                    sx={{ color: 'rgba(255,255,255,0.86)', textTransform: 'none' }}
                  >
                    Discard
                  </Button>
                </Box>

                {/* The card is not the only way to answer: the reply ended by
                    asking, and the word that answers it saves the draft. The verb
                    matches the button beside it — booking, not saving. */}
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)', display: 'block', mt: 1.25 }}>
                  {draft.action === 'CREATE_APPOINTMENT' ? 'Or say “yes” to book it.' : 'Or say “yes” to save it.'}
                </Typography>
              </Box>
            </motion.div>
          )}

          {/*
            The page a reply — or a record Mica just saved — is offering, waiting
            on the carer's word. Shown as a control as well as spoken, so the offer
            is openable by tap and by "yes" through the same route.
          */}
          {offer && (
            <Box sx={{ mt: 1.5, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Tooltip title={offer.question}>
                <Button
                  onClick={onOpenOffer}
                  data-mica-offer={offer.path}
                  startIcon={<OpenInNewIcon sx={{ fontSize: 17 }} />}
                  sx={{
                    color: '#FFFFFF',
                    bgcolor: 'rgba(16, 185, 129, 0.22)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: 'var(--radius-pill, 999px)',
                    px: 2.25,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.34)', borderColor: 'rgba(16, 185, 129, 0.7)' },
                  }}
                >
                  Open {offer.label}
                </Button>
              </Tooltip>
            </Box>
          )}

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
