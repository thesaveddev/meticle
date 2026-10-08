import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import NotesIcon from '@mui/icons-material/Notes'
import PersonIcon from '@mui/icons-material/Person'
import MedicationIcon from '@mui/icons-material/Medication'
import ScheduleIcon from '@mui/icons-material/Schedule'

export interface BrandFeature {
  title: string
  description: string
  icon: 'notes' | 'person' | 'medication' | 'schedule'
}

const FEATURE_ICONS = {
  notes: NotesIcon,
  person: PersonIcon,
  medication: MedicationIcon,
  schedule: ScheduleIcon,
} as const

const SOFT_SHAPES = {
  borderRadius: '50%',
  position: 'absolute',
} as const

/**
 * LEFT — the brand half of the auth canvas. Hidden on mobile browsers, where
 * the form becomes the page; never a substitute for the mobile application's
 * own experience. Decorative shapes are extremely soft and pinned low so they
 * can never compete with the form on the right.
 */
export default function AuthBrandPanel({
  heading,
  supporting,
  features,
}: {
  heading: React.ReactNode
  supporting: string
  features: BrandFeature[]
}) {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flex: { md: 1 },
        flexDirection: 'column',
        justifyContent: 'space-between',
        px: { lg: 10, xl: 12 },
        py: { md: 5, lg: 6 },
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'var(--mc-background)',
      }}
    >
      {/* Soft MeticleCare shapes, bottom of the panel. Purely decorative. */}
      <Box aria-hidden sx={{ ...SOFT_SHAPES, width: 340, height: 340, left: -120, bottom: -140, bgcolor: 'var(--mc-info-soft)' }} />
      <Box aria-hidden sx={{ ...SOFT_SHAPES, width: 220, height: 220, left: 140, bottom: -90, bgcolor: 'var(--mc-shape-cyan)', opacity: 0.85 }} />
      <Box aria-hidden sx={{ ...SOFT_SHAPES, width: 150, height: 150, right: -40, bottom: 60, bgcolor: 'var(--mc-success-soft)' }} />

      {/* Wordmark */}
      <Box
        sx={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', color: 'var(--mc-primary)', cursor: 'pointer', width: 'fit-content' }}
        onClick={() => navigate('/')}
        role="link"
        aria-label="MeticleCare home"
      >
        Meticle<span style={{ fontWeight: 400 }}>Care</span>
      </Box>
      <Typography variant="body2" sx={{ color: 'var(--mc-text-muted)', mt: 0.5, fontWeight: 500 }}>
        Care operations, unified.
      </Typography>

      {/* Headline + supporting copy */}
      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { md: '44px', lg: '52px' },
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-1.5px',
            color: 'var(--mc-text-primary)',
            mb: 2.5,
          }}
        >
          {heading}
        </Typography>
        <Typography sx={{ fontSize: 16, lineHeight: 1.7, color: 'var(--mc-text-secondary)', maxWidth: 440 }}>
          {supporting}
        </Typography>

        {/* Four compact feature statements — small icon, title, one line. */}
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {features.map(f => {
            const Icon = FEATURE_ICONS[f.icon]
            return (
              <Box component="li" key={f.title} sx={{ display: 'flex', gap: 1.5 }}>
                <Box
                  aria-hidden
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    bgcolor: 'var(--mc-info-soft, var(--mc-info-soft))',
                    color: 'var(--mc-primary)',
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-text-primary)' }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'var(--mc-text-secondary)', lineHeight: 1.5 }}>{f.description}</Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Trust statements — only substantiated claims. */}
      <Typography variant="caption" sx={{ position: 'relative', zIndex: 1, color: 'var(--mc-text-muted)', fontWeight: 500, letterSpacing: '0.01em' }}>
        Secure UK hosting · Encrypted data · GDPR focused
      </Typography>
    </Box>
  )
}
