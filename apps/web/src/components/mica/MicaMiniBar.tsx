import { useEffect } from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { MICA_LABEL, MICA_STATE_COPY, MICA_Z, type MicaActiveState } from './mica.identity'
import { usePrefersReducedMotion } from './mica.motion'
import type { MicaAudioChannel } from './mica.audio'
import type { MicaNavigateTarget } from './useMica'

interface MicaMiniBarProps {
  /**
   * Whether the bar is on screen. The bar owns its own presence — it is the only
   * thing that animates an exit, and keeping that animation here is what lets the
   * provider (and therefore every page) do without an animation library.
   */
  open?: boolean
  /** A live session only: the bar has no idle form (it is not the resting orb). */
  state: MicaActiveState
  /** The session's amplitude channel — see `mica.audio.ts`. */
  audio?: MicaAudioChannel
  transcript: string
  responseMessage: string | null
  lastNavigation: MicaNavigateTarget | null
  onExpand: () => void
  onEnd: () => void
}

type MicaMiniBarSurfaceProps = Omit<MicaMiniBarProps, 'open'>

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
export default function MicaMiniBar({ open = true, ...surface }: MicaMiniBarProps) {
  return (
    <AnimatePresence>
      {open && <MicaMiniBarSurface {...surface} />}
    </AnimatePresence>
  )
}

function MicaMiniBarSurface({
  state,
  audio,
  transcript,
  responseMessage,
  lastNavigation,
  onExpand,
  onEnd,
}: MicaMiniBarSurfaceProps) {
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
  const reducedMotion = usePrefersReducedMotion()

  /**
   * The pulse: a ring whose scale tracks the live audio level, so the carer can
   * see that Mica is hearing them without looking at a waveform.
   *
   * The level moves a motion value rather than React state. It used to be a
   * prop, which meant every audio frame re-rendered this bar *and* restarted its
   * 180ms scale animation — the animation never finished, because a new one
   * began 16ms later, and the strip visibly juddered for the whole session.
   * Written this way the ring is a composited transform, and the bar re-renders
   * only when what it *says* changes.
   */
  const level = useMotionValue(0)

  useEffect(() => {
    if (!audio) return undefined
    if (reducedMotion) {
      level.set(0)
      return undefined
    }
    return audio.subscribe(value => level.set(value))
  }, [audio, level, reducedMotion])

  const pulseScale = useTransform(level, [0, 1], [1, reducedMotion ? 1 : 1.5])
  const pulseOpacity = useTransform(level, [0, 1], [0.28, 0.55])

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
          {/* A gradient ring rather than a blurred disc: it scales as a
              composited transform instead of being re-blurred every frame. */}
          <motion.span
            data-mica-mini-pulse="on"
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(3, 198, 177, 0.55) 0%, rgba(3, 198, 177, 0) 70%)',
              scale: listening ? pulseScale : 1,
              opacity: listening ? pulseOpacity : 0.28,
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
            <Box sx={{ width: 3, height: 11, borderRadius: 2, bgcolor: '#FFFFFF' }} />
            <Box sx={{ width: 3, height: 11, borderRadius: 2, bgcolor: '#FFFFFF' }} />
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
              sx={{ color: 'rgba(255,255,255,0.82)', '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.12)' } }}
            >
              <OpenInFullIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={MICA_LABEL.end}>
            <IconButton
              size="small"
              onClick={onEnd}
              aria-label={MICA_LABEL.end}
              sx={{ color: 'rgba(255,255,255,0.82)', '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.12)' } }}
            >
              <CloseIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </motion.div>
  )
}
