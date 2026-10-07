import { AnimatePresence, motion } from 'framer-motion'
import { Box, Button, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import MicaOrb, { type MicaState } from './MicaOrb'

export type { MicaState }

interface MicaOverlayProps {
  state: MicaState
  audioLevel: number
  transcript: string
  responseMessage: string | null
  onCancel: () => void
}

const STATE_COPY: Record<Exclude<MicaState, 'idle'>, { title: string; sub: string; action: string }> = {
  listening: { title: 'MICA', sub: 'is listening…', action: 'Tap to cancel' },
  thinking: { title: 'MICA', sub: 'is thinking…', action: 'Cancel' },
  responding: { title: 'MICA', sub: 'responding…', action: 'Done' },
}

/**
 * Full-screen Mica voice overlay. Dimmed dashboard behind, live orb, waveform
 * and response card in front — mirrors the mobile listening/responding screens.
 */
export default function MicaOverlay({ state, audioLevel, transcript, responseMessage, onCancel }: MicaOverlayProps) {
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
