import { Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'

/**
 * The single MeticleCare wordmark. Every surface renders this so weight,
 * letter spacing and the two-tone treatment can never drift apart — the login
 * page, the signup page, the brand panel and the marketing nav are the same
 * component, not four copies with four font weights.
 */
export default function BrandWordmark({
  size = 22,
  color = 'var(--mc-primary)',
  accent,
  onClick,
  sx = [],
}: {
  /** Font size in px. */
  size?: number
  /** Colour of the "Meticle" stem. */
  color?: string
  /** Colour of the "Care" suffix; defaults to a lighter weight of the same colour. */
  accent?: string
  onClick?: () => void
  sx?: any
}) {
  const navigate = useNavigate()
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick ?? (() => navigate('/'))}
      aria-label="MeticleCare home"
      role={onClick ? undefined : 'link'}
      sx={[
        {
          // Reset when rendered as a button.
          border: 0,
          background: 'none',
          p: 0,
          cursor: 'pointer',
          width: 'fit-content',
          fontFamily: 'inherit',
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      Meticle
      <span style={{ fontWeight: 400, color: accent ?? color }}>Care</span>
    </Box>
  )
}
