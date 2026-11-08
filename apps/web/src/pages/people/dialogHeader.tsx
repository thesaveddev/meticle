import { Box, Chip, IconButton, Typography } from '@mui/material'
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

/** "DANIEL PRICE / CARE" — Figma 6.8 dialog eyebrow. Falls back to the area when the name is unknown. */
export function usePersonEyebrow(personId: string | undefined, area: string): string {
  const { data } = useQuery({
    queryKey: ['person-label', personId],
    queryFn: () => api.get(`/people/${personId}`).then((r: any) => r.data),
    enabled: !!personId,
    staleTime: 60_000,
  })
  const name = data ? `${data.first_name || ''} ${data.last_name || ''}`.trim() : ''
  return `${(name || 'Resident').toUpperCase()} / ${area}`
}

/** Figma 6.8 dialog header: eyebrow, title, subtitle, Close. Replaces bare DialogTitle. */
export default function FigDialogHeader({ eyebrow, title, subtitle, onClose }: {
  eyebrow: string
  title: string
  subtitle?: string
  onClose: () => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 3, pt: 2.5, pb: subtitle ? 0.5 : 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1.2, color: 'text.secondary' }}>
          {eyebrow}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
      </Box>
      <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon fontSize="small" /></IconButton>
    </Box>
  )
}

/** "DANIEL PRICE" -> "Daniel Price" for sentence subtitles. */
export function titleCase(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

/** Display name from an eyebrow ("DANIEL PRICE / CARE" -> "Daniel Price"). */
export function nameFromEyebrow(eyebrow: string): string {
  return titleCase(eyebrow.split(' / ')[0] || '')
}

/** Figma 6.8 pill option row (single-select). */
export function PillOptions<T extends string>({ options, value, onChange, color = '#0164C8', showCheck = false }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  color?: string
  /** Figma 7.2: the selected pill carries a check, so the choice reads at a glance. */
  showCheck?: boolean
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {options.map(o => {
        const selected = o.value === value
        return (
          <Chip
            key={o.value}
            label={o.label}
            clickable
            onClick={() => onChange(o.value)}
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            icon={selected && showCheck ? <CheckIcon sx={{ color: '#FFFFFF !important' }} /> : undefined}
            sx={selected
              ? { fontWeight: 600, bgcolor: color, color: '#FFFFFF', '&:hover': { bgcolor: color } }
              : { fontWeight: 500 }}
          />
        )
      })}
    </Box>
  )
}
