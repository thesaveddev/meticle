import { useEffect } from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { motion } from 'framer-motion'
import { MICA_LABEL, MICA_STATE_COPY, MICA_Z, type MicaActiveState } from './mica.identity'
import type { MicaNavigateTarget } from './useMica'

interface MicaMiniBarProps {
  /** A live session only: the bar has no idle form (it is not the resting orb). */
  state: MicaActiveState
  audioLevel: number
  transcript: string
  responseMessage: string | null
  lastNavigation: MicaNavigateTarget | null
  onExpand: () => void
  onEnd: () => void
}

/**
 * Mica, minimised: the bar the session lives in once it has opened a page.
 *
 * Why this exists. Mica's replies used to be the end of the interaction — it
 * said what was on the MAR chart and closed, leaving the carer to navigate
 * there themselves. Now it opens the page, and a full-screen modal sitting on
 * top of the thing it just opened would be absurd: the answer is the page. So
 * the session moves down here — small, bottom-centre, out of the content's way —
 * and keeps the microphone open, because the next question usually follows
 * immediately ("and February?").
 *
 * It is a *status strip*, not a second orb. The identity orb is MicaOrb, piped
 * through MICA_STATE_COPY and the z-index ladder; this deliberately reuses
 * those tokens (including the same gradient) at strip scale rather than
 * inventing a second Mica that would eventually drift from the first.
 */
export default function MicaMiniBar({
  state,
  audioLevel,
  transcript,
  responseMessage,
  lastNavigation,
  onExpand,
  onEnd,
}: MicaMiniBarProps) {
  // Escape ends the conversation from here too: the overlay owns it while the
  // overlay is open, and the bar owns it while the bar is.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onEnd()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onEnd])

  const listening = state === 'listening'
  // What the bar says, in priority order: the failure, then the reply being
  // spoken, then the live words, then the page Mica just opened, then the
  // state's own copy. A voice-first surface has to say something true at every
  // moment, and silence while "thinking" reads as a dead assistant.
  const line =
    state === 'error' && responseMessage ? responseMessage
      : responseMessage ? responseMessage
        : transcript ? `“${transcript}”`
          : lastNavigation ? `${MICA_LABEL.opened} ${lastNavigation.label}`
            : MICA_STATE_COPY[state].sub

  // The pulse: a ring whose scale tracks the live audio level, so the carer can
  // see that Mica is hearing them without looking at a waveform.
  const pulse = 1 + Math.max(0, Math.min(1, audioLevel)) * 0.5

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        // Centred without a layout width, so the bar sizes to its content.
        transform: 'translateX(-50%)',
        // Below MUI's modal layer on purpose (see MICA_Z.mini): an open dialog
        // must paint over the bar exactly as it does over the resting orb.
        zIndex: MICA_Z.mini,
        maxWidth: 'min(640px, calc(100vw - 32px))',
      }}
    >
      <Box
        data-mica-mini={state}
        role="status"
        aria-label={MICA_LABEL.mini}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pl: 1.25,
          pr: 0.75,
          py: 0.75,
          borderRadius: 'var(--radius-pill, 999px)',
          bgcolor: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 18px 40px rgba(12, 27, 46, 0.32)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* The status light: same gradient as the orb, at strip scale. */}
        <Box sx={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }} aria-hidden>
          <Box
            component={motion.span}
            animate={{ scale: listening ? pulse : 1, opacity: listening ? 0.55 : 0.28 }}
            transition={{ duration: 0.18 }}
            sx={{
              position: 'absolute',
              inset: -3,
              borderRadius: '50%',
              background: '#03C6B1',
              filter: 'blur(7px)',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #014FB5 0%, #0164C8 38%, #03C6B1 72%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
            }}
          >
            {/* The orb's two eyes, kept so the bar still reads as Mica. */}
            <Box sx={{ width: 3, height: 11, borderRadius: 2, bgcolor: '#fff' }} />
            <Box sx={{ width: 3, height: 11, borderRadius: 2, bgcolor: '#fff' }} />
          </Box>
        </Box>

        <Typography
          variant="body2"
          sx={{
            color: state === 'error' ? '#FCA5A5' : 'rgba(255,255,255,0.92)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.35,
          }}
        >
          {line}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto', flexShrink: 0 }}>
          <Tooltip title={MICA_LABEL.expand}>
            <IconButton
              size="small"
              onClick={onExpand}
              aria-label={MICA_LABEL.expand}
              sx={{ color: 'rgba(255,255,255,0.82)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' } }}
            >
              <OpenInFullIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={MICA_LABEL.end}>
            <IconButton
              size="small"
              onClick={onEnd}
              aria-label={MICA_LABEL.end}
              sx={{ color: 'rgba(255,255,255,0.82)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' } }}
            >
              <CloseIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </motion.div>
  )
}
