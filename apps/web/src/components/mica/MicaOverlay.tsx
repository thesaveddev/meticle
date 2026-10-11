import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Autocomplete, Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import MicaOrb, { type MicaState } from './MicaOrb'
import type { MicaPerson } from './useMica'
import api from '../../services/api'

export type { MicaState }

interface PersonOption {
  id: string
  first_name: string
  last_name: string
  room_number?: string
}

interface MicaOverlayProps {
  state: MicaState
  audioLevel: number
  transcript: string
  responseMessage: string | null
  person: MicaPerson | null
  onPersonChange: (person: MicaPerson | null) => void
  /** Submitted typed text — the text/keyboard Mica entry point. */
  onSendText?: (text: string) => void
  onCancel: () => void
}

const STATE_COPY: Record<Exclude<MicaState, 'idle'>, { title: string; sub: string; action: string }> = {
  listening: { title: 'MICA', sub: 'is listening…', action: 'Tap to cancel · Esc' },
  thinking: { title: 'MICA', sub: 'is thinking…', action: 'Esc to cancel' },
  responding: { title: 'MICA', sub: 'responding…', action: 'Done · Esc' },
}

const personName = (p: PersonOption) => `${p.first_name} ${p.last_name}`.trim()

/** Screen-reader announcements for state changes that carry no response text. */
const STATE_ANNOUNCEMENT: Record<MicaState, string> = {
  idle: '',
  listening: 'Mica is listening. Speak your care note, or press Escape to cancel.',
  thinking: 'Mica is thinking.',
  responding: 'Mica is responding.',
}

/**
 * Full-screen Mica overlay. Dimmed dashboard behind, live orb, waveform and
 * response card in front — mirrors the mobile listening/responding screens.
 * The listening state also carries the keyboard entry path: the same typing
 * box the hearing-impaired or quiet-room user reaches for, wired through the
 * identical intent pipeline as the mic so a typed sentence behaves exactly
 * like a spoken one.
 */
export default function MicaOverlay({ state, audioLevel, transcript, responseMessage, person, onPersonChange, onSendText, onCancel }: MicaOverlayProps) {
  const [people, setPeople] = useState<PersonOption[]>([])
  const [typed, setTyped] = useState('')

  // Focus management refs.
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Active people for the "who is this about?" picker. Loaded while the
  // overlay is open (it only renders in a non-idle state) so the dashboard
  // never pays for it.
  useEffect(() => {
    let cancelled = false
    api
      .get('/people', { params: { status: 'active' } })
      .then((r: { data: unknown }) => {
        if (cancelled) return
        const rows = Array.isArray(r.data) ? r.data : (r.data as { people?: PersonOption[] } | null)?.people || []
        setPeople(rows)
      })
      .catch(() => {
        if (!cancelled) setPeople([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => people.find(p => p.id === person?.id) ?? null, [people, person?.id])

  // ARIA live region text: announces what the assistant is doing without
  // requiring sight. The spoken-response text is the priority announcement;
  // state copy is the fallback for transitions with no response yet.
  const liveText = responseMessage ?? STATE_ANNOUNCEMENT[state]

  // Escape to cancel, and a Tab focus trap while the dialog is open.
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
  // The close button is a stable, always-present target inside the dialog,
  // so initial focus lands somewhere sensible whichever state we open into.
  useEffect(() => {
    const isActive = state !== 'idle'
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      // Defer one tick so the picker (autofocus target in listening state)
      // finishes rendering before we pick.
      const raf = requestAnimationFrame(() => {
        const target =
          dialogRef.current?.querySelector<HTMLElement>('[data-mica-autofocus]') ??
          dialogRef.current?.querySelector<HTMLElement>('button')
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
  }, [state])

  if (state === 'idle') {
    return null
  }
  const copy = STATE_COPY[state]

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
          zIndex: 1300,
          background: 'rgba(15, 23, 42, 0.62)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="MICA voice assistant"
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

          {/* Keyboard entry (listening state): type instead of speak. Shares
              the voice pipeline; source is recorded as 'text' server-side. */}
          {state === 'listening' && onSendText && (
            <Box
              component="form"
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault()
                if (!typed.trim()) return
                onSendText(typed)
                setTyped('')
              }}
              sx={{ width: '100%', mt: 2 }}
            >
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={3}
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  // Enter sends, Shift+Enter adds a line — the convention every
                  // other composer in this app follows.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (typed.trim()) {
                      onSendText(typed)
                      setTyped('')
                    }
                  }
                }}
                inputProps={{
                  // MUI maps aria-label on the multiline TextField into
                  // inputProps, and testing-library reads it there.
                  'aria-label': 'Type to Mica',
                }}
                placeholder="Type instead of speaking — questions, notes or tasks"
                aria-label="Type to Mica"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#FFFFFF',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.45)' },
                    '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.7)' },
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="submit"
                        size="small"
                        aria-label="Send to Mica"
                        disabled={!typed.trim()}
                        sx={{ color: 'rgba(255,255,255,0.8)' }}
                      >
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {state === 'listening' && (
            <Autocomplete
              disablePortal
              options={people}
              value={value}
              getOptionLabel={personName}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_, option) =>
                onPersonChange(option ? { id: option.id, name: personName(option) } : null)
              }
              sx={{ width: '100%', mt: 2 }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{personName(option)}</Typography>
                    {option.room_number ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Room {option.room_number}</Typography>
                    ) : null}
                  </Box>
                </Box>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Who is this note about?"
                  placeholder="Pick a person"
                  inputProps={{ ...params.inputProps, 'data-mica-autofocus': true }}
                  InputLabelProps={{
                    sx: { color: 'rgba(255,255,255,0.7)', '&.Mui-focused': { color: 'rgba(255,255,255,0.9)' } },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#FFFFFF',
                      bgcolor: 'rgba(255,255,255,0.08)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.45)' },
                      '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.7)' },
                    },
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
                  }}
                />
              )}
            />
          )}

          {state !== 'listening' && person && (
            <Typography variant="body2" aria-live="polite" sx={{ color: 'rgba(255,255,255,0.65)', mt: 1.5 }}>
              Note about {person.name}
            </Typography>
          )}

          <AnimatePresence>
            {state === 'responding' && responseMessage && (
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ width: '100%', marginTop: 24 }}
              >
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.18)',
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

          <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Button
              onClick={onCancel}
              aria-label={`Cancel Mica (or press Escape). ${copy.action}`}
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
      </motion.div>
    </AnimatePresence>
  )
}
