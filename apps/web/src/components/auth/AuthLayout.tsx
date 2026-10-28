import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AuthBrandPanel from './AuthBrandPanel'
import BrandWordmark from '../BrandWordmark'
import Nav from '../marketing/Nav'
import { M } from '../../styles/marketing-tokens'

export const AUTH_CARD_WIDTH = 500
export const AUTH_CARD_SHADOW = '0 12px 40px rgba(12, 27, 46, 0.06)'

/**
 * The one authentication shell every web auth page composes. Desktop is a
 * continuous two-panel canvas — brand left, form right, no harsh divider —
 * collapsing to a single form-first column on mobile browsers. This is the
 * web product's own responsive auth layout, deliberately independent of the
 * mobile application's navigation or UI.
 */
export default function AuthLayout({
  heading,
  supporting,
  features,
  children,
}: {
  /** Brand-panel headline (supports deliberate line breaks via <br/>). */
  heading: ReactNode
  /** Brand-panel supporting sentence. */
  supporting: string
  /** Four compact brand features — small, never cards. */
  features: { title: string; description: string; icon: 'notes' | 'person' | 'medication' | 'schedule' }[]
  /** The authentication card content (form or state). */
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        // Fixed to the viewport: the auth canvas never grows past one screen,
        // so the page itself never scrolls. On short viewports the right panel
        // scrolls internally rather than stretching the page.
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        bgcolor: 'var(--mc-background)',
        color: 'var(--mc-text-primary)',
        // The homepage header floats fixed over the page, so the canvas is
        // pushed down by the same offset the marketing layout uses.
        pt: { xs: '56px', md: '68px' },
        boxSizing: 'border-box',
      }}
    >
      {/* Same header as the homepage, for consistency. */}
      <Nav />
      <AuthBrandPanel
        heading={heading}
        supporting={supporting}
        features={features}
      />

      {/* RIGHT — authentication canvas. One continuous surface, so the two
          halves read as one page rather than two sites. */}
      <Box
        // data-lenis-prevent: Lenis's global wheel handler preventDefaults
        // every wheel event unless a node in the composed path carries this
        // attribute — without it, trackpad/gesture scrolling on this inner
        // panel is dead even when Lenis is stop()ed on auth routes, because
        // the virtual-scroll instance keeps listening on window. Verified in
        // browser: a dispatched wheel event on this panel had
        // defaultPrevented === true before this attribute existed. The same
        // opt-out the codebase applies to open MUI overlays.
        data-lenis-prevent
        sx={{
          flex: { xs: 1, md: 1 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          // safe center: short forms (login) stay vertically centred, but a
          // tall form (signup) aligns to the top when it overflows instead of
          // clipping its head above the scroll origin where gestures can
          // never reach it. Plain `center` + overflow hides the top of the
          // card on short viewports — the signup form's exact symptom.
          justifyContent: 'safe center',
          px: { xs: 3, sm: 6, md: 8 },
          py: { xs: 3, md: 4 },
          position: 'relative',
          // The one place scrolling is permitted: inside the right panel when
          // the viewport is genuinely too short for the card. The page never
          // scrolls; this panel does, invisibly.
          overflowY: 'auto',
          maxHeight: '100%',
          // Touch / gesture scrolling needs the native momentum path; without
          // these the panel scrolls on desktop wheels only.
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
      >
        {/* Mobile brand-header gradient (Figma 1.7): the brand panel is
            hidden on mobile, so its gradient lives as a strip behind the
            wordmark instead. Desktop keeps the form side un-tinted. */}
        <Box
          aria-hidden
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'absolute', top: 0, left: 0, right: 0, height: 120,
            background: `linear-gradient(180deg, ${M.heroTint} 0%, ${M.gradMid} 60%, rgba(255,255,255,0) 100%)`,
            pointerEvents: 'none',
          }}
        />
        {/* Slim top bar: wordmark on mobile (brand panel is hidden there),
            language on desktop. Never a second product's chrome. */}
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 20, md: 28 },
            left: { xs: 24, md: 40 },
            display: { md: 'none' },
          }}
        >
          <BrandWordmark size={20} onClick={() => navigate('/')} />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 20, md: 28 },
            right: { xs: 24, md: 40 },
            display: { xs: 'none', sm: 'block' },
          }}
        >
          <Typography component="span" sx={{ fontSize: 13, color: 'var(--mc-text-secondary)', fontWeight: 500 }}>
            English (UK)
          </Typography>
        </Box>

        <Box
          sx={{
            width: '100%',
            maxWidth: AUTH_CARD_WIDTH,
            bgcolor: 'var(--mc-surface)',
            border: '1px solid var(--mc-border)',
            borderRadius: '24px',
            boxShadow: AUTH_CARD_SHADOW,
            px: { xs: 3, sm: 4, md: 5 },
            py: { xs: 3.5, sm: 4, md: 4.5 },
            my: { xs: 7, md: 7 },
            flexShrink: 0,
          }}
        >
          {children}
        </Box>

        {/* Trust line mirrors the brand panel's claims on mobile, where the
            panel itself is hidden. */}
        <Typography
          variant="caption"
          sx={{
            mt: 3,
            display: { md: 'none' },
            color: 'var(--mc-text-muted)',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          Secure UK hosting · Encrypted · GDPR focused
        </Typography>
      </Box>
    </Box>
  )
}
