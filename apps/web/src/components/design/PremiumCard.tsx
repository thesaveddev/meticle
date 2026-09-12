import { Box, BoxProps, Typography, Stack, Chip, LinearProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'

interface PremiumCardProps extends BoxProps {
  noBorder?: boolean
  accentColor?: string
}

export function PremiumCard({ children, noBorder = false, accentColor, sx, ...props }: PremiumCardProps) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        background: theme.palette.background.paper,
        borderRadius: '18px',
        boxShadow: theme.palette.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(26,35,50,0.04)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        overflow: 'hidden',
        border: noBorder ? 'none' : `1px solid ${theme.palette.divider}`,
        ...(accentColor && {
          borderLeft: `4px solid ${accentColor}`,
        }),
        '&:hover': {
          boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(26,35,50,0.06)',
        },
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
  return (
    <PremiumCard
      noBorder
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { transform: 'translateY(-2px)' } : {},
      }}
      onClick={onClick}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            bgcolor: `${color}12`,
            color: color,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          fontWeight: 600,
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
  completed: { bg: '#E9F7F0', color: '#047857' },
  scheduled: { bg: '#E0F2FE', color: '#0369A1' },
  missed: { bg: '#FDECEC', color: '#DC2626' },
  'in-progress': { bg: '#FFF5D9', color: '#D97706' },
  pending: { bg: '#F3F4F6', color: '#6B7280' },
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
        fontWeight: 700,
        fontSize: '0.7rem',
        height: 24,
        borderRadius: '12px',
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
        <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.02em' }}>
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

export function ProgressCard({ value, max, color = '#10B981', label }: ProgressCardProps) {
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
              bgcolor: theme.palette.mode === 'dark' ? '#334155' : '#F1F5F9',
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
            }}
          />
        </Box>
      </Stack>
    </PremiumCard>
  )
}
