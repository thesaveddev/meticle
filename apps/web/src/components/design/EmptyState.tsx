import { Box, Typography, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import InboxIcon from '@mui/icons-material/Inbox'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { METICLE_COLORS } from '../../context/ThemeContext'

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
  default: { Icon: InboxIcon, color: METICLE_COLORS.textMuted },
  search: { Icon: SearchOffIcon, color: METICLE_COLORS.textMuted },
  error: { Icon: ErrorOutlineIcon, color: METICLE_COLORS.danger },
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
        py: 6,
        px: 3,
        textAlign: 'center',
        '@media (max-width: 600px)': { py: 4 },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : variant === 'error' ? '#FEF0F0' : '#F2F4F7',
          color,
        }}
      >
        {icon || <DefaultIcon sx={{ fontSize: 22, color }} />}
      </Box>

      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 1,
        }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            maxWidth: 360,
            lineHeight: 1.6,
            mb: action ? 2.5 : 0,
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
            px: 2,
            bgcolor: 'primary.main',
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  )
}

export default EmptyState
