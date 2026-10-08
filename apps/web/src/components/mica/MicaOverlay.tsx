import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
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
  onCancel: () => void
}

const STATE_COPY: Record<Exclude<MicaState, 'idle'>, { title: string; sub: string; action: string }> = {
  listening: { title: 'MICA', sub: 'is listening…', action: 'Tap to cancel' },
  thinking: { title: 'MICA', sub: 'is thinking…', action: 'Cancel' },
  responding: { title: 'MICA', sub: 'responding…', action: 'Done' },
}

const personName = (p: PersonOption) => `${p.first_name} ${p.last_name}`.trim()

/**
 * Full-screen Mica voice overlay. Dimmed dashboard behind, live orb, waveform
 * and response card in front — mirrors the mobile listening/responding screens.
 */
export default function MicaOverlay({ state, audioLevel, transcript, responseMessage, person, onPersonChange, onCancel }: MicaOverlayProps) {
  const [people, setPeople] = useState<PersonOption[]>([])

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

  if (state === 'idle') {
    return null
  }
  const copy = STATE_COPY[state]

  return (
    <AnimatePresence>
      <motion.div
        key="mica-overlay"
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
        }}
        role="dialog"
        aria-modal="true"
        aria-label="MICA voice assistant"
      >
        <Box
          component="div"
          sx={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3 }}
        >
          <MicaOrb state={state} audioLevel={audioLevel} />

          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <Typography
              variant="h4"
              component="div"
              sx={{ color: '#FFFFFF', fontWeight: 800, letterSpacing: 2, mt: 3, textAlign: 'center' }}
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
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 1.5 }}>
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
              aria-label="Cancel Mica"
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
