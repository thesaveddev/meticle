import { Box, BoxProps, Typography, Stack, Chip, LinearProgress } from '@mui/material'
import { METICLE_COLORS } from '../../context/ThemeContext'
import { useTheme } from '@mui/material/styles'

interface PremiumCardProps extends BoxProps {
  noBorder?: boolean
}

export function PremiumCard({ children, noBorder = false, sx, ...props }: PremiumCardProps) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'none',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        overflow: 'hidden',
        border: noBorder && theme.palette.mode === 'dark' ? 'none' : `1px solid ${theme.palette.divider}`,
        ...(props.onClick ? { cursor: 'pointer', '&:hover': { borderColor: theme.palette.mode === 'dark' ? '#43536A' : '#D8DEE7', boxShadow: 'var(--shadow-sm)' } } : {}),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  onClick?: () => void
}

export function StatCard({ label, value, icon, color, onClick }: StatCardProps) {
  const theme = useTheme()
  const accentColor = color === 'text.primary' ? theme.palette.primary.main : color
  return (
    <PremiumCard
      noBorder
      sx={{
        p: { xs: 2.25, sm: 2.5 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { borderColor: theme.palette.mode === 'dark' ? '#43536A' : '#CBD5E1' } : {},
        '&:focus-visible': onClick ? { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } : {},
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(47,128,237,0.16)' : `${accentColor}12`,
            color: accentColor,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.text.primary, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          fontWeight: 500,
          mt: 0.5,
        }}
      >
        {label}
      </Typography>
    </PremiumCard>
  )
}

type StatusVariant = 'completed' | 'scheduled' | 'missed' | 'in-progress' | 'pending'

interface StatusBadgeProps {
  variant?: StatusVariant
  label?: string
  size?: 'small' | 'medium'
  sx?: any
}

const STATUS_STYLES = {
  completed: { bg: '#EAFBF5', color: '#087A55' },
  scheduled: { bg: '#EAF3FF', color: '#175CD3' },
  missed: { bg: '#FEF0F0', color: '#B42318' },
  'in-progress': { bg: '#FFF7E6', color: '#9A6700' },
  pending: { bg: '#F2F4F7', color: '#475467' },
}

export function StatusBadge({ variant = 'pending', label, size = 'small', sx }: StatusBadgeProps) {
  const style = STATUS_STYLES[variant]
  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: style.bg,
        color: style.color,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24,
        borderRadius: '8px',
        ...sx,
      }}
    />
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const theme = useTheme()
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  )
}

interface ProgressCardProps {
  value: number
  max: number
  color?: string
  label?: string
}

export function ProgressCard({ value, max, color = METICLE_COLORS.success, label }: ProgressCardProps) {
  const theme = useTheme()
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <PremiumCard noBorder sx={{ p: 3 }}>
      <SectionHeader title={label || 'Progress'} />
      <Stack direction="row" alignItems="center" gap={3}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: `4px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800, color }}>
            {percent}%
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
            {value} of {max}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            completed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={percent}
            sx={{
              mt: 1.5,
              height: 6,
              borderRadius: 3,
              bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F5F7FA',
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
            }}
          />
        </Box>
      </Stack>
    </PremiumCard>
  )
}
