import { Box, Typography, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import InboxIcon from '@mui/icons-material/Inbox'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'search' | 'error'
}

const VARIANT_CONFIG = {
  default: { Icon: InboxIcon, color: '#94A3B8' },
  search: { Icon: SearchOffIcon, color: '#94A3B8' },
  error: { Icon: ErrorOutlineIcon, color: '#EF4444' },
} as const

export function EmptyState({ icon, title, description, action, variant = 'default' }: EmptyStateProps) {
  const theme = useTheme()
  const { Icon: DefaultIcon, color } = VARIANT_CONFIG[variant] || VARIANT_CONFIG.default

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
        animation: 'fadeIn 0.4s ease-out',
        '@keyframes fadeIn': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2.5,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : `${color}12`,
        }}
      >
        {icon || <DefaultIcon sx={{ fontSize: 36, color }} />}
      </Box>

      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: theme.palette.mode === 'dark' ? '#F1F5F9' : '#1E293B',
          mb: 1,
        }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.mode === 'dark' ? '#94A3B8' : '#64748B',
            maxWidth: 360,
            lineHeight: 1.6,
            mb: action ? 3 : 0,
          }}
        >
          {description}
        </Typography>
      )}

      {action && (
        <Button
          variant="contained"
          onClick={action.onClick}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            fontWeight: 600,
            px: 3,
            bgcolor: '#0F4C81',
            '&:hover': { bgcolor: '#0D3D6B' },
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  )
}

export default EmptyState
